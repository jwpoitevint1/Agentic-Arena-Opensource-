// Agentic Arena UI v2 entrypoint.
// Public navigation includes the shared Arena surfaces and the T2 governed bot interfaces.

const ACTIVE_SURFACES = [
  { key: "overview", label: "Project Page", icon: "01", href: "/project/" },
  { key: "lab", label: "Runtime Testbed", icon: "02", href: "/arena/" },
  { key: "logbook", label: "Runtime Logbook", icon: "03", href: "/runtime-logbook/" },
  { key: "enterprise", label: "Performance", icon: "04", href: "/enterprise/" },
  { key: "holding", label: "Agent Benchmark Testing Suite", icon: "05", href: "/holding/" },
  { key: "t2_coding", label: "Coding Assistant", icon: "06", href: "/coding-assistant/" },
  { key: "t2_medical", label: "Medical Analyst / Assistant", icon: "07", href: "/medical-analyst-assistant/" },
  { key: "t2_financial", label: "Financial Risk Analyst", icon: "08", href: "/financial-risk-analyst/" },
  { key: "t2_logistics", label: "Logistics Management Analyst / Assistant", icon: "09", href: "/logistics-management-assistant/" },
  { key: "t2_aviation", label: "Avia — Aviation Customer Service", icon: "10", href: "/aviation-travel-assistant/" },
  { key: "t2_execution", label: "Execution Pass", icon: "11", href: "/execution-pass/" },
];

const LOCKED_SURFACES = new Set([]);

const PROJECT_PAGE_HTML = `
  <header class="topbar">
    <div><div class="eyebrow">AI agent showcase · Runtime enforcement</div><h1>Project Page</h1></div>
  </header>
  <section class="hero project-hero">
    <div class="project-logo-panel"><img src="/agentic-arena-logo.svg" alt="Agentic Arena" /></div>
    <div class="eyebrow">Joshua Poitevint · Agentic Arena</div>
    <h2>AI agents with defined jobs and runtime enforcement</h2>
    <p><strong>Agentic Arena</strong> showcases AI agents across coding, healthcare, financial risk, logistics, and aviation customer service. Each agent has a defined job, a specific scope of work, and controlled access to the data and capabilities available to it.</p>
    <p>Runtime enforcement combines role-specific instructions with application controls over access, tool execution, validation, and response release. The showcase examines whether agents remain within their assigned roles, respond usefully to legitimate requests, and handle attempts to cross those boundaries.</p>
    <p>The Runtime Testbed also compares governed and ungoverned execution across operational datasets. Run records make model behavior, enforcement outcomes, latency, token usage, and reported cost available for inspection.</p>
    <p><strong>Project creator:</strong> Joshua Poitevint. <strong>Build disclosure:</strong> Codex is the primary coding tool used to implement the application and supporting architecture.</p>
    <div class="hero-actions">
      <a class="secondary" href="/arena/">Open Runtime Testbed</a>
    </div>
  </section>

  <section class="section card">
    <div class="eyebrow">Runtime enforcement</div>
    <div class="section-title">Methods and purpose</div>
    <p class="body-copy">The controls operate at different points in a request. System prompts guide behavior; server-side checks enforce the configured access and execution contracts. Each agent's boundaries are assessed against its assigned job.</p>
  </section>

  <section class="section grid-3">
    <div class="card"><div class="eyebrow">01 · Role and scope</div><div class="section-title">Define the agent's job</div><p class="body-copy">Role-specific system prompts describe the work, conversational behavior, authority limits, and redirection rules. Session bindings associate requests with a domain, role, and function.</p><p class="body-copy"><strong>Purpose:</strong> Keep the agent focused on its assigned work and identify attempts to redefine its role.</p></div>
    <div class="card"><div class="eyebrow">02 · Data and capabilities</div><div class="section-title">Limit access and actions</div><p class="body-copy">Bounded MCP capabilities route permitted operations through the server. Analytics agents use authorized read-only evidence; Avia uses its configured travel capabilities.</p><p class="body-copy"><strong>Purpose:</strong> Restrict source access and tool execution to the capabilities configured for the task.</p></div>
    <div class="card"><div class="eyebrow">03 · Policy and contracts</div><div class="section-title">Check execution requests</div><p class="body-copy">OPA/Rego policies and application contracts check governed requests against configured permissions, argument requirements, and execution limits.</p><p class="body-copy"><strong>Purpose:</strong> Reject operations that fall outside the permitted execution contract.</p></div>
    <div class="card"><div class="eyebrow">04 · Evidence verification</div><div class="section-title">Validate analytical inputs</div><p class="body-copy">Deterministic arithmetic and data-quality checks verify supported aggregates before analytical responses are produced. Output sanitization applies domain-specific identifier controls.</p><p class="body-copy"><strong>Purpose:</strong> Detect inconsistent evidence and restrict sensitive identifiers in released output.</p></div>
    <div class="card"><div class="eyebrow">05 · Failure handling</div><div class="section-title">Redirect, reset, or stop</div><p class="body-copy">Configured boundary handling includes conversational redirection, session resets, circuit breakers, and fail-closed responses when required checks or capabilities are unavailable.</p><p class="body-copy"><strong>Purpose:</strong> Handle violations at the appropriate boundary while preserving supported work where possible.</p></div>
    <div class="card"><div class="eyebrow">06 · Records and evaluation</div><div class="section-title">Inspect observed behavior</div><p class="body-copy">Run records, available traces, telemetry, integrity checks, and governance evaluations support inspection of responses and enforcement outcomes.</p><p class="body-copy"><strong>Purpose:</strong> Make failures traceable and compare behavior and performance across recorded runs.</p></div>
  </section>

  <section class="section card">
    <div class="eyebrow">Testing approach</div>
    <div class="section-title">Role adherence, useful responses, and boundary handling</div>
    <p class="body-copy">Testing includes ordinary job-related requests, role-redefinition attempts, instructions embedded in data, multilingual prompts, and repeated conversational pressure. Synthetic datasets include imperfect records to exercise reconciliation and data-quality checks.</p>
    <p class="body-copy">Role slip is a behavioral contract failure even when unauthorized tool execution is blocked. Results are assessed for both adherence to the assigned job and continued usefulness within that job. Recorded outcomes describe the tested conditions and observed behavior.</p>
  </section>

  <section class="section grid-3">
    <div class="card"><div class="eyebrow">Runtime Testbed</div><div class="section-title">Compare execution paths</div><p class="body-copy">Choose a domain, function, model, and task to inspect governed and ungoverned execution.</p><div class="hero-actions"><a class="primary" href="/arena/">Open Testbed</a></div></div>
    <div class="card"><div class="eyebrow">Runtime Logbook</div><div class="section-title">Review recorded runs</div><p class="body-copy">Inspect available responses, enforcement outcomes, and operational evidence.</p><div class="hero-actions"><a class="secondary" href="/runtime-logbook/">Open Logbook</a></div></div>
    <div class="card"><div class="eyebrow">Performance</div><div class="section-title">Inspect measured performance</div><p class="body-copy">Review recorded latency, token usage, and reported cost across models.</p><div class="hero-actions"><a class="secondary" href="/enterprise/">Open Performance</a></div></div>
  </section>

`;

