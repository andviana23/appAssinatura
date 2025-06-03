import { storage } from './storage';

// Cache para otimizar performance
let asaasCache = {
  lastUpdate: 0,
  data: null as any,
  ttl: 5 * 60 * 1000 // 5 minutos
};

export async function syncAsaasData() {
  const now = Date.now();
  
  // Verificar se cache ainda é válido
  if (asaasCache.data && (now - asaasCache.lastUpdate) < asaasCache.ttl) {
    return asaasCache.data;
  }

  try {
    console.log('🔄 Sincronizando dados do Asaas...');
    
    // Configuração das duas contas Asaas
    const asaasAccounts = [
      {
        apiKey: process.env.ASAAS_TRATO,
        name: 'ASAAS_PRINCIPAL'
      },
      {
        apiKey: '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFmYWFlOWZkLTU5YzItNDQ1ZS1hZjAxLWI1ZTc4ZTg1MDJlYzo6JGFhY2hfOGY2NTBlYzQtZjY4My00MDllLWE3ZDYtMzM3ODQwN2ViOGRj',
        name: 'TRATO_BARBADOS'
      }
    ];

    const clientesUnificados = [];
    let totalSincronizados = 0;

    for (const account of asaasAccounts) {
      if (!account.apiKey) continue;
      
      try {
        console.log(`📡 Buscando dados da conta: ${account.name}`);
        
        // Buscar clientes da conta
        const customersResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
          headers: {
            'access_token': account.apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (customersResponse.ok) {
          const customersData = await customersResponse.json();
          console.log(`${account.name}: ${customersData.totalCount || 0} clientes encontrados`);

          // Buscar assinaturas ativas
          const subscriptionsResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?status=ACTIVE&limit=100', {
            headers: {
              'access_token': account.apiKey,
              'Content-Type': 'application/json'
            }
          });

          const subscriptionsData = subscriptionsResponse.ok ? await subscriptionsResponse.json() : { data: [] };
          const activeSubscriptions = new Set(subscriptionsData.data?.map((s: any) => s.customer) || []);

          // Processar clientes
          for (const customer of customersData.data || []) {
            const hasActiveSubscription = activeSubscriptions.has(customer.id);
            
            // Verificar se cliente já existe no banco local
            const existingCliente = await storage.getClienteByAsaasId(customer.id);
            
            if (!existingCliente) {
              const clienteData = {
                nome: customer.name,
                email: customer.email,
                telefone: customer.phone || customer.mobilePhone,
                cpf: customer.cpfCnpj,
                origem: `ASAAS_${account.name}`,
                asaasCustomerId: customer.id,
                planoNome: hasActiveSubscription ? 'Assinatura Ativa' : 'Cliente Cadastrado',
                planoValor: hasActiveSubscription ? '50.00' : '0.00',
                formaPagamento: hasActiveSubscription ? 'CREDIT_CARD' : 'N/A',
                statusAssinatura: hasActiveSubscription ? 'ATIVO' : 'INATIVO',
                dataInicioAssinatura: new Date(customer.dateCreated),
                dataVencimentoAssinatura: hasActiveSubscription ? 
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : 
                  new Date(customer.dateCreated)
              };

              try {
                await storage.createCliente(clienteData);
                totalSincronizados++;
                console.log(`✅ Cliente ${customer.name} sincronizado`);
              } catch (error) {
                console.warn(`⚠️ Erro ao sincronizar cliente ${customer.name}:`, error);
              }
            }

            clientesUnificados.push({
              id: customer.id,
              nome: customer.name,
              email: customer.email,
              telefone: customer.phone || customer.mobilePhone,
              cpf: customer.cpfCnpj,
              origem: account.name,
              statusAssinatura: hasActiveSubscription ? 'ATIVO' : 'INATIVO',
              planoNome: hasActiveSubscription ? 'Assinatura Ativa' : 'Cliente Cadastrado'
            });
          }
        }
      } catch (accountError) {
        console.warn(`❌ Erro ao conectar com conta ${account.name}:`, accountError.message);
      }
    }

    const result = {
      success: true,
      totalSincronizados,
      clientesAsaas: clientesUnificados,
      timestamp: now
    };

    // Atualizar cache
    asaasCache.data = result;
    asaasCache.lastUpdate = now;

    console.log(`🎉 Sincronização concluída: ${totalSincronizados} novos clientes`);
    return result;

  } catch (error) {
    console.error('❌ Erro na sincronização Asaas:', error);
    return {
      success: false,
      error: error.message,
      timestamp: now
    };
  }
}

export function clearAsaasCache() {
  asaasCache.data = null;
  asaasCache.lastUpdate = 0;
}