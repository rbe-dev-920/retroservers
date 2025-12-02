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
  const res = await c.query('SELECT id, email, "firstName", "lastName" FROM members WHERE "firstName" = $1 AND "lastName" = $2', ['Waiyl', 'BELAIDI']);
  console.log('All Waiyl BELAIDI entries:');
  console.table(res.rows);
} finally {
  await c.end();
}
