/**
 * Split View — Simultaneous Dual-Screen Demonstration
 * Renders Senior Agent and Guardian Dashboard side-by-side with live real-time sync.
 */
import { renderAgentPage } from "./agent.js";
import { renderGuardianPage } from "./guardian.js";

export function renderSplitPage(container) {
  container.innerHTML = `
    <div class="split-view-container">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 24px; font-weight: 800; color: white;">
          Live Dual-Screen Demonstration
        </h2>
        <p style="font-size: 14px; color: var(--text-secondary); max-width: 650px; margin: 6px auto 0;">
          Watch how Amma's AI agent halts over-limit transactions on the left, instantly transmits an encrypted approval card to Priya's phone on the right, and executes live via reactive sync.
        </p>
      </div>

      <div class="split-grid">
        <!-- Senior Side -->
        <div class="split-column" id="split-senior-column">
          <div class="split-badge-header">
            <span class="split-role-tag senior">Senior Screen (Amma / Lakshmi Devi)</span>
            <span style="font-size: 12px; color: var(--text-muted);"><span class="realtime-dot"></span> Live</span>
          </div>
          <div id="split-senior-mount"></div>
        </div>

        <!-- Guardian Side -->
        <div class="split-column" id="split-guardian-column">
          <div class="split-badge-header">
            <span class="split-role-tag guardian">Guardian Phone (Priya / Daughter)</span>
            <span style="font-size: 12px; color: var(--text-muted);"><span class="realtime-dot"></span> Remote Link</span>
          </div>
          <div id="split-guardian-mount"></div>
        </div>
      </div>
    </div>
  `;

  const seniorMount = container.querySelector("#split-senior-mount");
  const guardianMount = container.querySelector("#split-guardian-mount");

  if (seniorMount) renderAgentPage(seniorMount);
  if (guardianMount) renderGuardianPage(guardianMount);
}
