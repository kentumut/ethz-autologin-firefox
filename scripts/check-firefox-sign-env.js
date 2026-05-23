const required = [
  ['WEB_EXT_API_KEY', 'your-jwt-issuer'],
  ['WEB_EXT_API_SECRET', 'your-jwt-secret']
];

const missing = required.filter(([name, placeholder]) => {
  const value = process.env[name];
  return !value || value === placeholder;
});

if (missing.length) {
  const names = missing.map(([name]) => name).join(', ');
  console.error(`Missing AMO signing credentials in .env: ${names}`);
  console.error('Copy .env.example to .env and paste your AMO JWT issuer and JWT secret.');
  process.exit(1);
}
