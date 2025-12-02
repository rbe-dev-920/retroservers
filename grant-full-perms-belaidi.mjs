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
  // Get w.belaidi member
  const memberRes = await c.query('SELECT id, email FROM members WHERE email = $1', ['belaidiw91@gmail.com']);
  if (!memberRes.rows.length) {
    console.log('❌ w.belaidi not found');
    await c.end();
    process.exit(1);
  }
  
  const memberId = memberRes.rows[0].id;
  console.log('✅ Found w.belaidi:', memberId);
  
  // Update member with full permissions
  const permissionsArray = [
    'ADMIN',
    'VEHICLES_READ',
    'VEHICLES_WRITE',
    'MEMBERS_READ',
    'MEMBERS_WRITE',
    'EVENTS_READ',
    'EVENTS_WRITE',
    'FINANCE_READ',
    'FINANCE_WRITE',
    'SETTINGS_READ',
    'SETTINGS_WRITE',
    'REPORTS_READ',
    'REPORTS_WRITE',
    'RETROACTUS_READ',
    'RETROACTUS_WRITE',
    'RETRODEMANDES_READ',
    'RETRODEMANDES_WRITE',
    'RETROPLANNING_READ',
    'RETROPLANNING_WRITE'
  ];
  
  const updateRes = await c.query(
    `UPDATE members 
     SET permissions = $1::jsonb
     WHERE id = $2
     RETURNING id, email, permissions`,
    [JSON.stringify(permissionsArray), memberId]
  );
  
  console.log('\n✅ Permissions updated for w.belaidi:');
  console.table(updateRes.rows);
  
} catch (e) {
  console.error('❌ Error:', e.message);
} finally {
  await c.end();
}
