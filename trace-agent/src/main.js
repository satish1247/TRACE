/**
 * TRACE Agent — Editorial Sidebar Interface & Single-Page Shell
 * Persistent shell architecture: layout renders once; routes swap smoothly;
 * all sidebar buttons are fully wired, reactive, and provide real-time tactile feedback.
 */
import "./style.css";
import { seedUsers } from "./lib/agentStore.js";
import { renderAgentPage } from "./pages/agent.js";
import { renderGuardianPage } from "./pages/guardian.js";
import { renderSplitPage } from "./pages/split.js";
import { toggleSound, getSoundStatus, playStepTick } from "./lib/audio.js";
import { initThreeBackground } from "./lib/bg3d.js";

// 1. Initialize interactive 3D OLED background
initThreeBackground();

// 2. Seed initial demo users
seedUsers().catch(console.error);

let isSeniorMode = localStorage.getItem("trace_senior_mode") === "true";
if (isSeniorMode) {
  document.body.classList.add("senior-mode");
}

let currentRoute = "";

/**
 * Mount the persistent shell layout once into #app.
 */
function initShell() {
  const app = document.getElementById("app");
  if (!app) return;

  const soundActive = getSoundStatus();

  app.innerHTML = `
    <div class="app-layout">
      <!-- Left Sidebar (Claude Editorial Style) -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <a href="#agent" class="sidebar-brand" id="brand-link">TRACE</a>
          <span class="status-verified-dot" title="RBI Precaution Shield Active"></span>
        </div>

        <button class="sidebar-new-btn" id="sidebar-btn-new" title="Start a fresh booking or reset">
          <span class="plus-icon">+</span> New Task
        </button>

        <nav class="sidebar-nav">
          <a href="#agent" class="sidebar-nav-item" id="nav-agent">
            Senior Screen
          </a>
          <a href="#guardian" class="sidebar-nav-item" id="nav-guardian">
            Guardian Phone
          </a>
          <a href="#split" class="sidebar-nav-item" id="nav-split">
            Dual View (Demo)
          </a>
        </nav>

        <div class="sidebar-section-title">Scenarios and tasks</div>
        <div class="sidebar-scenarios" id="sidebar-scenarios-list">
          <button class="sidebar-scenario-item" data-task="train_madurai">
            <span class="scenario-indicator"></span>
            Madurai Train (Run A)
          </button>
          <button class="sidebar-scenario-item" data-task="train_delhi">
            <span class="scenario-indicator"></span>
            Delhi Express 2AC (Run B)
          </button>
          <button class="sidebar-scenario-item" data-task="shopping_bp">
            <span class="scenario-indicator"></span>
            Omron BP Monitor (1mg)
          </button>
          <button class="sidebar-scenario-item" data-task="shopping_watch">
            <span class="scenario-indicator"></span>
            Titan Smartwatch
          </button>
          <button class="sidebar-scenario-item" data-task="support_sbi">
            <span class="scenario-indicator"></span>
            SBI Helpline Lookup
          </button>
          <button class="sidebar-scenario-item" data-task="support_irctc">
            <span class="scenario-indicator"></span>
            IRCTC Railway 139
          </button>
          <button class="sidebar-scenario-item" data-task="loan_app_stop">
            <span class="scenario-indicator"></span>
            Loan Check (QuickRupee)
          </button>
        </div>

        <div class="sidebar-footer">
          <div class="sidebar-user-row">
            <span>Lakshmi Devi</span>
            <span class="realtime-dot" title="Live connection"></span>
          </div>
          <div class="sidebar-controls-row">
            <button class="sidebar-mini-btn" id="btn-toggle-sound">
              ${soundActive ? "Audio: On" : "Audio: Muted"}
            </button>
            <button class="sidebar-mini-btn ${isSeniorMode ? "active" : ""}" id="btn-toggle-senior">
              Senior Mode
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Viewport -->
      <main class="main-viewport">
        <div id="page-content"></div>
      </main>
    </div>
  `;

  // ─── Bind Sidebar Navigation Click Events ───────────────────
  const navItems = {
    agent: document.getElementById("nav-agent"),
    guardian: document.getElementById("nav-guardian"),
    split: document.getElementById("nav-split"),
  };

  Object.entries(navItems).forEach(([routeKey, el]) => {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(routeKey, true);
    });
  });

  document.getElementById("brand-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo("agent", true);
  });

  // ─── Bind Sidebar "+ New Task" Button ───────────────────────
  const btnNewTask = document.getElementById("sidebar-btn-new");
  btnNewTask?.addEventListener("click", () => {
    playStepTick();
    clearActiveScenarioHighlight();

    if (currentRoute !== "agent" && currentRoute !== "split") {
      navigateTo("agent");
    }

    // Dispatch reset event so active page immediately returns to idle selection
    window.dispatchEvent(new CustomEvent("trace:reset-task"));
  });

  // ─── Bind Sidebar Scenario Buttons ──────────────────────────
  const scenarioButtons = document.querySelectorAll(".sidebar-scenario-item");
  scenarioButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskKey = btn.dataset.task;
      if (!taskKey) return;

      playStepTick();

      // Highlight active scenario in sidebar
      scenarioButtons.forEach((b) => b.classList.remove("active-scenario"));
      btn.classList.add("active-scenario");

      // If user is on Guardian page, switch to Split or Senior so they see execution
      if (currentRoute === "guardian") {
        navigateTo("split");
      }

      // Small tick to ensure page content DOM is ready
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("trace:run-task", { detail: { taskKey } }));
      }, 50);
    });
  });

  // ─── Bind Audio Toggle Button ───────────────────────────────
  const btnSound = document.getElementById("btn-toggle-sound");
  btnSound?.addEventListener("click", () => {
    const active = toggleSound();
    btnSound.textContent = active ? "Audio: On" : "Audio: Muted";
  });

  // ─── Bind Senior Accessibility Toggle Button ────────────────
  const btnSenior = document.getElementById("btn-toggle-senior");
  btnSenior?.addEventListener("click", () => {
    isSeniorMode = !isSeniorMode;
    document.body.classList.toggle("senior-mode", isSeniorMode);
    localStorage.setItem("trace_senior_mode", isSeniorMode ? "true" : "false");
    btnSenior.classList.toggle("active", isSeniorMode);
  });
}

