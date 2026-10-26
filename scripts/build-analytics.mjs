import { build } from 'vite'
await build({ configFile: false, publicDir: false, build: {
  outDir: 'dist-analytics', emptyOutDir: true,
  lib: { entry: { collector: 'functions/api/stop-analytics.ts', purge: 'workers/stop-analytics-purge/index.ts' }, formats: ['es'] },
  minify: false,
} })