function normalizePath(pathname = window.location.pathname) {
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function signalRouteChange() {
  window.dispatchEvent(new Event("agentic-arena-route-change"));
}

const originalPushState = window.history.pushState.bind(window.history);
window.history.pushState = (...args) => {
  originalPushState(...args);
  signalRouteChange();
};
const originalReplaceState = window.history.replaceState.bind(window.history);
window.history.replaceState = (...args) => {
  originalReplaceState(...args);
  signalRouteChange();
};

await import("./main.jsx");

function rebuildPublicNavigation() {
  const nav = document.querySelector("nav.nav");
  if (!nav) return;

  const existing = new Map(
    Array.from(nav.querySelectorAll("a.nav-button")).map((node) => {
      const match = Array.from(node.classList).find((name) => name.startsWith("nav-") && name !== "nav-button");
      return [match?.replace("nav-", ""), node];
    }),
  );

  const currentPath = normalizePath();
  const fragment = document.createDocumentFragment();

  ACTIVE_SURFACES.forEach(({ key, label, icon, href }) => {
    let link = existing.get(key);
    if (!link) {
      link = document.createElement("a");
      link.className = `nav-button nav-${key}`;
    }
    link.replaceChildren();
    const locked = LOCKED_SURFACES.has(key);
    if (locked) {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
      link.onclick = (event) => { event.preventDefault(); event.stopPropagation(); };
      link.style.cursor = "not-allowed";
      link.style.opacity = "0.65";
    } else {
      link.href = href;
    }
    link.classList.toggle("active", currentPath === href || (key === "overview" && currentPath === "/"));
    const iconNode = document.createElement("span");
    iconNode.className = "nav-icon";
    iconNode.textContent = icon;
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    if (locked) {
      const status = document.createElement("small");
      status.textContent = "🔒 Under development";
      status.style.display = "block";
      labelNode.appendChild(status);
    }
    link.append(iconNode, labelNode);
    fragment.appendChild(link);
  });

  nav.replaceChildren(fragment);
}

function syncProjectPage() {
  document.documentElement.dataset.agenticArenaUi = "v2";
  rebuildPublicNavigation();

  const shell = document.querySelector(".app-shell");
  const reactMain = shell?.querySelector(":scope > main.main");
  if (!shell || !reactMain) return;

  let projectMain = shell.querySelector(":scope > main.personal-project-page");
  const currentPath = normalizePath();
  const onProjectPage = currentPath === "/" || currentPath === "/project/";

  if (onProjectPage) {
    reactMain.hidden = true;
    if (!projectMain) {
      projectMain = document.createElement("main");
      projectMain.className = "main personal-project-page";
      projectMain.innerHTML = PROJECT_PAGE_HTML;
      shell.appendChild(projectMain);
    }
    projectMain.hidden = false;
  } else {
    reactMain.hidden = false;
    if (projectMain) projectMain.hidden = true;
  }
}

window.addEventListener("agentic-arena-route-change", syncProjectPage);
window.addEventListener("popstate", syncProjectPage);
window.addEventListener("hashchange", syncProjectPage);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncProjectPage, { once: true });
} else {
  syncProjectPage();
}

const reactMain = document.querySelector(".app-shell > main.main");
if (reactMain) {
  syncProjectPage();
} else {
  const observer = new MutationObserver(() => {
    if (!document.querySelector(".app-shell > main.main")) return;
    observer.disconnect();
    syncProjectPage();
  });
  observer.observe(document.getElementById("root"), { childList: true, subtree: true });
}
