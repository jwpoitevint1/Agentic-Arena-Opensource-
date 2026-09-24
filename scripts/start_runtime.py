import os
import signal
import subprocess
import sys
import time
from typing import Sequence


_children: list[subprocess.Popen[bytes]] = []
_stopping = False


def _terminate_all() -> None:
    global _stopping
    if _stopping:
        return
    _stopping = True

    for process in _children:
        if process.poll() is None:
            process.terminate()

    deadline = time.monotonic() + 10.0
    for process in _children:
        remaining = max(0.0, deadline - time.monotonic())
        if process.poll() is None:
            try:
                process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                process.kill()

    for process in _children:
        if process.poll() is None:
            process.wait(timeout=2)


def _handle_signal(signum: int, _frame: object) -> None:
    _terminate_all()
    raise SystemExit(128 + signum)


def _spawn(command: Sequence[str]) -> subprocess.Popen[bytes]:
    process = subprocess.Popen(list(command))
    _children.append(process)
    return process


def main() -> int:
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, _handle_signal)

    opa_binary = os.getenv("OPA_BINARY", "opa")
    opa_policy_path = os.getenv("OPA_POLICY_PATH", "/app/policies")
    opa = _spawn(
        [
            opa_binary,
            "run",
            "--server",
            "--addr=127.0.0.1:8181",
            "--skip-version-check",
            opa_policy_path,
        ]
    )

    uvicorn = _spawn(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            os.getenv("HOST", "0.0.0.0"),
            "--port",
            os.getenv("PORT", "8000"),
            "--log-level",
            os.getenv("LOG_LEVEL", "info").lower(),
        ]
    )

    try:
        while True:
            opa_code = opa.poll()
            api_code = uvicorn.poll()
            if opa_code is not None or api_code is not None:
                failed = "OPA" if opa_code is not None else "API"
                code = opa_code if opa_code is not None else api_code
                print(
                    f"runtime_child_exited component={failed} exit_code={code}",
                    file=sys.stderr,
                    flush=True,
                )
                _terminate_all()
                return int(code or 1)
            time.sleep(0.5)
    finally:
        _terminate_all()


if __name__ == "__main__":
    raise SystemExit(main())
