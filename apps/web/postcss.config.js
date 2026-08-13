/**
 * CommonJS, not .mjs, and deliberately so.
 *
 * The .mjs form was silently ignored: Next minified globals.css but never ran
 * the Tailwind plugin, so the shipped stylesheet still contained literal
 * `@tailwind` directives and the entire app rendered unstyled. Nothing failed
 * loudly — the build was green and the APK was plain HTML.
 *
 * `postcss.config.js` is the form Next resolves most reliably. The CI step
 * "Verify Tailwind compiled" now fails the build if `@tailwind` survives into
 * the output, so this cannot regress unnoticed again.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
