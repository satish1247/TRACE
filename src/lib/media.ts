/**
 * Synthetic-media indicator (REQ-018). SIMULATED: curated sample results, not a live detector.
 * The point on stage: the real scammer sounds authentic, and the script detector catches him anyway.
 */
export type MediaSampleKey = "genuine_bank" | "cloned_voice" | "real_scammer";

export interface MediaSignal {
  name: string;
  value: string;
  suspicious: boolean;
}

export interface MediaCheck {
  key: MediaSampleKey;
  label: string;
  /** 0..1, probability the audio is a real human voice */
  authenticity: number;
  verdict: "authentic" | "synthetic";
  signals: MediaSignal[];
  note: string;
  simulated: true;
}

export const MEDIA_SAMPLES: Record<MediaSampleKey, MediaCheck> = {
  genuine_bank: {
    key: "genuine_bank",
    label: "Fed Bank agent (genuine)",
    authenticity: 0.97,
    verdict: "authentic",
    signals: [
      { name: "Prosody variance", value: "natural", suspicious: false },
      { name: "Breath and plosives", value: "present", suspicious: false },
      { name: "Spectral seams", value: "none", suspicious: false },
      { name: "Lip-audio sync", value: "n/a (voice call)", suspicious: false },
    ],
    note: "Real voice, attested call.",
    simulated: true,
  },
  cloned_voice: {
    key: "cloned_voice",
    label: "Cloned voice of a relative",
    authenticity: 0.18,
    verdict: "synthetic",
    signals: [
      { name: "Prosody variance", value: "flat, repeated contours", suspicious: true },
      { name: "Breath and plosives", value: "absent", suspicious: true },
      { name: "Spectral seams", value: "7 splice points in 20 s", suspicious: true },
      { name: "Lip-audio sync", value: "42 ms offset (video)", suspicious: true },
    ],
    note: "Synthetic. Rare in India today, but growing.",
    simulated: true,
  },
  real_scammer: {
    key: "real_scammer",
    label: "'Inspector Rajesh Kumar' (real human)",
    authenticity: 0.94,
    verdict: "authentic",
    signals: [
      { name: "Prosody variance", value: "natural", suspicious: false },
      { name: "Breath and plosives", value: "present", suspicious: false },
      { name: "Spectral seams", value: "none", suspicious: false },
      { name: "Lip-audio sync", value: "n/a (voice call)", suspicious: false },
    ],
    note: "A real human voice. This is why TRACE reads the script, not the audio.",
    simulated: true,
  },
};

export function mediaCheckFor(key: MediaSampleKey): MediaCheck | undefined {
  return MEDIA_SAMPLES[key];
}
