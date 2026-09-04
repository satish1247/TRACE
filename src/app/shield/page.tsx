"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAiVerdict } from "@/lib/shield/aiVerdict";
import { DEMO_ATTESTED_CALLER_ID, checkAttestation } from "@/lib/shield/attestation";
import { classifyInterviewAnswer } from "@/lib/shield/interview";
import { writeCall } from "@/lib/shield/firestore";
import { WARN_THRESHOLD, scoreTranscript } from "@/lib/shield/markers";
import {
  createSpeechController,
  createTypedLine,
  isSpeechRecognitionSupported,
  type SpeechController,
  type SpeechStatus,
} from "@/lib/shield/speech";
import { classifyScam } from "@/lib/shield/taxonomy";
import type { AiVerdictResult, AttestationResult, InterviewResult, MarkerId, Speaker, TranscriptLine } from "@/lib/shield/types";
import { AiVerdictCard } from "./_components/AiVerdictCard";
import { InterviewCard } from "./_components/InterviewCard";
import { MarkerLamps } from "./_components/MarkerLamps";
import { RiskDial } from "./_components/RiskDial";
import { ShieldNav } from "./_components/ShieldNav";
import { StatusBanner } from "./_components/StatusBanner";
import { TranscriptPanel } from "./_components/TranscriptPanel";

interface CallUiState {
  transcript: TranscriptLine[];
  risk: number;
  firedMarkers: MarkerId[];
  scamType: string | null;
  scamLabel: string | null;
  statistic: string | null;
  active: boolean;
}

const INITIAL_CALL_STATE: CallUiState = {
  transcript: [],
  risk: 0,
  firedMarkers: [],
  scamType: null,
  scamLabel: null,
  statistic: null,
  active: true,
};

/** A short canned "digital arrest" script for the judge-facing demo button
 * (UI-SPEC.md: "simulate scripted call"). Fires all five markers in order. */
const DEMO_SCRIPT: readonly { speaker: Speaker; text: string }[] = [
  { speaker: "caller", text: "This is CBI, Cyber Crime Cell, calling about a case registered in your name." },
  { speaker: "caller", text: "There is an arrest warrant against you for money laundering." },
  { speaker: "caller", text: "Stay on the video call and don't tell your family about this." },
  { speaker: "caller", text: "Share your OTP and complete a UPI transfer to the verification account now." },
  { speaker: "caller", text: "Don't call the bank, ignore any warning message they send you." },
];

const DEMO_STEP_DELAY_MS = 900;

