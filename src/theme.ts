// Central theme — Dark Green & Cream (app-wide green theme; was warm orange).
// StyleSheet-based (no NativeWind, which crashes production builds).
//
// Re-skin note (warm port): token KEYS are unchanged so every existing screen
// picks up the new values automatically. Only the brand/surface/text/neutral
// VALUES moved to the warm palette below. Status families (red/amber/green/
// blue/cyan/indigo/purple/pink), `yellow` and `unitColors` are left as-is
// because their colours carry meaning (urgency, loan, availability, etc.).
//
// Previous (pre-reskin) values for reference:
//   brand #B45309, brandDark #92400E, brandTint #B4530915, cream #FAF7F2,
//   ink #2A2A2A, night #1C1917, night2 #292524 (dark), line #E7E5E4,
//   muted #A8A29E, muted2 #57534E, slate #64748B, slateBg #F8FAFC,
//   slateBorder #E2E8F0, slateText #475569.
//
// WATCH OUT: `night2` flipped from a DARK surface (#292524) to a LIGHT peach
// (#E7F0EA). Call sites that drew white text / icons on night2 were fixed to
// use `ink` (now navy) instead — see MapLayersSheet.tsx and crm/LeadDetailView.tsx.

export const colors = {
  brand: '#1F4D3A', // dark green (app-wide green theme)
  brandDark: '#173D2E',
  brandTint: '#1F4D3A14', // ~8% green tint for subtle backgrounds
  cream: '#EAF8EE',
  ink: '#17233A', // primary text (dark navy)
  night: '#17233A', // deep navy surface
  night2: '#E7F0EA', // pale green (was dark #292524, then peach)
  line: '#ECE5D8',
  muted: '#8A918C',
  muted2: '#6B7280',
  white: '#FFFFFF',

  // status colors (semantically unchanged — colours carry meaning)
  red: '#DC2626',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  redText: '#B91C1C',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  amberText: '#B45309',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  blueBorder: '#BFDBFE',
  blueText: '#1D4ED8',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenText: '#15803D',
  cyan: '#0891B2',
  cyanBg: '#ECFEFF',
  cyanBorder: '#A5F3FC',
  cyanText: '#0E7490',
  indigo: '#4F46E5',
  indigoBg: '#EEF2FF',
  indigoBorder: '#C7D2FE',
  indigoText: '#4338CA',
  purple: '#9333EA',
  purpleBg: '#FAF5FF',
  purpleBorder: '#E9D5FF',
  purpleText: '#7E22CE',
  pink: '#DB2777',
  pinkBg: '#FDF2F8',
  pinkBorder: '#FBCFE8',
  pinkText: '#BE185D',
  // neutral chip family — warm beige on cream background (was cool slate)
  slate: '#6B7280',
  slateBg: '#EEF2EE',
  slateBorder: '#DCE5DE',
  slateText: '#3F4B44',
  yellow: '#EAB308',
};

// Unit-inventory grid colours (GitHub-contributions style). Booked is a plain
// orange rather than `brand` so a booked cell never reads as a tappable button.
export const unitColors = {
  available: colors.green,
  booked: '#EA580C',
  sold: colors.slate,
  'on-hold': colors.yellow,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
};

// Floating bottom navigation pill (dashboard). Lists that scroll behind it add
// FLOAT_NAV_SPACE of bottom padding so their last rows can scroll clear of it
// (pill height + its gap above the system inset + a little breathing room).
export const FLOAT_NAV_HEIGHT = 60;
// The footer is a normal full-width bar now, so lists only need a little air.
export const FLOAT_NAV_SPACE = 24;
