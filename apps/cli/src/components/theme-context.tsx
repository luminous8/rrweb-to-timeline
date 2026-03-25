export interface Colors {
  TEXT: string;
  DIM: string;
  GREEN: string;
  PRIMARY: string;
  SELECTION: string;
  RED: string;
  BORDER: string;
  DIVIDER: string;
  YELLOW: string;
  PURPLE: string;
  CYAN: string;
  INPUT_BG: string;
  BANNER_BG: string;
  ERROR_BG: string;
}

export const theme = {
  primary: "whiteBright",
  secondary: "gray",
  accent: "white",
  error: "red",
  warning: "yellow",
  success: "green",
  info: "gray",
  text: "white",
  textMuted: "gray",
  border: "gray",
  borderActive: "white",
  borderSubtle: "blackBright",
  shimmerBase: "#555555",
  shimmerHighlight: "#ffffff",
  inputBg: "#1e1e1e",
  bannerBg: "#332b00",
  errorBg: "#330b0b",
};

export const COLORS: Colors = {
  TEXT: theme.text,
  DIM: theme.textMuted,
  GREEN: theme.success,
  PRIMARY: theme.primary,
  SELECTION: theme.accent,
  RED: theme.error,
  BORDER: theme.border,
  DIVIDER: theme.borderSubtle,
  YELLOW: theme.warning,
  PURPLE: theme.secondary,
  CYAN: theme.info,
  INPUT_BG: theme.inputBg,
  BANNER_BG: theme.bannerBg,
  ERROR_BG: theme.errorBg,
};

export const useColors = (): Colors => COLORS;