function randomCallerId(): string {
  return `caller-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ShieldLivePage(): React.JSX.Element {
  const [callId] = useState<string>(() => `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [startedAt] = useState<number>(() => Date.now());
  const [callerId, setCallerId] = useState<string>(() => randomCallerId());
  const [callState, setCallState] = useState<CallUiState>(INITIAL_CALL_STATE);
  const [syncError, setSyncError] = useState(false);

  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [micStarting, setMicStarting] = useState(false);
  const speechControllerRef = useRef<SpeechController | null>(null);

  const [typedText, setTypedText] = useState("");
  const [typedSpeaker, setTypedSpeaker] = useState<Speaker>("caller");
  const typedInputRef = useRef<HTMLInputElement | null>(null);

  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [pulsingMarkerId, setPulsingMarkerId] = useState<MarkerId | null>(null);
  const previousMarkersRef = useRef<MarkerId[]>([]);

  const [aiVerdictStatus, setAiVerdictStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [aiVerdictResult, setAiVerdictResult] = useState<AiVerdictResult | null>(null);
  const aiVerdictRequestedRef = useRef(false);

  const hasStarted = callState.transcript.length > 0;

  const addTranscriptLine = useCallback((line: TranscriptLine) => {
    setCallState((previous) => {
      const transcript = [...previous.transcript, line];
      const { risk, markers } = scoreTranscript(transcript, previous.risk);
      const taxonomy = classifyScam(transcript, markers);
      return {
        ...previous,
        transcript,
        risk,
        firedMarkers: markers,
        scamType: taxonomy.scamType,
        scamLabel: taxonomy.label,
        statistic: taxonomy.statistic,
      };
    });
  }, []);

  // Speech recognition setup — created once, torn down on unmount. Never
  // started twice concurrently: `speech.ts`'s controller guards that itself.
  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
    const controller = createSpeechController({
      speaker: "caller",
      onLine: addTranscriptLine,
      onStatusChange: (status) => {
        setSpeechStatus(status);
        setMicStarting(false);
      },
    });
    speechControllerRef.current = controller;
    return () => controller.stop();
  }, [addTranscriptLine]);

  useEffect(() => {
    if (speechStatus === "denied" || speechStatus === "unsupported") {
      typedInputRef.current?.focus();
    }
  }, [speechStatus]);

  // Sync to Firestore on every material change, once the call has actually
  // started (never write an empty call doc just from opening the page).
  useEffect(() => {
    if (!hasStarted) return;
    writeCall(callId, {
      startedAt,
      callerId,
      callerName: "Live caller",
      transcript: callState.transcript,
      markers: callState.firedMarkers,
      risk: callState.risk,
      scamType: callState.scamType,
      active: callState.active,
    })
      .then(() => setSyncError(false))
      .catch((error: unknown) => {
        console.error("SHIELD: Firestore sync failed", error);
        setSyncError(true);
      });
  }, [callId, callerId, startedAt, hasStarted, callState]);

  // Pulse the most-recently-fired lamp for a moment.
  useEffect(() => {
    const previous = previousMarkersRef.current;
    const current = callState.firedMarkers;
    previousMarkersRef.current = current;
    if (current.length <= previous.length) return;
    const newlyFired = current[current.length - 1];
    setPulsingMarkerId(newlyFired);
    const timer = setTimeout(() => setPulsingMarkerId(null), 800);
    return () => clearTimeout(timer);
  }, [callState.firedMarkers]);

  const attestation: AttestationResult | null = useMemo(() => {
    if (!callState.firedMarkers.includes("authority")) return null;
    return checkAttestation(callerId, callState.firedMarkers);
  }, [callerId, callState.firedMarkers]);

  const handleStartListening = useCallback(() => {
    setMicStarting(true);
    speechControllerRef.current?.start();
  }, []);

  const handleStopListening = useCallback(() => {
    speechControllerRef.current?.stop();
  }, []);

  const handleSendTyped = useCallback(() => {
    if (typedText.trim().length === 0) return;
    addTranscriptLine(createTypedLine(typedText, typedSpeaker));
    setTypedText("");
  }, [typedText, typedSpeaker, addTranscriptLine]);

  const handleSubmitInterview = useCallback(() => {
    if (interviewAnswer.trim().length === 0) return;
    setInterviewSubmitting(true);
    const result = classifyInterviewAnswer(interviewAnswer, callState.scamType, callState.scamLabel);
    setInterviewResult(result);
    setInterviewSubmitting(false);
  }, [interviewAnswer, callState.scamType, callState.scamLabel]);

  const handleAskAi = useCallback(async () => {
    if (callState.transcript.length === 0) return;
    setAiVerdictStatus("loading");
    const result = await fetchAiVerdict(callState.transcript);
    if (result) {
      setAiVerdictResult(result);
      setAiVerdictStatus("ready");
    } else {
      setAiVerdictStatus("unavailable");
    }
  }, [callState.transcript]);

  // Auto-ask once, the same moment the interview card appears (S4's warn
  // threshold) — never on every transcript line, which would spam the API.
  useEffect(() => {
    if (callState.risk < WARN_THRESHOLD || aiVerdictRequestedRef.current) return;
    aiVerdictRequestedRef.current = true;
    void handleAskAi();
  }, [callState.risk, handleAskAi]);

  const handleSimulateScriptedCall = useCallback(async () => {
    setSimulating(true);
    for (const step of DEMO_SCRIPT) {
      await new Promise<void>((resolve) => setTimeout(resolve, DEMO_STEP_DELAY_MS));
      addTranscriptLine({ speaker: step.speaker, text: step.text, at: Date.now() });
    }
    setSimulating(false);
  }, [addTranscriptLine]);

  const handleEndCall = useCallback(() => {
    speechControllerRef.current?.stop();
    setCallState((previous) => ({ ...previous, active: false }));
  }, []);

  const handleToggleAttestedDemo = useCallback((checked: boolean) => {
    setCallerId(checked ? DEMO_ATTESTED_CALLER_ID : randomCallerId());
  }, []);

  const showInterviewCard = callState.risk >= WARN_THRESHOLD;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ShieldNav active="live" />
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Live call</h1>

        {!callState.active && <StatusBanner tone="info">Call ended. Detection stopped.</StatusBanner>}

        {speechSupported === false && (
          <StatusBanner tone="warning">
            This browser doesn&rsquo;t support live transcription. Type what&rsquo;s being said instead.
          </StatusBanner>
        )}
        {speechStatus === "denied" && (
          <StatusBanner tone="warning">Microphone blocked. Type what&rsquo;s being said instead.</StatusBanner>
        )}
        {speechStatus === "error" && (
          <StatusBanner tone="warning">Microphone had a problem. Type what&rsquo;s being said instead.</StatusBanner>
        )}
        {syncError && (
          <StatusBanner tone="warning">Not syncing to your team right now &mdash; detection still works locally.</StatusBanner>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {speechStatus === "listening" ? (
            <button
              type="button"
              onClick={handleStopListening}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-200 dark:text-slate-900"
            >
              Stop listening
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartListening}
              disabled={micStarting || speechSupported === false || !callState.active}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {micStarting ? "Starting microphone…" : "Start listening"}
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleSimulateScriptedCall()}
            disabled={simulating || !callState.active}
            className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          >
            {simulating ? "Simulating…" : "Simulate scripted call"}
          </button>

          <button
            type="button"
            onClick={handleEndCall}
            disabled={!callState.active}
            className="rounded-md border border-red-400 px-3 py-1.5 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:text-red-300"
          >
            End call
          </button>

          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              disabled={hasStarted}
              onChange={(event) => handleToggleAttestedDemo(event.target.checked)}
              checked={callerId === DEMO_ATTESTED_CALLER_ID}
            />
            Simulate an attested caller (demo)
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="order-2 sm:order-1">
            <TranscriptPanel lines={callState.transcript} />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                aria-label="Speaker for typed line"
                value={typedSpeaker}
                onChange={(event) => setTypedSpeaker(event.target.value as Speaker)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="caller">Caller said</option>
                <option value="user">I said</option>
              </select>
              <input
                ref={typedInputRef}
                type="text"
                value={typedText}
                onChange={(event) => setTypedText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendTyped();
                }}
                placeholder="Type what's being said"
                aria-label="Type what's being said"
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleSendTyped}
                disabled={typedText.trim().length === 0}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
              >
                Send
              </button>
            </div>
          </div>

          <div className="order-1 flex flex-col gap-4 sm:order-2">
            <div className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <RiskDial risk={callState.risk} />
            </div>
            <div className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <MarkerLamps firedMarkers={callState.firedMarkers} pulsingMarkerId={pulsingMarkerId} />
            </div>
          </div>
        </div>

        {showInterviewCard && (
          <InterviewCard
            scamLabel={callState.scamLabel}
            statistic={callState.statistic}
            attestation={attestation}
            answer={interviewAnswer}
            onAnswerChange={setInterviewAnswer}
            onSubmit={handleSubmitInterview}
            submitting={interviewSubmitting}
            interviewResult={interviewResult}
          />
        )}

        <AiVerdictCard status={aiVerdictStatus} result={aiVerdictResult} onAskAgain={() => void handleAskAi()} />
      </main>
    </div>
  );
}
