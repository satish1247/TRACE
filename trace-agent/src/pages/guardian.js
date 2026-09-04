/**
 * Guardian Page — the daughter's approve / decline dashboard & remote safety controls.
 * Shows all agentTasks in real-time via onSnapshot, remote limit adjustments, and emergency freeze.
 * Fully scoped to `container` so it works seamlessly standalone and inside Split View.
 */
import {
  subscribeGuardianTasks,
  approveTask,
  declineTask,
  subscribeUser,
  updateUserLimit,
  toggleUserFreeze,
} from "../lib/agentStore.js";
import { playAlertChime, playSuccessChime, playStepTick } from "../lib/audio.js";

const SENIOR_UID = "lakshmi";
let unsubTasks = null;
let unsubSenior = null;
let previousPendingCount = 0;

export function renderGuardianPage(container) {
  if (unsubTasks) unsubTasks();
  if (unsubSenior) unsubSenior();

  container.innerHTML = `
    <div class="page">
      <!-- Guardian Header -->
      <div class="guardian-header">
        <div class="guardian-info">
          <h2>Guardian Command Center</h2>
          <p>Supervising Amma (Lakshmi Devi) · <span class="realtime-dot"></span> Live Link</p>
        </div>
      </div>

      <!-- Remote Safety Controls for Guardian -->
      <div class="guardian-controls-panel">
        <!-- Remote Limit Slider -->
        <div class="guardian-control-card">
          <div class="guardian-control-title">Amma's Spending Limit</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 13px; color: var(--text-secondary);">Auto-approve under:</span>
            <strong id="guardian-limit-val" style="color: var(--accent-bright); font-size: 17px;">₹2,000</strong>
          </div>
          <input 
            type="range" 
            class="limit-slider" 
            id="guardian-limit-slider" 
            min="500" 
            max="10000" 
            step="100" 
            value="2000" 
            style="width: 100%;"
          />
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            Changes sync to Amma's screen instantly.
          </div>
        </div>

        <!-- Emergency Account Freeze Switch -->
        <div class="guardian-control-card">
          <div class="guardian-control-title">Emergency Safety Freeze</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 13px; color: var(--text-secondary);">Status:</span>
            <strong id="freeze-status-text" style="color: var(--success); font-size: 13px;">ACTIVE (NORMAL)</strong>
          </div>
          <button id="btn-toggle-freeze" class="btn" style="width: 100%; justify-content: center; font-size: 12.5px; padding: 9px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: var(--danger);">
            Freeze All Agent Spending
          </button>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            Immediately halt all transactions in case of suspected coercion.
          </div>
        </div>
      </div>

      <!-- Approval Requests List -->
      <div class="section-header">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1>Approval Requests</h1>
            <p>Any purchase exceeding Amma's limit requires your explicit consent.</p>
          </div>
          <div id="pending-counter-badge" class="status-badge awaiting_approval hidden">
            0 Pending
          </div>
        </div>
      </div>

      <div id="guardian-tasks">
        <div class="empty-state">
          <p>No pending requests right now.<br/>When Amma's agent reaches an over-limit item, it will appear here in real-time.</p>
        </div>
      </div>
    </div>
  `;

  const tasksContainer = container.querySelector("#guardian-tasks");
  const guardianLimitSlider = container.querySelector("#guardian-limit-slider");
  const guardianLimitVal = container.querySelector("#guardian-limit-val");
  const btnToggleFreeze = container.querySelector("#btn-toggle-freeze");
  const freezeStatusText = container.querySelector("#freeze-status-text");
  const pendingCounterBadge = container.querySelector("#pending-counter-badge");

  let isSeniorFrozen = false;

  // ─── Subscribe to Senior User Settings ───────────────────────
  unsubSenior = subscribeUser(SENIOR_UID, (senior) => {
    if (!senior) return;
    isSeniorFrozen = !!senior.isFrozen;

    if (guardianLimitSlider && senior.agentLimit) {
      guardianLimitSlider.value = senior.agentLimit;
      if (guardianLimitVal) guardianLimitVal.textContent = `₹${senior.agentLimit.toLocaleString("en-IN")}`;
      const pct = ((senior.agentLimit - 500) / (10000 - 500)) * 100;
      guardianLimitSlider.style.setProperty("--pct", `${pct}%`);
    }

    if (freezeStatusText && btnToggleFreeze) {
      if (isSeniorFrozen) {
        freezeStatusText.textContent = "FROZEN";
        freezeStatusText.style.color = "var(--danger)";
        btnToggleFreeze.textContent = "Unfreeze Account";
        btnToggleFreeze.style.background = "rgba(16,185,129,0.15)";
        btnToggleFreeze.style.borderColor = "var(--success)";
        btnToggleFreeze.style.color = "var(--success)";
      } else {
        freezeStatusText.textContent = "ACTIVE (NORMAL)";
        freezeStatusText.style.color = "var(--success)";
        btnToggleFreeze.textContent = "Freeze All Agent Spending";
        btnToggleFreeze.style.background = "rgba(239,68,68,0.15)";
        btnToggleFreeze.style.borderColor = "rgba(239,68,68,0.3)";
        btnToggleFreeze.style.color = "var(--danger)";
      }
    }
  });

  // ─── Guardian Limit Slider Change ───────────────────────────
  guardianLimitSlider?.addEventListener("change", async () => {
    const val = parseInt(guardianLimitSlider.value);
    await updateUserLimit(SENIOR_UID, val);
  });

  guardianLimitSlider?.addEventListener("input", () => {
    const val = parseInt(guardianLimitSlider.value);
    if (guardianLimitVal) guardianLimitVal.textContent = `₹${val.toLocaleString("en-IN")}`;
    const pct = ((val - 500) / (10000 - 500)) * 100;
    guardianLimitSlider.style.setProperty("--pct", `${pct}%`);
  });

  // ─── Emergency Freeze Button ────────────────────────────────
  btnToggleFreeze?.addEventListener("click", async () => {
    playStepTick();
    await toggleUserFreeze(SENIOR_UID, !isSeniorFrozen);
  });

  // ─── Subscribe to Guardian Tasks ─────────────────────────────
  unsubTasks = subscribeGuardianTasks((tasks) => {
    if (!tasksContainer) return;

    const sorted = tasks.sort((a, b) => {
      const aWeight = a.status === "awaiting_approval" ? 0 : 1;
      const bWeight = b.status === "awaiting_approval" ? 0 : 1;
      if (aWeight !== bWeight) return aWeight - bWeight;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const pendingCount = sorted.filter((t) => t.status === "awaiting_approval").length;

    if (pendingCount > previousPendingCount) {
      playAlertChime();
    }
    previousPendingCount = pendingCount;

    if (pendingCounterBadge) {
      if (pendingCount > 0) {
        pendingCounterBadge.classList.remove("hidden");
        pendingCounterBadge.textContent = `${pendingCount} Awaiting Decision`;
      } else {
        pendingCounterBadge.classList.add("hidden");
      }
    }

    if (sorted.length === 0) {
      tasksContainer.innerHTML = `
        <div class="empty-state">
          <p>No requests right now.<br/>When Amma's agent needs approval, it will appear here in real-time.</p>
        </div>
      `;
      return;
    }

    tasksContainer.innerHTML = sorted.map((task) => renderTaskCard(task)).join("");

    // Bind action buttons
    tasksContainer.querySelectorAll(".btn-approve").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.dataset.taskId;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Approving…';
        playSuccessChime();
        await approveTask(taskId);
      });
    });

    tasksContainer.querySelectorAll(".btn-decline").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const taskId = btn.dataset.taskId;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Declining…';
        playAlertChime();
        await declineTask(taskId);
      });
    });
  });
}

