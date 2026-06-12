import { writeFileSync } from 'fs'

// Cegah koneksi WhatsApp nyata saat hanya men-generate spec (lihat src/wa.ts).
process.env.WA_DISABLE_AUTOLOAD = 'true'

const { default: app, openAPIConfig } = await import('../src/index.js')

const spec = app.getOpenAPIDocument(openAPIConfig)

const output = 'openapi.json'
writeFileSync(output, JSON.stringify(spec, null, 2))
console.log(`OpenAPI spec generated: ${output}`)
