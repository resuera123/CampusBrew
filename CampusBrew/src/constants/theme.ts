// CampusBrew Design System — sourced from SDD wireframes
// Frame size: 390×844 (iPhone 14 Pro)

export const COLORS = {
  // Primary brand
  primary: '#94353E',        // CIT-U Maroon
  primaryHover: '#7A2C33',   // Darker maroon for pressed states
  primaryLight: '#B85C65',   // Lighter maroon for secondary badges

  // Accent
  gold: '#F4C600',           // Gold — rewards, verification, incentives
  goldLight: '#FFD84D',      // Light gold — info chips, COD banners

  // Neutrals
  black: '#000000',
  text: '#000000',           // Primary text
  textSecondary: '#3A3A3A',  // Secondary text, placeholders, captions
  background: '#FFFFFF',     // Screen backgrounds
  backgroundSecondary: '#F5F5F5', // Cards, input backgrounds, sections
  border: '#E8E8E8',         // Input borders, dividers
  white: '#FFFFFF',

  // Payment
  gcashBlue: '#007DFF',
} as const;

export const FONTS = {
  // Wireframe uses Inter — React Native defaults to system font
  // which is close enough; if you want exact match, install expo-font + Inter
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const SIZES = {
  // Input fields
  inputHeight: 48,
  inputBorderRadius: 8,
  inputFontSize: 16,

  // Buttons
  buttonHeight: 48,
  buttonBorderRadius: 24, // Fully rounded pill buttons per wireframe
  buttonFontSize: 16,

  // Logo
  logoSize: 80,
  logoIconSize: 40,

  // Spacing
  screenPadding: 16,
  formGap: 16,

  // Text
  titleSize: 24,
  headingSize: 22,
  bodySize: 16,
  captionSize: 14,
  smallSize: 12,
  tinySize: 10,
} as const;