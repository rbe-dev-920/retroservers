const newUser = {
  email: "partenaire@example.com",
  firstName: "Jean",
  lastName: "Partenaire",
  matricule: "P001",
  password: "SecurePassword123!",
  role: "PARTENAIRE"
};

try {
  const response = await fetch('http://localhost:3001/api/admin/users', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20=',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newUser)
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.ok) {
    console.log('\n✅ User créé avec succès!');
    console.log('ID:', data.user?.id);
    console.log('Email:', data.user?.email);
    console.log('Matricule:', data.user?.matricule);
  }
} catch (e) {
  console.error('Error:', e.message);
}
