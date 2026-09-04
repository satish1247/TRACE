"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { writeDetection } from "@/lib/shield/firestore";
import {
  detectFace,
  detectVoice,
  validateAudioFile,
  validateImageFile,
  type FaceDetectionOutcome,
  type VoiceDetectionOutcome,
} from "@/lib/shield/mediaClient";
import type { DetectionVerdict } from "@/lib/shield/types";
import { ShieldNav } from "../_components/ShieldNav";
import { StatusBanner } from "../_components/StatusBanner";
import { AcousticNumbers } from "./_components/AcousticNumbers";

type MediaMode = "voice" | "face";
type CheckStatus = "idle" | "checking" | "done";

function acousticVerdictToDetectionVerdict(
  verdict: "likely_real" | "likely_synthetic" | "uncertain",
): DetectionVerdict {
  if (verdict === "likely_real") return "real";
  if (verdict === "likely_synthetic") return "fake";
  return "uncertain";
}

export default function ShieldMediaPage(): React.JSX.Element {
  const [mode, setMode] = useState<MediaMode>("voice");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckStatus>("idle");
  const [voiceResult, setVoiceResult] = useState<VoiceDetectionOutcome | null>(null);
  const [faceResult, setFaceResult] = useState<FaceDetectionOutcome | null>(null);
  const [writeSyncError, setWriteSyncError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const resetResults = useCallback(() => {
    setVoiceResult(null);
    setFaceResult(null);
    setStatus("idle");
    setWriteSyncError(false);
  }, []);

  const handleModeChange = useCallback(
    (nextMode: MediaMode) => {
      setMode(nextMode);
      setFile(null);
      setValidationError(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
      resetResults();
    },
    [resetResults],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      resetResults();
      if (!selected) {
        setFile(null);
        setValidationError(null);
        return;
      }

      const validation = mode === "voice" ? validateAudioFile(selected) : validateImageFile(selected);
      if (!validation.valid) {
        setFile(null);
        setValidationError(validation.reason);
        return;
      }

      setValidationError(null);
      setFile(selected);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(selected);
      objectUrlRef.current = url;
      setPreviewUrl(url);
    },
    [mode, resetResults],
  );

  const handleCheck = useCallback(async () => {
    if (!file) return;
    setStatus("checking");

    if (mode === "voice") {
      const outcome = await detectVoice(file);
      setVoiceResult(outcome);
      setStatus("done");

      if (outcome.status === "ok" || outcome.status === "fallback") {
        const verdict: DetectionVerdict =
          outcome.status === "ok" ? outcome.result.verdict : acousticVerdictToDetectionVerdict(outcome.acoustic.verdict);
        const confidence = outcome.status === "ok" ? outcome.result.confidence : outcome.acoustic.confidence;
        const model = outcome.status === "ok" ? outcome.result.model : "acoustic-fallback";
        const evidence = outcome.status === "ok" ? {} : { ...outcome.acoustic.features };
        try {
          await writeDetection({ at: Date.now(), kind: "voice", verdict, confidence, model, evidence, callId: null });
        } catch (error: unknown) {
          console.error("SHIELD: failed to record voice detection", error);
          setWriteSyncError(true);
        }
      }
      return;
    }

    const outcome = await detectFace(file);
    setFaceResult(outcome);
    setStatus("done");
    if (outcome.status === "ok") {
      try {
        await writeDetection({
          at: Date.now(),
          kind: "face",
          verdict: outcome.result.verdict,
          confidence: outcome.result.confidence,
          model: outcome.result.model,
          evidence: {},
          callId: null,
        });
      } catch (error: unknown) {
        console.error("SHIELD: failed to record face detection", error);
        setWriteSyncError(true);
      }
    }
  }, [file, mode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ShieldNav active="media" />
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Check a file</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleModeChange("voice")}
            aria-pressed={mode === "voice"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "voice" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
            }`}
          >
            Check audio
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("face")}
            aria-pressed={mode === "face"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "face" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
            }`}
          >
            Check face
          </button>
        </div>

        <div className="rounded-lg border border-dashed border-slate-400 p-4 text-sm dark:border-slate-600">
          {!file && !previewUrl && <p className="text-slate-500 dark:text-slate-400">Drop or choose a file.</p>}
          <input
            type="file"
            accept={mode === "voice" ? "audio/wav,audio/mpeg" : "image/jpeg,image/png"}
            onChange={handleFileChange}
            aria-label={mode === "voice" ? "Choose an audio file" : "Choose an image file"}
            className="mt-2 block w-full text-sm text-slate-700 dark:text-slate-200"
          />
          {validationError && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{validationError}</p>}

          {previewUrl && mode === "voice" && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={previewUrl} className="mt-3 w-full">
              <track kind="captions" />
            </audio>
          )}
          {previewUrl && mode === "face" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Uploaded preview" className="mt-3 max-h-64 rounded" />
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={!file || status === "checking"}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "checking" ? "Checking…" : "Check file"}
        </button>

        {writeSyncError && (
          <StatusBanner tone="warning">Not syncing to your team right now &mdash; the result above is still valid locally.</StatusBanner>
        )}

        {mode === "voice" && voiceResult && (
          <section aria-label="Voice check result" className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            {voiceResult.status === "ok" && (
              <p className="text-sm text-slate-900 dark:text-slate-100">
                Model verdict: <strong className="mono">{voiceResult.result.verdict}</strong> (confidence{" "}
                <span className="mono">{voiceResult.result.confidence.toFixed(2)}</span>) &mdash; {voiceResult.result.model}
              </p>
            )}
            {voiceResult.status === "fallback" && (
              <div>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  Acoustic-fallback verdict guess:{" "}
                  <strong className="mono">{voiceResult.acoustic.verdict}</strong> (confidence{" "}
                  <span className="mono">{voiceResult.acoustic.confidence.toFixed(2)}</span>)
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {voiceResult.acoustic.disclaimer}
                </p>
                <div className="mt-3">
                  <AcousticNumbers features={voiceResult.acoustic.features} />
                </div>
              </div>
            )}
            {voiceResult.status === "unavailable" && <StatusBanner tone="warning">{voiceResult.reason}</StatusBanner>}
          </section>
        )}

        {mode === "face" && faceResult && (
          <section aria-label="Face check result" className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            {faceResult.status === "ok" && (
              <p className="text-sm text-slate-900 dark:text-slate-100">
                Model verdict: <strong className="mono">{faceResult.result.verdict}</strong> (confidence{" "}
                <span className="mono">{faceResult.result.confidence.toFixed(2)}</span>) &mdash; {faceResult.result.model}
              </p>
            )}
            {faceResult.status === "unavailable" && <StatusBanner tone="warning">{faceResult.reason}</StatusBanner>}
          </section>
        )}
      </main>
    </div>
  );
}
