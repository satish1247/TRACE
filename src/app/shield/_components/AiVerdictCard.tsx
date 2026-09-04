import type { AiVerdictResult } from "@/lib/shield/types";

interface AiVerdictCardProps {
  status: "idle" | "loading" | "ready" | "unavailable";
  result: AiVerdictResult | null;
  onAskAgain: () => void;
}

/**
 * The LLM second opinion (NVIDIA-hosted model), shown next to the
 * deterministic marker/taxonomy verdict — never in place of it. Clearly
 * labelled as an AI assessment so it's never mistaken for the offline,
 * unit-tested engines in `markers.ts`/`taxonomy.ts`.
 */
export function AiVerdictCard({ status, result, onAskAgain }: AiVerdictCardProps): React.JSX.Element | null {
  if (status === "idle") return null;

  return (
    <section
      aria-label="AI second opinion"
      className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm dark:border-sky-800 dark:bg-sky-950"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-sky-950 dark:text-sky-100">AI second opinion</h2>
        <button
          type="button"
          onClick={onAskAgain}
          disabled={status === "loading"}
          className="rounded-md border border-sky-400 px-2 py-1 text-xs font-medium text-sky-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-700 dark:text-sky-200"
        >
          {status === "loading" ? "Asking…" : "Ask again"}
        </button>
      </div>

      {status === "loading" && <p className="mt-1 text-sky-900 dark:text-sky-200">Analyzing the transcript…</p>}

      {status === "unavailable" && (
        <p className="mt-1 text-sky-900 dark:text-sky-200">
          Not available right now &mdash; the script-based detection above still works on its own.
        </p>
      )}

      {status === "ready" && result && (
        <div className="mt-1 text-sky-900 dark:text-sky-200">
          <p>
            <span className="font-mono font-medium">{result.isLikelyScam ? "Likely a scam" : "Not clearly a scam"}</span>
            {" · "}
            <span className="font-mono">{Math.round(result.confidence * 100)}% confidence</span>
            {result.scamType && <> · {result.scamType.replace(/_/g, " ")}</>}
          </p>
          <p className="mt-1">{result.explanation}</p>
          <p className="mt-1 font-mono text-xs text-sky-700 dark:text-sky-400">{result.model}</p>
        </div>
      )}
    </section>
  );
}
