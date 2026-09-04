import type { TranscriptLine } from "@/lib/shield/types";

interface TranscriptPanelProps {
  lines: readonly TranscriptLine[];
}

/** Scrolling transcript, `aria-live="polite"` so new lines are announced
 * without interrupting (USER-FLOWS.md accessibility notes). */
export function TranscriptPanel({ lines }: TranscriptPanelProps): React.JSX.Element {
  return (
    <div
      aria-live="polite"
      aria-label="Call transcript"
      className="h-64 overflow-y-auto rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 sm:h-96"
    >
      {lines.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Say something or type below to begin.</p>
      ) : (
        <ol className="space-y-2">
          {lines.map((line, index) => (
            <li key={`${line.at}-${index}`} className="leading-snug">
              <span
                className={
                  line.speaker === "caller"
                    ? "mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    : "mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }
              >
                {line.speaker === "caller" ? "Caller" : "You"}
              </span>
              <span className="text-slate-900 dark:text-slate-100">{line.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
