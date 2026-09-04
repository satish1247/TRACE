/**
 * Agent Page — the senior's screen.
 * Voice search, limit slider, real-time verified execution HUD,
 * domain threat inspector, digital receipt, and sidebar scenario reactivity.
 * Fully scoped to `container` so it functions seamlessly both standalone and inside Split View.
 */
import {
  getUser,
  subscribeUser,
  createTask,
  addStep,
  updateTaskStatus,
  setTaskPrice,
  payTask,
  subscribeTask,
  resetDemoBalance,
} from "../lib/agentStore.js";
import { buildSteps, getTaskInfo, findTaskByQuery, CATALOGUE } from "../lib/engine.js";
import { playStepTick, playAlertChime, playSuccessChime } from "../lib/audio.js";
import { clearActiveScenarioHighlight } from "../main.js";

const UID = "lakshmi";
let unsubUser = null;
let unsubTask = null;
let currentTaskId = null;
let isRunning = false;
let runToken = 0;

export function renderAgentPage(container) {
  // Clean up previous subscriptions
  if (unsubUser) unsubUser();
  if (unsubTask) unsubTask();
  currentTaskId = null;
  isRunning = false;
  runToken++;

  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <h1>Precaution Agent</h1>
        <p>Your protective AI booking companion. Speak or type in plain English — I only visit verified official sites and strictly enforce your spending limit.</p>
      </div>

      <!-- User Profile & Balance -->
      <div class="user-bar" id="user-bar">
        <div class="user-info">
          <div class="user-name">
            <span class="user-name-text" id="user-name">Lakshmi Devi</span>
            <span class="badge-guardian-shield">Protected by Priya</span>
          </div>
          <div class="user-balance">
            Balance: <strong class="user-balance-val" id="user-balance">₹12,000</strong> · Limit: <strong class="user-limit-val" id="user-limit-display">₹2,000</strong>
          </div>
        </div>
        <div class="user-bar-actions">
          <button class="btn-mini-reset" id="btn-reset-balance" title="Reset balance to ₹12,000 for demo">Reset ₹12k</button>
          <div class="realtime-dot" title="Live Firebase & local sync"></div>
        </div>
      </div>

      <!-- Voice & Natural Language Search -->
      <div class="voice-search-card">
        <div class="voice-search-box">
          <button class="btn-mic" id="btn-mic" title="Click to speak (Simulated Speech-to-Text)">Speak</button>
          <input 
            type="text" 
            class="voice-search-input" 
            id="voice-input" 
            placeholder="Tell me what you need (e.g. 'Book Madurai train' or 'Buy BP monitor' or 'SBI care')…" 
          />
          <button class="btn-ask-agent" id="btn-ask">Ask Agent</button>
        </div>
        <div class="voice-wave-container hidden" id="voice-wave">
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <span style="font-size: 11px; color: var(--accent-bright); margin-left: 6px;">Listening to speech…</span>
        </div>
      </div>

      <!-- Category Filter Chips -->
      <div class="category-chips" id="category-chips">
        <button class="chip-btn active" data-cat="all">All Categories</button>
        <button class="chip-btn" data-cat="train">Trains (PRD A1-A6)</button>
        <button class="chip-btn" data-cat="shopping">Shopping (PRD A7)</button>
        <button class="chip-btn" data-cat="support">Helpline Shield (PRD A8)</button>
        <button class="chip-btn" data-cat="loan_check">Risk Check (PRD A9)</button>
      </div>

      <!-- Idle Section (Scenario Cards & Limit Control) -->
      <div id="agent-idle" class="agent-idle-view">
        <div class="card">
          <div class="card-title">
            Select a scenario to test:
          </div>

          <div class="quick-select" id="quick-select-grid">
            <!-- Run A -->
            <button class="quick-btn" data-task="train_madurai" data-cat="train">
              <span class="label">Run A: Madurai Train</span>
              <span class="sublabel">IRCTC Sleeper · ₹1,240</span>
              <span class="tag under">Within Limit · Auto-Pay</span>
            </button>

            <!-- Run B -->
            <button class="quick-btn" data-task="train_delhi" data-cat="train">
              <span class="label">Run B: Delhi Express 2AC</span>
              <span class="sublabel">IRCTC 2AC · ₹4,600</span>
              <span class="tag over">Over Limit · Guardian Asked</span>
            </button>

            <!-- Shopping PRD A7 Under Limit -->
            <button class="quick-btn" data-task="shopping_bp" data-cat="shopping">
              <span class="label">Omron BP Monitor</span>
              <span class="sublabel">Tata 1mg Store · ₹1,850</span>
              <span class="tag under">PRD A7 · Verified Store</span>
            </button>

            <!-- Shopping PRD A7 Over Limit -->
            <button class="quick-btn" data-task="shopping_watch" data-cat="shopping">
              <span class="label">Titan Smartwatch</span>
              <span class="sublabel">Titan Brand Store · ₹5,490</span>
              <span class="tag over">PRD A7 · Needs Approval</span>
            </button>

            <!-- Support Helpline PRD A8 -->
            <button class="quick-btn" data-task="support_sbi" data-cat="support">
              <span class="label">SBI Helpline Lookup</span>
              <span class="sublabel">Toll-Free 1800-11-2211</span>
              <span class="tag shield">PRD A8 · Ad Scam Shield</span>
            </button>

            <!-- Support IRCTC PRD A8 -->
            <button class="quick-btn" data-task="support_irctc" data-cat="support">
              <span class="label">IRCTC Railway Care</span>
              <span class="sublabel">Dial 139 (24x7 Helpline)</span>
              <span class="tag shield">PRD A8 · Official Channel</span>
            </button>

            <!-- Loan Check PRD A9 -->
            <button class="quick-btn" data-task="loan_app_stop" data-cat="loan_check" style="grid-column: 1 / -1;">
              <span class="label">Loan App Checkpoint: QuickRupee</span>
              <span class="sublabel">Attempt ₹8,500 repayment to predatory unregistered lender</span>
              <span class="tag danger">PRD A9 · Coercive Harassment Intercept</span>
            </button>
          </div>
        </div>

        <!-- Spending Limit Control -->
        <div class="limit-control mt-16">
          <span class="limit-label">My Spending Limit</span>
          <input type="range" class="limit-slider" id="limit-slider" min="500" max="10000" step="100" value="2000" />
          <span class="limit-value" id="limit-value">₹2,000</span>
        </div>
      </div>

      <!-- Active Section (Live Execution HUD) -->
      <div id="agent-active" class="agent-active-view hidden">
        <div class="card">
          <div class="card-title">
            Agent Execution HUD
            <span id="task-status" class="status-badge searching" style="margin-left: auto;">scanning</span>
          </div>

          <!-- Domain Threat & Phishing Inspector -->
          <div id="domain-inspector-area"></div>

          <!-- Step by Step Progress Log -->
          <ul class="step-log" id="step-log"></ul>
        </div>

        <div id="result-area" class="mt-16"></div>
        <div class="text-center">
          <button class="btn-reset" id="btn-new-task">← Run another scenario</button>
        </div>
      </div>
    </div>
  `;

  // ─── Scoped Elements ───────────────────────────────────────
  const limitSlider = container.querySelector("#limit-slider");
  const limitValue = container.querySelector("#limit-value");
  const idleSection = container.querySelector("#agent-idle");
  const activeSection = container.querySelector("#agent-active");
  const stepLog = container.querySelector("#step-log");
  const taskStatusBadge = container.querySelector("#task-status");
  const resultArea = container.querySelector("#result-area");
  const btnNewTask = container.querySelector("#btn-new-task");
  const btnResetBalance = container.querySelector("#btn-reset-balance");
  const voiceInput = container.querySelector("#voice-input");
  const btnMic = container.querySelector("#btn-mic");
  const btnAsk = container.querySelector("#btn-ask");
  const voiceWave = container.querySelector("#voice-wave");
  const inspectorArea = container.querySelector("#domain-inspector-area");
  const userLimitDisp = container.querySelector("#user-limit-display");

  // ─── Limit Slider Update ───────────────────────────────────
  function updateSlider() {
    if (!limitSlider || !limitValue) return;
    const val = parseInt(limitSlider.value);
    limitValue.textContent = `₹${val.toLocaleString("en-IN")}`;
    const pct = ((val - 500) / (10000 - 500)) * 100;
    limitSlider.style.setProperty("--pct", `${pct}%`);
    if (userLimitDisp) userLimitDisp.textContent = `₹${val.toLocaleString("en-IN")}`;
  }
  limitSlider?.addEventListener("input", updateSlider);
  updateSlider();

  // ─── Subscribe to User Profile ──────────────────────────────
  unsubUser = subscribeUser(UID, (user) => {
    if (!user) return;
    const nameEl = container.querySelector("#user-name");
    const balEl = container.querySelector("#user-balance");
    if (nameEl) nameEl.textContent = user.name;
    if (balEl) balEl.textContent = `₹${(user.balance || 0).toLocaleString("en-IN")}`;

    // Sync limit if changed remotely by Guardian
    if (limitSlider && user.agentLimit && parseInt(limitSlider.value) !== user.agentLimit) {
      limitSlider.value = user.agentLimit;
      updateSlider();
    }
  });

  // ─── Reset Balance for Demo ─────────────────────────────────
  btnResetBalance?.addEventListener("click", async () => {
    playStepTick();
    await resetDemoBalance(UID);
  });

  // ─── Category Filtering ────────────────────────────────────
  container.querySelectorAll(".chip-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      playStepTick();
      container.querySelectorAll(".chip-btn").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const category = chip.dataset.cat;
      container.querySelectorAll(".quick-btn").forEach((btn) => {
        if (category === "all" || btn.dataset.cat === category) {
          btn.style.display = "block";
        } else {
          btn.style.display = "none";
        }
      });
    });
  });

  // ─── Voice Input Simulator ─────────────────────────────────
  let isListening = false;
  const samplePrompts = [
    "Book the Madurai train on the 12th",
    "Book the Delhi train, 2AC",
    "Buy Omron BP monitor on Tata 1mg",
    "Buy Titan smartwatch",
    "Look up SBI customer care helpline",
    "Call IRCTC railway customer support",
    "Repay loan of 8500 on QuickRupee app",
  ];
  let promptIdx = 0;

  btnMic?.addEventListener("click", () => {
    if (isListening) return;
    isListening = true;
    playStepTick();
    btnMic.textContent = "…";
    voiceWave?.classList.remove("hidden");

    setTimeout(() => {
      voiceInput.value = samplePrompts[promptIdx % samplePrompts.length];
      promptIdx++;
      btnMic.textContent = "Speak";
      voiceWave?.classList.add("hidden");
      isListening = false;
    }, 1100);
  });

  btnAsk?.addEventListener("click", () => {
    const text = (voiceInput?.value || "").trim();
    if (!text) return;
    const taskKey = findTaskByQuery(text);
    if (taskKey) {
      const limit = parseInt(limitSlider.value);
      runTask(taskKey, limit);
    } else {
      alert(`No scenario matching "${text}". Try "Madurai train", "BP monitor", "SBI helpline", etc.`);
    }
  });

  voiceInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnAsk?.click();
  });

  // ─── Quick Select Buttons ──────────────────────────────────
  container.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      playStepTick();
      const taskKey = btn.dataset.task;
      const limit = parseInt(limitSlider.value);
      runTask(taskKey, limit);
    });
  });

  // ─── Reset / New Task Handler ──────────────────────────────
  function resetToIdle() {
    if (unsubTask) unsubTask();
    currentTaskId = null;
    isRunning = false;
    runToken++;

    idleSection?.classList.remove("hidden");
    activeSection?.classList.add("hidden");
    if (stepLog) stepLog.innerHTML = "";
    if (resultArea) {
      resultArea.innerHTML = "";
      delete resultArea.dataset.shown;
    }
    if (inspectorArea) inspectorArea.innerHTML = "";
    if (voiceInput) voiceInput.value = "";
    clearActiveScenarioHighlight();
  }

  btnNewTask?.addEventListener("click", () => {
    playStepTick();
    resetToIdle();
  });

  // ─── Global Reset Event Listener ───────────────────────────
  const onResetTask = () => {
    resetToIdle();
  };
  window.addEventListener("trace:reset-task", onResetTask);

  // ─── Listen for Sidebar Scenario Clicks ────────────────────
  const onSidebarTask = (e) => {
    const taskKey = e.detail?.taskKey;
    if (taskKey) {
      const limit = parseInt(limitSlider?.value || "2000");
      runTask(taskKey, limit);
    }
  };
  window.addEventListener("trace:run-task", onSidebarTask);

  // ─── Run Task Function ─────────────────────────────────────
  async function runTask(taskKey, limit) {
    const thisToken = ++runToken;
    isRunning = true;
    const taskInfo = getTaskInfo(taskKey);
    if (!taskInfo) return;

    idleSection?.classList.add("hidden");
    activeSection?.classList.remove("hidden");
    if (stepLog) stepLog.innerHTML = "";
    if (resultArea) {
      resultArea.innerHTML = "";
      delete resultArea.dataset.shown;
    }
    if (inspectorArea) inspectorArea.innerHTML = "";

    // Show initial domain inspection badge
    renderDomainInspector(inspectorArea, taskInfo);

    // Create task in reactive store (instant memory + background Firestore)
    const taskId = await createTask({
      uid: UID,
      request: taskInfo.request || taskInfo.item,
      limit,
      category: taskInfo.category,
      merchant: taskInfo.merchant,
      officialSite: taskInfo.officialSite,
      reference: taskInfo.reference,
      isPredatoryLoan: !!taskInfo.isPredatoryLoan,
    });

    if (thisToken !== runToken) return; // User aborted or picked another scenario
    currentTaskId = taskId;

    // Realtime subscription for task state updates
    if (unsubTask) unsubTask();
    unsubTask = subscribeTask(taskId, (task) => {
      if (!task || thisToken !== runToken) return;
      updateStatusBadge(taskStatusBadge, task.status);

      if (task.status === "paid" && resultArea.dataset.shown !== "paid") {
        resultArea.dataset.shown = "paid";
        playSuccessChime();
        if (taskInfo.isHelpline) {
          showHelplineCard(resultArea, taskInfo);
        } else {
          showReceipt(resultArea, task, taskInfo);
        }
      } else if (task.status === "declined" && resultArea.dataset.shown !== "declined") {
        resultArea.dataset.shown = "declined";
        playAlertChime();
        if (taskInfo.isPredatoryLoan) {
          showLoanBlockedAlert(resultArea, taskInfo);
        } else {
          showDeclined(resultArea, task);
        }
      } else if (task.status === "awaiting_approval" && resultArea.dataset.shown !== "awaiting") {
        resultArea.dataset.shown = "awaiting";
        playAlertChime();
        showAwaiting(resultArea, task);
      }
    });

    // Animate the pipeline steps with audio feedback
    const steps = buildSteps(taskKey, limit);
    for (let i = 0; i < steps.length; i++) {
      if (thisToken !== runToken) return; // cancelled
      const step = steps[i];
      await delay(step.delayMs);
      if (thisToken !== runToken) return;

      playStepTick();
      await addStep(taskId, step.text);
      appendStepUI(stepLog, step.text, step.isBlockedLoan);
      await updateTaskStatus(taskId, step.statusAfter);

      if (step.statusAfter === "filling" && i >= 2) {
        await setTaskPrice(taskId, taskInfo.price);
      }
    }

    if (thisToken !== runToken) return;

    // Final outcome transitions
    const lastStep = steps[steps.length - 1];
    if (taskInfo.isPredatoryLoan) {
      await updateTaskStatus(taskId, "declined");
    } else if (taskInfo.isHelpline) {
      await updateTaskStatus(taskId, "paid");
    } else if (lastStep.statusAfter === "paid") {
      await payTask(taskId, false);
    } else if (lastStep.statusAfter === "awaiting_approval") {
      await updateTaskStatus(taskId, "awaiting_approval", {
        approverUid: "guardian_priya",
      });
    }

    isRunning = false;
  }
}

// ─── UI Helpers ──────────────────────────────────────────────
function appendStepUI(container, text, isAlert = false) {
  if (!container) return;
  const li = document.createElement("li");
  li.className = "step-item";
  if (isAlert) li.style.borderColor = "var(--danger)";

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  li.innerHTML = `
    <div class="step-dot" style="${
      isAlert ? "background: var(--danger); box-shadow: 0 0 10px var(--danger-glow);" : ""
    }"></div>
    <div class="step-text">${text}</div>
    <div class="step-time">${timeStr}</div>
  `;
  container.appendChild(li);
  li.scrollIntoView({ behavior: "smooth", block: "end" });
}

function updateStatusBadge(badge, status) {
  if (!badge) return;
  badge.className = `status-badge ${status}`;
  const labels = {
    searching: "Scanning Domain",
    filling: "Form Automation",
    awaiting_approval: "Awaiting Approval",
    paid: "Verified & Paid",
    declined: "Payment Blocked",
  };
  badge.textContent = labels[status] || status;
}

function renderDomainInspector(container, taskInfo) {
  if (!container) return;
  const fakes = taskInfo.fakeSitesIgnored || [];
  const fakeHTML = fakes
    .map((f) => {
      const domain = typeof f === "string" ? f : f.domain;
      const threat = typeof f === "object" ? f.threat : "Look-alike Fake";
      return `
        <div class="blocked-domain-item">
          <span class="blocked-domain-name">${domain}</span>
          <span class="threat-reason-pill">${threat}</span>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="domain-inspector-card">
      <div class="inspector-header">
        <span class="inspector-title">Domain Threat & Phishing Protection</span>
        <span class="inspector-badge">SSL Verified</span>
      </div>
      <div class="verified-domain-row">
        <span class="verified-label">Target Official Site:</span>
        <span class="verified-site-url">${taskInfo.officialSite || "Verified Government Channel"}</span>
        <span class="shield-check">PASS</span>
      </div>
      ${
        fakes.length > 0
          ? `
        <div class="blocked-fakes-section">
          <div class="blocked-fakes-title">Ad-Spoofed / Phishing Domains Blocked:</div>
          <div class="blocked-domains-list">
            ${fakeHTML}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function showReceipt(container, task, taskInfo) {
  if (!container) return;
  const txId = "TXN-" + Math.floor(10000000 + Math.random() * 90000000);
  const now = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  container.innerHTML = `
    <div class="receipt-card">
      <div class="receipt-header">
        <div>
          <div class="receipt-title">Verified Digital Receipt</div>
          <div class="receipt-subtitle">${now} · Safe Channel Verified</div>
        </div>
        <div class="receipt-badge">PAID</div>
      </div>

      <div class="receipt-row">
        <span class="label">Item / Service</span>
        <span class="value">${task.request}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Merchant / Entity</span>
        <span class="value">${task.merchant || taskInfo.merchant || "Authorized Provider"}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Official Domain</span>
        <span class="value" style="color: var(--success);">${task.officialSite || taskInfo.officialSite || "irctc.co.in"}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Reference / Seat</span>
        <span class="value">${taskInfo.reference || "CONFIRMED"}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Amount Paid</span>
        <span class="value price">₹${(task.price || taskInfo.price).toLocaleString("en-IN")}</span>
      </div>
      <div class="receipt-row">
        <span class="label">Transaction Reference</span>
        <span class="value mono" style="font-size: 11px;">${txId}</span>
      </div>

      <div class="receipt-actions">
        <button class="btn-receipt" onclick="window.print()">Print Receipt</button>
        <button class="btn-receipt" id="btn-copy-tx">Copy Reference</button>
      </div>
    </div>
  `;

  container.querySelector("#btn-copy-tx")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(txId);
    alert("Transaction Reference copied: " + txId);
  });
}

function showHelplineCard(container, taskInfo) {
  if (!container) return;
  container.innerHTML = `
    <div class="helpline-card">
      <div style="margin-bottom: 8px;">
        <div style="font-size: 18px; font-weight: 800; color: #22d3ee;">Official Verified Helpline</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${taskInfo.merchant}</div>
      </div>

      <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;">
        The agent intercepted your inquiry and extracted the authentic telephone number directly from government databases, protecting you from fraudulent search engine ads.
      </p>

      <div class="helpline-phone-box">
        <div>
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Toll-Free Number</div>
          <div class="helpline-number">${taskInfo.verifiedPhone}</div>
        </div>
        <a href="tel:${taskInfo.verifiedPhone}" class="btn-dial">Tap to Call</a>
      </div>

      <div style="font-size: 11.5px; color: var(--warning); background: rgba(245,158,11,0.1); padding: 8px 12px; border-radius: var(--radius-sm);">
        <strong>Senior Safety Tip:</strong> Never call numbers found directly in Google search ads. Always use the TRACE verified registry.
      </div>
    </div>
  `;
}

function showLoanBlockedAlert(container, taskInfo) {
  if (!container) return;
  container.innerHTML = `
    <div class="loan-alert-card">
      <div class="loan-alert-header">
        <div>
          <div class="loan-alert-title">Predatory Loan Harassment Intercepted</div>
          <div class="rbi-badge">RBI UNREGISTERED LENDER BLACKLIST #9421</div>
        </div>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #fecaca; margin-bottom: 14px;">
        Payment to <strong>"${taskInfo.item}"</strong> was <strong>BLOCKED PERMANENTLY</strong>. This app is not registered with the Reserve Bank of India and is identified as an illegal extortion ring.
      </p>

      <div style="background: rgba(0,0,0,0.4); border-radius: var(--radius-sm); padding: 12px; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 16px;">
        <div><strong>Protection active:</strong> ₹0 deducted from your bank balance.</div>
        <div style="margin-top: 4px;"><strong>Guardian Alert:</strong> Priya has been notified of this harassment attempt.</div>
        <div style="margin-top: 4px;"><strong>Report Reference:</strong> National Cyber Crime Portal case token generated.</div>
      </div>
    </div>
  `;
}

function showAwaiting(container, task) {
  if (!container) return;
  container.innerHTML = `
    <div class="awaiting-card">
      <div class="title">Awaiting Guardian Approval</div>
      <div class="detail"><strong style="color: white; font-size: 17px;">${task.request}</strong></div>
      <div class="detail" style="margin-top: 6px;">
        Price <strong style="color: var(--danger);">₹${task.price.toLocaleString("en-IN")}</strong> exceeds your limit of <strong>₹${task.limit.toLocaleString("en-IN")}</strong>
      </div>
      <div class="detail" style="margin-top: 14px;">
        <span class="realtime-dot"></span>
        Waiting for <strong>Priya (Daughter)</strong> to approve on her phone…
      </div>
      <div class="detail" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
        Switch to the <strong>Guardian</strong> tab or open <strong>Dual View</strong> to approve.
      </div>
    </div>
  `;
}

function showDeclined(container, task) {
  if (!container) return;
  container.innerHTML = `
    <div class="declined-card" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-lg); padding: 24px; text-align: center;">
      <div class="title" style="font-size: 18px; font-weight: 800; color: #f87171;">Guardian Declined Request</div>
      <div class="detail" style="margin-top: 6px;"><strong>${task.request}</strong></div>
      <div class="detail" style="margin-top: 6px; color: var(--text-secondary);">
        No payment was made. Your balance is completely untouched.
      </div>
    </div>
  `;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
