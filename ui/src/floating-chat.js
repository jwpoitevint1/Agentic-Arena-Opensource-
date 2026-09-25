import "./floating-chat.css";

const UI_GUIDE_PRIMARY_MODEL = Object.freeze({
  key: "ling_3_0_flash",
  name: "Ling 3.0 Flash",
});
const UI_GUIDE_FAILOVER_MODEL = Object.freeze({
  key: "mistral_small_4",
  name: "Mistral Small 4",
});
const UI_GUIDE_CHAT_TOKENS = 512;
const UI_GUIDE_DOMAINS = [
  [1, "Finance"],
  [2, "Environmental Operations"],
  [3, "Healthcare"],
  [4, "Retail"],
  [5, "Aviation"],
  [6, "Supply Chain / Freight"],
];

const START_MESSAGE =
  "UI Guide ready. Talk with me about CV 1.1, the architecture, any of the six domains, or the governed agentic workflows available in Agentic Arena.";

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
    const error = new Error(message || `Request failed with ${response.status}`);
    error.status = response.status;
    error.code = typeof detail === "object" ? detail?.code || null : null;
    error.failoverEligible = typeof detail === "object" ? detail?.failover_eligible === true : false;
    throw error;
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

function optionMarkup(items) {
  return items
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
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
      <span class="cv-chat-launcher-copy"><strong>UI Guide</strong><small>${escapeHtml(UI_GUIDE_PRIMARY_MODEL.name)} · CV 1.1</small></span>
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
        <label class="cv-chat-model-label">Model<div class="cv-chat-model-fixed" title="UI Guide models are bounded by the CV 1.1 contract">${escapeHtml(UI_GUIDE_PRIMARY_MODEL.name)}</div></label>
        <label>Domain<select class="cv-chat-domain">${optionMarkup(UI_GUIDE_DOMAINS)}</select></label>
      </div>
      <div class="cv-chat-log" aria-live="polite"></div>
      <div class="cv-chat-error" hidden></div>
      <div class="cv-chat-composer">
        <textarea rows="2" maxlength="20000" placeholder="Ask about CV 1.1, the architecture, domains, or governed agentic workflows…"></textarea>
        <button class="cv-chat-send" type="button">Talk</button>
      </div>
      <footer>${escapeHtml(UI_GUIDE_PRIMARY_MODEL.name)} · 6 domains · governed workflow guidance · bounded history · CV 1.1</footer>
    </section>
  `;
  document.body.appendChild(shell);

  const launcher = shell.querySelector(".cv-chat-launcher");
  const minimize = shell.querySelector(".cv-chat-minimize");
  const reset = shell.querySelector(".cv-chat-reset");
  const log = shell.querySelector(".cv-chat-log");
  const textarea = shell.querySelector("textarea");
  const sendButton = shell.querySelector(".cv-chat-send");
  const domainSelect = shell.querySelector(".cv-chat-domain");
  const errorBox = shell.querySelector(".cv-chat-error");
  const modelDisplay = shell.querySelector(".cv-chat-model-fixed");
  const launcherModel = shell.querySelector(".cv-chat-launcher-copy small");
  const footer = shell.querySelector("footer");
  domainSelect.value = "6";

  let primaryModel = UI_GUIDE_PRIMARY_MODEL;
  let failoverModel = UI_GUIDE_FAILOVER_MODEL;
  let activeModel = primaryModel;
  let modelContractLoaded = false;
  let history = [{ role: "assistant", content: START_MESSAGE }];
  let sending = false;
  let circuitBroken = false;

  function selectedDomain() {
    const id = Number(domainSelect.value);
    return {
      id,
      name: UI_GUIDE_DOMAINS.find(([value]) => value === id)?.[1] || "Unknown",
    };
  }

  function updateModelDisplay() {
    modelDisplay.textContent = activeModel.name;
    modelDisplay.title = activeModel.key === primaryModel.key
      ? "Primary UI Guide model"
      : "Automatic failover model";
    launcherModel.textContent = `${activeModel.name} · CV 1.1`;
    footer.textContent = `${activeModel.name} · 6 domains · governed workflow guidance · bounded history · CV 1.1`;
  }

  async function syncModelContract(systemId) {
    if (modelContractLoaded) return;
    const capabilities = await apiRequest(`/api/v1/chatbot/capabilities/${systemId}`);
    const contract = capabilities?.model_contract;
    const primary = contract?.primary;
    const failover = contract?.failover;
    const allowedKeys = Array.isArray(contract?.allowed_keys) ? contract.allowed_keys : [];

    if (
      primary?.key && primary?.name &&
      failover?.key && failover?.name &&
      allowedKeys.includes(primary.key) &&
      allowedKeys.includes(failover.key)
    ) {
      const wasPrimary = activeModel.key === primaryModel.key;
      primaryModel = Object.freeze({ key: primary.key, name: primary.name });
      failoverModel = Object.freeze({ key: failover.key, name: failover.name });
      if (wasPrimary) activeModel = primaryModel;
      updateModelDisplay();
    }
    modelContractLoaded = true;
  }

  function isFailoverEligible(error) {
    if (error?.failoverEligible === true) return true;
    if (String(error?.code || "").startsWith("cv11_")) return false;
    const status = Number(error?.status || 0);
    return [404, 408, 429, 500, 502, 503, 504].includes(status);
  }

  async function requestWithFailover(body) {
    try {
      await syncModelContract(body.system_id);
    } catch {
      // Fall back to the local mirror of the published API/CV1.1 contract.
    }

    try {
      return await apiRequest("/api/v1/chatbot/message", {
        method: "POST",
        body: { ...body, model_key: activeModel.key },
      });
    } catch (error) {
      if (activeModel.key !== primaryModel.key || !isFailoverEligible(error)) throw error;

      activeModel = failoverModel;
      updateModelDisplay();
      history = [...history, {
        role: "assistant",
        content: `Ling 3.0 is unavailable. UI Guide automatically switched to ${activeModel.name}.`,
      }];
      renderHistory();

      return apiRequest("/api/v1/chatbot/message", {
        method: "POST",
        body: { ...body, model_key: activeModel.key },
      });
    }
  }

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
    const blocked = circuitBroken || value || !textarea.value.trim();
    sendButton.disabled = blocked;
    sendButton.textContent = value ? "…" : "Talk";
  }

  function setCircuitBreaker(tripped) {
    circuitBroken = tripped;
    textarea.disabled = tripped;
    domainSelect.disabled = tripped;
    shell.classList.toggle("circuit-broken", tripped);
    if (tripped) {
      textarea.value = "";
      showError("CV 1.1 circuit breaker tripped. Click Reset to re-arm the UI Guide.");
    }
    setSending(false);
  }

  function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || "";
  }

  function resetConversation(message = START_MESSAGE) {
    history = [{ role: "assistant", content: message }];
    setCircuitBreaker(false);
    showError("");
    renderHistory();
  }

  async function submit() {
    const current = textarea.value.trim();
    if (!current || sending || circuitBroken) return;

    const domain = selectedDomain();
    const prior = history.slice(-12);
    showError("");
    history = [...history, { role: "user", content: current }];
    textarea.value = "";
    renderHistory();
    setSending(true);

    const body = {
      operation: "chat",
      system_id: domain.id,
      model_key: activeModel.key,
      message: current,
      history: prior,
      max_tokens: UI_GUIDE_CHAT_TOKENS,
    };

    try {
      const result = await requestWithFailover(body);
      const reply = result.reply || assistantText(result) || "No response returned.";
      history = [...history, { role: "assistant", content: reply }];
      if (result?.chatbot?.reset_required || result?.chatbot?.circuit_breaker) {
        setCircuitBreaker(true);
      }
    } catch (error) {
      if (error?.status === 403) {
        history = [...history, { role: "assistant", content: "CV 1.1 denied the request. Reset the UI Guide before continuing." }];
        setCircuitBreaker(true);
      } else {
        showError(error.message || "The governed UI Guide request did not complete.");
        history = [...history, { role: "assistant", content: "The governed UI Guide request did not complete." }];
      }
    } finally {
      renderHistory();
      setSending(false);
    }
  }

  launcher.addEventListener("click", () => setOpen(true));
  minimize.addEventListener("click", () => setOpen(false));
  reset.addEventListener("click", () => {
    resetConversation();
    textarea.focus();
  });
  domainSelect.addEventListener("change", () => {
    const domain = selectedDomain();
    resetConversation(
      `Domain context switched to ${domain.name}. Ask about the domain, CV 1.1, or any available governed agentic workflow.`
    );
  });
  textarea.addEventListener("input", () => setSending(sending));
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
  sendButton.addEventListener("click", () => submit());

  updateModelDisplay();
  renderHistory();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountFloatingChat, { once: true });
} else {
  mountFloatingChat();
}
