// Teste do checkout personalizado do Asaas
const testData = {
  customerData: {
    name: "João Silva",
    email: "joao@teste.com",
    phone: "11999999999",
    cpfCnpj: "12345678901"
  },
  items: [{
    description: "Assinatura Premium Mensal",
    name: "Plano Premium",
    quantity: 1,
    value: 120.00
  }],
  subscription: {
    cycle: "MONTHLY",
    endDate: "2025-12-31 23:59:59",
    nextDueDate: "2025-07-03 00:00:00"
  }
};

console.log('Testando checkout personalizado: POST /api/asaas/criar-checkout-personalizado');
console.log('Payload:', JSON.stringify(testData, null, 2));

fetch('http://localhost:5000/api/asaas/criar-checkout-personalizado', {
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