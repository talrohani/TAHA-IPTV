import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * A Tizen app loads index.html from file://, where module scripts are blocked: the build is one classic script
 * (IIFE), loaded with `defer` instead of `type="module"`.
 */
function classicScript(): Plugin {
  return {
    name: 'taha-classic-script',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/<script type="module" crossorigin src=/g, '<script defer src=').replace(/<script type="module" src=/g, '<script defer src=');
    },
  };
}

// Samsung AU7000 (2021, Tizen 6.0) runs Chromium 76: the bundle is compiled down to what it understands, with
// relative paths so the app works from the .wgt package.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  base: './',
  // One version for everything: package.json → the app (Settings) and the .wgt manifest (tizen/package.py).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [classicScript()],
  build: {
    target: ['es2019', 'chrome76'],
    cssTarget: 'chrome76',
    outDir: 'dist',
    assetsInlineLimit: 0,
    modulePreload: false,
    sourcemap: false,
    rollupOptions: { output: { format: 'iife' } },
  },
  test: { environment: 'node' },
} as never);
