import { Platform } from "react-native";

export const colors = {
  bg: "#FAF9F5",
  surface: "#F0EEE6",
  surfaceAlt: "#FFFFFF",
  text: "#282D25",
  textMuted: "#62665C",
  textFaint: "#72766B",
  hairline: "#E1E3D8",
  accent: "#465A35",
  accentPressed: "#344428",
  accentSoft: "#EDF1E6",
  terracotta: "#9E4F36",
  primaryBg: "#465A35",
  primaryText: "#FFFFFF",
  primaryBgDisabled: "#E3E5DB",
  primaryTextDisabled: "#686E60",
  secondaryBorder: "#D5D9CB",
  secondaryText: "#37442E",
  error: "#A22E2B",
  errorBg: "#FCF0EC",
  tabBarBg: "#FAF9F5",
  tabActive: "#465A35",
  tabInactive: "#72766B",
  devChipOkBg: "#467A47",
  devChipErrBg: "#A22E2B",
  devChipLoadingBg: "#E3E5DB",
} as const;

export const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, serif",
});
export const type = {
  display: {
    fontFamily: serif,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "400" as const,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "400" as const,
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 15, lineHeight: 24, fontWeight: "400" as const },
  inputLabel: { fontSize: 13, fontWeight: "600" as const },
  input: { fontSize: 16, fontWeight: "400" as const },
  button: { fontSize: 14, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 23, fontWeight: "400" as const },
  name: { fontSize: 18, lineHeight: 25, fontWeight: "600" as const },
  meta: { fontSize: 13, lineHeight: 20, fontWeight: "500" as const },
  label: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700" as const,
    letterSpacing: 1.7,
    textTransform: "uppercase" as const,
  },
};
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
