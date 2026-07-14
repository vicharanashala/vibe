// Don't run this as-is, it's documentation. The right approach is to either:
//  - restart the mongo container with TLS enabled, OR
//  - patch MongoDatabase.ts to skip TLS for localhost connections
//
// For verification purposes only — override via env to add TLS opts.
const env = { ...process.env };
env.DB_URL = 'mongodb://127.0.0.1:27017/?directConnection=true&tls=true&tlsAllowInvalidCertificates=true';
console.log('Would run backend with DB_URL=' + env.DB_URL);