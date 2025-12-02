const newAdhesion = {
  email: "adhesion@example.com",
  firstName: "Dupont",
  lastName: "Adhérent",
  matricule: "A001",
  password: "SecurePassword123!",
  role: "USER"
};

try {
  const response = await fetch('http://localhost:3001/api/admin/users', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20=',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newAdhesion)
  });

  const data = await response.json();
  console.log('Status:', response.status);
  
  if (response.ok) {
    console.log('\n✅ Adhésion créée!');
    console.log('ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Rôle:', data.user.role);
  } else {
    console.error('❌ Erreur:', data.error);
  }
} catch (e) {
  console.error('Error:', e.message);
}
