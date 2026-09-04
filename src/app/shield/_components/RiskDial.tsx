import { RISK_CAP } from "@/lib/shield/markers";

interface RiskDialProps {
  risk: number;
}

/** Risk dial: calm blue -> amber -> red only as risk actually rises — never
 * red by default, so the meter never cries wolf (UI-SPEC.md). */
function riskBand(risk: number): { trackColor: string; label: string } {
  if (risk >= 70) return { trackColor: "bg-red-600", label: "high" };
  if (risk >= 30) return { trackColor: "bg-amber-500", label: "rising" };
  return { trackColor: "bg-blue-500", label: "calm" };
}

export function RiskDial({ risk }: RiskDialProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(RISK_CAP, risk));
  const { trackColor, label } = riskBand(clamped);

  return (
    <div
      role="meter"
      aria-label={`Live risk score: ${clamped} out of 100, ${label}`}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={RISK_CAP}
      className="w-full"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Risk
        </span>
        <span className="mono text-2xl font-semibold text-slate-900 dark:text-slate-100">{clamped}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${trackColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
