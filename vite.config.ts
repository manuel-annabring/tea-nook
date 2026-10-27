import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /<repo-name>/. Public asset URLs are built
// from import.meta.env.BASE_URL (see src/lib/assetUrl.ts), never a leading "/".
export default defineConfig({
  base: '/tea-nook/',
  plugins: [react()],
})
