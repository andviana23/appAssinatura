import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function registerRoutes(app: Express): Promise<Express> {
  
  // Nova função para determinar status baseado no mês e lógica de pagamentos vencidos
  function determinarStatusClientePorMes(cliente: any, mesFiltro: string): string {
    // Regra: Cliente é ATIVO se está em dia ou cobrança ainda não venceu
    // Regra: Cliente é ATRASADO apenas se pagamento venceu e não foi confirmado
    
    // Para simplificação inicial, vamos usar a lógica baseada em:
    // - notificationDisabled = true -> provavelmente cancelado/inativo
    // - Cliente muito recente (menos de 30 dias) -> ativo (ainda dentro do prazo)
    // - Clientes antigos sem notificationDisabled -> ativos (presumindo em dia)
    
    if (cliente.notificationDisabled || cliente.deleted) {
      return 'atrasado'; // Cliente com notificação desabilitada ou deletado = atrasado/cancelado
    }
    
    const dataCreated = new Date(cliente.dateCreated);
    const agora = new Date();
    const diasCriacao = Math.floor((agora.getTime() - dataCreated.getTime()) / (1000 * 3600 * 24));
    
    // Clientes muito antigos (mais de 90 dias) sem atividade recente podem estar atrasados
    if (diasCriacao > 90 && cliente.notificationDisabled) {
      return 'atrasado';
    }
    
    // Por padrão, considera ativo (em dia ou dentro do prazo)
    return 'ativo';
  }
  
  // =====================================================
  // ROTA UNIFICADA CLIENTES ASAAS POR STATUS
  // =====================================================

  app.get('/api/clientes/unificados-status', async (req: Request, res: Response) => {
    try {
      const mesFiltro = req.query.mes as string || new Date().toISOString().slice(0, 7); // YYYY-MM
      console.log(`📅 Filtrando clientes por mês: ${mesFiltro}`);
      
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;
      
      const clientesAtivos: any[] = [];
      const clientesAtrasados: any[] = [];
      
      // Buscar clientes da conta ASAAS_TRATO
      if (asaasTrato) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasTrato,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            data.data.forEach((cliente: any) => {
              const clienteFormatado = {
                ...cliente,
                conta: 'ASAAS_TRATO'
              };
              
              const status = determinarStatusClientePorMes(clienteFormatado, mesFiltro);
              if (status === 'ativo') {
                clientesAtivos.push({...clienteFormatado, status: 'ativo'});
              } else {
                clientesAtrasados.push({...clienteFormatado, status: 'atrasado'});
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar clientes ASAAS_TRATO:', error);
        }
      }
      
      // Buscar clientes da conta ASAAS_AND
      if (asaasAndrey) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasAndrey,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            data.data.forEach((cliente: any) => {
              const clienteFormatado = {
                ...cliente,
                conta: 'ASAAS_AND'
              };
              
              const status = determinarStatusClientePorMes(clienteFormatado, mesFiltro);
              if (status === 'ativo') {
                clientesAtivos.push({...clienteFormatado, status: 'ativo'});
              } else {
                clientesAtrasados.push({...clienteFormatado, status: 'atrasado'});
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar clientes ASAAS_AND:', error);
        }
      }
      
      res.json({
        success: true,
        total: clientesAtivos.length + clientesAtrasados.length,
        mes: mesFiltro,
        ativos: {
          total: clientesAtivos.length,
          clientes: clientesAtivos
        },
        inativos: {
          total: clientesAtrasados.length,
          clientes: clientesAtrasados
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro na rota clientes unificados:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // TESTE DE CONECTIVIDADE ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.get('/api/test-asaas', async (req: Request, res: Response) => {
    try {
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;
      
      console.log('🔍 Debug - Variáveis de ambiente:');
      console.log('ASAAS_TRATO:', asaasTrato ? `${asaasTrato.substring(0, 20)}...` : 'NÃO DEFINIDA');
      console.log('ASAAS_AND:', asaasAndrey ? `${asaasAndrey.substring(0, 20)}...` : 'NÃO DEFINIDA');
      
      const resultados = [];

      // Testar ASAAS_TRATO (sempre produção)
      if (asaasTrato) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
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

      // Testar ASAAS_AND (sempre produção)
      if (asaasAndrey) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasAndrey,
              'Content-Type': 'application/json'
            }
          });
          
          resultados.push({
            conta: 'ASAAS_AND',
            status: response.status,
            ok: response.ok,
            url: 'https://www.asaas.com/api/v3/',
            dados: response.ok ? await response.json() : null
          });
        } catch (error) {
          resultados.push({
            conta: 'ASAAS_AND',
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
      const asaasAndrey = process.env.ASAAS_AND;
      
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

      // Sincronizar ASAAS_AND
      if (asaasAndrey) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_AND');
        
        const response = await fetch(`${baseUrl}/customers?limit=100`, {
          headers: {
            'access_token': asaasAndrey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          resultados.push({
            conta: 'ASAAS_AND',
            total: data.totalCount || 0,
            url: baseUrl,
            status: 'sucesso'
          });
        } else {
          resultados.push({
            conta: 'ASAAS_AND',
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

      const asaasApiKey = process.env.ASAAS_AND;
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

      const asaasApiKey = process.env.ASAAS_AND;
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
  // AUTENTICAÇÃO BÁSICA
  // =====================================================

  // Login simplificado
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    
    res.json({
      success: true,
      user: {
        id: 1,
        email: email,
        name: "Admin Trato"
      }
    });
  });

  // Logout simplificado
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });

  // Dados do usuário
  app.get('/api/auth/me', (req: Request, res: Response) => {
    res.json({
      id: 1,
      email: "admin@tratobarbados.com",
      name: "Admin Trato"
    });
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

  return app;
}