/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        surfaceContainerLow: "var(--surface-container-low)",
        surfaceContainerLowest: "var(--surface-container-lowest)",
        surfaceContainerHigh: "var(--surface-container-high)",
        surfaceContainerHighest: "var(--surface-container-highest)",
        nav: "var(--nav-bg)",
        card: "var(--card-bg)",
        onSurface: "var(--on-surface)",
        onSurfaceVariant: "var(--on-surface-variant)",
        outlineVariant: "var(--outline-variant)",
        primary: "var(--primary)",
        primaryContainer: "var(--primary-container)",
        secondaryContainer: "var(--secondary-container)",
        onSecondaryContainer: "var(--on-secondary-container)",
        tertiaryContainer: "var(--tertiary-container)",
        onTertiaryContainer: "var(--on-tertiary-container)",
        accentBlue: "var(--accent-blue)",
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(to bottom, #005DA7, #2976C7)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
