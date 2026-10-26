import { build } from 'vite'
await build({configFile:false,build:{outDir:'/private/tmp/lengths-v11-probe-dist',emptyOutDir:true,rollupOptions:{input:'docs/qa/lengths-v11/implementation/probe.html'}}})
