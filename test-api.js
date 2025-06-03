// Teste da API REST do Asaas
const testData = {
  name: "Assinatura Gold",
  description: "Acesso premium mensal",
  value: 97.90,
  subscriptionCycle: "MONTHLY"
};

console.log('Testando API: POST /api/asaas/criar-link-pagamento');
console.log('Payload:', JSON.stringify(testData, null, 2));

fetch('http://localhost:5000/api/asaas/criar-link-pagamento', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
.then(response => {
  console.log('Status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Resposta:', JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Erro:', error);
});