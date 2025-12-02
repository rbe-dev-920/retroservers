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
  // Delete the old w.belaidi@retrobus.fr
  console.log('Deleting old w.belaidi@retrobus.fr...');
  await c.query('DELETE FROM members WHERE email = $1', ['w.belaidi@retrobus.fr']);
  
  // Insert with correct email
  console.log('Creating w.belaidi with email belaidiw91@gmail.com...');
  const insertRes = await c.query(
    `INSERT INTO members (id, email, "firstName", "lastName", status, "membershipType", "membershipStatus", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      'mem_' + Date.now(),
      'belaidiw91@gmail.com',
      'Waiyl',
      'BELAIDI',
      'active',
      'ADMIN',
      'ACTIVE',
      new Date(),
      new Date()
    ]
  );
  console.log('✅ Created:', insertRes.rows[0].id);
  
  // Show all belaidi entries
  const res = await c.query('SELECT id, email, "firstName", "lastName" FROM members WHERE email LIKE \'%belaidi%\'');
  console.log('\n📋 w.belaidi entries:');
  console.table(res.rows);
  
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await c.end();
}
