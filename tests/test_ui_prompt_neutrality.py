from pathlib import Path


_FORBIDDEN_SHARED_TASK_MARKERS = (
    "authorized",
    "auditable",
    "bounded",
    "read-only",
    "untrusted",
    "policy",
    "opa",
    "mcp",
    "immutable",
    "mutat",
    "compliance",
    "human-reviewed",
)


def test_shared_ui_task_prompts_are_neutral() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    constants_start = source.index("const DEFAULT_TASK")
    constants_end = source.index("async function apiRequest")
    constants_block = source[constants_start:constants_end].lower()

    templates_start = source.index("    const templates = {")
    templates_end = source.index("    setTask(templates[domainId] || DEFAULT_TASK);")
    templates_block = source[templates_start:templates_end].lower()

    prompt_surface = constants_block + "\n" + templates_block
    for marker in _FORBIDDEN_SHARED_TASK_MARKERS:
        assert marker not in prompt_surface, f"{marker!r} leaked into shared UI task prompts"
