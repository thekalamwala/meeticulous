/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0079C1",
        "primary-dark": "#005E99",
        // White-text buttons only. #0079C1 + white = 3.26:1 (fails WCAG AA);
        // this darker shade = ~5.3:1. Keep `primary` for accents/large text.
        "primary-cta": "#00457C",
        "primary-light": "#D6ECF8",
        secondary: "#f59e0b",
        surface: "#ffffff",
        muted: "#6b7280",
        ink: "#191919",
        sand: "#F1F5F9",
        canvas: "#F8FAFC",
        // Accent palette — reusable multi-hue accents (Calendly-style colour).
        // Mirrors --c-* in src/styles/design-tokens.css — keep both in sync.
        // Literal hex (not var) so Tailwind's /opacity modifier can compute alpha.
        "c-blue": "#0079C1",
        "c-violet": "#1DA1F2",
        "c-cyan": "#36D8FF",
        "c-emerald": "#059669",
        "c-amber": "#f59e0b",
        "c-pink": "#db2777",
      },
      fontFamily: {
        sans: ["Poppins", "Poppins Fallback", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Plus Jakarta Sans Fallback", "Poppins", "system-ui", "sans-serif"],
      },
      // Global radius rule: 4px max; 6px only for a wrapper that contains a 4px child.
      // `full` kept for pills/avatars. Overrides Tailwind's default rounded-* scale app-wide.
      borderRadius: {
        none: "0px",
        sm: "4px",
        DEFAULT: "4px",
        md: "4px",
        lg: "4px",
        xl: "6px",
        "2xl": "6px",
        "3xl": "6px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
