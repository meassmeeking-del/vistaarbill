// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Netlify CI (NETLIFY=true) we build with Nitro's `netlify` preset.
// Everywhere else (Lovable preview/publish) the default Cloudflare build is kept.
const isNetlify = process.env["NETLIFY"] === "true" || process.env["NETLIFY"] === "1";

export default defineConfig(
  isNetlify ? { nitro: { preset: "netlify" } } : {},
);
