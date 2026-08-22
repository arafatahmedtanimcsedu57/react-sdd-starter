import type { ConfigFile } from '@rtk-query/codegen-openapi'

// Example. Point schemaFile at your OpenAPI/Swagger (URL or file), then: npm run gen:api
const config: ConfigFile = {
  schemaFile: './openapi.json',
  apiFile: './src/services/emptyApi.ts',
  apiImport: 'emptyApi',
  outputFile: './src/services/generatedApi.ts',
  exportName: 'generatedApi',
  hooks: true,
}
export default config
