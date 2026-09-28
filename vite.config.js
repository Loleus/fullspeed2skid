import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

function copyGameFiles(outDir, isPortal) {
  return {
    name: 'copy-game-files',
    closeBundle() {
      cpSync(resolve(rootDir, 'assets'), resolve(outDir, 'assets'), { recursive: true });
      cpSync(resolve(rootDir, 'favicon.ico'), resolve(outDir, 'favicon.ico'));
      cpSync(resolve(rootDir, 'src/core/phaser.js'), resolve(outDir, 'src/core/phaser.js'));

      if (!isPortal) {
        cpSync(resolve(rootDir, 'manifest.json'), resolve(outDir, 'manifest.json'));
        cpSync(resolve(rootDir, 'service-worker.js'), resolve(outDir, 'service-worker.js'));
      }
    }
  };
}

function removePortalManifest() {
  return {
    name: 'remove-portal-manifest',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/\s*<link rel="manifest" href="\.\/manifest\.json">/i, '');
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const isPortal = mode === 'portal';
  const outDir = resolve(rootDir, 'dist', isPortal ? 'portal' : 'pwa');

  return {
    base: './',
    publicDir: false,
    plugins: [
      ...(isPortal ? [removePortalManifest()] : [viteSingleFile({ useRecommendedBuildConfig: false })]),
      copyGameFiles(outDir, isPortal)
    ],
    build: {
      outDir,
      emptyOutDir: true,
      assetsInlineLimit: 0,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    }
  };
});