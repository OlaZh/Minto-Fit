import { defineConfig, minimalPreset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: 'default' },
  preset: {
    ...minimalPreset,
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: '#060e07', fit: 'contain' },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: '#060e07', fit: 'contain' },
    },
    favicon: {
      sizes: [64, 192, 512],
      padding: 0,
      resizeOptions: { background: '#060e07', fit: 'contain' },
    },
  },
  images: ['public/favicon.svg'],
})
