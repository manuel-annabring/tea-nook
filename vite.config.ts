/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /<repo-name>/. Public asset URLs are built
// from import.meta.env.BASE_URL (see src/lib/assetUrl.ts), never a leading "/".
export default defineConfig({
  base: '/tea-nook/',
  plugins: [react()],
  // src/ui/ui.test.ts reads index.css as text; vitest blanks CSS files unless they are listed here.
  test: { css: { include: [/index\.css/] } },
})
