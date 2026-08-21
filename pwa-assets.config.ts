import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * Rasterises `public/icon.svg` into the PNG sizes a manifest and an iOS home
 * screen need. Development-time only: run `pnpm pwa:assets` when the source SVG
 * changes and commit the output. Nothing here runs during `pnpm build`.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
});
