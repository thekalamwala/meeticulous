/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#960D32",
        "primary-dark": "#7A0A28",
        // White-text buttons + body links. Crimson #960D32 on white = ~8.7:1 (AA/AAA).
        "primary-cta": "#960D32",
        "primary-light": "#FBE3E8", // --maroon-100
        secondary: "#FF9FB0", // --mt-pink
        teal: "#E0506F", // retired teal → --mt-rose (kit: no second accent hue)
        "teal-ink": "#960D32", // → --mt-maroon
        "surface-dark": "#960D32", // brand field → --mt-maroon
        "surface-darker": "#7A0A28", // → --mt-maroon-dark
        "ink-brand": "#3D0514",
        surface: "#ffffff",
        // Meeticulous design system (design-system/tokens/colors.css). Literal hex so
        // Tailwind's /opacity modifier works. Marigold = open time slots ONLY.
        maroon: { DEFAULT: "#960D32", dark: "#7A0A28", 50: "#FDF2F4", 100: "#FBE3E8", 200: "#F5C2CD", 300: "#EB93A6", 400: "#D65A79", 500: "#B8224C", 600: "#960D32", 700: "#7A0A28", 800: "#5C0820", 900: "#3D0516" },
        rose: { DEFAULT: "#E0506F", 400: "#E87A92", 500: "#E0506F", 600: "#C43A59", 700: "#A12A47" },
        pink: { DEFAULT: "#FF9FB0", 50: "#FFF7F9", 100: "#FFF1F4", 200: "#FFE4EA", 300: "#FFC9D3", 400: "#FF9FB0" },
        // Warm neutral ramp (cream → ink) replaces Tailwind's cold greys site-wide.
        neutral: { 0: "#FFFFFF", 50: "#FBF5F3", 100: "#F5ECEA", 200: "#EBDCD9", 300: "#D9C4C0", 400: "#B39A96", 500: "#8C716D", 600: "#6B524F", 700: "#4D3634", 800: "#34201F", 900: "#2B0A14" },
        blush: "#FFE4EA",
        cream: "#FBF5F3",
        marigold: { DEFAULT: "#F6C35A", 100: "#FDF0D2", 300: "#F9D684", 600: "#C68A12", 800: "#5A3A00" },
        muted: "#6B524F", // --neutral-600
        ink: "#2B0A14", // --mt-ink
        sand: "#FFE4EA", // --mt-blush
        canvas: "#FBF5F3", // --mt-cream (page ground)
        // Accent palette — reusable multi-hue accents (Calendly-style colour).
        // Mirrors --c-* in src/styles/design-tokens.css — keep both in sync.
        // Literal hex (not var) so Tailwind's /opacity modifier can compute alpha.
        "c-blue": "#960D32", // kit has no blue/purple: accents collapse onto the brand ramp
        "c-violet": "#E0506F",
        "c-cyan": "#FF9FB0",
        "c-emerald": "#1F7A4D",
        "c-amber": "#C68A12",
        "c-pink": "#C43A59",
        // Action accent — crimson conversion CTA.
        action: "#960D32",
        "action-dark": "#7A0A28",
        // Semantic status (fg = text/icon/solid, bg = subtle tint). Keep in sync
        // with the --*-fg / --*-bg vars in src/styles/design-tokens.css.
        "success-fg": "#1F7A4D",
        "success-bg": "#E3F4EA",
        "warning-fg": "#C68A12",
        "warning-bg": "#FDF0D2",
        "error-fg": "#B42318",
        "error-bg": "#FDE8E6",
        "info-fg": "#2F5DA8",
        "info-bg": "#E6EEFA",
      },
      fontFamily: {
        // Brand type: Poppins for body, UI and card titles (H3); Bricolage Grotesque
        // for H1 + section H2 (`font-display`, and the global h1/h2 rule in
        // index.css). `heading` stays as an alias so existing classes keep working.
        sans: ["Poppins", "Poppins Fallback", "system-ui", "sans-serif"],
        heading: ["Poppins", "Poppins Fallback", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "Bricolage Grotesque Fallback", "Poppins", "system-ui", "sans-serif"],
        // Instrument Serif italic: ONE human phrase per layout, never buttons/nav/body.
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
      // Design-system radius scale (design-system/tokens/radius.css): nothing is
      // square-cornered. inputs 16 · slots 20 · cards 24 · dialogs 32 · buttons/tags pill.
      borderRadius: {
        none: "0px",
        xs: "6px",
        sm: "10px",
        DEFAULT: "10px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "24px",
        "3xl": "32px",
        full: "9999px",
      },

    },
  },
  plugins: [],
};
