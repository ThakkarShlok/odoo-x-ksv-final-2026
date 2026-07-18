// Tailwind v3 runs as a PostCSS plugin (v4 would use @tailwindcss/vite instead).
// autoprefixer is required by Tailwind v3's documented setup — it adds vendor prefixes
// according to browserslist defaults.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
