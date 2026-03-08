import { writeFileSync } from 'fs'
import app, { openAPIConfig } from '../src/index.js'

const spec = app.getOpenAPIDocument(openAPIConfig)

const output = 'openapi.json'
writeFileSync(output, JSON.stringify(spec, null, 2))
console.log(`OpenAPI spec generated: ${output}`)
