import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { db } from './db';
import { eq, and, desc, sql, asc, isNull, isNotNull, or, ne } from 'drizzle-orm';
import { 
  usuarios, 
  barbeiros, 
  clientes, 
  servicos, 
  agendamentos, 
  assinaturas,
  planosAssinatura,
  clientesExternos,
  assinaturasExternas,
  clientesAsaas,
  assinaturasAsaas,
  filaAtendimento,
  statusAtendimento,
  origensDados,
  statusClienteNovo,
  clientesMaster
} from '../shared/schema';
import bcrypt from 'bcrypt';

// Middleware de autenticação
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Acesso negado. Faça login.' });
  }
  next();
}

// Middleware para verificar se é recepcionista
function requireRecepcionista(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Acesso negado. Faça login.' });
  }
  
  if (req.session.userRole !== 'recepcionista') {
    return res.status(403).json({ message: 'Acesso negado. Apenas recepcionistas.' });
  }
  
  next();
}

// Middleware para verificar se é barbeiro
function requireBarbeiro(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Acesso negado. Faça login.' });
  }
  
  if (req.session.userRole !== 'barbeiro') {
    return res.status(403).json({ message: 'Acesso negado. Apenas barbeiros.' });
  }
  
  next();
}

interface SessionData {
  userId: number;
  userRole: string;
  barbeiroId?: number;
}

declare module 'express-session' {
  interface Session {
    userId?: number;
    userRole?: string;
    barbeiroId?: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // =====================================================
  // AUTENTICAÇÃO
  // =====================================================
  
  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Acesso negado. Faça login.' });
    }
    
