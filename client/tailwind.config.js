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
        "primary-light": "#FBE3E8",
        secondary: "#FF9FB0",
        teal: "#00C9C6",
        "teal-ink": "#0E7C7A",
        "surface-dark": "#5E0820",
        "surface-darker": "#3D0514",
        "ink-brand": "#3D0514",
        surface: "#ffffff",
        muted: "#6E5257",
        ink: "#2A1416",
        sand: "#FFF1F4",
        canvas: "#FFF8FA",
        // Accent palette — reusable multi-hue accents (Calendly-style colour).
        // Mirrors --c-* in src/styles/design-tokens.css — keep both in sync.
        // Literal hex (not var) so Tailwind's /opacity modifier can compute alpha.
        "c-blue": "#0079C1",
        "c-violet": "#1DA1F2",
        "c-cyan": "#36D8FF",
        "c-emerald": "#059669",
        "c-amber": "#f59e0b",
        "c-pink": "#db2777",
        // Action accent — crimson conversion CTA.
        action: "#960D32",
        "action-dark": "#7A0A28",
        // Semantic status (fg = text/icon/solid, bg = subtle tint). Keep in sync
        // with the --*-fg / --*-bg vars in src/styles/design-tokens.css.
        "success-fg": "#15803D",
        "success-bg": "#DCFCE7",
        "warning-fg": "#B45309",
        "warning-bg": "#FEF3C7",
        "error-fg": "#DC2626",
        "error-bg": "#FEE2E2",
        "info-fg": "#0369A1",
        "info-bg": "#E0F2FE",
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
