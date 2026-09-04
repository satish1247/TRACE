/**
 * In-browser Web Audio API feature extraction for the offline
 * deepfake-audio fallback (S6, when `localhost:8000/detect/voice` is
 * unreachable). Pure given an `AudioBuffer` — no network, no ML model.
 *
 * PRD-1-SHIELD.md is explicit: this is "indicators, not a trained
 * classifier," and that label must always travel with the numbers. Every
 * result this module returns carries that disclaimer for the UI to show
 * verbatim, never a bare verdict.
 */

export interface AcousticFeatures {
  /** Breath/speech pauses detected per minute of audio. */
  breathPauseRate: number;
  /** Loudest-to-quietest voiced-frame spread, in dB. */
  dynamicRangeDb: number;
  /** 0..1; geometric-mean/arithmetic-mean of the power spectrum, averaged
   * across analysis frames. Closer to 1 = noise-like/flat spectrum. */
  spectralFlatness: number;
  /** 0..1 share of total spectral energy found above 8 kHz. */
  energyAbove8kHzRatio: number;
  /** 0..1 share of analysis frames classified as silence. */
  silenceShare: number;
  /** 0..1 share of samples at or beyond the clipping threshold. */
  clippingRatio: number;
}

export type AcousticVerdict = "likely_real" | "likely_synthetic" | "uncertain";

export interface AcousticAnalysisResult {
  verdict: AcousticVerdict;
  /** 0..1 — a heuristic confidence in `verdict`, not a model probability. */
  confidence: number;
  features: AcousticFeatures;
  /** Always present; the UI must render this next to any number here. */
  disclaimer: string;
  label: string;
}

const DISCLAIMER = "Indicators, not a trained classifier.";

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
/** Bound analysis cost on long recordings — a hackathon demo clip is short. */
const MAX_FRAMES = 400;
const CLIPPING_THRESHOLD = 0.999;
const SILENCE_RMS_THRESHOLD = 0.01;
/** A gap of voiced->silence->voiced this long or longer counts as a pause. */
const MIN_PAUSE_MS = 150;

/** Downmix a possibly multi-channel buffer to mono, without mutating it. */
function toMonoSamples(buffer: AudioBuffer): Float32Array {
  const channelCount = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] / channelCount;
    }
  }
  return mono;
}

/** In-place iterative radix-2 Cooley-Tukey FFT. `re`/`im` length must be a
 * power of two. Pure with respect to the caller: operates on private copies. */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const evenIndex = start + k;
        const oddIndex = start + k + len / 2;
        const oddRe = re[oddIndex] * curRe - im[oddIndex] * curIm;
        const oddIm = re[oddIndex] * curIm + im[oddIndex] * curRe;
        re[oddIndex] = re[evenIndex] - oddRe;
        im[oddIndex] = im[evenIndex] - oddIm;
        re[evenIndex] += oddRe;
        im[evenIndex] += oddIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

interface FrameMetrics {
  rms: number;
  powerSpectrum: Float64Array;
}

function analyzeFrame(samples: Float32Array, start: number, sampleRate: number): FrameMetrics {
  const re = new Float64Array(FRAME_SIZE);
  const im = new Float64Array(FRAME_SIZE);
  let sumSquares = 0;
  for (let i = 0; i < FRAME_SIZE; i += 1) {
    const sampleIndex = start + i;
    const sample = sampleIndex < samples.length ? samples[sampleIndex] : 0;
    // Hann window reduces spectral leakage.
    const windowed = sample * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));
    re[i] = windowed;
    sumSquares += sample * sample;
  }
  fftInPlace(re, im);

  const halfLength = FRAME_SIZE / 2;
  const powerSpectrum = new Float64Array(halfLength);
  for (let bin = 0; bin < halfLength; bin += 1) {
    powerSpectrum[bin] = re[bin] * re[bin] + im[bin] * im[bin];
  }

  return { rms: Math.sqrt(sumSquares / FRAME_SIZE), powerSpectrum };
}

function toDb(amplitude: number): number {
  const floor = 1e-8;
  return 20 * Math.log10(Math.max(amplitude, floor));
}

function spectralFlatnessOf(powerSpectrum: Float64Array): number {
  const floor = 1e-12;
  let logSum = 0;
  let sum = 0;
  // Skip bin 0 (DC).
  for (let bin = 1; bin < powerSpectrum.length; bin += 1) {
    const value = Math.max(powerSpectrum[bin], floor);
    logSum += Math.log(value);
    sum += value;
  }
  const count = powerSpectrum.length - 1;
  const geometricMean = Math.exp(logSum / count);
  const arithmeticMean = sum / count;
  return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
}

function energyAbove8kHzOf(powerSpectrum: Float64Array, sampleRate: number): number {
  const binHz = sampleRate / FRAME_SIZE;
  const cutoffBin = Math.round(8000 / binHz);
  let total = 0;
  let above = 0;
  for (let bin = 0; bin < powerSpectrum.length; bin += 1) {
    total += powerSpectrum[bin];
    if (bin >= cutoffBin) above += powerSpectrum[bin];
  }
  return total > 0 ? above / total : 0;
}

