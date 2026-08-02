// OpenAPI TypeScript Code Generator Configuration
// Run: npm run openapi:generate

module.exports = {
  // Points at a locally running API. OPENAPI_INPUT overrides it; the default
  // tracks the server's APP_PORT.
  input:
    process.env.OPENAPI_INPUT || 'http://127.0.0.1:4000/api-docs-json',
  output: {
    path: 'src/lib/api',
  },
  plugins: {
    '@hey-api/typescript': {},
    '@hey-api/fetch-client': {},
  },
};
