import { build } from 'vite'
import { cp } from 'node:fs/promises'
const output='/private/tmp/lengths-v11-activity-probe'
await build({configFile:false,build:{outDir:output,emptyOutDir:true,rollupOptions:{input:'docs/qa/lengths-v11/implementation/probe.html'}}})
await cp(output+'/assets','dist/assets',{recursive:true})
await cp(output+'/docs','dist/docs',{recursive:true})
