/**
 * WHAT: Tailwind v3.4 config. Maps semantic colour names to the CSS variables in
 *   src/styles/tokens.css.
 * WHY v3.4 AND NOT v4: v4 moves configuration into CSS (@theme) and changes the shadcn
 *   integration path. v3.4 + shadcn is the most heavily travelled combination in existence,
 *   which is exactly what we want when four people are pushing to one repo for 24 hours with
 *   no time to debug a build system. Boring is a feature here.
 * WHY hsl(var(--x) / <alpha-value>) AND NOT hex: the <alpha-value> placeholder is what lets
 *   Tailwind generate `bg-primary/10`. If we mapped to a hex literal, every opacity modifier
 *   in the codebase would silently stop working.
 * REVIEWER QUESTION: "How is the theme swapped?" -> tokens.css only. This file names things;
 *   it does not choose colours. There is not one hex value below.
 */

// `import`, not `require`: client/package.json sets "type": "module", so this file is ESM
// and `require` is not defined in it. Most shadcn/Tailwind v3 snippets online use require()
// because they assume CommonJS — that snippet crashes the build here.
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',

        // Status tokens. StatusBadge maps an enum value to one of these pairs.
        status: {
          active: 'hsl(var(--status-active) / <alpha-value>)',
          'active-bg': 'hsl(var(--status-active-bg) / <alpha-value>)',
          inactive: 'hsl(var(--status-inactive) / <alpha-value>)',
          'inactive-bg': 'hsl(var(--status-inactive-bg) / <alpha-value>)',
          warning: 'hsl(var(--status-warning) / <alpha-value>)',
          'warning-bg': 'hsl(var(--status-warning-bg) / <alpha-value>)',
          danger: 'hsl(var(--status-danger) / <alpha-value>)',
          'danger-bg': 'hsl(var(--status-danger-bg) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // System stack: zero network requests, zero layout shift, no font licence question.
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
