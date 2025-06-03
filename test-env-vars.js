// Test script to verify environment variables and API connectivity
import { config } from 'dotenv';
config();

console.log('=== TESTE DE VARIÁVEIS DE AMBIENTE ===');
console.log('ASAAS_TRATO exists:', !!process.env.ASAAS_TRATO);
console.log('ASAAS_API_KEY exists:', !!process.env.ASAAS_API_KEY);

if (process.env.ASAAS_TRATO) {
  console.log('ASAAS_TRATO starts with:', process.env.ASAAS_TRATO.substring(0, 10) + '...');
}

if (process.env.ASAAS_API_KEY) {
  console.log('ASAAS_API_KEY starts with:', process.env.ASAAS_API_KEY.substring(0, 10) + '...');
}

// Test API connectivity
async function testAsaasConnection() {
  const accounts = [
    { name: 'ASAAS_TRATO', key: process.env.ASAAS_TRATO },
    { name: 'ASAAS_API_KEY', key: process.env.ASAAS_API_KEY }
  ];

  for (const account of accounts) {
    if (!account.key) {
      console.log(`❌ ${account.name}: API key not found`);
      continue;
    }

    try {
      console.log(`🧪 Testing ${account.name} connection...`);
      const response = await fetch('https://www.asaas.com/api/v3/customers?limit=3', {
        headers: {
          'access_token': account.key,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${account.name}: ${data.totalCount} total customers found`);
        console.log(`   First 3 customers: ${data.data?.length || 0} returned`);
      } else {
        console.log(`❌ ${account.name}: API error ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${account.name}: Connection error - ${error.message}`);
    }
  }
}

testAsaasConnection();