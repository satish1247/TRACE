import type { AcousticFeatures } from "@/lib/shield/acoustic";

interface AcousticNumbersProps {
  features: AcousticFeatures;
}

const ROWS: ReadonlyArray<{ key: keyof AcousticFeatures; label: string; unit: string }> = [
  { key: "breathPauseRate", label: "Breath-pause rate", unit: "/min" },
  { key: "dynamicRangeDb", label: "Dynamic range", unit: "dB" },
  { key: "spectralFlatness", label: "Spectral flatness", unit: "" },
  { key: "energyAbove8kHzRatio", label: "Energy above 8kHz", unit: "" },
  { key: "silenceShare", label: "Silence share", unit: "" },
  { key: "clippingRatio", label: "Clipping", unit: "" },
];

/** Every measured number that produced the acoustic-fallback verdict
 * (UI-SPEC.md: "every measured number that produced it"). */
export function AcousticNumbers({ features }: AcousticNumbersProps): React.JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
      {ROWS.map(({ key, label, unit }) => (
        <div key={key} className="flex items-baseline justify-between gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
          <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
          <dd className="mono text-slate-900 dark:text-slate-100">
            {features[key]}
            {unit}
          </dd>
        </div>
      ))}
    </dl>
  );
}
