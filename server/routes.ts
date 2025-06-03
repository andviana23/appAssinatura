import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { db } from './db';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // =====================================================
  // TESTE DE CONECTIVIDADE ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.get('/api/test-asaas', async (req: Request, res: Response) => {
    try {
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_ANDREY;
      
      const resultados = [];

      // Testar ASAAS_TRATO (sempre produção)
      if (asaasTrato) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=1', {
            headers: {
              'access_token': asaasTrato,
              'Content-Type': 'application/json'
            }
          });
          
          resultados.push({
            conta: 'ASAAS_TRATO',
            status: response.status,
            ok: response.ok,
            url: 'https://www.asaas.com/api/v3/',
            dados: response.ok ? await response.json() : null
          });
        } catch (error) {
          resultados.push({
            conta: 'ASAAS_TRATO',
            erro: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      // Testar ASAAS_ANDREY (sempre produção)
      if (asaasAndrey) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=1', {
            headers: {
              'access_token': asaasAndrey,
              'Content-Type': 'application/json'
            }
          });
          
          resultados.push({
            conta: 'ASAAS_ANDREY',
            status: response.status,
            ok: response.ok,
            url: 'https://www.asaas.com/api/v3/',
            dados: response.ok ? await response.json() : null
          });
        } catch (error) {
          resultados.push({
            conta: 'ASAAS_ANDREY',
            erro: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      res.json({
        success: true,
        ambiente: 'PRODUÇÃO APENAS',
        baseUrl: 'https://www.asaas.com/api/v3/',
        resultados,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro no teste ASAAS:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // SINCRONIZAÇÃO CLIENTES ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post("/api/sync/clientes-asaas", async (req: Request, res: Response) => {
    try {
      console.log('🔄 Sincronizando clientes da conta: ASAAS_TRATO');
      
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_ANDREY;
      
      if (!asaasTrato && !asaasAndrey) {
        return res.status(500).json({ 
          success: false, 
          message: 'Nenhuma chave ASAAS configurada' 
        });
      }

      let totalSincronizados = 0;
      const resultados = [];

      // PRODUÇÃO APENAS: URL fixa para produção
      const baseUrl = 'https://www.asaas.com/api/v3';

      // Sincronizar ASAAS_TRATO
      if (asaasTrato) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_TRATO');
        
        const response = await fetch(`${baseUrl}/customers?limit=100`, {
          headers: {
            'access_token': asaasTrato,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          resultados.push({
            conta: 'ASAAS_TRATO',
            total: data.totalCount || 0,
            url: baseUrl,
            status: 'sucesso'
          });
        } else {
          resultados.push({
            conta: 'ASAAS_TRATO',
            erro: `HTTP ${response.status}`,
            url: baseUrl
          });
        }
      }

      // Sincronizar ASAAS_ANDREY
      if (asaasAndrey) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_ANDREY');
        
        const response = await fetch(`${baseUrl}/customers?limit=100`, {
          headers: {
            'access_token': asaasAndrey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          resultados.push({
            conta: 'ASAAS_ANDREY',
            total: data.totalCount || 0,
            url: baseUrl,
            status: 'sucesso'
          });
        } else {
          resultados.push({
            conta: 'ASAAS_ANDREY',
            erro: `HTTP ${response.status}`,
            url: baseUrl
          });
        }
      }

      res.json({
        success: true,
        message: 'Sincronização concluída (PRODUÇÃO)',
        ambiente: 'PRODUÇÃO APENAS',
        baseUrl: baseUrl,
        totalSincronizados,
        resultados
      });

    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro na sincronização',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CRIAR CLIENTE NO ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post("/api/asaas/criar-cliente", async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, cpf } = req.body;
      
      if (!nome) {
        return res.status(400).json({ message: 'Nome é obrigatório' });
      }

      const asaasApiKey = process.env.ASAAS_ANDREY;
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Chave API ASAAS não configurada' });
      }

      const customerData = {
        name: nome,
        email: email || undefined,
        phone: telefone || undefined,
        cpfCnpj: cpf || undefined
      };

      // PRODUÇÃO APENAS: URL fixa para produção
      const baseUrl = 'https://www.asaas.com/api/v3';

      const response = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const result = await response.json();

      if (response.ok) {
        res.json({
          success: true,
          customer: result,
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          message: 'Cliente criado com sucesso'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erro ao criar cliente',
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          error: result
        });
      }
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CRIAR ASSINATURA NO ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post("/api/asaas/criar-assinatura", async (req: Request, res: Response) => {
    try {
      const { customerId, value, description } = req.body;
      
      if (!customerId || !value) {
        return res.status(400).json({ message: 'customerId e value são obrigatórios' });
      }

      const asaasApiKey = process.env.ASAAS_ANDREY;
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Chave API ASAAS não configurada' });
      }

      const subscriptionData = {
        customer: customerId,
        billingType: 'PIX',
        nextDueDate: new Date().toISOString().split('T')[0],
        value: value,
        cycle: 'MONTHLY',
        description: description || 'Assinatura Mensal'
      };

      // PRODUÇÃO APENAS: URL fixa para produção
      const baseUrl = 'https://www.asaas.com/api/v3';

      const response = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const result = await response.json();

      if (response.ok) {
        res.json({
          success: true,
          subscription: result,
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          message: 'Assinatura criada com sucesso'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erro ao criar assinatura',
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          error: result
        });
      }
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // WEBHOOK ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post('/webhook/asaas', async (req: Request, res: Response) => {
    try {
      // Validar origem da requisição
      const userAgent = req.get('User-Agent');
      if (!userAgent || !userAgent.includes('Asaas')) {
        console.log('❌ Webhook rejeitado - User-Agent inválido:', userAgent);
        return res.status(400).json({ message: 'Origem não autorizada' });
      }

      const { event, payment } = req.body;
      
      if (!event || !payment) {
        console.log('❌ Webhook rejeitado - Dados incompletos');
        return res.status(400).json({ message: 'Dados do webhook incompletos' });
      }

      console.log('📨 Webhook ASAAS recebido (PRODUÇÃO):', {
        event,
        paymentId: payment.id,
        customerId: payment.customer,
        value: payment.value,
        status: payment.status,
        ambiente: 'PRODUÇÃO'
      });

      // Processar evento
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
          console.log(`✅ Pagamento confirmado: ${payment.id}`);
          break;
        
        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_DELETED':
          console.log(`❌ Pagamento cancelado: ${payment.id}`);
          break;
        
        default:
          console.log(`ℹ️ Evento não processado: ${event}`);
      }

      res.status(200).json({ 
        message: 'Webhook processado com sucesso',
        ambiente: 'PRODUÇÃO'
      });

    } catch (error) {
      console.error('❌ Erro no webhook ASAAS:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // =====================================================
  // ENDPOINT DE SAÚDE
  // =====================================================

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok',
      ambiente: 'PRODUÇÃO APENAS',
      asaasBaseUrl: 'https://www.asaas.com/api/v3/',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  });

  return app.listen(5000, '0.0.0.0');
}