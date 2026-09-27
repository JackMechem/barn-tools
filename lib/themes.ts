export const THEME_FIELDS = [
  { key: "background", label: "Page background" },
  { key: "surface", label: "Cards & sidebar" },
  { key: "surface-hover", label: "Hover / borders" },
  { key: "foreground", label: "Text" },
  { key: "muted", label: "Muted text" },
  { key: "accent", label: "Accent" },
  { key: "accent-hover", label: "Accent hover" },
  { key: "accent-foreground", label: "Text on accent" },
  { key: "overlay", label: "Modal backdrop" },
  { key: "danger", label: "Error" },
] as const;

export type ThemeColorKey = (typeof THEME_FIELDS)[number]["key"];
export type ThemeColors = Record<ThemeColorKey, string>;

export type ThemePreset = { id: string; label: string; colors: ThemeColors };

export const CUSTOM_THEME_ID = "custom";
export const OVERLAY_OPACITY = 0.6;

export const PRESETS: ThemePreset[] = [
  {
    id: "light",
    label: "Light",
    colors: {
      background: "#f4f4f6",
      surface: "#ffffff",
      "surface-hover": "#ececef",
      foreground: "#111114",
      muted: "#6b6b76",
      accent: "#6366f1",
      "accent-hover": "#4f52d6",
      "accent-foreground": "#ffffff",
      overlay: "#111114",
      danger: "#e0455a",
    },
  },
  {
    id: "dark",
    label: "Dark",
    colors: {
      background: "#0a0a0d",
      surface: "#18181f",
      "surface-hover": "#232330",
      foreground: "#f2f2f5",
      muted: "#9a9aa6",
      accent: "#818cf8",
      "accent-hover": "#a5aefb",
      "accent-foreground": "#0a0a0d",
      overlay: "#000000",
      danger: "#f28797",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: {
      background: "#0b1020",
      surface: "#131a2e",
      "surface-hover": "#1c2540",
      foreground: "#e6ebff",
      muted: "#8b96b8",
      accent: "#4f8cff",
      "accent-hover": "#79a6ff",
      "accent-foreground": "#06101f",
      overlay: "#000010",
      danger: "#ff7a8a",
    },
  },
  {
    id: "forest",
    label: "Forest",
    colors: {
      background: "#0f1a14",
      surface: "#172620",
      "surface-hover": "#20342b",
      foreground: "#e4f2e8",
      muted: "#8fae9a",
      accent: "#4ade80",
      "accent-hover": "#86efac",
      "accent-foreground": "#06140b",
      overlay: "#000000",
      danger: "#f28797",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    colors: {
      background: "#1c1216",
      surface: "#2a1a20",
      "surface-hover": "#3a2229",
      foreground: "#fdeee6",
      muted: "#c49a8c",
      accent: "#fb923c",
      "accent-hover": "#fdba74",
      "accent-foreground": "#1c0d05",
      overlay: "#100000",
      danger: "#fb7185",
    },
  },
  {
    id: "nord",
    label: "Nord",
    colors: {
      background: "#2e3440",
      surface: "#3b4252",
      "surface-hover": "#434c5e",
      foreground: "#eceff4",
      muted: "#a3aec4",
      accent: "#88c0d0",
      "accent-hover": "#8fbcbb",
      "accent-foreground": "#2e3440",
      overlay: "#1a1e26",
      danger: "#bf616a",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    colors: {
      background: "#21222c",
      surface: "#282a36",
      "surface-hover": "#343746",
      foreground: "#f8f8f2",
      muted: "#a0a6c4",
      accent: "#bd93f9",
      "accent-hover": "#d0b0ff",
      "accent-foreground": "#21222c",
      overlay: "#000000",
      danger: "#ff5555",
    },
  },
  {
    id: "rose",
    label: "Rose",
    colors: {
      background: "#fdf2f4",
      surface: "#ffffff",
      "surface-hover": "#fbe3e8",
      foreground: "#3b1520",
      muted: "#94606d",
      accent: "#e11d48",
      "accent-hover": "#be123c",
      "accent-foreground": "#ffffff",
      overlay: "#3b1520",
      danger: "#b91c1c",
    },
  },
  {
    id: "solarized",
    label: "Solarized",
    colors: {
      background: "#fdf6e3",
      surface: "#eee8d5",
      "surface-hover": "#e4ddc6",
      foreground: "#073642",
      muted: "#657b83",
      accent: "#268bd2",
      "accent-hover": "#1e6fa8",
      "accent-foreground": "#fdf6e3",
      overlay: "#002b36",
      danger: "#dc322f",
    },
  },
  {
    id: "coffee",
    label: "Coffee",
    colors: {
      background: "#f3ebe2",
      surface: "#fbf6f0",
      "surface-hover": "#e8dccd",
      foreground: "#2b1d14",
      muted: "#7d6553",
      accent: "#8b5a2b",
      "accent-hover": "#6f4520",
      "accent-foreground": "#ffffff",
      overlay: "#2b1d14",
      danger: "#b3372f",
    },
  },
];

export function getPreset(id: string): ThemePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isDarkColors(colors: ThemeColors): boolean {
  const hex = isValidHex(colors.background) ? colors.background : "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}
