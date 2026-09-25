export type Instrument = {
  id: string;
  label: string;
  range: string;
};

export const CUSTOM_INSTRUMENT_ID = "custom";

export const INSTRUMENTS: Instrument[] = [
  { id: "bass4", label: "Upright / Electric Bass (4-string)", range: "E1-G4" },
  { id: "bass5", label: "Electric Bass (5-string)", range: "B0-G4" },
  { id: "guitar", label: "Guitar (6-string, standard tuning)", range: "E2-E6" },
  { id: "ukulele", label: "Ukulele (soprano, standard tuning)", range: "C4-A5" },
  { id: "piano88", label: "Piano — 88 Key", range: "A0-C8" },
  { id: "piano76", label: "Keyboard — 76 Key", range: "E1-G7" },
  { id: "piano73", label: "Keyboard — 73 Key", range: "E1-E7" },
  { id: "piano61", label: "Keyboard — 61 Key", range: "C2-C7" },
  { id: "piano49", label: "Keyboard — 49 Key", range: "C2-C6" },
  { id: "piano37", label: "Keyboard — 37 Key", range: "C3-C6" },
  { id: "piano25", label: "Keyboard — 25 Key", range: "C3-C5" },
  { id: "violin", label: "Violin", range: "G3-C7" },
  { id: "viola", label: "Viola", range: "C3-E6" },
  { id: "cello", label: "Cello", range: "C2-C6" },
  { id: "trumpet", label: "Trumpet", range: "F#3-D6" },
  { id: "trombone", label: "Trombone", range: "E2-F5" },
  { id: "altosax", label: "Alto Saxophone", range: "Db3-A5" },
  { id: "tenorsax", label: "Tenor Saxophone", range: "Ab2-E5" },
  { id: "flute", label: "Flute", range: "C4-D7" },
  { id: "clarinet", label: "Clarinet (Bb)", range: "D3-C7" },
];
