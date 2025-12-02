import pkg from 'pg';
const { Client } = pkg;

const c = new Client({
  host: 'yamanote.proxy.rlwy.net',
  port: 18663,
  user: 'postgres',
  password: 'kufBlJfvgFQSHCnQyUgVqwGLthMXtyot',
  database: 'railway'
});

await c.connect();

try {
  // Get admin permissions structure
  const adminRes = await c.query('SELECT id, email, "firstName", "lastName", permissions FROM members LIMIT 5');
  console.log('Sample members with permissions:');
  adminRes.rows.forEach(r => {
    console.log(`\n${r.firstName} ${r.lastName} (${r.email}):`);
    console.log(JSON.stringify(r.permissions, null, 2));
  });
} finally {
  await c.end();
}