/**
 * Remove highlighted state from all sidebar scenarios
 */
export function clearActiveScenarioHighlight() {
  document.querySelectorAll(".sidebar-scenario-item").forEach((b) => {
    b.classList.remove("active-scenario");
  });
}

/**
 * Smoothly navigate between views and render into #page-content.
 */
function navigateTo(route, forceRerender = false) {
  const cleanRoute = (route || "agent").replace("#", "");

  if (currentRoute === cleanRoute && !forceRerender) {
    return;
  }

  currentRoute = cleanRoute;
  window.location.hash = `#${cleanRoute}`;

  // Update active state in sidebar nav
  document.querySelectorAll(".sidebar-nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  const activeNav = document.getElementById(`nav-${cleanRoute}`);
  if (activeNav) activeNav.classList.add("active");

  const content = document.getElementById("page-content");
  if (!content) return;

  if (cleanRoute === "guardian") {
    renderGuardianPage(content);
  } else if (cleanRoute === "split") {
    renderSplitPage(content);
  } else {
    renderAgentPage(content);
  }
}

/**
 * Handle initial load and browser back/forward buttons
 */
function handleRoute() {
  const hash = window.location.hash.replace("#", "") || "agent";
  navigateTo(hash);
}

// Initialize on DOM Ready
window.addEventListener("DOMContentLoaded", () => {
  initShell();
  handleRoute();
});

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "") || "agent";
  navigateTo(hash);
});
