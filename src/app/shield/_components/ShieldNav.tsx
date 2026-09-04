import Link from "next/link";

interface ShieldNavProps {
  active: "live" | "media";
}

/** Small nav linking SHIELD's two sibling screens (UI-SPEC.md Navigation). */
export function ShieldNav({ active }: ShieldNavProps): React.JSX.Element {
  return (
    <nav aria-label="SHIELD" className="flex items-center gap-4 border-b border-slate-300 px-4 py-3 text-sm dark:border-slate-700">
      <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">SHIELD</span>
      <Link
        href="/shield"
        aria-current={active === "live" ? "page" : undefined}
        className={
          active === "live"
            ? "font-medium text-blue-700 underline underline-offset-4 dark:text-blue-400"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        }
      >
        Live call
      </Link>
      <Link
        href="/shield/media"
        aria-current={active === "media" ? "page" : undefined}
        className={
          active === "media"
            ? "font-medium text-blue-700 underline underline-offset-4 dark:text-blue-400"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        }
      >
        Check a file
      </Link>
    </nav>
  );
}
