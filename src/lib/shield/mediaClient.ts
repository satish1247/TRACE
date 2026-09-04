/**
 * Client for the `shield-ml` FastAPI model service (S6/S7), per
 * `.claude/project/API.md`. POSTs `multipart/form-data` (field "file") to
 * `http://localhost:8000/detect/face` and `/detect/voice`, 3s timeout.
 *
 * - VOICE: on timeout/network error, falls back to `acoustic.ts` (always
 *   available, in-browser, honestly labelled "indicators, not a trained
 *   classifier").
 * - FACE: on timeout/network error, there is no fallback — returns a clear
 *   "service unavailable" result (no browser-side face model exists).
 */
import { z } from "zod";
import { analyzeAudioBuffer, type AcousticAnalysisResult } from "./acoustic";

const MODEL_SERVICE_BASE_URL = "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 3000;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const ACCEPTED_AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"];

export interface ModelDetectionResult {
  verdict: "real" | "fake";
  confidence: number;
  model: string;
}

export type FaceDetectionOutcome =
  | { status: "ok"; result: ModelDetectionResult }
  | { status: "unavailable"; reason: string };

export type VoiceDetectionOutcome =
  | { status: "ok"; result: ModelDetectionResult }
  | { status: "fallback"; acoustic: AcousticAnalysisResult }
  | { status: "unavailable"; reason: string };

export type FileValidationResult = { valid: true } | { valid: false; reason: string };

/** Reject client-side, before any network call (USER-FLOWS.md). */
export function validateImageFile(file: File): FileValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, reason: "Choose a JPEG or PNG image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { valid: false, reason: "Choose an image under 10MB." };
  }
  return { valid: true };
}

/** Reject client-side, before any network call (USER-FLOWS.md). */
export function validateAudioFile(file: File): FileValidationResult {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
    return { valid: false, reason: "Choose a WAV/MP3 under 15MB." };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { valid: false, reason: "Choose a WAV/MP3 under 15MB." };
  }
  return { valid: true };
}

const ModelResponseSchema = z.object({
  verdict: z.enum(["real", "fake"]),
  confidence: z.number(),
  model: z.string(),
});

async function postForDetection(path: string, file: File): Promise<ModelDetectionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${MODEL_SERVICE_BASE_URL}${path}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Model service responded with HTTP ${response.status}`);
    }
    const json: unknown = await response.json();
    return ModelResponseSchema.parse(json);
  } finally {
    clearTimeout(timeoutId);
  }
}

interface AudioContextWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioWindow = window as unknown as AudioContextWindow;
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Web Audio API is not available in this browser");
  }
  const audioContext = new AudioContextCtor();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    void audioContext.close();
  }
}

/** POST an image to `/detect/face`. No fallback exists for this endpoint —
 * unavailability is reported as-is. */
export async function detectFace(file: File): Promise<FaceDetectionOutcome> {
  try {
    const result = await postForDetection("/detect/face", file);
    return { status: "ok", result };
  } catch (cause: unknown) {
    console.error("SHIELD: face model service unavailable", cause);
    return { status: "unavailable", reason: "Model service unavailable — start it and retry." };
  }
}

/** POST audio to `/detect/voice`. On timeout/network error, decodes the
 * same file in-browser and falls back to `acoustic.ts`. */
export async function detectVoice(file: File): Promise<VoiceDetectionOutcome> {
  try {
    const result = await postForDetection("/detect/voice", file);
    return { status: "ok", result };
  } catch (cause: unknown) {
    console.error("SHIELD: voice model service unavailable, falling back to acoustic analysis", cause);
    try {
      const audioBuffer = await decodeAudioFile(file);
      const acoustic = analyzeAudioBuffer(audioBuffer);
      return { status: "fallback", acoustic };
    } catch (decodeCause: unknown) {
      console.error("SHIELD: acoustic fallback failed to decode audio", decodeCause);
      return { status: "unavailable", reason: "Couldn't analyze this audio file — try a different file." };
    }
  }
}
