/**
 * ScoreRush design tokens — single canonical source of truth.
 *
 * Re-derived from (not copy-pasted out of) the Premium Fantasy Refined spec at
 * `docs/design-reference/premium-fantasy-refined/PREMIUM_FANTASY_REFINED_IMPLEMENTATION_SPEC.md`.
 * That document remains the design *authority*; this module is the single place
 * the codebase reads token values from. `app/globals.css` mirrors the color/radius/
 * motion values below into CSS custom properties for Tailwind v4's `@theme inline`
 * — if you change a value, change it here first, then update globals.css to match.
 *
 * Do not import raw hex codes anywhere else in the app; import from here.
 */

export const colors = {
  bgPage: "#080B14",
  bgElevated: "#0E1320",
  surfaceCard: "#151B2A",
  surfaceCard2: "#1B2233",
  surfacePlum: "#241D32",
  interactive: "#5FA8D3",
  interactive2: "#7C83C9",
  gold: "#D6B56E",
  silver: "#AEB6C2",
  bronze: "#C9A876",
  success: "#4FAF83",
  coral: "#C87878",
  danger: "#D85C6A",
  textPrimary: "#F2F4F8",
  textSecondary: "#98A2B3",
  textMuted: "#6B7688",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.10)",
  overlay: "rgba(8,11,20,0.72)",
  focusRing: "#5FA8D3",
  focusRingHalo: "rgba(95,168,211,0.35)",
} as const;

export const gradients = {
  hero: `linear-gradient(160deg, ${colors.surfaceCard}, ${colors.bgElevated})`,
  achievements: `linear-gradient(160deg, ${colors.surfacePlum}, ${colors.surfaceCard2})`,
  avatarRingSelf: `linear-gradient(135deg, ${colors.interactive}, ${colors.interactive2})`,
  avatarRing1st: "linear-gradient(135deg, #D6B56E, #B89350)",
  avatarRing2nd: "linear-gradient(135deg, #AEB6C2, #7C8696)",
  goldRankRing: "linear-gradient(135deg, #D6B56E, #B8935088)",
  podium1st: "linear-gradient(180deg, #D6B56E, #B89350)",
  heroGlowWash:
    "radial-gradient(ellipse, rgba(214,181,110,0.10), transparent 70%)",
} as const;

export const radii = {
  card: "22px",
  cardHero: "24px",
  button: "16px",
  pill: "20px",
  tile: "14px",
  row: "12px",
  badgeLv: "8px",
  avatar: "50%",
  notification: "14px",
  podiumTop: "12px 12px 0 0",
} as const;

export const spacing = {
  pagePaddingX: "16px",
  pagePaddingBottom: "90px",
  headerPadding: "50px 18px 8px",
  cardPadding: "16px",
  cardPaddingHero: "18px",
  cardPaddingCompact: "10px",
  interCardGap: "14px",
  bottomNavHeight: "56px",
  desktopGridColumns: "340px 1fr 360px",
  desktopGutter: "18px",
  desktopOuterPadding: "20px 28px",
  desktopTopBarHeight: "72px",
  desktopMaxWidth: "1320px",
} as const;

export const typography = {
  fontFamily: 'Rubik, system-ui, "Segoe UI", Arial, sans-serif',
  weights: {
    secondaryLabel: 500,
    caption: 600,
    bodyStrong: 700,
    heading: 800,
    hero: 900,
  },
  scale: {
    heroTotalPoints: {
      mobile: "48px",
      desktop: "46px",
      weight: 900,
      lineHeight: 1.0,
    },
    heroRankNumber: {
      mobile: "44px",
      desktop: "42px",
      weight: 900,
      lineHeight: 0.9,
    },
    scoreValueOpen: {
      mobile: "52px",
      desktop: "62px",
      weight: 900,
      lineHeight: 1.0,
    },
    scoreValueDisplay: {
      mobile: "56px",
      desktop: "68px",
      weight: 900,
      lineHeight: 1.0,
    },
    resultScore: {
      mobile: "28px",
      desktop: "38px",
      weight: 900,
      lineHeight: 1.0,
    },
    cardTitle: {
      mobile: "13px",
      desktop: "14px",
      weight: 800,
      lineHeight: 1.2,
    },
    teamName: { mobile: "16px", desktop: "19px", weight: 800, lineHeight: 1.2 },
    greetingName: {
      mobile: "18px",
      desktop: "18px",
      weight: 800,
      lineHeight: 1.2,
    },
    body: { mobile: "12px", desktop: "13px", weight: 700, lineHeight: 1.4 },
    label: {
      mobile: "10.5px",
      desktop: "10.5px",
      weight: 600,
      lineHeight: 1.3,
    },
    countdownValue: {
      mobile: "15px",
      desktop: "16px",
      weight: 800,
      lineHeight: 1.0,
      tracking: "0.5px",
    },
    statTileNumber: {
      mobile: "19px",
      desktop: "18px",
      weight: 800,
      lineHeight: 1.0,
    },
  },
} as const;

export const motion = {
  duration: {
    fast: 120,
    normal: 220,
    slow: 420,
  },
  ease: {
    standard: [0.4, 0.0, 0.2, 1],
    out: [0.0, 0.0, 0.2, 1],
    in: [0.4, 0.0, 1, 1],
    emphasis: [0.2, 0.8, 0.2, 1],
  },
  spring: {
    soft: { type: "spring", stiffness: 260, damping: 26, mass: 0.9 },
    snappy: { type: "spring", stiffness: 420, damping: 30 },
  },
  stagger: 0.06,
} as const;

export type ColorToken = keyof typeof colors;
export type RadiusToken = keyof typeof radii;
