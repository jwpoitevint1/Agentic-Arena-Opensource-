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
  { key: "t2_aviation", label: "Aviation Travel Assistant", icon: "10", href: "/aviation-travel-assistant/" },
  { key: "t2_execution", label: "Execution Pass", icon: "11", href: "/execution-pass/" },
];

const LOCKED_SURFACES = new Set(["t2_financial", "t2_logistics", "t2_aviation", "t2_execution"]);

const PROJECT_PAGE_HTML = `
  <div class="notice page-notice" role="status">Agentic Arena is functional. Financial Analyst, Logistics Analyst, Aviation Assistant, and Execution Pass are under development and locked.</div>
  <header class="topbar">
    <div><div class="eyebrow">Personal applied AI project</div><h1>Project Page</h1></div>
  </header>
  <section class="hero project-hero">
    <div class="project-logo-panel"><img src="/agentic-arena-logo.svg" alt="Agentic Arena" /></div>
    <div class="eyebrow">Joshua Poitevint · Agentic Arena</div>
    <p>I'm <strong>Joshua Poitevint</strong>. I spent most of my career around aircraft maintenance and Air Force operations. I led 31 people across six work groups, then moved into operational analysis and automation. That shift was not as sharp as it might sound. Both kinds of work start with finding where a system is breaking, tracing the cause, and building something people can actually use. I later completed an MBA in Project Management.</p>
    <p>Agentic Arena came out of that way of working. I wanted a place to see what AI models do after they leave a clean demonstration and have to operate with actual constraints. In the Arena, a model gets a job, access to specific data, limited tools, and rules it cannot change. Some of the data is intentionally imperfect because real operating data often is.</p>
    <p>This is not a scientific benchmark, and I did not build it to declare a winning model. It is a working engineering project where I can test failures, change the surrounding system, and measure what happens next. The model can generate the response. It does not get to decide its own authority.</p>
    <p><strong>Build disclosure:</strong> I designed Agentic Arena and used Codex as my primary coding tool to implement the application and its supporting architecture.</p>
    <div class="hero-actions">
      <a class="primary" href="/arena/">Open Runtime Testbed</a>
      <a class="secondary" href="/runtime-logbook/">Inspect Runtime Logbook</a>
    </div>
  </section>

  <section class="section grid-3">
    <div class="card"><div class="eyebrow">01 · Assign the work</div><div class="section-title">Give the model a defined job</div><p class="body-copy">Set the function, domain, task, data, tools, and limits before execution.</p></div>
    <div class="card"><div class="eyebrow">02 · Run it</div><div class="section-title">Use real operating conditions</div><p class="body-copy">The model works with fixed permissions and data that may be incomplete, inconsistent, or dirty.</p></div>
    <div class="card"><div class="eyebrow">03 · Inspect the result</div><div class="section-title">Keep the evidence</div><p class="body-copy">Record the output, tool use, latency, tokens, cost, policy decisions, and failures.</p></div>
  </section>

  <section class="section card">
    <div class="eyebrow">Why it exists</div>
    <div class="section-title">AI as a working system, not just a conversation</div>
    <p class="body-copy">Agentic Arena gives models concrete work in analytics, modeling, auditing, verification, and operational assistance. The surrounding system controls what each model can see and do, then records what happened. I use the results to change the system and run it again.</p>
  </section>

  <section class="section grid-3">
    <div class="card"><div class="eyebrow">Runtime Testbed</div><div class="section-title">Run the workload</div><p class="body-copy">Choose the domain, function, model, and task.</p><div class="hero-actions"><a class="primary" href="/arena/">Open Testbed</a></div></div>
    <div class="card"><div class="eyebrow">Runtime Logbook</div><div class="section-title">Inspect the record</div><p class="body-copy">Review recent runs and their operational evidence.</p><div class="hero-actions"><a class="secondary" href="/runtime-logbook/">Open Logbook</a></div></div>
    <div class="card"><div class="eyebrow">Performance</div><div class="section-title">Compare execution</div><p class="body-copy">Review token use, latency, cost, and model behavior.</p><div class="hero-actions"><a class="secondary" href="/enterprise/">Open Performance</a></div></div>
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
