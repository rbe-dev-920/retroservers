const controle = {
  parc: "R123",
  datePassage: "2025-11-15",
  dateExpiration: "2026-11-15",
  resultat: "OK",
  observations: "Tous les tests passés"
};

try {
  const response = await fetch('http://localhost:3001/vehicles/R123/controle-technique', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20=',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(controle)
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.ok) {
    console.log('\n✅ Contrôle technique sauvegardé!');
  } else {
    console.log('Response code:', response.status);
  }
} catch (e) {
  console.error('Error:', e.message);
}
