import type { AttestationResult, InterviewResult } from "@/lib/shield/types";

interface InterviewCardProps {
  scamLabel: string | null;
  statistic: string | null;
  attestation: AttestationResult | null;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  interviewResult: InterviewResult | null;
}

/**
 * Verdict/interview card (S4, S8) — appears once risk crosses the warn
 * threshold. Deliberately not a warning banner: it asks a question and
 * names the scam back, per PRD-1-SHIELD.md's explicit instruction not to
 * pre-inoculate the victim against a generic warning.
 */
export function InterviewCard({
  scamLabel,
  statistic,
  attestation,
  answer,
  onAnswerChange,
  onSubmit,
  submitting,
  interviewResult,
}: InterviewCardProps): React.JSX.Element {
  return (
    <section
      aria-label="Verdict and interview"
      className="rounded-lg border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950"
    >
      {scamLabel && statistic ? (
        <p className="text-sm text-amber-950 dark:text-amber-100">
          This matches the <strong>{scamLabel}</strong> scam. {statistic} No police officer has ever
          legitimately told someone to stay on the line and hide it from their family.
        </p>
      ) : (
        <p className="text-sm text-amber-950 dark:text-amber-100">
          Risk is rising, though the exact scam family hasn&rsquo;t resolved yet — keep the
          conversation going or answer the question below.
        </p>
      )}

      {attestation && !attestation.attested && (
        <p className="mt-2 rounded bg-white px-2 py-1 text-sm font-medium text-red-700 dark:bg-slate-900 dark:text-red-300">
          {attestation.message}
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="interview-answer" className="block text-sm font-medium text-amber-950 dark:text-amber-100">
          In your own words &mdash; who is this money for, and why?
        </label>
        <textarea
          id="interview-answer"
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-amber-300 bg-white p-2 text-sm text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="e.g. I'm paying my nephew's bail after his arrest"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || answer.trim().length === 0}
          className="mt-2 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-600"
        >
          {submitting ? "Checking…" : "Submit answer"}
        </button>
      </div>

      {interviewResult && (
        <p className="mt-3 rounded bg-white px-3 py-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100">
          {interviewResult.verdict}
        </p>
      )}
    </section>
  );
}
