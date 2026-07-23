// OpenAPI TypeScript Code Generator Configuration
// Run: npm run openapi:generate

module.exports = {
  input: 'http://localhost:3001/api-docs-json',
  output: {
    path: 'src/lib/api',
  },
  plugins: {
    '@hey-api/typescript': {},
    '@hey-api/fetch-client': {},
  },
};
