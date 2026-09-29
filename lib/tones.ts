import { getAudioContext } from "@/lib/metronome";
import { noteToFrequency } from "@/lib/noteRange";

type Tone = {
  id: string;
  label: string;
  /** Renders one note starting at `ctx.currentTime`, decaying to silence by roughly
      `durationSeconds` later. Everything (oscillators, filters, envelopes) is built fresh per
      call — there's no persistent audio graph to manage between notes. */
  play: (ctx: AudioContext, freq: number, durationSeconds: number) => void;
};

/** The original tone shape: a single oscillator (a built-in waveform, or a custom one described
    as Fourier `[DC, fundamental, 2nd harmonic, …]` gains via `PeriodicWave`) with a plain
    attack/decay envelope. Used for the simple synth waves below. */
function waveTone(wave: OscillatorType | number[], gain: number, decayFraction = 1) {
  return (ctx: AudioContext, freq: number, durationSeconds: number) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    if (typeof wave === "string") {
      osc.type = wave;
    } else {
      const real = new Float32Array(wave.length);
      const imag = Float32Array.from(wave);
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    }
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(ctx.destination);
    const end = now + durationSeconds * decayFraction;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(now);
    osc.stop(end);
  };
}

/** A rough acoustic-piano-ish tone: a handful of sine partials, each a touch sharp of an exact
    integer multiple of the fundamental (a struck string's partials really are slightly
    inharmonic — that detuning is most of what separates "piano" from "stack of pure sines"),
    through a lowpass filter whose cutoff sweeps down over the note's length. A hammer strike is
    bright and a piano note audibly darkens as it rings out, which a static waveform can't
    capture. Entirely synthesized (Web Audio oscillators/filters) rather than sampled — there's no
    audio-asset pipeline in this app (everything else here is synthesis or the mic), so this is an
    approximation, not a recording. */
function pianoTone(ctx: AudioContext, freq: number, durationSeconds: number) {
  const now = ctx.currentTime;
  const end = now + durationSeconds;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.5, now + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  out.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(Math.min(9000, freq * 10), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 300), end);
  filter.connect(out);

  const partials = [
    { ratio: 1, gain: 1 },
    { ratio: 2.01, gain: 0.55 },
    { ratio: 3.03, gain: 0.28 },
    { ratio: 4.06, gain: 0.14 },
    { ratio: 5.1, gain: 0.07 },
  ];
  for (const { ratio, gain } of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    const partialGain = ctx.createGain();
    partialGain.gain.value = gain;
    osc.connect(partialGain);
    partialGain.connect(filter);
    osc.start(now);
    osc.stop(end);
  }
}

/** A rough Fender Rhodes-ish tone via 2-operator FM: a sine carrier at the fundamental, FM'd by
    a sine an octave above it, with the modulation index (the FM "bark") decaying quickly from a
    bright attack into the smoother, warmer sustained tone a struck tine and pickup actually make.
    Same caveat as the piano tone — synthesized, not sampled. */
function rhodesTone(ctx: AudioContext, freq: number, durationSeconds: number) {
  const now = ctx.currentTime;
  const end = now + durationSeconds;

  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = freq;

  const modulator = ctx.createOscillator();
  modulator.type = "sine";
  modulator.frequency.value = freq * 2;

  // The modulation index, in Hz of FM deviation on the carrier — high at the attack (the bright
  // "bark"), decaying to a gentle vibrato-like amount for the sustain. Clamped so a short note
  // doesn't spend its whole length in the bark.
  const modGain = ctx.createGain();
  const barkTime = Math.min(0.35, durationSeconds * 0.6);
  modGain.gain.setValueAtTime(freq * 1.6, now);
  modGain.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.05), now + barkTime);
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  carrier.connect(out);
  out.connect(ctx.destination);

  modulator.start(now);
  carrier.start(now);
  modulator.stop(end);
  carrier.stop(end);
}

export const TONES: Tone[] = [
  { id: "triangle", label: "Triangle", play: waveTone("triangle", 0.4) },
  { id: "sine", label: "Sine", play: waveTone("sine", 0.4) },
  { id: "square", label: "Square", play: waveTone("square", 0.15) },
  { id: "sawtooth", label: "Sawtooth", play: waveTone("sawtooth", 0.18) },
  { id: "organ", label: "Organ", play: waveTone([0, 1, 0.5, 0.35, 0.2, 0.1], 0.3) },
  {
    id: "pluck",
    label: "Pluck",
    play: waveTone([0, 1, 0.6, 0.35, 0.2, 0.1, 0.05], 0.4, 0.5),
  },
  { id: "piano", label: "Piano", play: pianoTone },
  { id: "rhodes", label: "Rhodes", play: rhodesTone },
];

export const DEFAULT_TONE_ID = TONES[0].id;

export function playNote(note: string, durationSeconds: number, toneId: string) {
  const freq = noteToFrequency(note);
  if (freq === null) return;
  const tone = TONES.find((t) => t.id === toneId) ?? TONES[0];
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  tone.play(ctx, freq, durationSeconds);
}
