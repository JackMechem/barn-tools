import { getAudioContext } from "@/lib/metronome";

/** 0 = silent, 1 = normal click, 2 = accented click. */
export type BeatLevel = 0 | 1 | 2;

type ClickSound = {
  id: string;
  label: string;
  wave: OscillatorType;
  accentFreq: number;
  normalFreq: number;
  subFreq: number;
  length: number;
  gain: number;
};

export const CLICK_SOUNDS: ClickSound[] = [
  {
    id: "classic",
    label: "Classic click",
    wave: "sine",
    accentFreq: 1500,
    normalFreq: 900,
    subFreq: 700,
    length: 0.06,
    gain: 1,
  },
  {
    id: "beep",
    label: "Beep",
    wave: "sine",
    accentFreq: 1046,
    normalFreq: 784,
    subFreq: 523,
    length: 0.12,
    gain: 0.8,
  },
  {
    id: "wood",
    label: "Woodblock",
    wave: "triangle",
    accentFreq: 1300,
    normalFreq: 950,
    subFreq: 750,
    length: 0.045,
    gain: 1,
  },
  {
    id: "digital",
    label: "Digital",
    wave: "square",
    accentFreq: 1760,
    normalFreq: 1175,
    subFreq: 880,
    length: 0.04,
    gain: 0.35,
  },
  {
    id: "soft",
    label: "Soft thump",
    wave: "triangle",
    accentFreq: 330,
    normalFreq: 220,
    subFreq: 165,
    length: 0.09,
    gain: 1.1,
  },
];

export const DEFAULT_CLICK_SOUND_ID = CLICK_SOUNDS[0].id;

export type ClickSettings = {
  bpm: number;
  beatsPerBar: number;
  accents: BeatLevel[];
  subdivision: number;
  volume: number;
  soundId: string;
};

export type ClickEngine = {
  stop: () => void;
};

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.12;

export function scheduleClick(
  ctx: AudioContext,
  time: number,
  wave: OscillatorType,
  freq: number,
  gain: number,
  length: number,
): OscillatorNode {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = wave;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(Math.max(gain, 0.0001), time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + length);
  osc.start(time);
  osc.stop(time + length);
  return osc;
}

/**
 * Starts a drift-free metronome. Settings are read on every scheduled tick, so
 * tempo, accents and subdivisions can change while it is running.
 * `onTick` fires (roughly) when each main beat is heard.
 */
export function startClickEngine(
  getSettings: () => ClickSettings,
  onBeat: (beat: number) => void,
): ClickEngine {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();

  let nextTime = ctx.currentTime + 0.06;
  let beat = 0;
  let sub = 0;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();

  const id = setInterval(() => {
    while (nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      const s = getSettings();
      if (beat >= s.beatsPerBar) beat = 0;
      if (sub >= s.subdivision) sub = 0;

      const sound = CLICK_SOUNDS.find((c) => c.id === s.soundId) ?? CLICK_SOUNDS[0];
      const vol = s.volume * sound.gain;

      if (sub === 0) {
        const level = s.accents[beat] ?? 1;
        if (level === 2) {
          scheduleClick(ctx, nextTime, sound.wave, sound.accentFreq, 0.9 * vol, sound.length);
        } else if (level === 1) {
          scheduleClick(ctx, nextTime, sound.wave, sound.normalFreq, 0.55 * vol, sound.length);
        }
        const shownBeat = beat;
        const delayMs = Math.max(0, (nextTime - ctx.currentTime) * 1000);
        const t = setTimeout(() => {
          timeouts.delete(t);
          onBeat(shownBeat);
        }, delayMs);
        timeouts.add(t);
      } else {
        scheduleClick(ctx, nextTime, sound.wave, sound.subFreq, 0.25 * vol, sound.length * 0.6);
      }

      nextTime += 60 / s.bpm / s.subdivision;
      sub++;
      if (sub >= s.subdivision) {
        sub = 0;
        beat++;
        if (beat >= s.beatsPerBar) beat = 0;
      }
    }
  }, SCHEDULER_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(id);
      for (const t of timeouts) clearTimeout(t);
      timeouts.clear();
    },
  };
}
