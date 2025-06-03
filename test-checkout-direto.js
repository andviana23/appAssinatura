// Teste direto do checkout personalizado usando fetch com headers corretos
const fetch = require('node-fetch');

const testCheckoutPersonalizado = async () => {
  const payload = {
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

  try {
    console.log('🔄 Testando checkout personalizado...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('http://localhost:5000/api/asaas/criar-checkout-personalizado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Status HTTP:', response.status);
    console.log('Headers:', response.headers.raw());
    
    const responseText = await response.text();
    console.log('Resposta bruta:', responseText.substring(0, 200));

    // Tentar fazer parse do JSON
    try {
      const jsonData = JSON.parse(responseText);
      console.log('✅ Resposta JSON:', JSON.stringify(jsonData, null, 2));
    } catch (parseError) {
      console.log('❌ Erro ao fazer parse do JSON:', parseError.message);
      console.log('Tipo de conteúdo recebido:', response.headers.get('content-type'));
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
};

testCheckoutPersonalizado();