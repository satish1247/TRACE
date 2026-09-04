interface StatusBannerProps {
  tone: "info" | "warning";
  children: React.ReactNode;
}

/** Small, non-blocking banner — used for mic-denied text, Firestore sync
 * failures, and model-service fallback notices. Never a dead end. */
export function StatusBanner({ tone, children }: StatusBannerProps): React.JSX.Element {
  const toneClasses =
    tone === "warning"
      ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <div role="status" className={`rounded-md border px-3 py-2 text-sm ${toneClasses}`}>
      {children}
    </div>
  );
}