function renderTaskCard(task) {
  const isAwaiting = task.status === "awaiting_approval";
  const isPaid = task.status === "paid";
  const isDeclined = task.status === "declined";
  const overLimit = task.price > task.limit;

  const statusLabels = {
    searching: "Searching Official Channel",
    filling: "Form Automated",
    awaiting_approval: "APPROVAL REQUIRED",
    paid: "APPROVED & PAID",
    declined: "DECLINED",
  };

  const stepsHTML = (task.steps || [])
    .map(
      (s) => `
      <li class="step-item">
        <div class="step-dot"></div>
        <div class="step-text">${s.text}</div>
      </li>
    `
    )
    .join("");

  return `
    <div class="approval-card ${isAwaiting ? "awaiting" : ""}" id="task-card-${task.id}">
      <div class="approval-header">
        <span class="approval-task-id">${task.category?.toUpperCase() || "TRANSACTION"} · ${new Date(task.createdAt).toLocaleTimeString("en-IN")}</span>
        <span class="status-badge ${task.status}">${statusLabels[task.status] || task.status}</span>
      </div>

      <div class="approval-request" style="margin-bottom: 8px;">
        ${task.request}
      </div>

      ${
        task.officialSite
          ? `
        <div style="font-size: 12px; color: var(--success); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <span>Verified Destination:</span>
          <strong>${task.officialSite}</strong>
          ${task.merchant ? `<span>(${task.merchant})</span>` : ""}
        </div>
      `
          : ""
      }

      <div class="approval-details">
        <div class="approval-detail">
          <div class="label">Amount Requested</div>
          <div class="value ${overLimit ? "over-limit" : ""}">₹${(task.price || 0).toLocaleString("en-IN")}</div>
        </div>
        <div class="approval-detail">
          <div class="label">Amma's Limit</div>
          <div class="value">₹${(task.limit || 0).toLocaleString("en-IN")}</div>
        </div>
      </div>

      ${
        overLimit
          ? `
        <div style="font-size: 12px; color: #f87171; background: rgba(239,68,68,0.1); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 14px;">
          <strong>Exceeds Limit by ₹${(task.price - task.limit).toLocaleString("en-IN")}:</strong> Agent halted payment to protect senior from unauthorized or excessive spending.
        </div>
      `
          : ""
      }

      ${
        stepsHTML
          ? `
        <details style="margin-bottom: 16px;">
          <summary style="cursor: pointer; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
            View ${task.steps.length} verified agent steps
          </summary>
          <ul class="step-log">${stepsHTML}</ul>
        </details>
      `
          : ""
      }

      ${
        isAwaiting
          ? `
        <div class="approval-actions">
          <button class="btn btn-approve" data-task-id="${task.id}" id="approve-${task.id}">
            Approve Payment (₹${(task.price || 0).toLocaleString("en-IN")})
          </button>
          <button class="btn btn-decline" data-task-id="${task.id}" id="decline-${task.id}">
            Decline
          </button>
        </div>
      `
          : ""
      }

      ${
        isPaid
          ? `
        <div style="padding: 12px; background: var(--success-glow); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-sm); text-align: center; font-size: 13.5px; color: var(--success);">
          You approved this. Payment of ₹${(task.price || 0).toLocaleString("en-IN")} was securely executed.
        </div>
      `
          : ""
      }

      ${
        isDeclined
          ? `
        <div style="padding: 12px; background: var(--danger-glow); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-sm); text-align: center; font-size: 13.5px; color: #f87171;">
          Request declined. Zero funds were deducted from Amma's account.
        </div>
      `
          : ""
      }
    </div>
  `;
}
