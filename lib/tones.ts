import { getAudioContext } from "@/lib/metronome";
import { noteToFrequency } from "@/lib/noteRange";

type Tone = {
  id: string;
  label: string;
  wave: OscillatorType | number[];
  gain: number;
  decayFraction: number;
};

export const TONES: Tone[] = [
  { id: "triangle", label: "Triangle", wave: "triangle", gain: 0.4, decayFraction: 1 },
  { id: "sine", label: "Sine", wave: "sine", gain: 0.4, decayFraction: 1 },
  { id: "square", label: "Square", wave: "square", gain: 0.15, decayFraction: 1 },
  { id: "sawtooth", label: "Sawtooth", wave: "sawtooth", gain: 0.18, decayFraction: 1 },
  { id: "organ", label: "Organ", wave: [0, 1, 0.5, 0.35, 0.2, 0.1], gain: 0.3, decayFraction: 1 },
  { id: "pluck", label: "Pluck", wave: [0, 1, 0.6, 0.35, 0.2, 0.1, 0.05], gain: 0.4, decayFraction: 0.5 },
];

export const DEFAULT_TONE_ID = TONES[0].id;

export function playNote(note: string, durationSeconds: number, toneId: string) {
  const freq = noteToFrequency(note);
  if (freq === null) return;
  const tone = TONES.find((t) => t.id === toneId) ?? TONES[0];
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  if (typeof tone.wave === "string") {
    osc.type = tone.wave;
  } else {
    const real = new Float32Array(tone.wave.length);
    const imag = Float32Array.from(tone.wave);
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  }
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const end = now + durationSeconds * tone.decayFraction;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(tone.gain, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.start(now);
  osc.stop(end);
}