function countClipping(samples: Float32Array): number {
  let clipped = 0;
  for (let i = 0; i < samples.length; i += 1) {
    if (Math.abs(samples[i]) >= CLIPPING_THRESHOLD) clipped += 1;
  }
  return samples.length > 0 ? clipped / samples.length : 0;
}

function countPauses(frameIsSilent: readonly boolean[], hopSeconds: number): number {
  const minPauseFrames = Math.max(1, Math.round(MIN_PAUSE_MS / 1000 / hopSeconds));
  let pauses = 0;
  let runLength = 0;
  let sawVoicedBefore = false;

  for (const isSilent of frameIsSilent) {
    if (isSilent) {
      runLength += 1;
    } else {
      if (sawVoicedBefore && runLength >= minPauseFrames) {
        pauses += 1;
      }
      runLength = 0;
      sawVoicedBefore = true;
    }
  }
  return pauses;
}

function classifyVerdict(features: AcousticFeatures): { verdict: AcousticVerdict; confidence: number } {
  // Heuristic, not a trained model: real speech tends to have irregular
  // breath pauses, wide dynamic range, non-flat spectrum, and some energy
  // rolloff above 8kHz relative to a lot of synthetic voices which can be
  // spectrally flatter and hyper-consistent in level.
  let syntheticScore = 0;
  let signalCount = 0;

  if (features.spectralFlatness > 0.35) {
    syntheticScore += 1;
  }
  signalCount += 1;

  if (features.dynamicRangeDb < 20) {
    syntheticScore += 1;
  }
  signalCount += 1;

  if (features.breathPauseRate < 4) {
    syntheticScore += 1;
  }
  signalCount += 1;

  if (features.energyAbove8kHzRatio < 0.02) {
    syntheticScore += 1;
  }
  signalCount += 1;

  const ratio = syntheticScore / signalCount;
  const confidence = Math.abs(ratio - 0.5) * 2;

  if (ratio >= 0.75) {
    return { verdict: "likely_synthetic", confidence };
  }
  if (ratio <= 0.25) {
    return { verdict: "likely_real", confidence };
  }
  return { verdict: "uncertain", confidence };
}

/**
 * Extract acoustic forensic features from a decoded audio buffer and return
 * a heuristic verdict guess alongside the raw measured numbers. Always
 * labelled as indicators, never presented as a trained classifier's output.
 */
export function analyzeAudioBuffer(buffer: AudioBuffer): AcousticAnalysisResult {
  const samples = toMonoSamples(buffer);
  const sampleRate = buffer.sampleRate;
  const hopSeconds = HOP_SIZE / sampleRate;

  const frameStarts: number[] = [];
  for (let start = 0; start + FRAME_SIZE <= samples.length && frameStarts.length < MAX_FRAMES; start += HOP_SIZE) {
    frameStarts.push(start);
  }
  // Guarantee at least one frame even for very short clips.
  if (frameStarts.length === 0) frameStarts.push(0);

  const frameRms: number[] = [];
  const frameIsSilent: boolean[] = [];
  const flatnessValues: number[] = [];
  const highFreqRatios: number[] = [];

  for (const start of frameStarts) {
    const { rms, powerSpectrum } = analyzeFrame(samples, start, sampleRate);
    frameRms.push(rms);
    frameIsSilent.push(rms < SILENCE_RMS_THRESHOLD);
    flatnessValues.push(spectralFlatnessOf(powerSpectrum));
    highFreqRatios.push(energyAbove8kHzOf(powerSpectrum, sampleRate));
  }

  const voicedDb = frameRms
    .filter((rms) => rms >= SILENCE_RMS_THRESHOLD)
    .map(toDb);
  const dynamicRangeDb =
    voicedDb.length > 0 ? Math.max(...voicedDb) - Math.min(...voicedDb) : 0;

  const silenceShare = frameIsSilent.filter(Boolean).length / frameIsSilent.length;
  const pauses = countPauses(frameIsSilent, hopSeconds);
  const durationMinutes = (samples.length / sampleRate) / 60;
  const breathPauseRate = durationMinutes > 0 ? pauses / durationMinutes : 0;

  const spectralFlatness = flatnessValues.reduce((a, b) => a + b, 0) / flatnessValues.length;
  const energyAbove8kHzRatio = highFreqRatios.reduce((a, b) => a + b, 0) / highFreqRatios.length;
  const clippingRatio = countClipping(samples);

  const features: AcousticFeatures = {
    breathPauseRate: Number(breathPauseRate.toFixed(2)),
    dynamicRangeDb: Number(dynamicRangeDb.toFixed(2)),
    spectralFlatness: Number(spectralFlatness.toFixed(4)),
    energyAbove8kHzRatio: Number(energyAbove8kHzRatio.toFixed(4)),
    silenceShare: Number(silenceShare.toFixed(4)),
    clippingRatio: Number(clippingRatio.toFixed(4)),
  };

  const { verdict, confidence } = classifyVerdict(features);

  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    features,
    disclaimer: DISCLAIMER,
    label: DISCLAIMER,
  };
}
