import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// index.html takes its strings from src/i18n/en.json too: %i18n:meta.title%.
// {marketplace} inside them is the name from the generated catalog.
function i18nHtml() {
  const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
  return {
    name: 'i18n-html',
    transformIndexHtml(html) {
      const messages = read('./src/i18n/en.json');
      const { marketplace } = read('./src/generated/catalog.json');
      return html.replace(/%i18n:([\w.]+)%/g, (m, key) => {
        const value = key.split('.').reduce((node, part) => node?.[part], messages);
        if (typeof value !== 'string') throw new Error(`index.html: missing i18n string "${key}"`);
        return value.replace(/\{marketplace\}/g, marketplace.name).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      });
    },
  };
}

// Strict CSP (SITE-SPEC §9.4) for the built site only. The dev server injects
// CSS as inline <style> tags and an inline HMR preamble, which it would block.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
  + "connect-src 'self'; base-uri 'self'; form-action 'none'";

function cspMeta() {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  };
}

// GitHub Pages serves a project site from /<repo>/, so asset URLs need that
// prefix. CI passes BASE_PATH from actions/configure-pages; locally it is '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), i18nHtml(), cspMeta()],
  build: {
    outDir: 'dist',
    // Inlined data: fonts would need a looser CSP; keep every asset a file.
    assetsInlineLimit: 0,
  },
});
