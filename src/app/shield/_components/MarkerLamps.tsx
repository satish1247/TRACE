import { MARKER_LABELS, MARKER_ORDER } from "@/lib/shield/markers";
import type { MarkerId } from "@/lib/shield/types";

interface MarkerLampsProps {
  firedMarkers: readonly MarkerId[];
  /** The marker that fired most recently — gets the pulse animation. */
  pulsingMarkerId: MarkerId | null;
}

/** Five marker lamps, always in the PRD's fixed left-to-right order, so a
 * judge can read the scam's shape at a glance regardless of fire order. */
export function MarkerLamps({ firedMarkers, pulsingMarkerId }: MarkerLampsProps): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-5" aria-label="Scam-script markers">
      {MARKER_ORDER.map((markerId) => {
        const isOn = firedMarkers.includes(markerId);
        const isPulsing = pulsingMarkerId === markerId;
        return (
          <li key={markerId}>
            <div
              role="img"
              aria-label={`${MARKER_LABELS[markerId]}: ${isOn ? "fired" : "not fired"}`}
              className={[
                "rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors duration-300",
                isOn
                  ? "border-amber-600 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-600"
                  : "border-slate-300 bg-transparent text-slate-500 dark:border-slate-600 dark:text-slate-400",
                isPulsing ? "animate-[pulse_0.7s_ease-in-out_1]" : "",
              ].join(" ")}
            >
              {MARKER_LABELS[markerId]}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
