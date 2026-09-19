import "./floating-chat.css";

const DOMAINS = [
  [1, "Finance"],
  [2, "Environmental Operations"],
  [3, "Healthcare"],
  [4, "Retail"],
  [5, "Aviation"],
  [6, "Supply Chain / Freight"],
];

const UI_GUIDE_MODEL_KEY = "ling_3_0_flash_vl_free";
const UI_GUIDE_MODEL_NAME = "Ling 3.0 Flash VL";
const START_MESSAGE = "UI Guide ready. Ask about CV 1.1, the control architecture, the Arena interface, or governed workflows.";

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    method: options.method || "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  let payload = text;
  try { payload = text ? JSON.parse(text) : {}; } catch { /* preserve text */ }
  if (!response.ok) {
    const detail = typeof payload === "object" && payload?.detail ? payload.detail : payload;
    const message = typeof detail === "string" ? detail : detail?.message || JSON.stringify(detail);
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return payload;
}

function assistantText(payload) {
  if (!payload) return "";
  if (typeof payload.reply === "string") return payload.reply;
  const content = payload?.result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => item?.text || "").filter(Boolean).join("\n");
  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mountFloatingChat() {
  if (document.getElementById("cv-floating-chat")) return;
  if (window.location.hash === "#chat") window.location.hash = "#overview";

  const shell = document.createElement("div");
  shell.id = "cv-floating-chat";
  shell.className = "cv-chat collapsed";
  shell.innerHTML = `
    <button class="cv-chat-launcher" type="button" aria-label="Open UI Guide" aria-expanded="false">
      <span class="cv-chat-launcher-mark">UI</span>
      <span class="cv-chat-launcher-copy"><strong>UI Guide</strong><small>${escapeHtml(UI_GUIDE_MODEL_NAME)} · CV 1.1</small></span>
    </button>
    <section class="cv-chat-panel" aria-label="UI Guide">
      <header class="cv-chat-header">
        <div>
          <strong>UI Guide</strong>
          <span><i></i> CV 1.1 governed runtime</span>
        </div>
        <div class="cv-chat-header-actions">
          <button class="cv-chat-reset" type="button" title="Reset conversation">Reset</button>
          <button class="cv-chat-minimize" type="button" aria-label="Minimize UI Guide">−</button>
        </div>
      </header>
      <div class="cv-chat-settings">
        <label>Domain<select class="cv-chat-domain"></select></label>
        <label>Model<div class="cv-chat-model-fixed" title="UI Guide model is fixed by policy">${escapeHtml(UI_GUIDE_MODEL_NAME)}</div></label>
      </div>
      <div class="cv-chat-log" aria-live="polite"></div>
      <div class="cv-chat-error" hidden></div>
      <div class="cv-chat-composer">
        <textarea rows="2" maxlength="20000" placeholder="Ask UI Guide about CV 1.1, controls, architecture, or governed workflows…"></textarea>
        <button class="cv-chat-send" type="button">Send</button>
      </div>
      <footer>${escapeHtml(UI_GUIDE_MODEL_NAME)} · bounded history · 512-token response ceiling · CV 1.1 governed</footer>
    </section>
  `;
  document.body.appendChild(shell);

  const launcher = shell.querySelector(".cv-chat-launcher");
  const minimize = shell.querySelector(".cv-chat-minimize");
  const reset = shell.querySelector(".cv-chat-reset");
  const log = shell.querySelector(".cv-chat-log");
  const textarea = shell.querySelector("textarea");
  const sendButton = shell.querySelector(".cv-chat-send");
  const errorBox = shell.querySelector(".cv-chat-error");
  const domainSelect = shell.querySelector(".cv-chat-domain");

  DOMAINS.forEach(([id, name]) => domainSelect.insertAdjacentHTML(
    "beforeend",
    `<option value="${id}"${id === 6 ? " selected" : ""}>${escapeHtml(name)}</option>`,
  ));

  let history = [{ role: "assistant", content: START_MESSAGE }];
  let sending = false;

  function renderHistory() {
    log.innerHTML = history.map((item) => `
      <div class="cv-chat-message ${item.role}">
        <span>${item.role === "assistant" ? "UI Guide" : "You"}</span>
        <div>${escapeHtml(item.content)}</div>
      </div>
    `).join("");
    log.scrollTop = log.scrollHeight;
  }

  function setOpen(open) {
    shell.classList.toggle("collapsed", !open);
    shell.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) window.setTimeout(() => textarea.focus(), 120);
  }

  function setSending(value) {
    sending = value;
    sendButton.disabled = value || !textarea.value.trim();
    sendButton.textContent = value ? "…" : "Send";
  }

  function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || "";
  }

  async function send() {
    const current = textarea.value.trim();
    if (!current || sending) return;
    showError("");
    const prior = history.slice(-12);
    history = [...history, { role: "user", content: current }];
    textarea.value = "";
    renderHistory();
    setSending(true);
    try {
      const result = await apiRequest("/api/v1/chatbot/message", {
        method: "POST",
        body: {
          operation: "chat",
          system_id: Number(domainSelect.value),
          model_key: UI_GUIDE_MODEL_KEY,
          message: current,
          history: prior,
          max_tokens: 512,
        },
      });
      history = [...history, {
        role: "assistant",
        content: result.reply || assistantText(result) || "No response returned.",
      }];
    } catch (error) {
      showError(error.message || "The governed UI Guide request did not complete.");
      history = [...history, { role: "assistant", content: "The governed UI Guide request did not complete." }];
    } finally {
      renderHistory();
      setSending(false);
    }
  }

  launcher.addEventListener("click", () => setOpen(true));
  minimize.addEventListener("click", () => setOpen(false));
  reset.addEventListener("click", () => {
    history = [{ role: "assistant", content: START_MESSAGE }];
    showError("");
    renderHistory();
  });
  textarea.addEventListener("input", () => setSending(sending));
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });
  sendButton.addEventListener("click", send);

  renderHistory();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountFloatingChat, { once: true });
} else {
  mountFloatingChat();
}