    res.json({ 
      userId: req.session.userId, 
      userRole: req.session.userRole,
      barbeiroId: req.session.barbeiroId || null
    });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, senha } = req.body;
      
      if (!email || !senha) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
      }

      const usuario = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
      
      if (usuario.length === 0) {
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      const senhaValida = await bcrypt.compare(senha, usuario[0].senha);
      
      if (!senhaValida) {
        return res.status(401).json({ message: 'Credenciais inválidas' });
      }

      // Buscar informações do barbeiro se for barbeiro
      let barbeiroId = null;
      if (usuario[0].tipo === 'barbeiro') {
        const barbeiro = await db.select().from(barbeiros).where(eq(barbeiros.usuarioId, usuario[0].id)).limit(1);
        if (barbeiro.length > 0) {
          barbeiroId = barbeiro[0].id;
        }
      }

      req.session.userId = usuario[0].id;
      req.session.userRole = usuario[0].tipo;
      req.session.barbeiroId = barbeiroId;

      res.json({ 
        message: 'Login realizado com sucesso',
        userRole: usuario[0].tipo,
        barbeiroId: barbeiroId
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Erro ao fazer logout' });
      }
      res.json({ message: 'Logout realizado com sucesso' });
    });
  });

  // =====================================================
  // BARBEIROS
  // =====================================================

  app.get('/api/barbeiros', requireAuth, async (req: Request, res: Response) => {
    try {
      const barbeirosData = await db
        .select({
          id: barbeiros.id,
          nome: barbeiros.nome,
          email: barbeiros.email,
          telefone: barbeiros.telefone,
          especialidades: barbeiros.especialidades,
          ativo: barbeiros.ativo,
          comissaoPercentual: barbeiros.comissaoPercentual,
          usuarioId: barbeiros.usuarioId
        })
        .from(barbeiros)
        .orderBy(barbeiros.nome);

      res.json(barbeirosData);
    } catch (error) {
      console.error('Erro ao buscar barbeiros:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/barbeiros', requireRecepcionista, async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, especialidades, comissaoPercentual, senha } = req.body;
      
      if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios' });
      }

      // Verificar se email já existe
      const emailExistente = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
      if (emailExistente.length > 0) {
        return res.status(400).json({ message: 'Email já cadastrado' });
      }

      // Hash da senha
      const senhaHash = await bcrypt.hash(senha, 12);
      
      // Criar usuário
      const [novoUsuario] = await db.insert(usuarios).values({
        email,
        senha: senhaHash,
        tipo: 'barbeiro'
      }).returning();

      // Criar barbeiro
      const [novoBarbeiro] = await db.insert(barbeiros).values({
        nome,
        email,
        telefone,
        especialidades: especialidades || [],
        comissaoPercentual: comissaoPercentual || 50,
        ativo: true,
        usuarioId: novoUsuario.id
      }).returning();

      res.status(201).json({
        id: novoBarbeiro.id,
        nome: novoBarbeiro.nome,
        email: novoBarbeiro.email,
        telefone: novoBarbeiro.telefone,
        especialidades: novoBarbeiro.especialidades,
        ativo: novoBarbeiro.ativo,
        comissaoPercentual: novoBarbeiro.comissaoPercentual,
        usuarioId: novoBarbeiro.usuarioId
      });
    } catch (error) {
      console.error('Erro ao criar barbeiro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.put('/api/barbeiros/:id', requireRecepcionista, async (req: Request, res: Response) => {
    try {
      const barbeiroId = parseInt(req.params.id);
      const { nome, email, telefone, especialidades, comissaoPercentual, ativo } = req.body;
      
      if (!nome || !email) {
        return res.status(400).json({ message: 'Nome e email são obrigatórios' });
      }

      const [barbeiroAtualizado] = await db
        .update(barbeiros)
        .set({
          nome,
          email,
          telefone,
          especialidades: especialidades || [],
          comissaoPercentual: comissaoPercentual || 50,
          ativo
        })
        .where(eq(barbeiros.id, barbeiroId))
        .returning();

      if (!barbeiroAtualizado) {
        return res.status(404).json({ message: 'Barbeiro não encontrado' });
      }

      res.json(barbeiroAtualizado);
    } catch (error) {
      console.error('Erro ao atualizar barbeiro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // =====================================================
  // CLIENTES EXTERNOS (Sistema local)
  // =====================================================

  app.get('/api/clientes-externos', requireAuth, async (req: Request, res: Response) => {
    try {
      const clientesData = await db
        .select()
        .from(clientesExternos)
        .orderBy(clientesExternos.nome);

      res.json(clientesData);
    } catch (error) {
      console.error('Erro ao buscar clientes externos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/clientes-externos', requireAuth, async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, cpf } = req.body;
      
      if (!nome) {
        return res.status(400).json({ message: 'Nome é obrigatório' });
      }

      const [novoCliente] = await db.insert(clientesExternos).values({
        nome,
        email,
        telefone,
        cpf,
        ativo: true
      }).returning();

      res.status(201).json(novoCliente);
    } catch (error) {
      console.error('Erro ao criar cliente externo:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // =====================================================
  // CLIENTES UNIFICADOS (Asaas + Externos)
  // =====================================================

  app.get('/api/clientes/unified', requireAuth, async (req: Request, res: Response) => {
    try {
      // Buscar clientes Asaas das duas contas
      const clientesAsaasData = await db
        .select()
        .from(clientesAsaas)
        .orderBy(clientesAsaas.nome);

      // Buscar clientes externos
      const clientesExternosData = await db
        .select()
        .from(clientesExternos)
        .where(eq(clientesExternos.ativo, true))
        .orderBy(clientesExternos.nome);

      // Unificar os dados
      const clientesUnificados = [
        ...clientesAsaasData.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          cpf: cliente.cpf,
          tipo: 'asaas',
          origem: cliente.origem || 'ASAAS_PRINCIPAL',
          asaasId: cliente.asaasId,
          ativo: true,
          dataCriacao: cliente.dataCriacao
        })),
        ...clientesExternosData.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          cpf: cliente.cpf,
          tipo: 'externo',
          origem: 'SISTEMA_LOCAL',
          asaasId: null,
          ativo: cliente.ativo,
          dataCriacao: cliente.dataCriacao
        }))
      ];

      res.json({
        success: true,
        total: clientesUnificados.length,
        clientes: clientesUnificados
      });
    } catch (error) {
      console.error('Erro ao buscar clientes unificados:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao buscar clientes',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // SINCRONIZAÇÃO ASAAS
  // =====================================================

  // Importar serviços
  let AsaasIntegrationService: any;
  let ClientesMasterService: any;

  try {
    const asaasModule = await import('./services/asaas-integration');
    const clientesModule = await import('./services/clientes-master');
    AsaasIntegrationService = asaasModule.AsaasIntegrationService;
    ClientesMasterService = clientesModule.ClientesMasterService;
  } catch (error) {
    console.error('Erro ao importar serviços:', error);
  }

  // Sincronização da conta principal ASAAS_TRATO
  app.post("/api/v2/sync/asaas-principal", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!AsaasIntegrationService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new AsaasIntegrationService();
      const resultado = await service.syncClientesPrincipal();

      res.json({
        success: true,
        message: "Sincronização concluída",
        ...resultado
      });
    } catch (error) {
      console.error("Erro na sincronização:", error);
      res.status(500).json({ 
        message: "Erro na sincronização",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Sincronização da conta secundária ASAAS_ANDREY
  app.post("/api/v2/sync/asaas-andrey", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!AsaasIntegrationService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new AsaasIntegrationService();
      const resultado = await service.syncClientesAndrey();

      res.json({
        success: true,
        message: "Sincronização concluída",
        ...resultado
      });
    } catch (error) {
      console.error("Erro na sincronização:", error);
      res.status(500).json({ 
        message: "Erro na sincronização",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Sincronização automática das duas contas
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

      // Sincronizar ASAAS_TRATO
      if (asaasTrato) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_TRATO');
        
        const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
          headers: {
            'access_token': asaasTrato,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          for (const customer of data.data || []) {
            try {
              // Verificar se cliente já existe
              const clienteExistente = await db
                .select()
                .from(clientesAsaas)
                .where(eq(clientesAsaas.asaasId, customer.id))
                .limit(1);

              if (clienteExistente.length === 0) {
                await db.insert(clientesAsaas).values({
                  asaasId: customer.id,
                  nome: customer.name || 'Nome não informado',
                  email: customer.email || null,
                  telefone: customer.phone || null,
                  cpf: customer.cpfCnpj || null,
                  origem: 'ASAAS_PRINCIPAL',
                  dadosCompletos: customer,
                  dataCriacao: new Date(customer.dateCreated)
                });
                totalSincronizados++;
              }
            } catch (error) {
              console.error(`Erro ao sincronizar cliente ${customer.id}:`, error);
            }
          }
          
          resultados.push({
            conta: 'ASAAS_TRATO',
            total: data.totalCount || 0,
            sincronizados: totalSincronizados
          });
        }
      }

      // Sincronizar ASAAS_ANDREY
      if (asaasAndrey) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_ANDREY');
        
        const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
          headers: {
            'access_token': asaasAndrey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          for (const customer of data.data || []) {
            try {
              // Verificar se cliente já existe
              const clienteExistente = await db
                .select()
                .from(clientesAsaas)
                .where(eq(clientesAsaas.asaasId, customer.id))
                .limit(1);

              if (clienteExistente.length === 0) {
                await db.insert(clientesAsaas).values({
                  asaasId: customer.id,
                  nome: customer.name || 'Nome não informado',
                  email: customer.email || null,
                  telefone: customer.phone || null,
                  cpf: customer.cpfCnpj || null,
                  origem: 'ASAAS_ANDREY',
                  dadosCompletos: customer,
                  dataCriacao: new Date(customer.dateCreated)
                });
                totalSincronizados++;
              }
            } catch (error) {
              console.error(`Erro ao sincronizar cliente ${customer.id}:`, error);
            }
          }
          
          resultados.push({
            conta: 'ASAAS_ANDREY',
            total: data.totalCount || 0,
            sincronizados: totalSincronizados
          });
        }
      }

      res.json({
        success: true,
        message: 'Sincronização concluída',
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
  // CRIAÇÃO DE ASSINATURAS ASAAS
  // =====================================================

  // Criar assinatura no ASAAS (usa ASAAS_ANDREY)
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

      const response = await fetch('https://www.asaas.com/api/v3/subscriptions', {
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
          message: 'Assinatura criada com sucesso'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erro ao criar assinatura',
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

  // Criar cliente e assinatura no ASAAS (usa ASAAS_ANDREY)
  app.post("/api/create-customer-subscription", async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, cpf, valor, descricao, planoId } = req.body;
      
      if (!nome || !valor) {
        return res.status(400).json({ message: 'Nome e valor são obrigatórios' });
      }

      const asaasApiKey = process.env.ASAAS_ANDREY;
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Chave API ASAAS não configurada' });
      }

      // 1. Criar cliente no ASAAS
      const customerData = {
        name: nome,
        email: email || undefined,
        phone: telefone || undefined,
        cpfCnpj: cpf || undefined
      };

      const customerResponse = await fetch('https://www.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const customerResult = await customerResponse.json();

      if (!customerResponse.ok) {
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar cliente no ASAAS',
          error: customerResult
        });
      }

      // 2. Criar assinatura
      const subscriptionData = {
        customer: customerResult.id,
        billingType: 'PIX',
        nextDueDate: new Date().toISOString().split('T')[0],
        value: valor,
        cycle: 'MONTHLY',
        description: descricao || 'Assinatura Mensal'
      };

      const subscriptionResponse = await fetch('https://www.asaas.com/api/v3/subscriptions', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const subscriptionResult = await subscriptionResponse.json();

      if (!subscriptionResponse.ok) {
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar assinatura no ASAAS',
          error: subscriptionResult
        });
      }

      // 3. Salvar cliente no banco local
      try {
        await db.insert(clientesAsaas).values({
          asaasId: customerResult.id,
          nome: customerResult.name,
          email: customerResult.email,
          telefone: customerResult.phone,
          cpf: customerResult.cpfCnpj,
          origem: 'ASAAS_ANDREY',
          dadosCompletos: customerResult,
          dataCriacao: new Date(customerResult.dateCreated)
        });
      } catch (dbError) {
        console.log('Cliente já existe no banco local, continuando...');
      }

      // 4. Salvar assinatura no banco local
      try {
        await db.insert(assinaturasAsaas).values({
          asaasId: subscriptionResult.id,
          customerId: customerResult.id,
          valor: subscriptionResult.value,
          status: subscriptionResult.status,
          ciclo: subscriptionResult.cycle,
          proximoVencimento: new Date(subscriptionResult.nextDueDate),
          descricao: subscriptionResult.description,
          origem: 'ASAAS_ANDREY',
          dadosCompletos: subscriptionResult,
          dataCriacao: new Date(subscriptionResult.dateCreated)
        });
      } catch (dbError) {
        console.log('Assinatura já existe no banco local, continuando...');
      }

      res.json({
        success: true,
        customer: customerResult,
        subscription: subscriptionResult,
        message: 'Cliente e assinatura criados com sucesso'
      });

    } catch (error) {
      console.error('Erro ao criar cliente e assinatura:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // WEBHOOK ASAAS
  // =====================================================

  app.post('/webhook/asaas', async (req: Request, res: Response) => {
    try {
      // Validar origem da requisição
      const userAgent = req.get('User-Agent');
      if (!userAgent || !userAgent.includes('Asaas')) {
        console.log('❌ Webhook rejeitado - User-Agent inválido:', userAgent);
        return res.status(400).json({ message: 'Origem não autorizada' });
      }

      // Validar dados básicos do webhook
      const { event, payment } = req.body;
      
      if (!event || !payment) {
        console.log('❌ Webhook rejeitado - Dados incompletos');
        return res.status(400).json({ message: 'Dados do webhook incompletos' });
      }

      console.log('📨 Webhook ASAAS recebido:', {
        event,
        paymentId: payment.id,
        customerId: payment.customer,
        value: payment.value,
        status: payment.status
      });

      // Determinar qual conta ASAAS baseado no token
      let apiKey = '';
      let accountName = '';
      
      // Verificar através do customer ID ou outros identificadores
      if (payment.customer) {
        // Tentar identificar a conta através do cliente
        const clienteAsaas = await db
          .select()
          .from(clientesAsaas)
          .where(eq(clientesAsaas.asaasId, payment.customer))
          .limit(1);
        
        if (clienteAsaas.length > 0) {
          if (clienteAsaas[0].origem === 'ASAAS_PRINCIPAL') {
            apiKey = process.env.ASAAS_TRATO || '';
            accountName = 'ASAAS_TRATO';
          } else {
            apiKey = process.env.ASAAS_ANDREY || '';
            accountName = 'ASAAS_ANDREY';
          }
        }
      }

      // Se não conseguir identificar, usar padrão
      if (!apiKey) {
        apiKey = process.env.ASAAS_ANDREY || '';
        accountName = 'ASAAS_ANDREY';
      }

      // Processar evento
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
          await processarPagamentoConfirmado(payment, apiKey, accountName);
          break;
        
        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_DELETED':
          await processarPagamentoCancelado(payment);
          break;
        
        default:
          console.log(`ℹ️ Evento não processado: ${event}`);
      }

      res.status(200).json({ message: 'Webhook processado com sucesso' });

    } catch (error) {
      console.error('❌ Erro no webhook ASAAS:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Função para processar pagamento confirmado
  async function processarPagamentoConfirmado(payment: any, apiKey: string, accountName: string) {
    try {
      console.log(`✅ Processando pagamento confirmado: ${payment.id} (${accountName})`);
      
      // Buscar dados completos do pagamento
      const response = await fetch(`https://www.asaas.com/api/v3/payments/${payment.id}`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const paymentData = await response.json();
        
        // Atualizar status no banco se necessário
        console.log('💰 Pagamento confirmado:', {
          id: paymentData.id,
          value: paymentData.value,
          customer: paymentData.customer,
          status: paymentData.status
        });
        
        // Aqui você pode adicionar lógica adicional para:
        // - Liberar acesso ao cliente
        // - Enviar email de confirmação
        // - Atualizar status de assinatura
        
      } else {
        console.error('Erro ao buscar dados do pagamento:', response.status);
      }
    } catch (error) {
      console.error('Erro ao processar pagamento confirmado:', error);
    }
  }

  // Função para processar pagamento cancelado
  async function processarPagamentoCancelado(payment: any) {
    try {
      console.log(`❌ Processando pagamento cancelado: ${payment.id}`);
      
      // Aqui você pode adicionar lógica para:
      // - Suspender acesso do cliente
      // - Enviar notificação de cobrança em atraso
      // - Atualizar status de assinatura
      
    } catch (error) {
      console.error('Erro ao processar pagamento cancelado:', error);
    }
  }

  // Criar cliente no ASAAS (usa ASAAS_ANDREY)
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

      const response = await fetch('https://www.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const result = await response.json();

      if (response.ok) {
        // Salvar no banco local
        try {
          await db.insert(clientesAsaas).values({
            asaasId: result.id,
            nome: result.name,
            email: result.email,
            telefone: result.phone,
            cpf: result.cpfCnpj,
            origem: 'ASAAS_ANDREY',
            dadosCompletos: result,
            dataCriacao: new Date(result.dateCreated)
          });
        } catch (dbError) {
          console.log('Cliente já existe no banco local');
        }

        res.json({
          success: true,
          customer: result,
          message: 'Cliente criado com sucesso'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erro ao criar cliente',
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
  // ENDPOINTS DE TESTE E SAÚDE
  // =====================================================

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  app.get('/api/test/clientes-unified', async (req: Request, res: Response) => {
    try {
      const clientesAsaasData = await db.select().from(clientesAsaas).limit(5);
      const clientesExternosData = await db.select().from(clientesExternos).limit(5);
      
      res.json({
        success: true,
        asaas: clientesAsaasData,
        externos: clientesExternosData,
        total: {
          asaas: clientesAsaasData.length,
          externos: clientesExternosData.length
        }
      });
    } catch (error) {
      console.error('Erro no teste:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  app.get('/api/test-asaas', async (req: Request, res: Response) => {
    try {
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_ANDREY;
      
      const resultados = [];

      // Testar ASAAS_TRATO
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
            dados: response.ok ? await response.json() : null
          });
        } catch (error) {
          resultados.push({
            conta: 'ASAAS_TRATO',
            erro: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      // Testar ASAAS_ANDREY
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
  // PÁGINAS DE RETORNO DE PAGAMENTO
  // =====================================================

  app.get('/pagamento/sucesso', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pagamento Confirmado</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #28a745; }
          .container { max-width: 500px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="success">✅ Pagamento Confirmado!</h1>
          <p>Seu pagamento foi processado com sucesso.</p>
          <p>Em breve você receberá um email de confirmação.</p>
          <button onclick="window.close()">Fechar</button>
        </div>
      </body>
      </html>
    `);
  });

  app.get('/pagamento/cancelado', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pagamento Cancelado</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #dc3545; }
          .container { max-width: 500px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">❌ Pagamento Cancelado</h1>
          <p>O pagamento foi cancelado.</p>
          <p>Você pode tentar novamente a qualquer momento.</p>
          <button onclick="window.close()">Fechar</button>
        </div>
      </body>
      </html>
    `);
  });

  app.get('/pagamento/expirado', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pagamento Expirado</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .warning { color: #ffc107; }
          .container { max-width: 500px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="warning">⏰ Pagamento Expirado</h1>
          <p>O tempo para realizar o pagamento expirou.</p>
          <p>Por favor, gere um novo link de pagamento.</p>
          <button onclick="window.close()">Fechar</button>
        </div>
      </body>
      </html>
    `);
  });

  // =====================================================
  // OUTROS ENDPOINTS MANTIDOS
  // =====================================================

  // Demais endpoints existentes serão mantidos aqui...
  // (agendamentos, serviços, estatísticas, etc.)

  return app.listen(5000, '0.0.0.0');
}