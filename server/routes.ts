import type { Express } from "express";
import { createServer, type Server } from "http";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { storage, db } from "./storage";
import { syncAsaasData } from "./asaas-sync";
import { insertBarbeiroSchema, insertServicoSchema, insertPlanoAssinaturaSchema, insertUserSchema, insertAtendimentoDiarioSchema, insertAgendamentoSchema, insertClienteSchema, planosAssinatura } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import { eq } from "drizzle-orm";

// Extend session interface
declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
    barbeiroId?: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'barbados-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Acesso negado. Faça login." });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.userId || req.session?.userRole !== 'admin') {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores." });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.barbeiroId = user.barbeiroId ?? undefined;

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        barbeiroId: user.barbeiroId
      });
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Endpoint temporário para resetar senha do admin
  app.post("/api/auth/reset-admin-password", async (req, res) => {
    try {
      const admin = await storage.getUserByEmail("admin@tratodebarbados.com");
      if (admin) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await storage.updateUserPassword(admin.id, hashedPassword);
        console.log("Senha do admin resetada para: admin123");
        res.json({ message: "Senha resetada com sucesso" });
      } else {
        res.status(404).json({ message: "Admin não encontrado" });
      }
    } catch (error) {
      console.error("Erro ao resetar senha:", error);
      res.status(500).json({ message: "Erro interno" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const user = await storage.getUserById(userId as number);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.nome,
        fotoPerfil: user.fotoPerfil,
        barbeiroId: user.barbeiroId
      });
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // User configuration routes
  app.post("/api/users/change-password", requireAuth, async (req, res) => {
    try {
      const { senhaAtual, novaSenha } = req.body;
      const userId = req.session?.userId;

      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }

      const user = await storage.getUserById(userId as number);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const isValidPassword = await bcrypt.compare(senhaAtual, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      const hashedPassword = await bcrypt.hash(novaSenha, 10);
      await storage.updateUser(userId as number, { password: hashedPassword });

      res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/users/update-profile", requireAuth, async (req, res) => {
    try {
      const { nome, fotoPerfil } = req.body;
      const userId = req.session?.userId;

      await storage.updateUser(userId as number, { nome, fotoPerfil });

      res.json({ message: "Perfil atualizado com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { nome, email, senha, role, telefone, endereco, comissao } = req.body;
      
      if (!nome || !email || !senha || !role) {
        return res.status(400).json({ message: "Nome, email, senha e role são obrigatórios" });
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(senha, 10);
      
      if (role === 'recepcionista') {
        // Criar usuário recepcionista
        const userData = {
          email,
          password: hashedPassword,
          role: 'recepcionista',
          nome
        };
        
        const user = await storage.createUser(userData);
        res.status(201).json({
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          tipo: 'recepcionista',
          ativo: true
        });
      } else if (role === 'barbeiro') {
        // Criar barbeiro e usuário associado
        const barbeiroData = {
          nome,
          email,
          ativo: true
        };
        
        const barbeiro = await storage.createBarbeiro(barbeiroData);
        
        const userData = {
          email,
          password: hashedPassword,
          role: 'barbeiro',
          nome,
          barbeiroId: barbeiro.id
        };
        
        const user = await storage.createUser(userData);
        res.status(201).json({
          id: barbeiro.id,
          nome: barbeiro.nome,
          email: barbeiro.email,
          ativo: barbeiro.ativo,
          tipo: 'barbeiro',
          userId: user.id
        });
      } else {
        return res.status(400).json({ message: "Role deve ser 'barbeiro' ou 'recepcionista'" });
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(400).json({ message: "Email já está em uso" });
      } else {
        res.status(500).json({ message: "Erro ao criar usuário" });
      }
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/metrics", requireAuth, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Erro ao buscar métricas:", error);
      res.status(500).json({ message: "Erro ao buscar métricas do dashboard" });
    }
  });

  app.get("/api/dashboard/ranking", requireAuth, async (req, res) => {
    try {
      const ranking = await storage.getBarbeiroRanking();
      res.json(ranking);
    } catch (error) {
      console.error("Erro ao buscar ranking:", error);
      res.status(500).json({ message: "Erro ao buscar ranking de barbeiros" });
    }
  });

  // Barbeiros routes
  app.get("/api/barbeiros", requireAuth, async (req, res) => {
    try {
      const barbeiros = await storage.getAllBarbeiros();
      res.json(barbeiros);
    } catch (error) {
      console.error("Erro ao buscar barbeiros:", error);
      res.status(500).json({ message: "Erro ao buscar barbeiros" });
    }
  });

  app.get("/api/barbeiros/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const barbeiro = await storage.getBarbeiroById(id);
      
      if (!barbeiro) {
        return res.status(404).json({ message: "Barbeiro não encontrado" });
      }

      res.json(barbeiro);
    } catch (error) {
      console.error("Erro ao buscar barbeiro:", error);
      res.status(500).json({ message: "Erro ao buscar barbeiro" });
    }
  });

  app.post("/api/barbeiros", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBarbeiroSchema.parse(req.body);
      const barbeiro = await storage.createBarbeiro(validatedData);
      res.status(201).json(barbeiro);
    } catch (error: any) {
      console.error("Erro ao criar barbeiro:", error);
      if (error.code === '23505') {
        res.status(400).json({ message: "Email já está em uso por outro barbeiro" });
      } else if (error.issues) {
        res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      } else {
        res.status(400).json({ message: error.message || "Erro ao criar barbeiro" });
      }
    }
  });

  app.put("/api/barbeiros/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertBarbeiroSchema.partial().parse(req.body);
      const barbeiro = await storage.updateBarbeiro(id, validatedData);
      res.json(barbeiro);
    } catch (error) {
      console.error("Erro ao atualizar barbeiro:", error);
      res.status(400).json({ message: "Erro ao atualizar barbeiro" });
    }
  });

  app.delete("/api/barbeiros/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBarbeiro(id);
      res.json({ message: "Barbeiro removido com sucesso" });
    } catch (error) {
      console.error("Erro ao remover barbeiro:", error);
      res.status(500).json({ message: "Erro ao remover barbeiro" });
    }
  });

  // Profissionais routes (barbeiros + recepcionistas)
  app.get("/api/profissionais", requireAuth, async (req, res) => {
    try {
      const profissionais = await storage.getAllProfissionais();
      res.json(profissionais);
    } catch (error) {
      console.error("Erro ao buscar profissionais:", error);
      res.status(500).json({ message: "Erro ao buscar profissionais" });
    }
  });

  // Serviços routes
  app.get("/api/servicos", requireAuth, async (req, res) => {
    try {
      const servicos = await storage.getAllServicos();
      res.json(servicos);
    } catch (error) {
      console.error("Erro ao buscar serviços:", error);
      res.status(500).json({ message: "Erro ao buscar serviços" });
    }
  });

  app.get("/api/servicos/assinatura", requireAuth, async (req, res) => {
    try {
      const servicosAssinatura = await storage.getServicosAssinatura();
      res.json(servicosAssinatura);
    } catch (error) {
      console.error("Erro ao buscar serviços de assinatura:", error);
      res.status(500).json({ message: "Erro ao buscar serviços de assinatura" });
    }
  });

  app.post("/api/servicos", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertServicoSchema.parse(req.body);
      const servico = await storage.createServico(validatedData);
      res.status(201).json(servico);
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
      res.status(400).json({ message: "Dados inválidos para criação do serviço" });
    }
  });

  app.put("/api/servicos/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertServicoSchema.partial().parse(req.body);
      const servico = await storage.updateServico(id, validatedData);
      res.json(servico);
    } catch (error) {
      console.error("Erro ao atualizar serviço:", error);
      res.status(400).json({ message: "Erro ao atualizar serviço" });
    }
  });

  app.delete("/api/servicos/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteServico(id);
      res.json({ message: "Serviço removido com sucesso" });
    } catch (error) {
      console.error("Erro ao remover serviço:", error);
      res.status(500).json({ message: "Erro ao remover serviço" });
    }
  });

  // Planos routes
  app.get("/api/planos", requireAuth, async (req, res) => {
    try {
      const planos = await storage.getAllPlanos();
      res.json(planos);
    } catch (error) {
      console.error("Erro ao buscar planos:", error);
      res.status(500).json({ message: "Erro ao buscar planos de assinatura" });
    }
  });

  app.post("/api/planos", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPlanoAssinaturaSchema.parse(req.body);
      const plano = await storage.createPlano(validatedData);
      res.status(201).json(plano);
    } catch (error) {
      console.error("Erro ao criar plano:", error);
      res.status(400).json({ message: "Dados inválidos para criação do plano" });
    }
  });

  app.put("/api/planos/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPlanoAssinaturaSchema.partial().parse(req.body);
      const plano = await storage.updatePlano(id, validatedData);
      res.json(plano);
    } catch (error) {
      console.error("Erro ao atualizar plano:", error);
      res.status(400).json({ message: "Erro ao atualizar plano" });
    }
  });

  app.delete("/api/planos/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlano(id);
      res.json({ message: "Plano removido com sucesso" });
    } catch (error) {
      console.error("Erro ao remover plano:", error);
      res.status(500).json({ message: "Erro ao remover plano" });
    }
  });

  // Distribuição routes
  app.post("/api/distribuicao/calcular", requireAdmin, async (req, res) => {
    try {
      const { 
        faturamentoTotal, 
        percentualComissao, 
        distribuicaoData 
      } = req.body;

      if (!faturamentoTotal || !percentualComissao || !distribuicaoData) {
        return res.status(400).json({ message: "Dados obrigatórios em falta" });
      }

      // Implementação do algoritmo de cálculo de comissão conforme PRD
      let totalMinutesPool = 0;
      const barbeiroMinutes: { [key: number]: number } = {};

      // 1. Calcula total de minutos do pool
      for (const barbeiroId in distribuicaoData) {
        let barbeiroTotalMinutes = 0;
        for (const servicoId in distribuicaoData[barbeiroId]) {
          const quantidade = distribuicaoData[barbeiroId][servicoId];
          const servico = await storage.getServicoById(parseInt(servicoId));
          if (servico && servico.isAssinatura) {
            const minutes = quantidade * servico.tempoMinutos;
            barbeiroTotalMinutes += minutes;
            totalMinutesPool += minutes;
          }
        }
        barbeiroMinutes[parseInt(barbeiroId)] = barbeiroTotalMinutes;
      }

      // 2. Calcula valor do pool de comissão
      const poolValue = (faturamentoTotal * percentualComissao) / 100;

      // 3. Calcula participação e comissão de cada barbeiro
      const resultados = [];
      for (const barbeiroId in barbeiroMinutes) {
        const minutesWorked = barbeiroMinutes[parseInt(barbeiroId)];
        const participationRate = totalMinutesPool > 0 ? minutesWorked / totalMinutesPool : 0;
        const revenueShare = faturamentoTotal * participationRate;
        const commission = poolValue * participationRate;

        const barbeiro = await storage.getBarbeiroById(parseInt(barbeiroId));
        if (barbeiro) {
          resultados.push({
            barbeiro,
            minutesWorked,
            participationRate: participationRate * 100, // Convert to percentage
            revenueShare,
            commission
          });
        }
      }

      res.json({ resultados, totalMinutesPool, poolValue });
    } catch (error) {
      console.error("Erro ao calcular distribuição:", error);
      res.status(500).json({ message: "Erro ao calcular distribuição de comissões" });
    }
  });

  app.post("/api/distribuicao/salvar", requireAdmin, async (req, res) => {
    try {
      const {
        periodoInicio,
        periodoFim,
        faturamentoTotal,
        percentualComissao,
        resultados
      } = req.body;

      // Criar distribuição
      const distribuicao = await storage.createDistribuicao({
        periodoInicio: new Date(periodoInicio),
        periodoFim: new Date(periodoFim),
        faturamentoTotal: faturamentoTotal.toString(),
        percentualComissao
      });

      // Criar itens de distribuição e comissões
      const mes = new Date(periodoInicio).toISOString().slice(0, 7);
      
      for (const resultado of resultados) {
        // Salvar comissão
        await storage.createComissao({
          barbeiroId: resultado.barbeiro.id,
          mes,
          valor: resultado.commission.toString()
        });
      }

      res.json({ message: "Distribuição salva com sucesso", distribuicao });
    } catch (error) {
      console.error("Erro ao salvar distribuição:", error);
      res.status(500).json({ message: "Erro ao salvar distribuição" });
    }
  });

  // Atendimentos routes
  app.get("/api/atendimentos", requireAuth, async (req, res) => {
    try {
      const atendimentos = await storage.getAllAtendimentos();
      res.json(atendimentos);
    } catch (error) {
      console.error("Erro ao buscar atendimentos:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/atendimentos/barbeiro/:barbeiroId", requireAuth, async (req, res) => {
    try {
      const barbeiroId = parseInt(req.params.barbeiroId);
      const mes = req.query.mes as string;
      
      // Verificar se é admin ou o próprio barbeiro
      if (req.session.userRole !== 'admin' && req.session.barbeiroId !== barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const atendimentos = await storage.getAtendimentosByBarbeiro(barbeiroId, mes);
      res.json(atendimentos);
    } catch (error) {
      console.error("Erro ao buscar atendimentos do barbeiro:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/atendimentos/resumo/:barbeiroId/:mes", requireAuth, async (req, res) => {
    try {
      const barbeiroId = parseInt(req.params.barbeiroId);
      const mes = req.params.mes;
      
      // Verificar se é admin ou o próprio barbeiro
      if (req.session.userRole !== 'admin' && req.session.barbeiroId !== barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const resumo = await storage.getAtendimentosResumo(barbeiroId, mes);
      res.json(resumo);
    } catch (error) {
      console.error("Erro ao buscar resumo de atendimentos:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/atendimentos", requireAuth, async (req, res) => {
    try {
      const atendimento = await storage.createAtendimento(req.body);
      res.status(201).json(atendimento);
    } catch (error) {
      console.error("Erro ao criar atendimento:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.put("/api/atendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const atendimento = await storage.updateAtendimento(id, req.body);
      res.json(atendimento);
    } catch (error) {
      console.error("Erro ao atualizar atendimento:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.delete("/api/atendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAtendimento(id);
      res.json({ message: "Atendimento removido com sucesso" });
    } catch (error) {
      console.error("Erro ao remover atendimento:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS DE CLIENTES UNIFICADOS =====
  // Lista todos os clientes de todas as fontes (Local + Principal + Andrey)
  app.get("/api/clientes-unified", requireAuth, async (req, res) => {
    try {
      console.log("🔍 Buscando clientes unificados de todas as fontes...");
      
      const clientesUnificados = [];
      
      // 1. Clientes do banco local (incluindo sincronizados e externos)
      const clientesLocais = await storage.getAllClientes();
      clientesUnificados.push(...clientesLocais);
      console.log(`✅ ${clientesLocais.length} clientes locais adicionados`);
      
      // 2. Buscar apenas clientes com PAGAMENTOS CONFIRMADOS da conta Principal (últimos 30 dias)
      try {
        const apiKey = process.env.ASAAS_API_KEY;
        if (apiKey) {
          // Buscar pagamentos confirmados dos últimos 30 dias
          const dataLimite = new Date();
          dataLimite.setDate(dataLimite.getDate() - 30);
          const dataLimiteStr = dataLimite.toISOString().split('T')[0];
          
          const paymentsResponse = await fetch(`https://www.asaas.com/api/v3/payments?status=CONFIRMED&dateCreated[ge]=${dataLimiteStr}&limit=100`, {
            headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
          });
          
          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            const clientesComPagamentoConfirmado = new Set();
            
            // Verificar quais clientes ainda não estão no banco local
            const emailsLocais = new Set(clientesLocais.map(c => c.email.toLowerCase()));
            
            for (const payment of paymentsData.data || []) {
              // Verificar se o pagamento foi confirmado nos últimos 30 dias
              const paymentDate = new Date(payment.paymentDate || payment.confirmedDate);
              const agora = new Date();
              const diasDesdeConfirmacao = Math.floor((agora.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (diasDesdeConfirmacao <= 30 && !clientesComPagamentoConfirmado.has(payment.customer)) {
                clientesComPagamentoConfirmado.add(payment.customer);
                
                // Buscar dados do cliente
                try {
                  const customerResponse = await fetch(`https://www.asaas.com/api/v3/customers/${payment.customer}`, {
                    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
                  });
                  
                  if (customerResponse.ok) {
                    const customer = await customerResponse.json();
                    
                    if (!emailsLocais.has(customer.email.toLowerCase())) {
                      clientesUnificados.push({
                        id: `principal_${customer.id}`,
                        nome: customer.name,
                        email: customer.email,
                        telefone: customer.phone || customer.mobilePhone,
                        cpf: customer.cpfCnpj,
                        origem: 'ASAAS_PRINCIPAL',
                        asaasCustomerId: customer.id,
                        planoNome: 'Assinatura Ativa',
                        planoValor: payment.value.toString(),
                        formaPagamento: payment.billingType || 'CREDIT_CARD',
                        statusAssinatura: 'ATIVO',
                        dataInicioAssinatura: new Date(payment.dateCreated),
                        dataVencimentoAssinatura: new Date(paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000),
                        createdAt: new Date(customer.dateCreated)
                      });
                    }
                  }
                } catch (customerError) {
                  console.warn(`Erro ao buscar cliente ${payment.customer}:`, customerError);
                }
              }
            }
            console.log(`✅ Clientes da conta Principal com pagamentos confirmados verificados`);
          }
        }
      } catch (error) {
        console.warn("Aviso: Erro ao buscar conta Principal:", error);
      }
      
      // 3. Buscar clientes da conta Asaas Andrey (não sincronizados)
      try {
        const andreyApiKey = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFmYWFlOWZkLTU5YzItNDQ1ZS1hZjAxLWI1ZTc4ZTg1MDJlYzo6JGFhY2hfOGY2NTBlYzQtZjY4My00MDllLWE3ZDYtMzM3ODQwN2ViOGRj';
        
        const andreyCustomersResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
          headers: { 'access_token': andreyApiKey, 'Content-Type': 'application/json' }
        });
        
        if (andreyCustomersResponse.ok) {
          const andreyCustomersData = await andreyCustomersResponse.json();
          
          // Buscar assinaturas ativas da conta Andrey
          const andreySubscriptionsResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?status=ACTIVE&limit=100', {
            headers: { 'access_token': andreyApiKey, 'Content-Type': 'application/json' }
          });
          
          const andreySubscriptionsData = andreySubscriptionsResponse.ok ? await andreySubscriptionsResponse.json() : { data: [] };
          const andreyActiveSubscriptions = new Set(andreySubscriptionsData.data?.map((s: any) => s.customer) || []);
          
          // Verificar quais clientes ainda não estão na lista
          const emailsExistentes = new Set(clientesUnificados.map(c => c.email.toLowerCase()));
          
          for (const customer of andreyCustomersData.data || []) {
            if (!emailsExistentes.has(customer.email.toLowerCase())) {
              const hasActiveSubscription = andreyActiveSubscriptions.has(customer.id);
              
              clientesUnificados.push({
                id: `andrey_${customer.id}`,
                nome: customer.name,
                email: customer.email,
                telefone: customer.phone || customer.mobilePhone,
                cpf: customer.cpfCnpj,
                origem: 'ASAAS_ANDREY',
                asaasCustomerId: customer.id,
                planoNome: hasActiveSubscription ? 'Assinatura Ativa' : 'Cliente Cadastrado',
                planoValor: hasActiveSubscription ? '50.00' : '0.00',
                formaPagamento: hasActiveSubscription ? 'CREDIT_CARD' : 'N/A',
                statusAssinatura: hasActiveSubscription ? 'ATIVO' : 'INATIVO',
                dataInicioAssinatura: new Date(customer.dateCreated),
                dataVencimentoAssinatura: hasActiveSubscription ? 
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : 
                  new Date(customer.dateCreated),
                createdAt: new Date(customer.dateCreated)
              });
            }
          }
          console.log(`✅ Clientes da conta Andrey verificados`);
        }
      } catch (error) {
        console.warn("Aviso: Erro ao buscar conta Andrey:", error);
      }
      
      console.log(`🎯 Total de clientes unificados: ${clientesUnificados.length}`);
      
      res.json({
        success: true,
        total: clientesUnificados.length,
        clientes: clientesUnificados
      });
    } catch (error) {
      console.error("Erro ao buscar clientes unificados:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rota para limpar dados antigos
  app.post("/api/admin/limpar-dados", requireAuth, async (req, res) => {
    try {
      const { limparDadosAntigos } = await import('./cleanup-data');
      const resultado = await limparDadosAntigos();
      res.json({
        success: true,
        message: "Limpeza realizada com sucesso",
        ...resultado
      });
    } catch (error) {
      console.error("Erro na limpeza:", error);
      res.status(500).json({ message: "Erro ao limpar dados" });
    }
  });

  // =====================================================
  // NOVA API MODERNA - CLIENTES MASTER
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

  // Listar todos os clientes da nova estrutura
  app.get("/api/v2/clientes", requireAuth, async (req, res) => {
    try {
      if (!ClientesMasterService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new ClientesMasterService();
      const clientes = await service.getClientesCompletos();

      res.json({
        success: true,
        total: clientes.length,
        clientes
      });
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Obter cliente específico
  app.get("/api/v2/clientes/:id", requireAuth, async (req, res) => {
    try {
      if (!ClientesMasterService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new ClientesMasterService();
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const cliente = await service.getClienteById(id);

      if (!cliente) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      res.json({
        success: true,
        cliente
      });
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar novo cliente
  app.post("/api/v2/clientes", requireAuth, async (req, res) => {
    try {
      if (!ClientesMasterService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new ClientesMasterService();
      const novoCliente = await service.createCliente(req.body);

      res.status(201).json({
        success: true,
        message: "Cliente criado com sucesso",
        cliente: novoCliente
      });
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar cliente
  app.put("/api/v2/clientes/:id", requireAuth, async (req, res) => {
    try {
      if (!ClientesMasterService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new ClientesMasterService();
      const clienteAtualizado = await service.updateCliente(parseInt(req.params.id), req.body);

      if (!clienteAtualizado) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      res.json({
        success: true,
        message: "Cliente atualizado com sucesso",
        cliente: clienteAtualizado
      });
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Sincronizar clientes das APIs Asaas
  app.post("/api/v2/sync/asaas-principal", requireAuth, async (req, res) => {
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

  app.post("/api/v2/sync/asaas-andrey", requireAuth, async (req, res) => {
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

  // Estatísticas consolidadas da nova estrutura
  app.get("/api/v2/estatisticas", requireAuth, async (req, res) => {
    try {
      if (!AsaasIntegrationService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new AsaasIntegrationService();
      const estatisticas = await service.getEstatisticasConsolidadas();

      res.json({
        success: true,
        ...estatisticas
      });
    } catch (error) {
      console.error("Erro ao obter estatísticas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Validar integridade dos dados
  app.get("/api/v2/clientes/validar-integridade", requireAuth, async (req, res) => {
    try {
      if (!ClientesMasterService) {
        return res.status(500).json({ message: "Serviço não disponível" });
      }

      const service = new ClientesMasterService();
      const problemas = await service.validarIntegridade();

      res.json({
        success: true,
        problemas
      });
    } catch (error) {
      console.error("Erro na validação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // =====================================================
  // MANTER APIs ANTIGAS PARA COMPATIBILIDADE
  // =====================================================

  // Stats unificados APENAS com clientes ATIVOS de hoje + APIs Asaas
  app.get("/api/clientes-unified/stats", requireAuth, async (req, res) => {
    try {
      console.log("📊 Calculando estatísticas CONFIRMADAS (apenas hoje + Asaas ativas)...");
      
      // 1. Clientes locais/externos ATIVOS criados HOJE
      const clientesLocais = await storage.getAllClientes();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const clientesLocaisAtivos = clientesLocais.filter(c => {
        if (c.statusAssinatura !== 'ATIVO') return false;
        
        const dataCliente = new Date(c.createdAt);
        dataCliente.setHours(0, 0, 0, 0);
        return dataCliente.getTime() === hoje.getTime();
      });
      
      const receitaLocal = clientesLocaisAtivos.reduce((sum, c) => sum + parseFloat(c.planoValor || '0'), 0);
      
      console.log(`Local/Externos HOJE: ${clientesLocaisAtivos.length} clientes ativos, R$ ${receitaLocal.toFixed(2)} receita`);
      
      // 2. Conta Principal - Assinaturas ATIVAS (status ACTIVE = pagamentos confirmados)
      let clientesAtivosPrincipal = 0;
      let receitaPrincipal = 0;
      
      try {
        const apiKey = process.env.ASAAS_API_KEY;
        if (apiKey) {
          console.log("🔍 Buscando assinaturas ATIVAS da conta Principal...");
          
          const subscriptionsResponse = await fetch(`https://www.asaas.com/api/v3/subscriptions?status=ACTIVE&limit=100`, {
            headers: { 'access_token': apiKey, 'Content-Type': 'application/json' }
          });
          
          if (subscriptionsResponse.ok) {
            const subscriptionsData = await subscriptionsResponse.json();
            console.log(`Principal API Response:`, {
              totalCount: subscriptionsData.totalCount,
              dataLength: subscriptionsData.data?.length
            });
            
            // Assinaturas ATIVAS já indicam pagamentos confirmados
            for (const subscription of subscriptionsData.data || []) {
              if (subscription.status === 'ACTIVE') {
                clientesAtivosPrincipal++;
                receitaPrincipal += parseFloat(subscription.value || '0');
              }
            }
            console.log(`Principal: ${clientesAtivosPrincipal} assinaturas ATIVAS, R$ ${receitaPrincipal.toFixed(2)} receita`);
          } else {
            console.log(`Principal API Error: ${subscriptionsResponse.status} - ${await subscriptionsResponse.text()}`);
          }
        }
      } catch (error) {
        console.warn("Erro ao buscar dados da conta Principal:", error);
      }
      
      // 3. Conta Andrey - Assinaturas ATIVAS (status ACTIVE = pagamentos confirmados)
      let clientesAtivosAndrey = 0;
      let receitaAndrey = 0;
      
      try {
        const andreyApiKey = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjUwODNiMzE1LWJiMjktNDQwYi05NDVhLWNkZTNkZDhlZWI2OTo6JGFhY2hfOGM4M2UyNDEtNzk2NS00MDg5LTgyYzgtNjA4YWE5MWM0Y2Q5';
        
        console.log("🔍 Buscando assinaturas ATIVAS da conta Andrey...");
        
        const andreySubscriptionsResponse = await fetch(`https://www.asaas.com/api/v3/subscriptions?status=ACTIVE&limit=100`, {
          headers: { 'access_token': andreyApiKey, 'Content-Type': 'application/json' }
        });
        
        if (andreySubscriptionsResponse.ok) {
          const andreySubscriptionsData = await andreySubscriptionsResponse.json();
          console.log(`Andrey API Response:`, {
            totalCount: andreySubscriptionsData.totalCount,
            dataLength: andreySubscriptionsData.data?.length
          });
          
          // Assinaturas ATIVAS já indicam pagamentos confirmados
          for (const subscription of andreySubscriptionsData.data || []) {
            if (subscription.status === 'ACTIVE') {
              clientesAtivosAndrey++;
              receitaAndrey += parseFloat(subscription.value || '0');
            }
          }
          console.log(`Andrey: ${clientesAtivosAndrey} assinaturas ATIVAS, R$ ${receitaAndrey.toFixed(2)} receita`);
        } else {
          console.log(`Andrey API Error: ${andreySubscriptionsResponse.status} - ${await andreySubscriptionsResponse.text()}`);
        }
      } catch (error) {
        console.warn("Erro ao buscar dados da conta Andrey:", error);
      }
      
      // 4. Totais consolidados APENAS com pagamentos confirmados
      const totalClientesAtivos = clientesLocaisAtivos.length + clientesAtivosPrincipal + clientesAtivosAndrey;
      const receitaTotalConfirmada = receitaLocal + receitaPrincipal + receitaAndrey;
      
      console.log(`🎯 TOTAL CONFIRMADO: ${totalClientesAtivos} clientes ativos, R$ ${receitaTotalConfirmada.toFixed(2)} receita confirmada`);
      
      // 5. Estatísticas por origem
      const clientesPorOrigem = [
        { origem: 'LOCAL_EXTERNO', total: clientesLocaisAtivos.length },
        { origem: 'ASAAS_PRINCIPAL', total: clientesAtivosPrincipal },
        { origem: 'ASAAS_ANDREY', total: clientesAtivosAndrey }
      ];
      
      res.json({
        success: true,
        total: totalClientesAtivos,
        origem: clientesPorOrigem,
        valorTotalAssinaturas: receitaTotalConfirmada,
        clientesAtivos: totalClientesAtivos,
        stats: {
          totalClientes: totalClientesAtivos,
          valorTotalAssinaturas: receitaTotalConfirmada,
          clientesAtivos: totalClientesAtivos,
          clientesPorOrigem,
          breakdown: {
            local: { total: clientesLocaisAtivos.length, receita: receitaLocal },
            principal: { total: clientesAtivosPrincipal, receita: receitaPrincipal },
            andrey: { total: clientesAtivosAndrey, receita: receitaAndrey }
          }
        }
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas confirmadas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTA OTIMIZADA PARA SINCRONIZAÇÃO ASAAS =====
  app.get("/api/asaas/sync", requireAuth, async (req, res) => {
    try {
      const result = await syncAsaasData();
      res.json(result);
    } catch (error) {
      console.error("Erro na sincronização Asaas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTA ESPECÍFICA PARA TRATO DE BARBADOS =====
  app.get("/api/clientes-trato-barbados", requireAuth, async (req, res) => {
    try {
      const tratoBarbadosApiKey = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFmYWFlOWZkLTU5YzItNDQ1ZS1hZjAxLWI1ZTc4ZTg1MDJlYzo6JGFhY2hfOGY2NTBlYzQtZjY4My00MDllLWE3ZDYtMzM3ODQwN2ViOGRj';
      
      console.log('🔍 Buscando clientes da conta Trato de Barbados');
      
      // Buscar clientes
      const customersResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
        headers: {
          'access_token': tratoBarbadosApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!customersResponse.ok) {
        throw new Error(`Erro na API Trato de Barbados: ${customersResponse.status}`);
      }

      const customersData = await customersResponse.json();
      console.log(`📋 Encontrados ${customersData.totalCount || 0} clientes da conta Trato de Barbados`);

      // Buscar assinaturas ativas
      const subscriptionsResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?status=ACTIVE&limit=100', {
        headers: {
          'access_token': tratoBarbadosApiKey,
          'Content-Type': 'application/json'
        }
      });

      const subscriptionsData = subscriptionsResponse.ok ? await subscriptionsResponse.json() : { data: [] };
      const activeSubscriptions = new Set(subscriptionsData.data?.map((s: any) => s.customer) || []);

      const clientesProcessados = [];
      for (const customer of customersData.data || []) {
        const hasActiveSubscription = activeSubscriptions.has(customer.id);
        
        clientesProcessados.push({
          id: customer.id,
          nome: customer.name,
          email: customer.email,
          telefone: customer.phone || customer.mobilePhone,
          cpf: customer.cpfCnpj,
          origem: 'TRATO_BARBADOS',
          statusAssinatura: hasActiveSubscription ? 'ATIVO' : 'INATIVO',
          planoNome: hasActiveSubscription ? 'Assinatura Ativa' : 'Cliente Cadastrado',
          planoValor: hasActiveSubscription ? '50.00' : '0.00',
          dataCreated: customer.dateCreated
        });
      }

      res.json({
        success: true,
        total: customersData.totalCount || 0,
        clientes: clientesProcessados,
        assinaturasAtivas: activeSubscriptions.size
      });
    } catch (error) {
      console.error("Erro ao buscar clientes Trato de Barbados:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTA DA API 1 CLIENTE PRINCIPAL (CORRIGIDA) =====
  app.get("/api/clientes", requireAuth, async (req, res) => {
    try {
      const apiKey = process.env.ASAAS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Chave API principal não configurada" });
      }

      // Buscar clientes da API 1 Principal  
      const clientesResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!clientesResponse.ok) {
        throw new Error(`Erro na API: ${clientesResponse.status}`);
      }

      const clientesData = await clientesResponse.json();

      // Buscar assinaturas para identificar clientes ativos
      const assinaturasResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?limit=100&status=ACTIVE', {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      const assinaturasData = await assinaturasResponse.json();

      // IMPLEMENTAR FLUXO OBRIGATÓRIO: API 1 → Sistema Central
      const assinaturasPorCliente = new Map();
      for (const assinatura of assinaturasData.data || []) {
        assinaturasPorCliente.set(assinatura.customer, {
          planoNome: assinatura.billingType || 'Plano API 1',
          planoValor: assinatura.value || '0.00',
          formaPagamento: assinatura.billingType || 'CREDIT_CARD',
          statusAssinatura: 'ATIVO',
          dataInicioAssinatura: new Date(assinatura.dateCreated),
          dataVencimentoAssinatura: new Date(assinatura.nextDueDate || Date.now() + 30*24*60*60*1000)
        });
      }

      // Verificar clientes existentes na tabela central
      const clientesExistentes = await storage.getAllClientes();
      const emailsExistentes = new Set(clientesExistentes.map(c => c.email.toLowerCase()));
      const asaasIdsExistentes = new Set(clientesExistentes.map(c => c.asaasCustomerId).filter(Boolean));

      let clientesSincronizados = 0;
      for (const customer of clientesData.data || []) {
        // Pular se cliente já existe por email ou asaasCustomerId
        if (emailsExistentes.has(customer.email.toLowerCase()) || asaasIdsExistentes.has(customer.id)) {
          continue;
        }

        const assinatura = assinaturasPorCliente.get(customer.id);
        
        // Só cadastrar clientes com assinatura ativa
        if (assinatura) {
          try {
            // ETAPA 3: Cadastrar na tabela CLIENTES DO SISTEMA (FLUXO OBRIGATÓRIO)
            await storage.createCliente({
              nome: (customer.name || '').substring(0, 250),
              email: (customer.email || '').substring(0, 250),
              telefone: (customer.phone || customer.mobilePhone || '').substring(0, 20),
              cpf: (customer.cpfCnpj || '').substring(0, 14),
              origem: 'ASAAS_PRINCIPAL', // Identificação da fonte de dados
              asaasCustomerId: customer.id,
              planoNome: (assinatura.planoNome || '').substring(0, 250),
              planoValor: assinatura.planoValor,
              formaPagamento: (assinatura.formaPagamento || '').substring(0, 50),
              statusAssinatura: assinatura.statusAssinatura,
              dataInicioAssinatura: assinatura.dataInicioAssinatura,
              dataVencimentoAssinatura: assinatura.dataVencimentoAssinatura
            });
            clientesSincronizados++;
            console.log(`✅ Cliente API 1 sincronizado na tabela central: ${customer.name}`);
          } catch (error) {
            console.warn(`❌ Erro ao sincronizar cliente API 1 ${customer.name}:`, error);
          }
        }
      }

      console.log(`🔍 API 1 Principal processada: ${clientesSincronizados} clientes sincronizados no sistema central`);

      res.json({
        success: true,
        total: clientesData.totalCount || clientesData.data?.length || 0,
        clientesSincronizados,
        clientes: clientesData.data || []
      });
    } catch (error) {
      console.error("Erro na API 1 Cliente Principal:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS ESPECÍFICAS PARA CLIENTES EXTERNOS =====
  // Lista apenas clientes externos
  app.get("/api/clientes-externos", requireAuth, async (req, res) => {
    try {
      const clientesExternos = await storage.getAllClientesExternos();
      res.json(clientesExternos);
    } catch (error) {
      console.error("Erro ao buscar clientes externos:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar cliente externo por ID
  app.get("/api/clientes-externos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const cliente = await storage.getClienteExternoById(id);
      
      if (!cliente) {
        return res.status(404).json({ message: "Cliente externo não encontrado" });
      }
      
      res.json(cliente);
    } catch (error) {
      console.error("Erro ao buscar cliente externo:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar cliente externo
  app.put("/api/clientes-externos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const cliente = await storage.updateClienteExterno(id, req.body);
      res.json(cliente);
    } catch (error) {
      console.error("Erro ao atualizar cliente externo:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Total de Serviços routes (Controle Admin)
  app.get("/api/total-servicos/:mes", requireAdmin, async (req, res) => {
    try {
      const mes = req.params.mes;
      const totais = await storage.getTotalServicosByMes(mes);
      res.json(totais);
    } catch (error) {
      console.error("Erro ao buscar totais de serviços:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/total-servicos", requireAdmin, async (req, res) => {
    try {
      const totalServico = await storage.createOrUpdateTotalServico(req.body);
      res.json(totalServico);
    } catch (error) {
      console.error("Erro ao salvar total de serviço:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/validate-limits/:mes", requireAdmin, async (req, res) => {
    try {
      const mes = req.params.mes;
      const validation = await storage.validateAtendimentoLimits(mes);
      res.json(validation);
    } catch (error) {
      console.error("Erro ao validar limites:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Comissão em tempo real para barbeiro
  app.get("/api/comissao-atual/:barbeiroId/:mes", requireAuth, async (req, res) => {
    try {
      const barbeiroId = parseInt(req.params.barbeiroId);
      const mes = req.params.mes;
      
      // Verificar se é admin ou o próprio barbeiro
      if (req.session.userRole !== 'admin' && req.session.barbeiroId !== barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const comissao = await storage.getComissaoAtualBarbeiro(barbeiroId, mes);
      res.json(comissao);
    } catch (error) {
      console.error("Erro ao buscar comissão atual:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Comissões routes
  // Rota para barbeiros acessarem suas próprias comissões
  app.get("/api/comissoes/barbeiro", requireAuth, async (req, res) => {
    try {
      // Para barbeiros, usar o ID da sessão
      if (req.session.userRole === 'barbeiro' && req.session.barbeiroId) {
        const comissoes = await storage.getComissoesByBarbeiro(req.session.barbeiroId);
        return res.json(comissoes);
      }
      
      // Para outros usuários, retornar erro
      return res.status(403).json({ message: "Acesso negado" });
    } catch (error) {
      console.error("Erro ao buscar comissões:", error);
      res.status(500).json({ message: "Erro ao buscar comissões do barbeiro" });
    }
  });

  // Nova API para dados de comissão do barbeiro baseado na página de distribuição
  app.get("/api/barbeiro/comissao-dados", requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'barbeiro' || !req.session.barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { mes } = req.query;
      const mesConsulta = mes ? mes.toString() : new Date().toISOString().slice(0, 7);

      // Buscar barbeiro
      const barbeiro = await storage.getBarbeiroById(req.session.barbeiroId);
      if (!barbeiro) {
        return res.status(404).json({ message: "Barbeiro não encontrado" });
      }

      // Buscar agendamentos finalizados do barbeiro no mês
      const agendamentos = await storage.getAllAgendamentos();
      const agendamentosFinalizados = agendamentos.filter(a => 
        a.barbeiroId === req.session.barbeiroId &&
        a.status === 'FINALIZADO' &&
        new Date(a.dataHora).toISOString().slice(0, 7) === mesConsulta
      );

      // Buscar serviços para calcular tempo
      const servicos = await storage.getAllServicos();
      const servicosMap = new Map(servicos.map(s => [s.id, s]));

      // Calcular dados
      let totalServicos = 0;
      let tempoTotalMinutos = 0;
      let comissaoTotal = 0;

      for (const agendamento of agendamentosFinalizados) {
        const servico = servicosMap.get(agendamento.servicoId);
        if (servico) {
          totalServicos += 1;
          tempoTotalMinutos += servico.tempoMinutos;
        }
      }

      // Buscar comissões registradas do barbeiro para o mês
      const comissoes = await storage.getComissoesByBarbeiro(req.session.barbeiroId);
      const comissaoMes = comissoes.find(c => c.mes === mesConsulta);
      if (comissaoMes) {
        comissaoTotal = parseFloat(comissaoMes.valor);
      }

      res.json({
        barbeiro: {
          id: barbeiro.id,
          nome: barbeiro.nome,
          email: barbeiro.email
        },
        mes: mesConsulta,
        totalServicos,
        tempoTotalMinutos,
        comissaoTotal,
        servicosFinalizados: agendamentosFinalizados.length
      });

    } catch (error) {
      console.error("Erro ao buscar dados de comissão:", error);
      res.status(500).json({ message: "Erro ao buscar dados de comissão" });
    }
  });

  // API para editar perfil do barbeiro
  app.put("/api/barbeiro/perfil", requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'barbeiro' || !req.session.barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { nome, email } = req.body;
      
      if (!nome || !email) {
        return res.status(400).json({ message: "Nome e email são obrigatórios" });
      }

      // Atualizar dados do barbeiro
      const barbeiro = await storage.updateBarbeiro(req.session.barbeiroId!, { nome, email });
      
      // Atualizar dados do usuário também
      await storage.updateUser(req.session.userId, { nome, email });

      res.json({ message: "Perfil atualizado com sucesso", barbeiro });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  // API para trocar senha do barbeiro
  app.put("/api/barbeiro/senha", requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'barbeiro' || !req.session.userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { senhaAtual, novaSenha } = req.body;
      
      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }

      // Buscar usuário
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verificar senha atual
      const senhaValida = await bcrypt.compare(senhaAtual, user.password);
      if (!senhaValida) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      // Criptografar nova senha
      const novaSenhaCriptografada = await bcrypt.hash(novaSenha, 10);
      
      // Atualizar senha
      await storage.updateUser(req.session.userId, { password: novaSenhaCriptografada });

      res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  // API para Lista da Vez específica do barbeiro
  app.get("/api/lista-vez/barbeiro", requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'barbeiro' || !req.session.barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Buscar clientes na lista da vez do barbeiro
      const agendamentos = await storage.getAllAgendamentos();
      const agendamentosHoje = agendamentos.filter(a => 
        a.barbeiroId === req.session.barbeiroId &&
        a.status === 'AGENDADO' &&
        new Date(a.dataHora).toDateString() === new Date().toDateString()
      );

      // Buscar dados dos clientes
      const clientes = await storage.getAllClientes();
      const clientesMap = new Map(clientes.map(c => [c.id, c]));

      const clientesComDetalhes = agendamentosHoje.map((agendamento, index) => {
        const cliente = clientesMap.get(agendamento.clienteId);
        return {
          id: agendamento.id,
          posicao: index + 1,
          cliente: cliente ? {
            id: cliente.id,
            nome: cliente.nome,
            telefone: cliente.telefone
          } : null,
          criadoEm: agendamento.dataHora
        };
      }).filter(item => item.cliente !== null);

      res.json({
        clientes: clientesComDetalhes,
        total: clientesComDetalhes.length
      });

    } catch (error) {
      console.error("Erro ao buscar lista da vez:", error);
      res.status(500).json({ message: "Erro ao buscar lista da vez" });
    }
  });

  app.get("/api/comissoes/barbeiro/:barbeiroId", requireAuth, async (req, res) => {
    try {
      const barbeiroId = parseInt(req.params.barbeiroId);
      
      // Verificar se é admin ou o próprio barbeiro
      if (req.session.userRole !== 'admin' && req.session.barbeiroId !== barbeiroId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const comissoes = await storage.getComissoesByBarbeiro(barbeiroId);
      res.json(comissoes);
    } catch (error) {
      console.error("Erro ao buscar comissões:", error);
      res.status(500).json({ message: "Erro ao buscar comissões do barbeiro" });
    }
  });

  // Asaas Integration
  app.post("/api/clientes/asaas", requireAdmin, async (req, res) => {
    try {
      const { nome, email } = req.body;
      
      const ASAAS_API_KEY = process.env.ASAAS_API_KEY || 
        "aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjY4NGRiNmQ3LWJjZTMtNDQyZS1hM2FhLTE4ZDkyMDJjMTc3OTo6JGFhY2hfNWU5NTdkMzUtNzRiNS00YjU4LWJmYWItN2U4Y2ExZDAxMzBl";

      // Registrar cliente no Asaas
      const asaasResponse = await fetch("https://www.asaas.com/api/v3/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          name: nome,
          email: email,
        }),
      });

      if (!asaasResponse.ok) {
        throw new Error("Erro ao registrar cliente no Asaas");
      }

      const asaasCustomer = await asaasResponse.json();

      // Salvar cliente localmente
      const cliente = await storage.createCliente({
        nome,
        email,
        asaasCustomerId: asaasCustomer.id,
      });

      res.status(201).json(cliente);
    } catch (error) {
      console.error("Erro ao registrar cliente:", error);
      res.status(500).json({ message: "Erro ao registrar cliente no sistema de pagamentos" });
    }
  });

  // CSV Export
  app.get("/api/export/comissoes", requireAdmin, async (req, res) => {
    try {
      const { mes } = req.query;
      
      if (!mes) {
        return res.status(400).json({ message: "Mês é obrigatório" });
      }

      const comissoes = await storage.getComissoesByMes(mes as string);
      
      // Buscar dados dos barbeiros
      const comissoesComBarbeiros = await Promise.all(
        comissoes.map(async (comissao) => {
          const barbeiro = await storage.getBarbeiroById(comissao.barbeiroId);
          return {
            ...comissao,
            barbeiro,
          };
        })
      );

      // Gerar CSV
      const csvHeader = "Barbeiro,Email,Mês,Comissão\n";
      const csvRows = comissoesComBarbeiros
        .map(c => `${c.barbeiro?.nome},${c.barbeiro?.email},${c.mes},R$ ${c.valor}`)
        .join("\n");
      
      const csv = csvHeader + csvRows;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="comissoes-${mes}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      res.status(500).json({ message: "Erro ao gerar relatório CSV" });
    }
  });

  // Endpoint para verificar chaves PIX disponíveis
  app.get('/api/asaas/pix-keys', async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnvironment = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Configuração da API Asaas não encontrada' });
      }

      const baseUrl = asaasEnvironment === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      const response = await fetch(`${baseUrl}/pix/addressKeys`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro ao buscar chaves PIX: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      res.json(data);

    } catch (error) {
      console.error('Erro ao buscar chaves PIX:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor',
        error: error.message 
      });
    }
  });

  // CRUD para Planos de Assinatura - Admins e Recepcionistas podem visualizar
  app.get("/api/planos-assinatura", requireAuth, async (req, res) => {
    try {
      const planos = await storage.getAllPlanos();
      res.json(planos);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post("/api/planos-assinatura", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { nome, descricao, valorMensal, categoria } = req.body;
      
      if (!nome || !valorMensal || !categoria) {
        return res.status(400).json({ message: 'Nome, valor mensal e categoria são obrigatórios' });
      }

      const novoPlano = await storage.createPlano({
        nome,
        descricao: descricao || `Assinatura ${nome} - ${categoria}`,
        valorMensal: valorMensal.toString(),
        categoria,
        servicosIncluidos: []
      });

      res.json(novoPlano);
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.put("/api/planos-assinatura/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { nome, descricao, valorMensal, categoria } = req.body;
      
      // Usar updatePlano para a tabela correta
      const planoAtualizado = await storage.updatePlano(id, {
        nome,
        descricao,
        valorMensal,
        categoria
      });

      res.json(planoAtualizado);
    } catch (error) {
      console.error('Erro ao atualizar plano:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.delete("/api/planos-assinatura/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlano(id);
      res.json({ message: 'Plano excluído com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // POST /api/planos-assinatura/:id/gerar-link-exclusivo - Gerar link exclusivo para clientes com assinatura
  app.post("/api/planos-assinatura/:id/gerar-link-exclusivo", requireAuth, requireAdmin, async (req, res) => {
    try {
      const planoId = parseInt(req.params.id);
      
      // Buscar o plano
      const planos = await storage.getAllPlanos();
      const plano = planos.find(p => p.id === planoId);
      
      if (!plano) {
        return res.status(404).json({ message: 'Plano não encontrado' });
      }

      // Verificar se é categoria "Exclusiva clientes antigo"
      if (plano.categoria !== "Exclusiva clientes antigo") {
        return res.status(400).json({ message: 'Este plano não é exclusivo para clientes antigos' });
      }

      // Verificar se existem clientes com assinaturas ativas via API do Asaas
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnvironment = process.env.ASAAS_ENVIRONMENT;
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Chave API do Asaas não configurada' });
      }

      const baseUrl = asaasEnvironment === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Buscar assinaturas ativas
      const subscriptionsResponse = await fetch(`${baseUrl}/subscriptions?status=ACTIVE&limit=100`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!subscriptionsResponse.ok) {
        throw new Error('Erro ao verificar assinaturas ativas');
      }

      const subscriptionsData = await subscriptionsResponse.json();
      const assinaturasAtivas = subscriptionsData.data || [];

      if (assinaturasAtivas.length === 0) {
        return res.status(400).json({ message: 'Nenhum cliente com assinatura ativa encontrado' });
      }

      // Gerar checkout exclusivo via Asaas
      const checkoutData = {
        name: plano.nome,
        description: `${plano.descricao} - Exclusivo para clientes com assinatura ativa`,
        chargeType: "RECURRENT",
        billingType: plano.billingType,
        value: plano.valor,
        cycle: plano.cycle,
        maxInstallmentCount: 1,
        externalReference: `plano_exclusivo_${planoId}_${Date.now()}`
      };

      const checkoutResponse = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        },
        body: JSON.stringify(checkoutData)
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json();
        throw new Error(`Erro ao criar checkout: ${JSON.stringify(errorData)}`);
      }

      const asaasData = await checkoutResponse.json();
      
      res.json({ 
        checkoutUrl: asaasData.invoiceUrl || asaasData.bankSlipUrl || `${baseUrl}/subscriptions/${asaasData.id}/payment`,
        message: 'Link exclusivo gerado com sucesso',
        clientesElegiveis: assinaturasAtivas.length,
        subscriptionId: asaasData.id
      });
    } catch (error) {
      console.error('Erro ao gerar link exclusivo:', error);
      res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  });

  // Rota para clientes unificados (Asaas + Externos)
  app.get("/api/clientes/unified", requireAuth, async (req, res) => {
    try {
      const clientesUnificados = [];
      
      // Buscar todos os clientes do banco local
      const clientesExternos = await storage.getAllClientes();
      const hoje = new Date();
      
      // Sincronizar clientes de ambas as contas Asaas
      let clientesAsaasSincronizados = new Set();

      // Configuração das duas contas Asaas
      const asaasAccounts = [
        {
          apiKey: process.env.ASAAS_TRATO,
          name: 'ASAAS_TRATO'
        },
        {
          apiKey: process.env.ASAAS_API_KEY,
          name: 'ASAAS_API_KEY'
        }
      ];

      // Buscar cobranças confirmadas de ambas as contas Asaas
      for (const account of asaasAccounts) {
        if (!account.apiKey) continue;
        
        try {
          console.log(`Buscando clientes da conta: ${account.name}`);
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://www.asaas.com/api/v3';

          // Buscar todas as cobranças confirmadas (últimos 6 meses para performance)
          const seiseMesesAtras = new Date();
          seiseMesesAtras.setMonth(seiseMesesAtras.getMonth() - 6);
          const dataInicio = seiseMesesAtras.toISOString().split('T')[0];
          
          const paymentsResponse = await fetch(`${baseUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${dataInicio}&limit=500`, {
            headers: {
              'access_token': account.apiKey,
              'Content-Type': 'application/json'
            }
          });

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            
            // Agrupar por cliente (evitar duplicatas se o mesmo cliente teve múltiplos pagamentos)
            const clientesUnicos = new Map();
            
            for (const payment of paymentsData.data || []) {
              if (!clientesUnicos.has(payment.customer)) {
                // Buscar dados do cliente
                const customerResponse = await fetch(`${baseUrl}/customers/${payment.customer}`, {
                  headers: {
                    'access_token': account.apiKey,
                    'Content-Type': 'application/json'
                  }
                });

                if (customerResponse.ok) {
                  const customer = await customerResponse.json();
                  
                  // Calcular data de validade: data do pagamento + 30 dias
                  const dataPagamento = new Date(payment.paymentDate || payment.confirmedDate);
                  const dataValidade = new Date(dataPagamento);
                  dataValidade.setDate(dataValidade.getDate() + 30);
                  
                  // Verificar se o cliente já existe no banco local
                  let clienteLocal = null;
                  try {
                    const clientesExistentes = await storage.getAllClientes();
                    clienteLocal = clientesExistentes.find(c => c.asaasCustomerId === payment.customer);
                    
                    if (!clienteLocal) {
                      // Criar cliente no banco local
                      clienteLocal = await storage.createCliente({
                        nome: customer.name,
                        email: customer.email,
                        telefone: customer.phone,
                        cpf: customer.cpfCnpj,
                        asaasCustomerId: payment.customer,
                        planoNome: payment.description || 'Cobrança Asaas',
                        planoValor: payment.value.toString(),
                        formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                                       payment.billingType === 'PIX' ? 'PIX' : 
                                       payment.billingType === 'BOLETO' ? 'Boleto' : payment.billingType,
                        origem: account.name,
                        statusAssinatura: 'ATIVO',
                        dataInicioAssinatura: new Date(payment.paymentDate || payment.confirmedDate),
                        dataVencimentoAssinatura: dataValidade
                      });
                    } else {
                      // Atualizar data de vencimento se necessário
                      if (!clienteLocal.dataVencimentoAssinatura || new Date(clienteLocal.dataVencimentoAssinatura) < dataValidade) {
                        await storage.updateCliente(clienteLocal.id, {
                          dataVencimentoAssinatura: dataValidade,
                          statusAssinatura: 'ATIVO'
                        });
                        clienteLocal.dataVencimentoAssinatura = dataValidade;
                      }
                    }
                  } catch (error) {
                    console.error('Erro ao sincronizar cliente:', error);
                  }
                  
                  // Só adicionar se o cliente foi sincronizado com sucesso no banco local
                  if (clienteLocal) {
                    // Marcar este cliente como sincronizado do Asaas
                    clientesAsaasSincronizados.add(clienteLocal.id);
                    
                    clientesUnicos.set(payment.customer, {
                      id: clienteLocal.id, // Sempre usar ID numérico do banco local
                      nome: customer.name,
                      email: customer.email,
                      telefone: customer.phone,
                      cpf: customer.cpfCnpj,
                      planoNome: payment.description || 'Cobrança Asaas',
                      planoValor: payment.value,
                      formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                                     payment.billingType === 'PIX' ? 'PIX' : 
                                     payment.billingType === 'BOLETO' ? 'Boleto' : payment.billingType,
                      dataInicio: payment.paymentDate || payment.confirmedDate,
                      dataValidade: dataValidade.toISOString(),
                      status: 'ATIVO',
                      origem: 'ASAAS',
                      billingType: payment.billingType,
                      asaasCustomerId: payment.customer
                    });
                  }
                }
              }
            }
            
            // Adicionar clientes únicos do Asaas à lista
            clientesUnificados.push(...Array.from(clientesUnicos.values()));
          }
        } catch (asaasError) {
          console.error("Erro ao buscar dados do Asaas:", asaasError);
        }
      }

      // Adicionar apenas clientes externos que NÃO foram sincronizados do Asaas
      for (const cliente of clientesExternos) {
        // Pular clientes que foram sincronizados do Asaas
        if (clientesAsaasSincronizados.has(cliente.id)) {
          continue;
        }

        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          const status = validade >= hoje ? 'ATIVO' : 'VENCIDO';
          
          if (status === 'ATIVO') {
            clientesUnificados.push({
              id: cliente.id, // ID numérico do banco local
              nome: cliente.nome,
              email: cliente.email,
              telefone: cliente.telefone,
              cpf: cliente.cpf,
              planoNome: cliente.planoNome || 'Não informado',
              planoValor: parseFloat(cliente.planoValor?.toString() || '0'),
              formaPagamento: cliente.formaPagamento || 'Externo',
              dataInicio: cliente.dataInicioAssinatura ? cliente.dataInicioAssinatura.toISOString() : cliente.createdAt.toISOString(),
              dataValidade: cliente.dataVencimentoAssinatura.toISOString(),
              status: status,
              origem: 'EXTERNO'
            });
          }
        }
      }

      res.json(clientesUnificados);
    } catch (error) {
      console.error("Erro ao buscar clientes unificados:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rota para estatísticas unificadas
  app.get("/api/clientes/unified-stats", requireAuth, async (req, res) => {
    try {
      let totalActiveClients = 0;
      let totalMonthlyRevenue = 0;
      let newClientsThisMonth = 0;
      let totalExternalClients = 0;
      let totalAsaasClients = 0;
      
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      // Primeiro, identificar clientes sincronizados do Asaas para evitar duplicação
      let clientesAsaasSincronizados = new Set();
      
      // Contar clientes do banco local (incluindo sincronizados do Asaas)
      const clientesExternos = await storage.getAllClientes();
      for (const cliente of clientesExternos) {
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          if (validade >= hoje) {
            totalActiveClients++;
            totalMonthlyRevenue += parseFloat(cliente.planoValor?.toString() || '0');
            
            // Classificar origem
            if (cliente.asaasCustomerId) {
              totalAsaasClients++;
              clientesAsaasSincronizados.add(cliente.asaasCustomerId);
            } else {
              totalExternalClients++;
            }
            
            const dataInicio = new Date(cliente.dataInicioAssinatura || cliente.createdAt);
            if (dataInicio >= inicioMes) {
              newClientsThisMonth++;
            }
          }
        }
      }

      // Não precisamos mais buscar estatísticas do Asaas separadamente
      // pois todos os clientes já estão sincronizados no banco local

      res.json({
        totalActiveClients,
        totalMonthlyRevenue,
        newClientsThisMonth,
        overdueClients: 0,
        totalExternalClients,
        totalAsaasClients
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas unificadas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rota para clientes por origem (asaas ou externo)
  app.get("/api/clientes/by-origin/:origem", requireAuth, async (req, res) => {
    try {
      const { origem } = req.params;
      const clientesFiltrados = [];
      const hoje = new Date();
      
      // Buscar todos os clientes do banco local
      const clientesExternos = await storage.getAllClientes();
      
      for (const cliente of clientesExternos) {
        // Filtrar por origem
        const isAsaas = cliente.asaasCustomerId ? true : false;
        const isExterno = !cliente.asaasCustomerId;
        
        if ((origem === 'asaas' && !isAsaas) || (origem === 'externo' && !isExterno)) {
          continue;
        }
        
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          const status = validade >= hoje ? 'ATIVO' : 'VENCIDO';
          
          clientesFiltrados.push({
            id: cliente.id,
            nome: cliente.nome,
            email: cliente.email,
            telefone: cliente.telefone,
            cpf: cliente.cpf,
            planoNome: cliente.planoNome || 'Não informado',
            planoValor: parseFloat(cliente.planoValor?.toString() || '0'),
            formaPagamento: cliente.formaPagamento || (isAsaas ? 'Asaas' : 'Externo'),
            dataInicio: cliente.dataInicioAssinatura ? cliente.dataInicioAssinatura.toISOString() : cliente.createdAt.toISOString(),
            dataValidade: cliente.dataVencimentoAssinatura.toISOString(),
            status: status,
            origem: isAsaas ? 'ASAAS' : 'EXTERNO'
          });
        }
      }
      
      res.json(clientesFiltrados);
    } catch (error) {
      console.error("Erro ao buscar clientes por origem:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Endpoint para assinaturas vencendo (3 mais próximas)
  app.get("/api/clientes/expiring", requireAuth, async (req, res) => {
    try {
      const agora = new Date();
      const clientesVencendo: any[] = [];

      // Buscar clientes externos
      const clientesExternos = await storage.getAllClientes();
      for (const cliente of clientesExternos) {
        if (cliente.dataVencimentoAssinatura) {
          const dataValidade = new Date(cliente.dataVencimentoAssinatura);
          const diasRestantes = Math.ceil((dataValidade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diasRestantes <= 7 && diasRestantes >= 0) {
            clientesVencendo.push({
              id: `ext_${cliente.id}`,
              clientName: cliente.nome,
              planName: cliente.planoNome || 'Plano Externo',
              expiryDate: cliente.dataVencimentoAssinatura,
              daysLeft: diasRestantes,
              origem: 'EXTERNO'
            });
          }
        }
      }

      // Buscar assinaturas do Asaas próximas do vencimento
      const asaasApiKey = process.env.ASAAS_API_KEY;
      if (asaasApiKey) {
        try {
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://www.asaas.com/api/v3';

          // Buscar próximas cobranças (due date nos próximos 7 dias)
          const proximasCobranças = await fetch(`${baseUrl}/payments?status=PENDING&limit=100`, {
            headers: {
              'access_token': asaasApiKey,
              'Content-Type': 'application/json'
            }
          });

          if (proximasCobranças.ok) {
            const cobrancasData = await proximasCobranças.json();
            
            for (const payment of cobrancasData.data || []) {
              const dataVencimento = new Date(payment.dueDate);
              const diasRestantes = Math.ceil((dataVencimento.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
              
              if (diasRestantes <= 7 && diasRestantes >= 0) {
                // Buscar dados do cliente
                const customerResponse = await fetch(`${baseUrl}/customers/${payment.customer}`, {
                  headers: {
                    'access_token': asaasApiKey,
                    'Content-Type': 'application/json'
                  }
                });

                if (customerResponse.ok) {
                  const customer = await customerResponse.json();
                  
                  clientesVencendo.push({
                    id: `asaas_${payment.customer}`,
                    clientName: customer.name,
                    planName: payment.description || 'Cobrança Asaas',
                    expiryDate: payment.dueDate,
                    daysLeft: diasRestantes,
                    origem: 'ASAAS'
                  });
                }
              }
            }
          }
        } catch (asaasError) {
          console.error("Erro ao buscar assinaturas vencendo do Asaas:", asaasError);
        }
      }

      // Ordenar por dias restantes e pegar apenas as 3 mais próximas
      const top3Vencendo = clientesVencendo
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 3);

      res.json(top3Vencendo);
    } catch (error) {
      console.error("Erro ao buscar assinaturas vencendo:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Endpoints para agendamentos
  app.get('/api/agendamentos', requireAuth, async (req, res) => {
    try {
      const { date } = req.query;
      
      let agendamentos;
      if (date && typeof date === 'string') {
        agendamentos = await storage.getAgendamentosByDate(date);
      } else {
        agendamentos = await storage.getAllAgendamentos();
      }
      
      res.json(agendamentos);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post('/api/agendamentos', requireAuth, async (req, res) => {
    try {
      let { clienteId, barbeiroId, servicoId, dataHora } = req.body;
      
      // Processar ID do cliente (pode ser "ext_1" para clientes externos)
      let finalClienteId: number;
      
      if (typeof clienteId === 'string' && clienteId.startsWith('ext_')) {
        // Cliente externo - extrair o ID numérico e criar uma referência especial
        const externoId = parseInt(clienteId.replace('ext_', ''));
        
        // Buscar o cliente externo para garantir que existe
        const clienteExterno = await storage.getClienteExternoById(externoId);
        if (!clienteExterno) {
          return res.status(400).json({ message: 'Cliente externo não encontrado' });
        }
        
        // Criar ou buscar cliente na tabela principal para compatibilidade
        let clientePrincipal = await storage.getClienteByEmail(clienteExterno.email);
        if (!clientePrincipal) {
          clientePrincipal = await storage.createCliente({
            nome: clienteExterno.nome,
            email: clienteExterno.email,
            asaasCustomerId: `ext_${externoId}`, // ID especial para clientes externos
            telefone: clienteExterno.telefone,
            cpf: clienteExterno.cpf,
            planoNome: clienteExterno.planoNome,
            planoValor: clienteExterno.planoValor?.toString() || '0',
            formaPagamento: clienteExterno.formaPagamento || 'PIX',
            dataInicioAssinatura: clienteExterno.dataInicioAssinatura,
            dataVencimentoAssinatura: clienteExterno.dataVencimentoAssinatura
          });
        }
        finalClienteId = clientePrincipal.id;
      } else {
        finalClienteId = parseInt(clienteId);
      }
      
      const agendamentoData = {
        clienteId: finalClienteId,
        barbeiroId: parseInt(barbeiroId),
        servicoId: parseInt(servicoId),
        dataHora: new Date(dataHora)
      };
      
      const validatedData = insertAgendamentoSchema.parse(agendamentoData);
      const agendamento = await storage.createAgendamento(validatedData);
      res.json(agendamento);
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: 'Dados inválidos para criação do agendamento' });
      } else {
        res.status(500).json({ message: 'Erro interno do servidor' });
      }
    }
  });

  app.patch('/api/agendamentos/:id/finalizar', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const agendamento = await storage.finalizarAgendamento(Number(id));
      res.json(agendamento);
    } catch (error) {
      console.error('Erro ao finalizar agendamento:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.patch('/api/agendamentos/:id/cancelar', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const agendamento = await storage.cancelarAgendamento(Number(id));
      res.json(agendamento);
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoints para comissão dos barbeiros
  app.get('/api/comissao/barbeiros', requireAuth, async (req, res) => {
    try {
      const { mes } = req.query;
      const mesAtual = mes as string || new Date().toISOString().slice(0, 7);
      
      // Buscar todos os barbeiros ativos
      const barbeiros = await storage.getAllBarbeiros();
      const barbeirosAtivos = barbeiros.filter(b => b.ativo);
      
      // Buscar atendimentos finalizados do mês com dados dos serviços
      const atendimentos = await storage.getAllAtendimentos();
      const atendimentosMes = atendimentos.filter(a => 
        a.dataAtendimento.toISOString().slice(0, 7) === mesAtual
      );
      
      // Buscar todos os serviços para obter tempos
      const servicos = await storage.getAllServicos();
      const servicosMap = new Map(servicos.map(s => [s.id, s]));
      
      // Buscar receita total de assinatura do mês
      const clientesStats = await storage.getClientesUnifiedStats();
      const faturamentoTotal = clientesStats.totalSubscriptionRevenue;
      
      // Calcular total de minutos trabalhados por todos os barbeiros
      const totalMinutosGerais = atendimentosMes.reduce((total, atendimento) => {
        const servico = servicosMap.get(atendimento.servicoId);
        const tempoMinutos = servico?.tempoMinutos || 30;
        return total + (atendimento.quantidade * tempoMinutos);
      }, 0);
      
      // Calcular dados por barbeiro
      const barbeirosComissao = barbeirosAtivos.map(barbeiro => {
        const atendimentosBarbeiro = atendimentosMes.filter(a => a.barbeiroId === barbeiro.id);
        
        const minutosTrabalhadosMes = atendimentosBarbeiro.reduce((total, atendimento) => {
          return total + (atendimento.quantidade * (atendimento.tempoMinutos || 30));
        }, 0);
        
        const numeroServicos = atendimentosBarbeiro.reduce((total, atendimento) => {
          return total + atendimento.quantidade;
        }, 0);
        
        const percentualTempo = totalMinutosGerais > 0 
          ? (minutosTrabalhadosMes / totalMinutosGerais) * 100 
          : 0;
        
        const faturamentoAssinatura = (percentualTempo / 100) * faturamentoTotal;
        const comissaoAssinatura = faturamentoAssinatura * 0.4; // 40% de comissão
        
        const horas = Math.floor(minutosTrabalhadosMes / 60);
        const minutosRestantes = minutosTrabalhadosMes % 60;
        let horasTrabalhadasMes = '';
        if (horas === 0) horasTrabalhadasMes = `${minutosRestantes}min`;
        else if (minutosRestantes === 0) horasTrabalhadasMes = `${horas}h`;
        else horasTrabalhadasMes = `${horas}h ${minutosRestantes}min`;
        
        return {
          barbeiro,
          faturamentoAssinatura: Math.round(faturamentoAssinatura * 100) / 100,
          comissaoAssinatura: Math.round(comissaoAssinatura * 100) / 100,
          minutosTrabalhadosMes,
          horasTrabalhadasMes,
          numeroServicos,
          percentualTempo: Math.round(percentualTempo * 100) / 100
        };
      });
      
      // Ordenar por faturamento de assinatura (maior para menor)
      barbeirosComissao.sort((a, b) => b.faturamentoAssinatura - a.faturamentoAssinatura);
      
      res.json(barbeirosComissao);
    } catch (error) {
      console.error('Erro ao buscar dados de comissão:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.get('/api/comissao/stats', requireAuth, async (req, res) => {
    try {
      const { mes } = req.query;
      const mesAtual = mes as string || new Date().toISOString().slice(0, 7);
      
      // Extrair mês e ano do parâmetro mes (formato YYYY-MM)
      const [ano, mesNum] = mesAtual.split('-');
      
      // Buscar receita total de assinatura APENAS do mês vigente
      const clientesStats = await storage.getClientesUnifiedStats(mesNum, ano);
      const faturamentoTotalAssinatura = clientesStats.totalSubscriptionRevenue;
      
      // Buscar atendimentos finalizados do mês
      const atendimentos = await storage.getAllAtendimentos();
      const atendimentosMes = atendimentos.filter(a => 
        a.dataAtendimento.toISOString().slice(0, 7) === mesAtual
      );
      
      // Calcular total de minutos trabalhados
      const totalMinutosGerais = atendimentosMes.reduce((total, atendimento) => {
        return total + (atendimento.quantidade * (atendimento.tempoMinutos || 30));
      }, 0);
      
      // Calcular total de comissão (40% da receita total)
      const totalComissao = faturamentoTotalAssinatura * 0.4;
      
      res.json({
        faturamentoTotalAssinatura: Math.round(faturamentoTotalAssinatura * 100) / 100,
        totalMinutosGerais,
        totalComissao: Math.round(totalComissao * 100) / 100
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas de comissão:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoint para analytics
  app.get('/api/analytics', requireAuth, async (req, res) => {
    try {
      const { mes, barbeiro } = req.query;
      const mesAtual = mes as string || new Date().toISOString().slice(0, 7);
      const barbeiroId = barbeiro === 'all' ? null : parseInt(barbeiro as string);
      
      // Buscar atendimentos do mês
      const atendimentos = await storage.getAllAtendimentos();
      let atendimentosMes = atendimentos.filter(a => 
        a.dataAtendimento.toISOString().slice(0, 7) === mesAtual
      );
      
      // Filtrar por barbeiro se especificado
      if (barbeiroId) {
        atendimentosMes = atendimentosMes.filter(a => a.barbeiroId === barbeiroId);
      }
      
      // Buscar dados complementares
      const servicos = await storage.getAllServicos();
      const barbeiros = await storage.getAllBarbeiros();
      const servicosMap = new Map(servicos.map(s => [s.id, s]));
      const barbeirosMap = new Map(barbeiros.map(b => [b.id, b]));
      
      // 1. Atendimentos por dia
      const atendimentosPorDia = [];
      const diasNoMes = new Date(mesAtual.split('-')[0] as any, mesAtual.split('-')[1] as any, 0).getDate();
      
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${mesAtual}-${dia.toString().padStart(2, '0')}`;
        const atendimentosDia = atendimentosMes.filter(a => 
          a.dataAtendimento.toISOString().slice(0, 10) === dataStr
        );
        const quantidade = atendimentosDia.reduce((total, a) => total + a.quantidade, 0);
        
        atendimentosPorDia.push({
          dia: dia.toString(),
          quantidade
        });
      }
      
      // 2. Top 5 serviços mais feitos
      const servicosCount = new Map();
      atendimentosMes.forEach(a => {
        const servico = servicosMap.get(a.servicoId);
        if (servico) {
          const current = servicosCount.get(servico.nome) || 0;
          servicosCount.set(servico.nome, current + a.quantidade);
        }
      });
      
      const servicosMaisFeitos = Array.from(servicosCount.entries())
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);
      
      // 3. Receita por dia (baseada em assinaturas ativas)
      const clientesStats = await storage.getClientesUnifiedStats();
      const receitaDiaria = clientesStats.totalSubscriptionRevenue / diasNoMes;
      
      const receitaPorDia = [];
      for (let dia = 1; dia <= diasNoMes; dia++) {
        receitaPorDia.push({
          dia: dia.toString(),
          valor: receitaDiaria
        });
      }
      
      // 4. Horas trabalhadas por barbeiro
      const horasPorBarbeiro = [];
      const barbeirosAtivos = barbeiros.filter(b => b.ativo);
      
      barbeirosAtivos.forEach(barbeiro => {
        if (barbeiroId && barbeiro.id !== barbeiroId) return;
        
        const atendimentosBarbeiro = atendimentosMes.filter(a => a.barbeiroId === barbeiro.id);
        const minutosTotal = atendimentosBarbeiro.reduce((total, a) => {
          const servico = servicosMap.get(a.servicoId);
          const tempoMinutos = servico?.tempoMinutos || 30;
          return total + (a.quantidade * tempoMinutos);
        }, 0);
        
        const horas = Math.round((minutosTotal / 60) * 10) / 10;
        const atendimentosTotal = atendimentosBarbeiro.reduce((total, a) => total + a.quantidade, 0);
        
        // Calcular faturamento e comissão proporcionais
        const totalMinutosGerais = atendimentosMes.reduce((total, a) => {
          const servico = servicosMap.get(a.servicoId);
          return total + (a.quantidade * (servico?.tempoMinutos || 30));
        }, 0);
        
        const percentualTempo = totalMinutosGerais > 0 ? (minutosTotal / totalMinutosGerais) : 0;
        const faturamento = percentualTempo * clientesStats.totalSubscriptionRevenue;
        const comissao = faturamento * 0.4;
        
        horasPorBarbeiro.push({
          barbeiro: barbeiro.nome,
          horas,
          atendimentos: atendimentosTotal,
          faturamento: Math.round(faturamento * 100) / 100,
          comissao: Math.round(comissao * 100) / 100
        });
      });
      
      // Ordenar por horas trabalhadas
      horasPorBarbeiro.sort((a, b) => b.horas - a.horas);
      
      // 5. Comissão mensal histórica (últimos 12 meses)
      const comissaoMensal = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const mesStr = date.toISOString().slice(0, 7);
        
        // Para simplicidade, usar 40% da receita mensal média
        const comissaoEstimada = clientesStats.totalSubscriptionRevenue * 0.4;
        
        comissaoMensal.push({
          mes: format(date, "MMM/yyyy", { locale: { ...ptBR } }),
          valor: Math.round(comissaoEstimada * 100) / 100
        });
      }
      
      res.json({
        atendimentosPorDia,
        servicosMaisFeitos,
        receitaPorDia,
        horasPorBarbeiro,
        comissaoMensal
      });
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoint para clientes com assinaturas vencidas
  app.get('/api/clientes/expired', requireAuth, async (req, res) => {
    try {
      const clientes = await storage.getAllClientes();
      const hoje = new Date();
      
      // Filtrar clientes com assinaturas vencidas
      const clientesVencidos = clientes
        .filter(cliente => {
          if (!cliente.dataVencimentoAssinatura) return false;
          const vencimento = new Date(cliente.dataVencimentoAssinatura);
          return vencimento < hoje;
        })
        .map(cliente => ({
          ...cliente,
          diasRestantes: Math.floor((new Date(cliente.dataVencimentoAssinatura).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        }))
        .sort((a, b) => new Date(a.dataVencimentoAssinatura).getTime() - new Date(b.dataVencimentoAssinatura).getTime());
      
      res.json(clientesVencidos);
    } catch (error) {
      console.error('Erro ao buscar assinaturas vencidas:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoint para cadastrar cliente com pagamento externo
  app.post('/api/clientes/external', async (req, res) => {
    try {
      const { nome, email, cpf, telefone, planoNome, formaPagamento, valorMensal } = req.body;

      if (!nome || !email || !formaPagamento || !planoNome || !valorMensal) {
        return res.status(400).json({ message: 'Dados obrigatórios não fornecidos' });
      }

      // Validação crítica: valor do plano nunca pode ser zero ou negativo
      const valorNumerico = parseFloat(valorMensal);
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({ 
          message: `Valor do plano inválido: ${valorMensal}. Deve ser um número maior que zero.` 
        });
      }

      // Data de início: agora
      const dataInicio = new Date();
      // Data de vencimento: 30 dias corridos
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const cliente = await storage.createClienteExterno({
        nome,
        email,
        cpf: cpf || null,
        telefone: telefone || null,
        planoNome,
        planoValor: valorNumerico.toFixed(2), // Garantir formato correto
        formaPagamento,
        origem: origem || 'checkout_externo',
        statusAssinatura: 'ATIVO',
        dataInicioAssinatura: dataInicio,
        dataVencimentoAssinatura: dataVencimento,
      });

      console.log(`Cliente externo criado: ${nome}, valor: R$ ${valorNumerico.toFixed(2)}, plano: ${planoNome}, pagamento: ${formaPagamento}`);

      res.json({
        success: true,
        cliente,
        message: `Cliente cadastrado com sucesso. Assinatura ativa até ${dataVencimento.toLocaleDateString('pt-BR')}`
      });

    } catch (error) {
      console.error('Erro ao cadastrar cliente externo:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor',
        error: error.message 
      });
    }
  });

  // Rota para finalizar pagamento externo
  app.post('/api/clientes-externos/finalizar-pagamento', async (req, res) => {
    try {
      const { nome, email, telefone, planoNome, planoValor, formaPagamento, origem } = req.body;

      if (!nome || !email || !telefone || !planoNome || !planoValor || !formaPagamento) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
      }

      const valorNumerico = parseFloat(planoValor);
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({ message: 'Valor do plano deve ser um número válido maior que zero' });
      }

      // Data de início: agora
      const dataInicio = new Date();
      // Data de vencimento: 30 dias corridos
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const cliente = await storage.createClienteExterno({
        nome,
        email,
        telefone,
        planoNome,
        planoValor: valorNumerico.toFixed(2),
        formaPagamento,
        origem: origem || 'checkout_externo',
        statusAssinatura: 'ATIVO',
        dataInicioAssinatura: dataInicio,
        dataVencimentoAssinatura: dataVencimento,
      });

      console.log(`Pagamento externo finalizado: ${nome}, método: ${formaPagamento}, valor: R$ ${valorNumerico.toFixed(2)}`);

      res.json({
        success: true,
        cliente,
        message: `Cliente cadastrado com pagamento ${formaPagamento}. Assinatura ativa até ${dataVencimento.toLocaleDateString('pt-BR')}`
      });

    } catch (error) {
      console.error('Erro ao finalizar pagamento externo:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor',
        error: error.message 
      });
    }
  });

  // Rota para criar checkout link do Asaas
  app.post('/api/asaas/checkout-link', async (req, res) => {
    try {
      const { customer, billingType, value, dueDate, description, externalReference } = req.body;
      
      if (!customer || !billingType || !value || !dueDate) {
        return res.status(400).json({ 
          error: 'Campos obrigatórios: customer, billingType, value, dueDate' 
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      
      if (!asaasApiKey) {
        return res.status(500).json({ 
          error: 'Chave da API Asaas não configurada' 
        });
      }

      // Criar cobrança com checkout
      const paymentData = {
        customer,
        billingType,
        value: parseFloat(value),
        dueDate,
        description: description || 'Pagamento Trato de Barbados',
        externalReference: externalReference || `payment_${Date.now()}`
      };

      console.log('🔄 Criando cobrança com checkout:', paymentData);

      const response = await fetch('https://www.asaas.com/api/v3/payments', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        const responseText = await response.text();
        console.error('❌ Erro ao fazer parse da resposta do Asaas:', responseText);
        return res.status(500).json({
          error: 'Erro na resposta da API do Asaas',
          details: `Status: ${response.status}, Response: ${responseText.substring(0, 200)}...`
        });
      }

      if (!response.ok) {
        console.error('❌ Erro ao criar cobrança:', responseData);
        return res.status(response.status).json({
          error: 'Erro ao criar cobrança no Asaas',
          details: responseData
        });
      }

      // Gerar link de checkout
      const checkoutResponse = await fetch(`https://www.asaas.com/api/v3/payments/${responseData.id}/paymentBook`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      let checkoutData;
      try {
        checkoutData = await checkoutResponse.json();
      } catch (parseError) {
        const checkoutText = await checkoutResponse.text();
        console.error('❌ Erro ao fazer parse da resposta do checkout:', checkoutText);
        return res.status(500).json({
          error: 'Erro na resposta do checkout do Asaas',
          details: `Status: ${checkoutResponse.status}, Response: ${checkoutText.substring(0, 200)}...`
        });
      }

      if (!checkoutResponse.ok) {
        console.error('❌ Erro ao criar checkout:', checkoutData);
        return res.status(checkoutResponse.status).json({
          error: 'Erro ao criar checkout no Asaas',
          details: checkoutData
        });
      }

      console.log('✅ Checkout criado com sucesso:', checkoutData);

      res.json({
        success: true,
        payment: responseData,
        checkoutUrl: checkoutData.url,
        message: 'Checkout criado com sucesso!'
      });

    } catch (error) {
      console.error('❌ Erro interno ao criar checkout:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  });

  // Endpoint para criar link de pagamento personalizado do Asaas
  app.post('/api/asaas/checkout', async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnvironment = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Configuração da API Asaas não encontrada' });
      }

      const baseUrl = asaasEnvironment === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      const { nome, email, cpf, billingType, valorPlano, planoSelecionado } = req.body;

      // 1. Criar ou buscar cliente
      let customerId;
      
      // Primeiro, tentar buscar cliente existente por email
      const searchUrl = `${baseUrl}/customers?email=${encodeURIComponent(email)}`;
      const searchCustomerResponse = await fetch(searchUrl, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (searchCustomerResponse.ok) {
        const searchData = await searchCustomerResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          customerId = searchData.data[0].id;
        }
      }

      // Validar CPF obrigatório
      if (!cpf || !cpf.trim()) {
        throw new Error('CPF é obrigatório para criar cobrança');
      }

      // Se não encontrou, criar novo cliente
      if (!customerId) {
        const customerPayload: any = {
          name: nome,
          email: email,
          cpfCnpj: cpf.replace(/\D/g, '') // Remove formatação
        };

        const customerResponse = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerPayload)
        });

        if (!customerResponse.ok) {
          const errorData = await customerResponse.json();
          throw new Error(`Erro ao criar cliente: ${JSON.stringify(errorData)}`);
        }

        const customerData = await customerResponse.json();
        customerId = customerData.id;
      }

      // 2. Criar cobrança com tipo específico
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Validar valor do plano
      if (!valorPlano || valorPlano <= 0) {
        throw new Error('Valor do plano é obrigatório e deve ser maior que zero');
      }

      // Gerar descrição baseada no plano selecionado
      const descricaoPlano = planoSelecionado || 'Clube do Trato';
      
      let chargePayload: any = {
        customer: customerId,
        billingType: billingType || 'CREDIT_CARD',
        value: parseFloat(valorPlano),
        dueDate: tomorrow.toISOString().split('T')[0],
        description: descricaoPlano,
        externalReference: `${descricaoPlano.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`
      };

      // Configurações específicas por tipo de pagamento
      if (billingType === 'PIX') {
        // PIX requer chave cadastrada no painel do Asaas
        chargePayload.pixDescription = 'Clube do Trato Único - Teste de Funcionalidade';
      } else if (billingType === 'BOLETO') {
        // Boleto com vencimento para o dia seguinte
        chargePayload.discount = {
          value: 0,
          dueDateLimitDays: 0
        };
        chargePayload.fine = {
          value: 1.0
        };
        chargePayload.interest = {
          value: 1.0
        };
      }

      const chargeResponse = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chargePayload)
      });

      if (!chargeResponse.ok) {
        const errorData = await chargeResponse.json();
        throw new Error(`Erro ao criar cobrança: ${JSON.stringify(errorData)}`);
      }

      const chargeData = await chargeResponse.json();

      // Retornar dados da cobrança criada
      res.json({
        id: chargeData.id,
        checkoutUrl: chargeData.invoiceUrl,
        pixQrCode: chargeData.pixTransaction?.qrCode?.payload,
        pixQrCodeImage: chargeData.pixTransaction?.qrCode?.encodedImage,
        status: chargeData.status,
        value: chargeData.value,
        dueDate: chargeData.dueDate,
        customer: {
          id: customerId,
          name: nome,
          email: email
        }
      });

    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor',
        error: error.message 
      });
    }
  });

  // Endpoint para buscar planos autorizados via API Asaas
  app.get('/api/asaas/planos', async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnvironment = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Configuração da API Asaas não encontrada' });
      }

      const baseUrl = asaasEnvironment === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Lista de planos autorizados
      const planosAutorizados = [
        'Clube do Trato One - Corte Barba',
        'Clube do Trato One - Corte',
        'Clube do Trato Gold - Corte + Barba',
        'Clube do Trato Gold - Corte',
        'Clube do Trato Gold - Barba',
        'Clube do Trato - Corte e Barba 2x',
        'Clube do Trato - Corte 2x Barba 4x',
        'Clube do Trato - Corte 2x',
        'Clube do Trato - Barba 4x'
      ];

      // Buscar links de pagamento do Asaas
      const response = await fetch(`${baseUrl}/paymentLinks?limit=100`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Asaas: ${response.status}`);
      }

      const data = await response.json();
      const links = data.data || [];

      // Filtrar apenas os planos autorizados
      const planosDisponiveis = links
        .filter((link: any) => planosAutorizados.includes(link.name))
        .map((link: any) => ({
          id: link.id,
          nome: link.name,
          valor: parseFloat(link.value),
          descricao: link.description || '',
          urlCheckout: link.url,
          ativo: link.active,
          criadoEm: link.dateCreated
        }));

      res.json(planosDisponiveis);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoint para buscar clientes da segunda conta Asaas (Andrey)
  app.get("/api/clientes-asaas-andrey", requireAuth, async (req, res) => {
    try {
      console.log('🔍 Buscando clientes da conta Asaas Andrey');
      
      const token = process.env.ASAAS_API_KEY_ANDREY;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token da segunda API não encontrado' });
      }
      
      // Buscar clientes
      const clientesResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
        headers: {
          'access_token': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!clientesResponse.ok) {
        const errorText = await clientesResponse.text();
        console.log('❌ Erro na segunda API:', errorText);
        return res.status(clientesResponse.status).json({ success: false, error: `Erro da API: ${errorText}` });
      }

      const clientesData = await clientesResponse.json();
      console.log(`📋 Encontrados ${clientesData.totalCount} clientes da conta Andrey`);

      // Buscar assinaturas ativas
      const assinaturasResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?limit=100&status=ACTIVE', {
        headers: {
          'access_token': token,
          'Content-Type': 'application/json'
        }
      });

      const assinaturasData = assinaturasResponse.ok ? await assinaturasResponse.json() : { data: [] };
      
      // Criar mapa de assinaturas por cliente
      const assinaturasPorCliente = new Map();
      assinaturasData.data?.forEach((assinatura: any) => {
        assinaturasPorCliente.set(assinatura.customer, {
          planoNome: assinatura.description || 'Plano não informado',
          planoValor: assinatura.value || 0,
          formaPagamento: assinatura.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                           assinatura.billingType === 'BOLETO' ? 'Boleto' : 
                           assinatura.billingType === 'PIX' ? 'PIX' : 'Dinheiro',
          statusAssinatura: 'ATIVO',
          dataProximaFatura: assinatura.nextDueDate,
          cycle: assinatura.cycle
        });
      });
      
      const clientesFormatados = clientesData.data?.map((customer: any) => {
        const assinatura = assinaturasPorCliente.get(customer.id);
        
        return {
          id: customer.id,
          nome: customer.name,
          email: customer.email,
          telefone: customer.phone || customer.mobilePhone,
          cpf: customer.cpfCnpj,
          endereco: customer.address,
          cidade: customer.cityName,
          estado: customer.state,
          dataCadastro: customer.dateCreated,
          origem: 'ASAAS_ANDREY',
          // Informações de assinatura
          planoNome: assinatura?.planoNome || null,
          planoValor: assinatura?.planoValor || null,
          formaPagamento: assinatura?.formaPagamento || null,
          statusAssinatura: assinatura?.statusAssinatura || 'SEM_ASSINATURA',
          dataProximaFatura: assinatura?.dataProximaFatura || null,
          cycle: assinatura?.cycle || null
        };
      }).filter((cliente: any) => cliente.statusAssinatura === 'ATIVO') || [];
      
      return res.json({
        success: true,
        total: clientesData.totalCount,
        clientes: clientesFormatados
      });

    } catch (error) {
      console.error('❌ Erro ao buscar clientes Asaas Andrey:', error);
      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Endpoint para cadastrar cliente da segunda conta no banco local
  // Endpoint para sincronizar clientes da segunda conta com o banco local
  app.post("/api/clientes-asaas-andrey/sync", requireAuth, async (req, res) => {
    try {
      const tokenAndrey = process.env.ASAAS_API_KEY_ANDREY;
      if (!tokenAndrey) {
        return res.status(400).json({ message: 'Token da segunda conta Asaas não configurado' });
      }

      console.log('🔄 Iniciando sincronização de clientes da segunda conta Asaas');

      // Buscar clientes da API Asaas Andrey
      const clientesResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
        headers: {
          'access_token': tokenAndrey,
          'Content-Type': 'application/json'
        }
      });

      if (!clientesResponse.ok) {
        throw new Error('Erro ao buscar clientes da segunda conta Asaas');
      }

      const clientesData = await clientesResponse.json();

      // Buscar assinaturas ativas
      const assinaturasResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?limit=100&status=ACTIVE', {
        headers: {
          'access_token': tokenAndrey,
          'Content-Type': 'application/json'
        }
      });

      let assinaturasPorCliente = new Map();
      if (assinaturasResponse.ok) {
        const assinaturasData = await assinaturasResponse.json();
        assinaturasData.data?.forEach((assinatura: any) => {
          // Calcular data de vencimento (30 dias a partir da próxima cobrança)
          const dataVencimento = new Date(assinatura.nextDueDate);
          dataVencimento.setDate(dataVencimento.getDate() + 30);
          
          assinaturasPorCliente.set(assinatura.customer, {
            planoNome: assinatura.description || 'Assinatura Asaas',
            planoValor: assinatura.value.toString(),
            formaPagamento: assinatura.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                          assinatura.billingType === 'PIX' ? 'PIX' :
                          assinatura.billingType === 'BOLETO' ? 'Boleto' : assinatura.billingType,
            statusAssinatura: 'ATIVO',
            dataInicioAssinatura: new Date(assinatura.dateCreated),
            dataVencimentoAssinatura: dataVencimento
          });
        });
      }

      let clientesSincronizados = 0;
      let clientesIgnorados = 0;

      // Verificar clientes externos existentes para evitar duplicação
      const clientesExistentes = await storage.getAllClientesExternos();
      const emailsExistentes = new Set(clientesExistentes.map(c => c.email.toLowerCase()));

      for (const customer of clientesData.data || []) {
        // Pular se cliente já existe no banco
        if (emailsExistentes.has(customer.email.toLowerCase())) {
          clientesIgnorados++;
          continue;
        }

        const assinatura = assinaturasPorCliente.get(customer.id);
        
        // Só cadastrar clientes com assinatura ativa
        if (assinatura) {
          try {
            await storage.createClienteExterno({
              nome: customer.name,
              email: customer.email,
              telefone: customer.phone || customer.mobilePhone,
              cpf: customer.cpfCnpj,
              planoNome: assinatura.planoNome,
              planoValor: assinatura.planoValor,
              formaPagamento: assinatura.formaPagamento,
              statusAssinatura: assinatura.statusAssinatura,
              dataInicioAssinatura: assinatura.dataInicioAssinatura,
              dataVencimentoAssinatura: assinatura.dataVencimentoAssinatura
            });
            clientesSincronizados++;
          } catch (error) {
            console.warn(`Erro ao sincronizar cliente ${customer.name}:`, error);
          }
        }
      }

      console.log(`✅ Sincronização concluída: ${clientesSincronizados} novos clientes, ${clientesIgnorados} ignorados`);

      res.json({
        success: true,
        message: `Sincronização concluída com sucesso`,
        clientesSincronizados,
        clientesIgnorados
      });

    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  app.post("/api/clientes-asaas-andrey/cadastrar", requireAuth, async (req, res) => {
    try {
      const { clienteId, planoId, formaPagamento } = req.body;
      
      if (!clienteId || !planoId) {
        return res.status(400).json({ error: 'Cliente ID e Plano ID são obrigatórios' });
      }

      // Buscar dados do cliente na API Andrey
      const token = process.env.ASAAS_API_KEY_ANDREY;
      const customerResponse = await fetch(`https://www.asaas.com/api/v3/customers/${clienteId}`, {
        headers: {
          'access_token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!customerResponse.ok) {
        return res.status(400).json({ error: 'Cliente não encontrado na API Andrey' });
      }

      const customer = await customerResponse.json();
      
      // Buscar dados do plano
      const plano = await storage.getPlano(planoId);
      if (!plano) {
        return res.status(400).json({ error: 'Plano não encontrado' });
      }

      // Criar cliente externo no banco local
      const novoCliente = {
        nome: customer.name,
        email: customer.email,
        telefone: customer.phone || customer.mobilePhone,
        cpf: customer.cpfCnpj,
        planoNome: plano.nome,
        planoValor: parseFloat(plano.valorMensal),
        formaPagamento: formaPagamento || 'PIX',
        dataInicioAssinatura: new Date(),
        dataVencimentoAssinatura: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        observacoes: `Importado da conta Asaas Andrey - ID original: ${clienteId}`
      };

      const clienteCriado = await storage.createClienteExterno(novoCliente);
      
      console.log(`✅ Cliente ${customer.name} cadastrado no banco local`);
      
      res.json({
        success: true,
        cliente: clienteCriado,
        message: 'Cliente cadastrado com sucesso no sistema local'
      });
    } catch (error) {
      console.error('❌ Erro ao cadastrar cliente:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Endpoint de teste isolado para verificar segunda integração
  app.get("/api/teste-isolado-segunda-api", requireAuth, async (req, res) => {
    try {
      console.log('🧪 TESTE: Testando segunda API isoladamente');
      
      const token = process.env.ASAAS_API_KEY_ANDREY;
      console.log('🔑 Token da segunda API:', token ? token.substring(0, 20) + '...' : 'VAZIO');
      
      if (!token) {
        return res.json({ success: false, error: 'Token não encontrado' });
      }
      
      const response = await fetch('https://www.asaas.com/api/v3/customers', {
        headers: {
          'access_token': token,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📱 Status da resposta:', response.status);
      console.log('📱 Response OK:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📱 Dados recebidos:', data);
        console.log('📱 Quantidade de clientes:', data.data?.length || 0);
        
        return res.json({
          success: true,
          status: response.status,
          totalCustomers: data.totalCount,
          customers: data.data?.slice(0, 3) // Apenas os primeiros 3 para teste
        });
      } else {
        const errorText = await response.text();
        console.log('❌ Erro na resposta:', errorText);
        return res.json({ success: false, error: `Status ${response.status}: ${errorText}` });
      }
    } catch (error) {
      console.error('❌ Erro na segunda API:', error);
      return res.json({ success: false, error: error.message });
    }
  });

  // Endpoint de teste para verificar segunda integração
  app.get("/api/test-segunda-integracao", requireAuth, async (req, res) => {
    try {
      console.log('=== TESTE SEGUNDA INTEGRAÇÃO ===');
      console.log('ASAAS_API_KEY existe:', !!process.env.ASAAS_API_KEY);
      console.log('ASAAS_API_KEY_ANDREY existe:', !!process.env.ASAAS_API_KEY_ANDREY);
      
      if (process.env.ASAAS_API_KEY_ANDREY) {
        const baseUrl = 'https://www.asaas.com/api/v3';
        const response = await fetch(`${baseUrl}/subscriptions?status=ACTIVE&limit=5`, {
          headers: {
            'access_token': process.env.ASAAS_API_KEY_ANDREY,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Assinaturas da conta Andrey:', data.totalCount);
          res.json({
            success: true,
            totalSubscriptions: data.totalCount,
            subscriptions: data.data?.slice(0, 3)
          });
        } else {
          console.log('Erro na API Andrey:', response.status);
          res.json({ success: false, error: 'Erro na API' });
        }
      } else {
        res.json({ success: false, error: 'Chave API não encontrada' });
      }
    } catch (error) {
      console.error('Erro:', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Nova rota para clientes de ambas as contas Asaas  
  app.get("/api/clientes-unified", requireAuth, async (req, res) => {
    console.log('=== INICIANDO BUSCA CLIENTES UNIFICADOS ===');
    console.log('Timestamp:', new Date().toISOString());
    try {
      const clientesUnificados = [];
      const hoje = new Date();

      // Buscar clientes externos do banco local
      const clientesExternos = await storage.getAllClientesExternos();
      
      // Criar conjunto de emails dos clientes externos para evitar duplicação
      const emailsClientesExternos = new Set(
        clientesExternos.map(cliente => cliente.email.toLowerCase())
      );
      
      // Adicionar clientes externos válidos
      for (const cliente of clientesExternos) {
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          const daysRemaining = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          const status = daysRemaining > 0 ? 'ATIVO' : 'VENCIDO';
          
          clientesUnificados.push({
            id: cliente.id,
            nome: cliente.nome,
            email: cliente.email,
            telefone: cliente.telefone,
            cpf: cliente.cpf,
            planoNome: cliente.planoNome,
            planoValor: cliente.planoValor?.toString(),
            formaPagamento: cliente.formaPagamento,
            statusAssinatura: status,
            dataInicioAssinatura: cliente.dataInicioAssinatura,
            dataVencimentoAssinatura: cliente.dataVencimentoAssinatura,
            origem: 'EXTERNO',
            createdAt: cliente.createdAt
          });
        }
      }

      // Configurar contas Asaas
      const asaasAccounts = [
        {
          apiKey: process.env.ASAAS_API_KEY,
          name: 'PRINCIPAL'
        },
        {
          apiKey: process.env.ASAAS_API_KEY_ANDREY,
          name: 'ANDREY'
        }
      ];

      console.log('=== INÍCIO BUSCA CLIENTES UNIFICADOS ===');
      console.log('ASAAS_API_KEY existe:', !!process.env.ASAAS_API_KEY);
      console.log('ASAAS_API_KEY_ANDREY existe:', !!process.env.ASAAS_API_KEY_ANDREY);
      console.log('Clientes externos encontrados:', clientesExternos.length);

      // Buscar clientes de ambas as contas Asaas
      for (const account of asaasAccounts) {
        if (!account.apiKey) {
          console.log(`Chave API não encontrada para conta: ${account.name}`);
          continue;
        }

        try {
          console.log(`🔍 INICIANDO busca da conta Asaas: ${account.name}`);
          console.log(`🔑 Token da API ${account.name}:`, account.apiKey ? account.apiKey.substring(0, 20) + '...' : 'VAZIO');
          const baseUrl = 'https://www.asaas.com/api/v3';
          
          // Para a conta ANDREY, buscar todos os clientes diretamente
          if (account.name === 'ANDREY') {
            console.log(`📋 Buscando TODOS os clientes da conta ${account.name}`);
            const customersResponse = await fetch(`${baseUrl}/customers?limit=100`, {
              headers: {
                'access_token': account.apiKey,
                'Content-Type': 'application/json'
              }
            });

            if (customersResponse.ok) {
              const customersData = await customersResponse.json();
              console.log(`${account.name}: Total de clientes encontrados:`, customersData.totalCount);
              console.log(`${account.name}: Clientes retornados:`, customersData.data?.length || 0);

              for (const customer of customersData.data || []) {
                clientesUnificados.push({
                  id: `asaas_${account.name}_${customer.id}`,
                  nome: customer.name,
                  email: customer.email,
                  telefone: customer.phone || customer.mobilePhone,
                  cpf: customer.cpfCnpj,
                  planoNome: 'Cliente Asaas - Sem Assinatura Ativa',
                  planoValor: '0.00',
                  formaPagamento: 'N/A',
                  statusAssinatura: 'CLIENTE_CADASTRADO',
                  dataInicioAssinatura: new Date(customer.dateCreated),
                  dataVencimentoAssinatura: null,
                  origem: `ASAAS_${account.name}`,
                  createdAt: new Date(customer.dateCreated)
                });
              }
            }
          } else {
            // Para conta principal, buscar assinaturas ativas primeiro
            const subscriptionsResponse = await fetch(`${baseUrl}/subscriptions?status=ACTIVE&limit=100`, {
              headers: {
                'access_token': account.apiKey,
                'Content-Type': 'application/json'
              }
            });

            let clientesProcessados = new Set();

            console.log(`📱 Status da resposta ${account.name}:`, subscriptionsResponse.status);
            console.log(`📱 Response OK ${account.name}:`, subscriptionsResponse.ok);
            
              if (subscriptionsResponse.ok) {
                const subscriptionsData = await subscriptionsResponse.json();
                console.log(`📊 Resposta da API ${account.name}:`, JSON.stringify(subscriptionsData, null, 2));
                console.log(`${account.name}: Total de assinaturas encontradas:`, subscriptionsData.totalCount);
                console.log(`${account.name}: Assinaturas retornadas:`, subscriptionsData.data?.length || 0);

                for (const subscription of subscriptionsData.data || []) {
                  if (!clientesProcessados.has(subscription.customer)) {
                    try {
                      const customerResponse = await fetch(`${baseUrl}/customers/${subscription.customer}`, {
                        headers: {
                          'access_token': account.apiKey,
                          'Content-Type': 'application/json'
                        }
                      });

                      if (customerResponse.ok) {
                        const customer = await customerResponse.json();
                        
                        // Verificar se o cliente já existe como externo (evitar duplicação)
                        if (emailsClientesExternos.has(customer.email.toLowerCase())) {
                          console.log(`Cliente ${customer.name} já existe como externo, pulando da lista Asaas`);
                          clientesProcessados.add(subscription.customer);
                          continue;
                        }
                        
                        // Calcular próxima data de vencimento
                        const proximaCobranca = new Date(subscription.nextDueDate);
                        const daysRemaining = Math.ceil((proximaCobranca.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                        const status = daysRemaining > 0 ? 'ATIVO' : 'VENCIDO';

                        clientesUnificados.push({
                          id: `asaas_${account.name}_${subscription.customer}`,
                          nome: customer.name,
                          email: customer.email,
                          telefone: customer.phone || customer.mobilePhone,
                          cpf: customer.cpfCnpj,
                          planoNome: subscription.description || 'Assinatura Asaas',
                          planoValor: subscription.value,
                          formaPagamento: subscription.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                                         subscription.billingType === 'PIX' ? 'PIX' :
                                         subscription.billingType === 'BOLETO' ? 'Boleto' : subscription.billingType,
                          statusAssinatura: status,
                          dataInicioAssinatura: new Date(subscription.dateCreated),
                          dataVencimentoAssinatura: proximaCobranca,
                          origem: `ASAAS_${account.name}`,
                          createdAt: new Date(subscription.dateCreated)
                        });

                        clientesProcessados.add(subscription.customer);
                      }
                    } catch (customerError) {
                      console.warn(`Erro ao buscar cliente ${subscription.customer} da conta ${account.name}:`, customerError);
                    }
                  }
                }
              }

              // Buscar também pagamentos confirmados do mês atual (caso não tenham assinatura)
              const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
              const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
              
              const paymentsResponse = await fetch(
                `${baseUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${inicioMes}&receivedInCashDate[le]=${fimMes}&limit=100`,
                {
                  headers: {
                    'access_token': account.apiKey,
                    'Content-Type': 'application/json'
                  }
                }
              );

              if (paymentsResponse.ok) {
                const paymentsData = await paymentsResponse.json();
                // Reutilizar o Set já existente para evitar duplicatas

                for (const payment of paymentsData.data || []) {
                  if (!clientesProcessados.has(payment.customer)) {
                    try {
                      const customerResponse = await fetch(`${baseUrl}/customers/${payment.customer}`, {
                        headers: {
                          'access_token': account.apiKey,
                          'Content-Type': 'application/json'
                        }
                      });

                      if (customerResponse.ok) {
                        const customer = await customerResponse.json();
                        
                        // Calcular data de validade: data do pagamento + 30 dias
                        const dataPagamento = new Date(payment.paymentDate || payment.confirmedDate);
                        const dataValidade = new Date(dataPagamento);
                        dataValidade.setDate(dataValidade.getDate() + 30);
                        
                        const daysRemaining = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                        const status = daysRemaining > 0 ? 'ATIVO' : 'VENCIDO';

                        clientesUnificados.push({
                          id: `asaas_${account.name}_${payment.customer}`,
                          nome: customer.name,
                          email: customer.email,
                          telefone: customer.phone || customer.mobilePhone,
                          cpf: customer.cpfCnpj,
                          planoNome: payment.description || 'Cobrança Asaas',
                          planoValor: payment.value,
                          formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                                         payment.billingType === 'PIX' ? 'PIX' :
                                         payment.billingType === 'BOLETO' ? 'Boleto' : payment.billingType,
                          statusAssinatura: status,
                          dataInicioAssinatura: new Date(payment.paymentDate || payment.confirmedDate),
                          dataVencimentoAssinatura: dataValidade,
                          origem: `ASAAS_${account.name}`,
                          createdAt: new Date(payment.dateCreated)
                        });

                        clientesProcessados.add(payment.customer);
                      }
                    } catch (customerError) {
                      console.warn(`Erro ao buscar cliente ${payment.customer} da conta ${account.name}:`, customerError);
                    }
                  }
                }
              }
            }
        } catch (accountError) {
          console.warn(`Erro ao conectar com conta Asaas ${account.name}:`, accountError);
        }
      }

      console.log(`=== RESULTADO FINAL ===`);
      console.log(`Total de clientes encontrados: ${clientesUnificados.length}`);
      console.log(`Distribuição por origem:`);
      const contagemPorOrigem = clientesUnificados.reduce((acc, cliente) => {
        acc[cliente.origem] = (acc[cliente.origem] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(JSON.stringify(contagemPorOrigem, null, 2));
      console.log(`=== FIM BUSCA UNIFICADA ===`);
      res.json(clientesUnificados);
    } catch (error) {
      console.error('Erro ao buscar clientes unificados:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Asaas API Integration - Cobranças Recorrentes (manter o endpoint original para compatibilidade)
  app.get("/api/asaas/clientes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: "Chave da API do Asaas não configurada" });
      }

      const baseUrl = asaasEnv === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Buscar apenas assinaturas ativas e inadimplentes do mês atual
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const allStatuses = ['ACTIVE', 'OVERDUE'];
      const subscriptions = [];

      for (const status of allStatuses) {
        const subscriptionsResponse = await fetch(`${baseUrl}/subscriptions?status=${status}&limit=100`, {
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          }
        });

        if (subscriptionsResponse.ok) {
          const subscriptionsData = await subscriptionsResponse.json();

          for (const subscription of subscriptionsData.data || []) {
            // Para inadimplentes, verificar se é do mês atual
            if (status === 'OVERDUE') {
              const dueMonth = subscription.nextDueDate?.slice(0, 7);
              if (dueMonth !== currentMonth) {
                continue; // Pular inadimplentes de outros meses
              }
            }

            try {
              // Buscar dados do cliente
              const customerResponse = await fetch(`${baseUrl}/customers/${subscription.customer}`, {
                headers: {
                  'access_token': asaasApiKey,
                  'Content-Type': 'application/json'
                }
              });

              if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                
                // Buscar pagamentos do mês atual para determinar status
                const currentMonth = new Date().toISOString().slice(0, 7);
                const currentMonthPayments = await fetch(`${baseUrl}/payments?subscription=${subscription.id}&status=CONFIRMED&dateCreated[ge]=${currentMonth}-01&dateCreated[le]=${currentMonth}-31`, {
                  headers: {
                    'access_token': asaasApiKey,
                    'Content-Type': 'application/json'
                  }
                });

                // Buscar pagamentos em atraso para determinar inadimplência
                const overduePayments = await fetch(`${baseUrl}/payments?subscription=${subscription.id}&status=OVERDUE`, {
                  headers: {
                    'access_token': asaasApiKey,
                    'Content-Type': 'application/json'
                  }
                });

                // Determinar status real baseado em pagamentos confirmados no mês atual
                let realStatus = 'ACTIVE'; // Padrão é ativo
                
                // Só marca como INACTIVE se há pagamentos em atraso no mês atual
                if (overduePayments.ok) {
                  const overdueData = await overduePayments.json();
                  if (overdueData.data && overdueData.data.length > 0) {
                    // Verificar se algum pagamento em atraso é do mês atual
                    const hasCurrentMonthOverdue = overdueData.data.some((payment: any) => {
                      const paymentMonth = payment.dueDate.slice(0, 7);
                      return paymentMonth === currentMonth;
                    });
                    if (hasCurrentMonthOverdue) {
                      realStatus = 'INACTIVE';
                    }
                  }
                }

                // Se tem pagamento confirmado no mês atual, sempre ativo
                if (currentMonthPayments.ok) {
                  const currentPayments = await currentMonthPayments.json();
                  if (currentPayments.data && currentPayments.data.length > 0) {
                    realStatus = 'ACTIVE';
                  }
                }

                // Buscar último pagamento confirmado para calcular próximo vencimento
                const lastPaymentResponse = await fetch(`${baseUrl}/payments?subscription=${subscription.id}&status=CONFIRMED&limit=1`, {
                  headers: {
                    'access_token': asaasApiKey,
                    'Content-Type': 'application/json'
                  }
                });

                // Buscar dados do link de pagamento
                let paymentLinkName = 'Link não informado';
                if (subscription.paymentLink) {
                  const linkResponse = await fetch(`${baseUrl}/paymentLinks/${subscription.paymentLink}`, {
                    headers: {
                      'access_token': asaasApiKey,
                      'Content-Type': 'application/json'
                    }
                  });
                  if (linkResponse.ok) {
                    const linkData = await linkResponse.json();
                    paymentLinkName = linkData.name || 'Link de pagamento';
                  }
                }

                let calculatedNextDueDate = subscription.nextDueDate;
                let daysRemaining = 0;

                if (lastPaymentResponse.ok) {
                  const paymentsData = await lastPaymentResponse.json();
                  if (paymentsData.data && paymentsData.data.length > 0) {
                    const lastPayment = paymentsData.data[0];
                    const lastPaymentDate = new Date(lastPayment.paymentDate || lastPayment.dateCreated);
                    
                    // Calcular próximo vencimento: último pagamento + 30 dias (mensal)
                    const nextDue = new Date(lastPaymentDate);
                    if (subscription.cycle === 'MONTHLY') {
                      nextDue.setMonth(nextDue.getMonth() + 1);
                    } else {
                      nextDue.setTime(new Date(subscription.nextDueDate).getTime());
                    }
                    
                    calculatedNextDueDate = nextDue.toISOString().split('T')[0];
                    
                    // Calcular dias restantes
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    nextDue.setHours(0, 0, 0, 0);
                    daysRemaining = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  } else {
                    // Se não há pagamentos, usar a data do Asaas
                    const nextDue = new Date(subscription.nextDueDate);
                    const today = new Date();
                    daysRemaining = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  }
                } else {
                  // Fallback para data do Asaas
                  const nextDue = new Date(subscription.nextDueDate);
                  const today = new Date();
                  daysRemaining = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                }

                subscriptions.push({
                  id: subscription.id,
                  subscriptionId: subscription.id,
                  customerId: customerData.id,
                  customerName: customerData.name,
                  customerEmail: customerData.email,
                  customerPhone: customerData.phone,
                  customerCpfCnpj: customerData.cpfCnpj,
                  status: realStatus, // Status baseado em inadimplência real no mês atual
                  value: parseFloat(subscription.value),
                  cycle: subscription.cycle,
                  billingType: subscription.billingType,
                  nextDueDate: calculatedNextDueDate,
                  daysRemaining: daysRemaining,
                  planName: paymentLinkName, // Nome do link de pagamento como nome do plano
                  paymentLinkName: paymentLinkName,
                  createdAt: subscription.dateCreated
                });
              }
            } catch (error) {
              console.error(`Erro ao buscar cliente ${subscription.customer}:`, error);
            }
          }
        }
      }

      res.json(subscriptions);
    } catch (error: any) {
      console.error("Erro ao buscar cobranças recorrentes do Asaas:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/asaas/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: "Chave da API do Asaas não configurada" });
      }

      const baseUrl = asaasEnv === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Buscar assinaturas ativas
      const activeSubscriptionsResponse = await fetch(`${baseUrl}/subscriptions?status=ACTIVE&limit=100`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      // Buscar assinaturas inadimplentes
      const overdueSubscriptionsResponse = await fetch(`${baseUrl}/subscriptions?status=OVERDUE&limit=100`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!activeSubscriptionsResponse.ok || !overdueSubscriptionsResponse.ok) {
        throw new Error('Erro ao buscar dados do Asaas');
      }

      const activeData = await activeSubscriptionsResponse.json();
      const overdueData = await overdueSubscriptionsResponse.json();

      // Calcular estatísticas corretas
      let totalMonthlyRevenue = 0;
      let newClientsThisMonth = 0;
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      // Somar apenas receita de assinaturas ativas
      for (const subscription of activeData.data || []) {
        totalMonthlyRevenue += parseFloat(subscription.value);
        
        // Verificar se é novo este mês baseado na data de criação da assinatura
        const createdMonth = subscription.dateCreated?.slice(0, 7);
        if (createdMonth === currentMonth) {
          newClientsThisMonth++;
        }
      }

      // Calcular inadimplentes reais usando a nova lógica  
      let realOverdueClients = 0;
      
      // Verificar cada assinatura para determinar inadimplência real
      for (const subscription of [...(activeData.data || []), ...(overdueData.data || [])]) {
        // Buscar pagamentos em atraso específicos do mês atual
        const overduePaymentsResponse = await fetch(`${baseUrl}/payments?subscription=${subscription.id}&status=OVERDUE`, {
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          }
        });

        if (overduePaymentsResponse.ok) {
          const overduePaymentsData = await overduePaymentsResponse.json();
          if (overduePaymentsData.data && overduePaymentsData.data.length > 0) {
            // Verificar se algum pagamento em atraso é do mês atual
            const hasCurrentMonthOverdue = overduePaymentsData.data.some((payment: any) => {
              const paymentMonth = payment.dueDate.slice(0, 7);
              return paymentMonth === currentMonth;
            });
            
            if (hasCurrentMonthOverdue) {
              // Verificar se não tem pagamento confirmado no mês atual
              const currentMonthPaymentsResponse = await fetch(`${baseUrl}/payments?subscription=${subscription.id}&status=CONFIRMED&dateCreated[ge]=${currentMonth}-01&dateCreated[le]=${currentMonth}-31`, {
                headers: {
                  'access_token': asaasApiKey,
                  'Content-Type': 'application/json'
                }
              });

              if (currentMonthPaymentsResponse.ok) {
                const currentPayments = await currentMonthPaymentsResponse.json();
                if (!currentPayments.data || currentPayments.data.length === 0) {
                  realOverdueClients++;
                }
              }
            }
          }
        }
      }

      const stats = {
        totalActiveClients: activeData.totalCount || 0,
        totalMonthlyRevenue: totalMonthlyRevenue,
        newClientsThisMonth: newClientsThisMonth,
        overdueClients: realOverdueClients // Inadimplentes reais do mês atual
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas do Asaas:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Buscar faturamento do Asaas por mês específico
  app.get("/api/asaas/faturamento-mensal", requireAuth, async (req, res) => {
    try {
      const { mes } = req.query; // formato YYYY-MM
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: "Chave da API do Asaas não configurada" });
      }

      const baseUrl = asaasEnv === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Se não especificar mês, usar mês atual
      const targetMonth = mes || new Date().toISOString().slice(0, 7);
      const dateFrom = `${targetMonth}-01`;
      const dateTo = `${targetMonth}-31`;

      // Buscar pagamentos confirmados do mês específico
      const paymentsResponse = await fetch(
        `${baseUrl}/payments?status=CONFIRMED&paymentDate[ge]=${dateFrom}&paymentDate[le]=${dateTo}&limit=1000`, 
        {
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!paymentsResponse.ok) {
        throw new Error(`Erro na API do Asaas: ${paymentsResponse.status}`);
      }

      const paymentsData = await paymentsResponse.json();
      
      let totalRevenue = 0;
      let subscriptionRevenue = 0;
      let subscriptionCount = 0;
      
      for (const payment of paymentsData.data || []) {
        totalRevenue += payment.value;
        
        // Filtrar apenas pagamentos de assinaturas
        if (payment.subscription) {
          subscriptionRevenue += payment.value;
          subscriptionCount++;
        }
      }

      res.json({
        mes: targetMonth,
        totalRevenue,
        subscriptionRevenue,
        subscriptionCount,
        totalPayments: paymentsData.data?.length || 0
      });
    } catch (error: any) {
      console.error("Erro ao buscar faturamento mensal do Asaas:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dados de faturamento diário para gráfico
  app.get("/api/asaas/faturamento-diario", requireAuth, requireAdmin, async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: "Chave da API do Asaas não configurada" });
      }

      const baseUrl = asaasEnv === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Buscar pagamentos confirmados dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
      const dateTo = new Date().toISOString().split('T')[0];

      const paymentsResponse = await fetch(
        `${baseUrl}/payments?status=CONFIRMED&dateCreated[ge]=${dateFrom}&dateCreated[le]=${dateTo}&limit=1000`, 
        {
          headers: {
            'access_token': asaasApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!paymentsResponse.ok) {
        throw new Error(`Erro na API do Asaas: ${paymentsResponse.status}`);
      }

      const paymentsData = await paymentsResponse.json();
      
      // Agrupar pagamentos por dia
      const dailyRevenue = {};
      
      for (const payment of paymentsData.data || []) {
        // Filtrar apenas pagamentos de assinaturas
        if (payment.subscription) {
          const paymentDate = payment.paymentDate?.split('T')[0] || payment.dateCreated?.split('T')[0];
          if (paymentDate) {
            if (!dailyRevenue[paymentDate]) {
              dailyRevenue[paymentDate] = {
                date: paymentDate,
                value: 0,
                count: 0
              };
            }
            dailyRevenue[paymentDate].value += parseFloat(payment.value);
            dailyRevenue[paymentDate].count += 1;
          }
        }
      }

      // Converter para array e ordenar por data
      const dailyData = Object.values(dailyRevenue).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      res.json(dailyData);
    } catch (error: any) {
      console.error("Erro ao buscar faturamento diário:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // === LISTA DA VEZ ===

  // GET /api/lista-da-vez/fila-mensal/:mes - Obter fila mensal completa (Recepcionista)
  app.get('/api/lista-da-vez/fila-mensal/:mes', requireAuth, async (req, res) => {
    try {
      const { mes } = req.params; // formato "YYYY-MM"
      
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const filaMensal = await storage.getFilaMensalComOrdem(mes);
      res.json(filaMensal);
    } catch (error: any) {
      console.error('Erro ao buscar fila mensal:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/lista-da-vez/atendimentos/:data - Obter atendimentos de uma data específica
  app.get('/api/lista-da-vez/atendimentos/:data', requireAuth, async (req, res) => {
    try {
      const { data } = req.params; // formato "YYYY-MM-DD"
      
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const atendimentos = await storage.getAtendimentosDiarios(data);
      res.json(atendimentos);
    } catch (error: any) {
      console.error('Erro ao buscar atendimentos diários:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/lista-da-vez/salvar - Salvar/atualizar atendimentos diários (Recepcionista)
  app.post('/api/lista-da-vez/salvar', requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const { data, atendimentos } = req.body;
      
      if (!data || !Array.isArray(atendimentos)) {
        return res.status(400).json({ message: 'Dados inválidos' });
      }

      const resultados = [];
      
      for (const atendimento of atendimentos) {
        try {
          const validated = insertAtendimentoDiarioSchema.parse({
            barbeiroId: atendimento.barbeiroId,
            data: data,
            atendimentosDiarios: atendimento.atendimentosDiarios || 0,
            passouAVez: atendimento.passouAVez || false
          });

          const resultado = await storage.createOrUpdateAtendimentoDiario(validated);
          resultados.push(resultado);
        } catch (validationError: any) {
          console.error(`Erro de validação para barbeiro ${atendimento.barbeiroId}:`, validationError);
          continue; // Pular este registro e continuar com os outros
        }
      }

      res.json({ 
        message: `Lista da Vez salva com sucesso para ${data}`,
        total: resultados.length 
      });
    } catch (error: any) {
      console.error('Erro ao salvar lista da vez:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/lista-da-vez/barbeiro/:barbeiroId/:mes - Obter posição do barbeiro (Barbeiro)
  app.get('/api/lista-da-vez/barbeiro/:barbeiroId/:mes', requireAuth, async (req, res) => {
    try {
      const { barbeiroId, mes } = req.params;
      
      // Barbeiro só pode ver sua própria posição
      if (req.session.userRole === 'barbeiro' && req.session.barbeiroId !== parseInt(barbeiroId)) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const posicaoBarbeiro = await storage.getBarbeiroFilaMensal(parseInt(barbeiroId), mes);
      res.json(posicaoBarbeiro);
    } catch (error: any) {
      console.error('Erro ao buscar posição do barbeiro:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/lista-da-vez/fila-mensal - Obter fila mensal (sem parâmetro de mês)
  app.get('/api/lista-da-vez/fila-mensal', requireAuth, async (req, res) => {
    try {
      const { mesAno } = req.query;
      const mesConsulta = mesAno ? mesAno.toString() : new Date().toISOString().substring(0, 7);
      
      // Permitir acesso para admin, recepcionista e barbeiro
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista' && req.session.userRole !== 'barbeiro') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const filaMensal = await storage.getFilaMensalComOrdem(mesConsulta);
      
      // Se for barbeiro, retornar apenas as informações dele
      if (req.session.userRole === 'barbeiro' && req.session.barbeiroId) {
        const filaBarbeiro = filaMensal.filter(item => item.barbeiro.id === req.session.barbeiroId);
        return res.json(filaBarbeiro);
      }
      
      res.json(filaMensal);
    } catch (error: any) {
      console.error('Erro ao buscar fila mensal:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/lista-da-vez/atendimentos - Obter atendimentos (sem parâmetro de data)
  app.get('/api/lista-da-vez/atendimentos', requireAuth, async (req, res) => {
    try {
      const { data } = req.query;
      const dataConsulta = data ? data.toString() : new Date().toISOString().split('T')[0];
      
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const atendimentos = await storage.getAtendimentosDiarios(dataConsulta);
      res.json(atendimentos);
    } catch (error: any) {
      console.error('Erro ao buscar atendimentos diários:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/lista-da-vez/adicionar-atendimento - Adicionar atendimento seguindo ordem da fila
  app.post('/api/lista-da-vez/adicionar-atendimento', requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const { barbeiroId, data, mesAno, tipoAtendimento } = req.body;
      
      if (!data || !mesAno) {
        return res.status(400).json({ message: 'Data e mês/ano são obrigatórios' });
      }

      let targetBarbeiroId = barbeiroId;

      // Se não especificar barbeiro, automaticamente selecionar o próximo da fila
      if (!barbeiroId) {
        const filaMensal = await storage.getFilaMensal(mesAno);
        if (filaMensal.length > 0) {
          // Pegar o barbeiro com menos atendimentos (primeiro da fila ordenada)
          targetBarbeiroId = filaMensal[0].barbeiro.id;
        } else {
          return res.status(400).json({ message: 'Nenhum barbeiro disponível' });
        }
      }

      await storage.createOrUpdateAtendimentoDiario({
        barbeiroId: parseInt(targetBarbeiroId),
        data: data, // Manter como string no formato YYYY-MM-DD
        mesAno: mesAno,
        tipoAtendimento: tipoAtendimento || 'NORMAL'
      });

      // Buscar nome do barbeiro para resposta
      const barbeiro = await storage.getBarbeiroById(parseInt(targetBarbeiroId));
      const nomeBarbeiro = barbeiro?.nome || 'Barbeiro';

      res.json({ 
        message: `Cliente adicionado para ${nomeBarbeiro}`,
        barbeiroId: targetBarbeiroId,
        barbeiroNome: nomeBarbeiro
      });
    } catch (error: any) {
      console.error('Erro ao adicionar atendimento:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/lista-da-vez/passar-vez - Registrar que barbeiro passou a vez
  app.post('/api/lista-da-vez/passar-vez', requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const { barbeiroId, data, mesAno } = req.body;
      
      if (!barbeiroId || !data || !mesAno) {
        return res.status(400).json({ message: 'Dados obrigatórios não fornecidos' });
      }

      await storage.createOrUpdateAtendimentoDiario({
        barbeiroId: parseInt(barbeiroId),
        data: data, // Manter como string no formato YYYY-MM-DD
        mesAno: mesAno,
        tipoAtendimento: 'PASSOU_VEZ'
      });

      res.json({ message: 'Vez passada registrada com sucesso' });
    } catch (error: any) {
      console.error('Erro ao registrar vez passada:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/lista-da-vez/zerar-atendimentos - Zerar todos os atendimentos do mês (apenas admin)
  app.post('/api/lista-da-vez/zerar-atendimentos', requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem zerar atendimentos.' });
      }

      const { mesAno } = req.body;
      
      if (!mesAno) {
        return res.status(400).json({ message: 'Mês/ano é obrigatório' });
      }

      await storage.zerarAtendimentosMes(mesAno);

      res.json({ message: `Todos os atendimentos do mês ${mesAno} foram zerados com sucesso.` });
    } catch (error: any) {
      console.error('Erro ao zerar atendimentos:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/analytics/dias-movimento - Dias de maior movimento baseado em agendamentos reais
  app.get('/api/analytics/dias-movimento', requireAuth, async (req, res) => {
    try {
      const { mes } = req.query;
      const mesAtual = mes || format(new Date(), 'yyyy-MM');
      
      // Buscar todos os agendamentos finalizados do mês
      const agendamentos = await storage.getAllAgendamentos();
      const agendamentosFinalizados = agendamentos.filter(a => 
        a.status === 'finalizado' && 
        format(new Date(a.dataHora), 'yyyy-MM') === mesAtual
      );

      // Agrupar por dia da semana
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const movimentoPorDia = diasSemana.map(dia => ({
        dia,
        atendimentos: 0,
        tempoTotal: 0
      }));

      agendamentosFinalizados.forEach(agendamento => {
        const diaSemana = new Date(agendamento.dataHora).getDay();
        movimentoPorDia[diaSemana].atendimentos++;
        movimentoPorDia[diaSemana].tempoTotal += agendamento.servico?.tempoMinutos || 30;
      });

      // Ordenar por número de atendimentos
      const ranking = movimentoPorDia
        .filter(item => item.atendimentos > 0)
        .sort((a, b) => b.atendimentos - a.atendimentos)
        .slice(0, 5);

      res.json(ranking);
    } catch (error: any) {
      console.error('Erro ao buscar dias de movimento:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/servicos/top-5 - Top 5 serviços baseado em tempo real executado
  app.get('/api/servicos/top-5', requireAuth, async (req, res) => {
    try {
      const { mes } = req.query;
      const mesAtual = mes || format(new Date(), 'yyyy-MM');
      
      // Buscar todos os agendamentos finalizados do mês
      const agendamentos = await storage.getAllAgendamentos();
      const agendamentosFinalizados = agendamentos.filter(a => 
        a.status === 'finalizado' && 
        format(new Date(a.dataHora), 'yyyy-MM') === mesAtual
      );

      // Agrupar por serviço
      const servicosMap = new Map();
      
      for (const agendamento of agendamentosFinalizados) {
        const servicoId = agendamento.servicoId;
        const servico = await storage.getServicoById(servicoId);
        
        if (servico) {
          const key = servico.nome;
          if (!servicosMap.has(key)) {
            servicosMap.set(key, {
              servico: servico.nome,
              quantidade: 0,
              tempoTotal: 0,
              tempoMinutos: servico.tempoMinutos
            });
          }
          
          const item = servicosMap.get(key);
          item.quantidade++;
          item.tempoTotal += servico.tempoMinutos;
        }
      }

      // Converter para array e ordenar por tempo total
      const topServicos = Array.from(servicosMap.values())
        .sort((a, b) => b.tempoTotal - a.tempoTotal)
        .slice(0, 5);

      res.json(topServicos);
    } catch (error: any) {
      console.error('Erro ao buscar top serviços:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/analytics/kpis-dashboard - KPIs principais do dashboard
  app.get('/api/analytics/kpis-dashboard', requireAuth, async (req, res) => {
    try {
      const { mes, dia } = req.query;
      const mesAtual = mes || format(new Date(), 'yyyy-MM');
      
      // Buscar agendamentos finalizados do período
      const agendamentos = await storage.getAllAgendamentos();
      let agendamentosFiltrados = agendamentos.filter(a => 
        a.status === 'FINALIZADO' && 
        format(new Date(a.dataHora), 'yyyy-MM') === mesAtual
      );

      // Filtrar por dia se especificado
      if (dia && dia !== 'todos' && typeof dia === 'string') {
        agendamentosFiltrados = agendamentosFiltrados.filter(a => 
          format(new Date(a.dataHora), 'dd') === dia.padStart(2, '0')
        );
      }

      console.log(`Agendamentos filtrados para KPIs: ${agendamentosFiltrados.length} encontrados`);

      // Buscar estatísticas de clientes unificadas para o mês específico
      const [ano, mesNum] = (mesAtual as string).split('-');
      const totalClientes = await storage.getTotalClientes();
      const valorTotalAssinaturas = await storage.getValorTotalAssinaturas();
      const clientesStats = {
        totalActiveClients: totalClientes,
        totalSubscriptionRevenue: valorTotalAssinaturas,
        totalExpiringSubscriptions: 0
      };
      
      // Calcular KPIs com dados reais do mês
      const totalAtendimentos = agendamentosFiltrados.length;
      
      // Calcular receita total das duas contas Asaas + clientes externos
      let receitaTotal = clientesStats.totalSubscriptionRevenue || 0;
      
      // Somar receita da primeira conta Asaas
      try {
        const asaasToken = process.env.ASAAS_API_KEY;
        if (asaasToken) {
          const assinaturasResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?limit=100&status=ACTIVE', {
            headers: {
              'access_token': asaasToken,
              'Content-Type': 'application/json'
            }
          });
          
          if (assinaturasResponse.ok) {
            const assinaturasData = await assinaturasResponse.json();
            const receitaAsaas = assinaturasData.data?.reduce((sum: number, sub: any) => sum + (sub.value || 0), 0) || 0;
            receitaTotal += receitaAsaas;
          }
        }
      } catch (error) {
        console.warn('Erro ao buscar receita da primeira conta Asaas:', error);
      }
      
      // Somar receita da segunda conta Asaas (Andrey)
      try {
        const tokenAndrey = process.env.ASAAS_API_KEY_ANDREY;
        if (tokenAndrey) {
          const assinaturasAndreyResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?limit=100&status=ACTIVE', {
            headers: {
              'access_token': tokenAndrey,
              'Content-Type': 'application/json'
            }
          });
          
          if (assinaturasAndreyResponse.ok) {
            const assinaturasAndreyData = await assinaturasAndreyResponse.json();
            const receitaAsaasAndrey = assinaturasAndreyData.data?.reduce((sum: number, sub: any) => sum + (sub.value || 0), 0) || 0;
            receitaTotal += receitaAsaasAndrey;
          }
        }
      } catch (error) {
        console.warn('Erro ao buscar receita da segunda conta Asaas:', error);
      }
      
      // Ticket médio baseado em clientes que realmente pagaram no mês vigente
      const clientesComPagamentoMes = clientesStats.clientesPagantesDoMes || 0;
      const ticketMedio = clientesComPagamentoMes > 0 ? 
        receitaTotal / clientesComPagamentoMes : 0;

      // Tempo médio por atendimento
      const tempoTotalMinutos = agendamentosFiltrados.reduce((sum, a) => {
        return sum + (a.servico?.tempoMinutos || 30);
      }, 0);
      
      const tempoMedioPorAtendimento = totalAtendimentos > 0 ? 
        Math.round(tempoTotalMinutos / totalAtendimentos) : 0;

      // Buscar assinaturas vencidas
      const assinaturasVencidas = clientesStats.totalExpiringSubscriptions || 0;

      console.log(`KPIs calculados: totalAtendimentos=${totalAtendimentos}, receitaTotal=${receitaTotal}, clientesPagantes=${clientesComPagamentoMes}, ticketMedio=${ticketMedio}`);

      res.json({
        totalAtendimentos,
        receitaTotal,
        ticketMedio,
        tempoMedioPorAtendimento,
        tempoTotalMinutos,
        assinaturasVencidas
      });
    } catch (error: any) {
      console.error('Erro ao buscar KPIs do dashboard:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/clientes/all - Buscar APENAS clientes com assinaturas reais pagas
  app.get('/api/clientes/all', requireAuth, async (req, res) => {
    try {
      let clientesUnificados = [];
      const hoje = new Date();

      // 1. Buscar clientes locais APENAS os que têm assinatura válida paga
      const clientesLocais = await storage.getAllClientes();
      for (const cliente of clientesLocais) {
        // Incluir APENAS clientes que têm:
        // - planoValor > 0 (pagamento feito)
        // - dataVencimentoAssinatura válida
        // - formaPagamento definida (PIX, Cartão, etc.)
        if (cliente.planoValor && 
            cliente.dataVencimentoAssinatura && 
            cliente.formaPagamento &&
            cliente.formaPagamento !== 'Local') {
          
          const dataValidade = new Date(cliente.dataVencimentoAssinatura);
          const daysRemaining = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          
          let status: 'ATIVO' | 'INATIVO' | 'VENCIDO' = 'INATIVO';
          if (dataValidade >= hoje) {
            status = 'ATIVO';
          } else {
            status = 'VENCIDO';
          }

          clientesUnificados.push({
            id: `local_${cliente.id}`,
            nome: cliente.nome,
            email: cliente.email,
            telefone: cliente.telefone || '',
            cpf: cliente.cpf || '',
            planoNome: cliente.planoNome || 'Plano Local',
            planoValor: parseFloat(cliente.planoValor.toString()),
            formaPagamento: cliente.formaPagamento,
            dataInicio: cliente.dataInicioAssinatura ? cliente.dataInicioAssinatura.toISOString() : cliente.createdAt.toISOString(),
            dataValidade: cliente.dataVencimentoAssinatura.toISOString(),
            status,
            origem: 'EXTERNO' as const,
            daysRemaining: Math.max(0, daysRemaining)
          });
        }
      }

      // 2. Buscar clientes do Asaas APENAS com assinaturas ativas e pagamentos confirmados
      if (process.env.ASAAS_API_KEY && process.env.ASAAS_ENVIRONMENT) {
        try {
          const asaasUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://www.asaas.com/api/v3';
          
          // Buscar pagamentos confirmados do mês atual
          const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
          const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
          
          const paymentsResponse = await fetch(
            `${asaasUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${inicioMes}&receivedInCashDate[le]=${fimMes}&limit=100`, 
            {
              headers: {
                'access_token': process.env.ASAAS_API_KEY,
                'Content-Type': 'application/json'
              }
            }
          );

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            const clientesAsaasProcessados = new Set();
            
            // Processar APENAS pagamentos confirmados de assinaturas
            for (const payment of paymentsData.data || []) {
              if (payment.subscription && payment.status === 'CONFIRMED' && !clientesAsaasProcessados.has(payment.customer)) {
                try {
                  // Buscar dados do cliente
                  const customerResponse = await fetch(`${asaasUrl}/customers/${payment.customer}`, {
                    headers: {
                      'access_token': process.env.ASAAS_API_KEY,
                      'Content-Type': 'application/json'
                    }
                  });

                  if (customerResponse.ok) {
                    const customerData = await customerResponse.json();
                    
                    // Buscar assinatura ativa
                    const subscriptionResponse = await fetch(`${asaasUrl}/subscriptions/${payment.subscription}`, {
                      headers: {
                        'access_token': process.env.ASAAS_API_KEY,
                        'Content-Type': 'application/json'
                      }
                    });

                    if (subscriptionResponse.ok) {
                      const subscriptionData = await subscriptionResponse.json();
                      
                      const dataValidade = new Date(subscriptionData.nextDueDate);
                      const daysRemaining = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      
                      let status: 'ATIVO' | 'INATIVO' | 'VENCIDO' = 'INATIVO';
                      if (subscriptionData.status === 'ACTIVE' && daysRemaining > 0) {
                        status = 'ATIVO';
                      } else if (daysRemaining < 0) {
                        status = 'VENCIDO';
                      }

                      clientesUnificados.push({
                        id: customerData.id,
                        nome: customerData.name,
                        email: customerData.email,
                        telefone: customerData.mobilePhone || customerData.phone || '',
                        cpf: customerData.cpfCnpj || '',
                        planoNome: subscriptionData.description || 'Plano Asaas',
                        planoValor: parseFloat(payment.value),
                        formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                                       payment.billingType === 'BOLETO' ? 'Boleto' : 
                                       payment.billingType === 'PIX' ? 'PIX' : 'Outros',
                        dataInicio: payment.paymentDate || payment.dateCreated,
                        dataValidade: subscriptionData.nextDueDate,
                        status,
                        origem: 'ASAAS' as const,
                        billingType: payment.billingType,
                        daysRemaining: Math.max(0, daysRemaining)
                      });

                      clientesAsaasProcessados.add(payment.customer);
                    }
                  }
                } catch (customerError) {
                  console.warn(`Erro ao buscar detalhes do cliente ${payment.customer}:`, customerError);
                }
              }
            }
          }
        } catch (asaasError) {
          console.warn('Erro ao conectar com Asaas, usando apenas dados locais:', asaasError);
        }
      }

      console.log(`Clientes válidos encontrados: ${clientesUnificados.length}`);
      res.json(clientesUnificados);
    } catch (error: any) {
      console.error('Erro ao buscar todos os clientes:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/clientes-ativos-agendamento - Clientes com assinaturas ativas para agendamento
  app.get('/api/clientes-ativos-agendamento', requireAuth, async (req, res) => {
    try {
      const hoje = new Date();
      const clientesAtivos = [];
      const clientesAsaasProcessados = new Set<string>();

      // SINCRONIZAÇÃO AUTOMÁTICA: Buscar e sincronizar clientes da segunda conta Asaas
      try {
        const tokenAndrey = process.env.ASAAS_API_KEY_ANDREY;
        if (tokenAndrey) {
          console.log('🔄 Sincronização automática: Verificando clientes da segunda conta Asaas');

          // Buscar clientes da API Asaas Andrey
          const clientesResponse = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': tokenAndrey,
              'Content-Type': 'application/json'
            }
          });

          if (clientesResponse.ok) {
            const clientesData = await clientesResponse.json();

            // Buscar assinaturas ativas
            const assinaturasResponse = await fetch('https://www.asaas.com/api/v3/subscriptions?limit=100&status=ACTIVE', {
              headers: {
                'access_token': tokenAndrey,
                'Content-Type': 'application/json'
              }
            });

            let assinaturasPorCliente = new Map();
            if (assinaturasResponse.ok) {
              const assinaturasData = await assinaturasResponse.json();
              assinaturasData.data?.forEach((assinatura: any) => {
                // Calcular data de vencimento (30 dias a partir da próxima cobrança)
                const dataVencimento = new Date(assinatura.nextDueDate);
                dataVencimento.setDate(dataVencimento.getDate() + 30);
                
                assinaturasPorCliente.set(assinatura.customer, {
                  planoNome: assinatura.description || 'Assinatura Asaas',
                  planoValor: assinatura.value.toString(),
                  formaPagamento: assinatura.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                            assinatura.billingType === 'PIX' ? 'PIX' :
                            assinatura.billingType === 'BOLETO' ? 'Boleto' : assinatura.billingType,
                  statusAssinatura: 'ATIVO',
                  dataInicioAssinatura: new Date(assinatura.dateCreated),
                  dataVencimentoAssinatura: dataVencimento
                });
              });
            }

            // Verificar clientes existentes na tabela central unificada
            const clientesExistentes = await storage.getAllClientes();
            
            const emailsExistentes = new Set(clientesExistentes.map(c => c.email.toLowerCase()));
            const asaasIdsExistentes = new Set(clientesExistentes.map(c => c.asaasCustomerId).filter(Boolean));

            let clientesSincronizados = 0;
            for (const customer of clientesData.data || []) {
              // Pular se cliente já existe por email ou asaasCustomerId
              if (emailsExistentes.has(customer.email.toLowerCase()) || asaasIdsExistentes.has(customer.id)) {
                continue;
              }

              const assinatura = assinaturasPorCliente.get(customer.id);
              
              // Só cadastrar clientes com assinatura ativa
              if (assinatura) {
                try {
                  // Salvar na tabela central unificada (FLUXO OBRIGATÓRIO)
                  await storage.createCliente({
                    nome: (customer.name || '').substring(0, 250),
                    email: (customer.email || '').substring(0, 250),
                    telefone: (customer.phone || customer.mobilePhone || '').substring(0, 20),
                    cpf: (customer.cpfCnpj || '').substring(0, 14),
                    origem: 'ASAAS_ANDREY', // Identificação da fonte de dados
                    asaasCustomerId: customer.id, // ID da segunda conta Asaas
                    planoNome: (assinatura.planoNome || '').substring(0, 250),
                    planoValor: assinatura.planoValor,
                    formaPagamento: (assinatura.formaPagamento || '').substring(0, 50),
                    statusAssinatura: assinatura.statusAssinatura,
                    dataInicioAssinatura: assinatura.dataInicioAssinatura,
                    dataVencimentoAssinatura: assinatura.dataVencimentoAssinatura
                  });
                  clientesSincronizados++;
                  console.log(`✅ Cliente sincronizado na tabela principal: ${customer.name}`);
                } catch (error) {
                  console.warn(`❌ Erro ao sincronizar cliente ${customer.name}:`, error);
                }
              }
            }

            if (clientesSincronizados > 0) {
              console.log(`✅ Sincronização automática: ${clientesSincronizados} novos clientes sincronizados`);
            }
          }
        }
      } catch (error) {
        console.warn('Erro na sincronização automática da segunda conta Asaas:', error);
      }

      // Buscar clientes da tabela 'clientes'
      const clientesLocais = await storage.getAllClientes();
      
      for (const cliente of clientesLocais) {
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          if (validade >= hoje) {
            clientesAtivos.push({
              id: cliente.id,
              nome: cliente.nome,
              email: cliente.email,
              telefone: cliente.telefone,
              origem: cliente.asaasCustomerId ? 'ASAAS' : 'EXTERNO'
            });
            
            // Marcar clientes Asaas já processados
            if (cliente.asaasCustomerId) {
              clientesAsaasProcessados.add(cliente.asaasCustomerId);
            }
          }
        }
      }

      // Buscar clientes da tabela 'clientes_externos'
      const clientesExternos = await storage.getAllClientesExternos();
      
      for (const cliente of clientesExternos) {
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          if (validade >= hoje) {
            clientesAtivos.push({
              id: `ext_${cliente.id}`, // Prefixo para evitar conflito de IDs
              nome: cliente.nome,
              email: cliente.email,
              telefone: cliente.telefone || '',
              origem: 'EXTERNO'
            });
          }
        }
      }

      // Buscar clientes da API do Asaas (mesma lógica do endpoint unificado)
      if (process.env.ASAAS_API_KEY) {
        try {
          const asaasApiKey = process.env.ASAAS_API_KEY;
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://www.asaas.com/api/v3';

          // Buscar todos os pagamentos recentes para encontrar clientes ativos
          const paymentsResponse = await fetch(`${baseUrl}/payments?status=RECEIVED&limit=100`, {
            headers: {
              'access_token': asaasApiKey
            }
          });

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            
            for (const payment of paymentsData.data || []) {
              if (!clientesAsaasProcessados.has(payment.customer)) {
                try {
                  // Buscar dados do cliente
                  const customerResponse = await fetch(`${baseUrl}/customers/${payment.customer}`, {
                    headers: {
                      'access_token': asaasApiKey
                    }
                  });

                  if (customerResponse.ok) {
                    const customerData = await customerResponse.json();
                    
                    // Buscar assinatura do cliente
                    const subscriptionResponse = await fetch(`${baseUrl}/subscriptions?customer=${payment.customer}&status=ACTIVE`, {
                      headers: {
                        'access_token': asaasApiKey
                      }
                    });

                    if (subscriptionResponse.ok) {
                      const subscriptionData = await subscriptionResponse.json();
                      
                      if (subscriptionData.data && subscriptionData.data.length > 0) {
                        const subscription = subscriptionData.data[0];
                        const dataValidade = new Date(subscription.nextDueDate);
                        const daysRemaining = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                        
                        // Se a assinatura está ativa e válida
                        if (subscription.status === 'ACTIVE' && daysRemaining > 0) {
                          clientesAtivos.push({
                            id: customerData.id,
                            nome: customerData.name,
                            email: customerData.email,
                            telefone: customerData.mobilePhone || customerData.phone || '',
                            origem: 'ASAAS'
                          });

                          clientesAsaasProcessados.add(payment.customer);
                        }
                      }
                    }
                  }
                } catch (customerError) {
                  console.warn(`Erro ao buscar detalhes do cliente ${payment.customer}:`, customerError);
                }
              }
            }
          }
        } catch (asaasError) {
          console.warn('Erro ao conectar com Asaas, usando apenas dados locais:', asaasError);
        }
      }

      console.log(`Clientes ativos para agendamento: ${clientesAtivos.length}`);
      res.json(clientesAtivos);
    } catch (error) {
      console.error('Erro ao buscar clientes ativos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // GET /api/clientes/unified-stats - Estatísticas unificadas de clientes
  app.get('/api/clientes/unified-stats', requireAuth, async (req, res) => {
    try {
      let totalActiveClients = 0;
      let totalSubscriptionRevenue = 0;
      let newClientsThisMonth = 0;
      let totalExternalClients = 0;
      let totalAsaasClients = 0;
      let overdueClients = 0;
      
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const currentMonth = hoje.toISOString().slice(0, 7);

      // Buscar todos os clientes locais (inclui sincronizados do Asaas)
      const clientesLocais = await storage.getAllClientes();
      
      // Set para evitar duplicação de clientes Asaas já sincronizados
      const clientesAsaasProcessados = new Set();

      // Processar clientes locais
      for (const cliente of clientesLocais) {
        // Se tem asaasCustomerId, marcar como processado
        if (cliente.asaasCustomerId) {
          clientesAsaasProcessados.add(cliente.asaasCustomerId);
        }

        // Verificar se está ativo
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          const isActive = validade >= hoje;
          const isOverdue = validade < hoje;
          
          if (isActive) {
            totalActiveClients++;
            totalSubscriptionRevenue += parseFloat(cliente.planoValor?.toString() || '0');
            
            // Classificar origem
            if (cliente.asaasCustomerId) {
              totalAsaasClients++;
            } else {
              totalExternalClients++;
            }
          } else if (isOverdue) {
            overdueClients++;
          }
          
          // Verificar se é cliente novo do mês
          const dataInicio = new Date(cliente.dataInicioAssinatura || cliente.createdAt);
          if (dataInicio >= inicioMes) {
            newClientsThisMonth++;
          }
        }
      }

      // Buscar dados adicionais do Asaas para pagamentos do mês atual
      const asaasApiKey = process.env.ASAAS_API_KEY;
      if (asaasApiKey) {
        try {
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://www.asaas.com/api/v3';

          // Buscar pagamentos confirmados do mês atual
          const inicioMesStr = inicioMes.toISOString().split('T')[0];
          const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          const fimMesStr = fimMes.toISOString().split('T')[0];
          
          const paymentsResponse = await fetch(
            `${baseUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${inicioMesStr}&receivedInCashDate[le]=${fimMesStr}&limit=100`, 
            {
              headers: {
                'access_token': asaasApiKey,
                'Content-Type': 'application/json'
              }
            }
          );

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            
            // Processar pagamentos que não foram sincronizados ainda
            for (const payment of paymentsData.data || []) {
              if (payment.subscription && !clientesAsaasProcessados.has(payment.customer)) {
                totalAsaasClients++;
                totalActiveClients++;
                totalSubscriptionRevenue += parseFloat(payment.value || '0');
                clientesAsaasProcessados.add(payment.customer);
              }
            }
          }
        } catch (asaasError) {
          console.error("Erro ao conectar com Asaas:", asaasError);
        }
      }

      console.log(`Estatísticas calculadas: totalActiveClients=${totalActiveClients}, totalSubscriptionRevenue=${totalSubscriptionRevenue}`);

      res.json({
        totalActiveClients,
        totalInactiveClients: overdueClients,
        totalClients: totalActiveClients + overdueClients,
        totalSubscriptionRevenue,
        totalMonthlyRevenue: totalSubscriptionRevenue, // Alias para compatibilidade
        newClientsThisMonth,
        overdueClients,
        totalExternalClients,
        totalAsaasClients
      });
    } catch (error: any) {
      console.error('Erro ao calcular estatísticas unificadas:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/comissao/services-finished - Serviços finalizados para cálculo de comissão
  app.get('/api/comissao/services-finished', requireAuth, async (req, res) => {
    try {
      const { mes } = req.query;
      const targetMonth = mes || new Date().toISOString().slice(0, 7);

      // Buscar agendamentos finalizados do mês
      const agendamentos = await storage.getAllAgendamentos();
      console.log('Total agendamentos:', agendamentos.length);
      console.log('Target month:', targetMonth);
      
      const agendamentosFinalizados = agendamentos.filter(a => {
        const agendamentoMonth = new Date(a.dataHora).toISOString().slice(0, 7);
        const isFinalized = a.status === 'FINALIZADO';
        console.log(`Agendamento ${a.id}: status=${a.status}, month=${agendamentoMonth}, isFinalized=${isFinalized}`);
        return isFinalized && agendamentoMonth === targetMonth;
      });
      
      console.log('Agendamentos finalizados encontrados:', agendamentosFinalizados.length);

      // Buscar receita total de assinaturas do mês
      const [ano, mesNum] = targetMonth.split('-');
      const clientesStats = await storage.getClientesUnifiedStats(mesNum, ano);
      const receitaTotalAssinaturas = clientesStats.totalSubscriptionRevenue;
      const comissaoTotal = receitaTotalAssinaturas * 0.4; // 40% da receita

      // Buscar todos os serviços para obter tempos
      const servicos = await storage.getAllServicos();
      const servicosMap = new Map(servicos.map(s => [s.id, s]));

      // Calcular total de minutos trabalhados por todos os barbeiros
      let totalMinutosTrabalhados = 0;
      
      for (const agendamento of agendamentosFinalizados) {
        const servico = servicosMap.get(agendamento.servicoId);
        const tempoMinutos = servico?.tempoMinutos || 30;
        totalMinutosTrabalhados += tempoMinutos;
      }

      // Agrupar por barbeiro e calcular tempos individuais
      const servicosPorBarbeiro: { [key: number]: any } = {};

      for (const agendamento of agendamentosFinalizados) {
        const barbeiroId = agendamento.barbeiroId;
        
        if (!servicosPorBarbeiro[barbeiroId]) {
          const barbeiro = await storage.getBarbeiroById(barbeiroId);
          servicosPorBarbeiro[barbeiroId] = {
            barbeiro,
            servicos: [],
            totalServicos: 0,
            tempoTotalMinutos: 0,
            percentualTempo: 0,
            comissaoTotal: 0
          };
        }

        const servico = servicosMap.get(agendamento.servicoId);
        const tempoMinutos = servico?.tempoMinutos || 30;

        servicosPorBarbeiro[barbeiroId].servicos.push({
          ...agendamento,
          tempoMinutos
        });
        
        servicosPorBarbeiro[barbeiroId].totalServicos++;
        servicosPorBarbeiro[barbeiroId].tempoTotalMinutos += tempoMinutos;
      }

      // Calcular percentual de tempo e comissão proporcional para cada barbeiro
      for (const barbeiroId in servicosPorBarbeiro) {
        const barbeiro = servicosPorBarbeiro[barbeiroId];
        
        // Calcular percentual de participação
        barbeiro.percentualTempo = totalMinutosTrabalhados > 0 
          ? (barbeiro.tempoTotalMinutos / totalMinutosTrabalhados) * 100 
          : 0;
        
        // Calcular comissão proporcional
        barbeiro.comissaoTotal = totalMinutosTrabalhados > 0 
          ? (barbeiro.tempoTotalMinutos / totalMinutosTrabalhados) * comissaoTotal 
          : 0;
      }

      const resultado = Object.values(servicosPorBarbeiro);

      res.json({
        mes: targetMonth,
        barbeiros: resultado,
        totalServicosFinalizados: agendamentosFinalizados.length,
        receitaTotalServicos: receitaTotalAssinaturas,
        totalMinutosTrabalhados,
        comissaoTotalDisponivel: comissaoTotal
      });
    } catch (error: any) {
      console.error('Erro ao buscar serviços finalizados:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/admin/reset-passwords - Resetar senhas de todos os profissionais (apenas admin)
  app.post('/api/admin/reset-passwords', requireAuth, async (req, res) => {
    try {
      if (req.session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem resetar senhas.' });
      }

      const bcrypt = require('bcrypt');
      const newPassword = '12345678';
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Buscar todos os usuários que não são admin
      const { db } = await import('../shared/db');
      const { users } = await import('../shared/schema');
      const { ne } = await import('drizzle-orm');

      const result = await db.update(users)
        .set({ password: hashedPassword })
        .where(ne(users.role, 'admin'));

      res.json({ 
        message: 'Senhas de todos os profissionais atualizadas para 12345678',
        affectedUsers: result.rowCount || 0
      });
    } catch (error: any) {
      console.error('Erro ao resetar senhas:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==========================================
  // NOVOS ENDPOINTS - GESTÃO DE ASSINATURAS EXTERNAS
  // ==========================================

  // Cancelar assinatura externa (status = CANCELADO)
  app.put('/api/assinaturas-externas/:id/cancelar', async (req: Request, res: Response) => {
    try {
      const clienteId = parseInt(req.params.id);
      
      if (!clienteId || isNaN(clienteId)) {
        return res.status(400).json({ message: 'ID do cliente inválido' });
      }

      const clienteCancelado = await storage.cancelarAssinaturaExterna(clienteId);
      
      res.json({
        message: 'Assinatura cancelada com sucesso. Permanecerá ativa até o vencimento.',
        cliente: clienteCancelado
      });
    } catch (error: any) {
      console.error('Erro ao cancelar assinatura externa:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor', 
        error: error.message 
      });
    }
  });

  // Cancelar assinatura Asaas (status = CANCELADO)
  app.put('/api/assinaturas-asaas/:id/cancelar', async (req: Request, res: Response) => {
    try {
      const clienteId = parseInt(req.params.id);
      
      if (!clienteId || isNaN(clienteId)) {
        return res.status(400).json({ message: 'ID do cliente inválido' });
      }

      const clienteCancelado = await storage.cancelarAssinaturaAsaas(clienteId);
      
      res.json({
        message: 'Assinatura cancelada com sucesso. Permanecerá ativa até o vencimento.',
        cliente: clienteCancelado
      });
    } catch (error: any) {
      console.error('Erro ao cancelar assinatura Asaas:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor', 
        error: error.message 
      });
    }
  });

  // Excluir assinatura externa completamente
  app.delete('/api/assinaturas-externas/:id/excluir', async (req: Request, res: Response) => {
    try {
      const clienteId = parseInt(req.params.id);
      
      if (!clienteId || isNaN(clienteId)) {
        return res.status(400).json({ message: 'ID do cliente inválido' });
      }

      // Verificar se o cliente existe antes de excluir
      const cliente = await storage.getClienteExternoById(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }

      await storage.excluirAssinaturaExterna(clienteId);
      
      res.json({
        message: 'Assinatura excluída permanentemente com sucesso',
        clienteExcluido: cliente.nome
      });
    } catch (error: any) {
      console.error('Erro ao excluir assinatura externa:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor', 
        error: error.message 
      });
    }
  });

  // Excluir assinatura Asaas completamente
  app.delete('/api/assinaturas-asaas/:id/excluir', async (req: Request, res: Response) => {
    try {
      const clienteId = parseInt(req.params.id);
      
      if (!clienteId || isNaN(clienteId)) {
        return res.status(400).json({ message: 'ID do cliente inválido' });
      }

      // Verificar se o cliente existe antes de excluir
      const cliente = await storage.getClienteById(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }

      await storage.excluirAssinaturaAsaas(clienteId);
      
      res.json({
        message: 'Assinatura excluída permanentemente com sucesso',
        clienteExcluido: cliente.nome
      });
    } catch (error: any) {
      console.error('Erro ao excluir assinatura Asaas:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor', 
        error: error.message 
      });
    }
  });

  // Buscar assinaturas canceladas que expiraram (para limpeza automática)
  app.get('/api/assinaturas/canceladas-expiradas', async (req: Request, res: Response) => {
    try {
      const assinaturasExpiradas = await storage.getAssinaturasCanceladasExpiradas();
      
      res.json({
        message: 'Assinaturas canceladas e expiradas encontradas',
        total: assinaturasExpiradas.length,
        assinaturas: assinaturasExpiradas
      });
    } catch (error: any) {
      console.error('Erro ao buscar assinaturas canceladas:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor', 
        error: error.message 
      });
    }
  });

  // Processo automático de limpeza de assinaturas canceladas e expiradas
  app.post('/api/assinaturas/limpeza-automatica', async (req: Request, res: Response) => {
    try {
      const assinaturasExpiradas = await storage.getAssinaturasCanceladasExpiradas();
      let removidas = 0;

      // Remover cada assinatura expirada
      for (const assinatura of assinaturasExpiradas) {
        try {
          // Verificar se é cliente externo ou Asaas
          if ('formaPagamento' in assinatura && assinatura.formaPagamento) {
            // É cliente externo
            await storage.excluirAssinaturaExterna(assinatura.id);
          } else {
            // É cliente Asaas
            await storage.excluirAssinaturaAsaas(assinatura.id);
          }
          removidas++;
        } catch (error) {
          console.error(`Erro ao remover assinatura ${assinatura.id}:`, error);
        }
      }

      res.json({
        message: 'Limpeza automática executada com sucesso',
        assinaturasEncontradas: assinaturasExpiradas.length,
        assinaturasRemovidas: removidas
      });
    } catch (error: any) {
      console.error('Erro na limpeza automática:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor', 
        error: error.message 
      });
    }
  });

  // Estatísticas específicas do barbeiro
  app.get("/api/barbeiro/estatisticas", requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as SessionData;
      const barbeiroId = session.barbeiroId;

      if (!barbeiroId) {
        return res.status(403).json({ message: "Acesso negado. Apenas barbeiros podem acessar." });
      }

      // Buscar total de atendimentos do barbeiro
      const totalAtendimentos = await storage.getTotalAtendimentosBarbeiro(barbeiroId);
      
      // Calcular média de atendimentos (últimos 30 dias)
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);
      const atendimentosUltimos30Dias = await storage.getAtendimentosBarbeiroPeriodo(barbeiroId, dataInicio, new Date());
      const mediaAtendimentos = Math.round(atendimentosUltimos30Dias.length / 30 * 10) / 10;

      // Buscar serviços por tipo no mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      
      const fimMes = new Date();
      fimMes.setMonth(fimMes.getMonth() + 1);
      fimMes.setDate(0);
      fimMes.setHours(23, 59, 59, 999);

      const servicosPorTipo = await storage.getServicosPorTipoBarbeiro(barbeiroId, inicioMes, fimMes);

      res.json({
        totalAtendimentos: totalAtendimentos || 0,
        mediaAtendimentos,
        servicosPorTipo: servicosPorTipo || []
      });

    } catch (error) {
      console.error("Erro ao buscar estatísticas do barbeiro:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Posição do barbeiro na fila
  app.get("/api/barbeiro/posicao-fila", requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as SessionData;
      const barbeiroId = session.barbeiroId;

      if (!barbeiroId) {
        return res.status(403).json({ message: "Acesso negado. Apenas barbeiros podem acessar." });
      }

      // Buscar dados da fila mensal atual
      const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM
      const filaMensal = await storage.getFilaMensal(mesAtual);
      
      // Encontrar posição do barbeiro
      const barbeiros = filaMensal || [];
      barbeiros.sort((a, b) => a.totalAtendimentos - b.totalAtendimentos);
      
      const posicaoBarbeiro = barbeiros.findIndex(item => item.barbeiroId === barbeiroId);
      let statusFila = "Você não está na fila";
      
      if (posicaoBarbeiro !== -1) {
        const pessoasNaFrente = posicaoBarbeiro;
        
        if (pessoasNaFrente === 0) {
          statusFila = "É SUA VEZ!";
        } else if (pessoasNaFrente === 1) {
          statusFila = "Você é o PRÓXIMO";
        } else {
          statusFila = `${pessoasNaFrente} pessoas na sua frente`;
        }
      }

      res.json({
        posicao: posicaoBarbeiro + 1,
        statusFila,
        totalBarbeiros: barbeiros.length
      });

    } catch (error) {
      console.error("Erro ao buscar posição na fila:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // === GERENCIAMENTO DE ORDEM DA FILA (ADMIN APENAS) ===

  // GET /api/ordem-fila - Obter configuração atual da ordem da fila
  app.get('/api/ordem-fila', requireAdmin, async (req, res) => {
    try {
      const ordemFila = await storage.getOrdemFila();
      res.json(ordemFila);
    } catch (error: any) {
      console.error('Erro ao buscar ordem da fila:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/ordem-fila/reordenar - Reordenar profissionais na fila
  app.post('/api/ordem-fila/reordenar', requireAdmin, async (req, res) => {
    try {
      const { novaOrdem } = req.body; // Array de { barbeiroId, ordemCustomizada }
      
      if (!Array.isArray(novaOrdem)) {
        return res.status(400).json({ message: 'Nova ordem deve ser um array' });
      }

      const resultado = await storage.reordenarFila(novaOrdem);
      res.json({ message: 'Ordem da fila atualizada com sucesso', dados: resultado });
    } catch (error: any) {
      console.error('Erro ao reordenar fila:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // PUT /api/ordem-fila/:barbeiroId/toggle - Ativar/desativar barbeiro na fila
  app.put('/api/ordem-fila/:barbeiroId/toggle', requireAdmin, async (req, res) => {
    try {
      const barbeiroId = parseInt(req.params.barbeiroId);
      const { ativo } = req.body;
      
      if (typeof ativo !== 'boolean') {
        return res.status(400).json({ message: 'Status ativo deve ser boolean' });
      }

      const resultado = await storage.toggleBarbeiroFila(barbeiroId, ativo);
      res.json({ 
        message: `Barbeiro ${ativo ? 'ativado' : 'desativado'} na fila com sucesso`, 
        dados: resultado 
      });
    } catch (error: any) {
      console.error('Erro ao alterar status do barbeiro na fila:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/ordem-fila/inicializar - Inicializar ordem da fila com todos os barbeiros
  app.post('/api/ordem-fila/inicializar', requireAdmin, async (req, res) => {
    try {
      const resultado = await storage.inicializarOrdemFila();
      res.json({ message: 'Ordem da fila inicializada com sucesso', dados: resultado });
    } catch (error: any) {
      console.error('Erro ao inicializar ordem da fila:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== API V2 - SISTEMA MODERNO =====
  
  // Estatísticas consolidadas
  app.get("/api/v2/estatisticas", async (req: Request, res: Response) => {
    try {
      const asaasService = new AsaasIntegrationService();
      const estatisticas = await asaasService.getEstatisticasConsolidadas();
      res.json(estatisticas);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Listar clientes da nova estrutura - usando cobranças confirmadas
  app.get("/api/v2/clientes", async (req: Request, res: Response) => {
    try {
      console.log('=== INICIANDO BUSCA DE CLIENTES COM COBRANÇAS CONFIRMADAS ===');
      
      const clientesConsolidados = [];
      const clientesProcessados = new Set(); // Para evitar duplicatas
      const contas = [
        { nome: 'ASAAS_TRATO', apiKey: process.env.ASAAS_TRATO },
        { nome: 'ASAAS_ANDREY', apiKey: process.env.ASAAS_API_KEY_ANDREY }
      ];

      for (const conta of contas) {
        if (!conta.apiKey) {
          console.log(`❌ API Key não configurada para ${conta.nome}`);
          continue;
        }

        console.log(`🔍 Buscando cobranças confirmadas da conta ${conta.nome}...`);
        
        try {
          // Buscar cobranças confirmadas
          const paymentsResponse = await fetch('https://www.asaas.com/api/v3/payments?status=CONFIRMED&limit=100', {
            headers: {
              'access_token': conta.apiKey,
              'Content-Type': 'application/json'
            }
          });

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            console.log(`💰 ${conta.nome}: ${paymentsData.totalCount || 0} cobranças confirmadas encontradas`);

            // Processar cada cobrança confirmada
            for (const payment of paymentsData.data || []) {
              try {
                // Evitar duplicatas baseado no customer ID + conta
                const clienteKey = `${payment.customer}_${conta.nome}`;
                if (clientesProcessados.has(clienteKey)) {
                  continue;
                }
                clientesProcessados.add(clienteKey);

                // Buscar dados do cliente
                const customerResponse = await fetch(`https://www.asaas.com/api/v3/customers/${payment.customer}`, {
                  headers: {
                    'access_token': conta.apiKey,
                    'Content-Type': 'application/json'
                  }
                });

                if (customerResponse.ok) {
                  const customer = await customerResponse.json();
                  
                  // Calcular próximo vencimento (30 dias a partir da última cobrança confirmada)
                  const dataUltimaCobranca = new Date(payment.paymentDate || payment.dueDate);
                  const proximoVencimento = new Date(dataUltimaCobranca);
                  proximoVencimento.setDate(proximoVencimento.getDate() + 30);
                  
                  // Verificar status baseado no vencimento
                  const hoje = new Date();
                  const diasRestantes = Math.ceil((proximoVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                  
                  let status = 'ATIVO';
                  if (diasRestantes < 0) {
                    status = 'VENCIDO';
                  }
                  
                  // Se tem cobrança confirmada, considerar ativo independente do vencimento
                  if (payment.status === 'CONFIRMED') {
                    status = 'ATIVO';
                  }

                  const cliente = {
                    id: `${payment.customer}_${conta.nome}`, // ID único
                    nomeCompleto: customer.name,
                    email: customer.email || '',
                    telefonePrincipal: customer.mobilePhone || customer.phone || '',
                    numeroDocumento: customer.cpfCnpj || '',
                    valorPlanoAtual: payment.value,
                    statusAssinatura: status,
                    dataUltimoPagamento: payment.paymentDate || payment.dueDate,
                    origem: conta.nome,
                    idAsaasPrincipal: conta.nome === 'ASAAS_TRATO' ? payment.customer : null,
                    idAsaasAndrey: conta.nome === 'ASAAS_ANDREY' ? payment.customer : null,
                    cidade: customer.city || '',
                    estado: customer.state || '',
                    createdAt: payment.dateCreated || new Date().toISOString(),
                    formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                                   payment.billingType === 'PIX' ? 'PIX' : 'Boleto',
                    proximoVencimento: proximoVencimento.toISOString(),
                    diasRestantes
                  };
                  
                  clientesConsolidados.push(cliente);
                }
              } catch (customerError) {
                console.error(`Erro ao buscar dados do cliente ${payment.customer}:`, customerError);
              }
            }
          }
        } catch (contaError) {
          console.error(`Erro ao buscar dados da conta ${conta.nome}:`, contaError);
        }
      }

      console.log(`📊 Total de clientes consolidados: ${clientesConsolidados.length}`);
      
      res.json({
        success: true,
        total: clientesConsolidados.length,
        clientes: clientesConsolidados
      });
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Validar integridade dos dados
  app.get("/api/v2/clientes/validar-integridade", async (req: Request, res: Response) => {
    try {
      const clientesMasterService = new ClientesMasterService();
      const problemas = await clientesMasterService.validarIntegridade();
      
      res.json({
        success: true,
        problemas
      });
    } catch (error) {
      console.error('Erro ao validar integridade:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Sincronização Asaas Principal
  app.post("/api/v2/sync/asaas-principal", async (req: Request, res: Response) => {
    try {
      const asaasService = new AsaasIntegrationService();
      const resultado = await asaasService.syncClientesPrincipal();
      res.json(resultado);
    } catch (error) {
      console.error('Erro na sincronização Principal:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro na sincronização com Asaas Principal' 
      });
    }
  });

  // Sincronização Asaas Andrey
  // Endpoint para sincronizar todos os clientes do Asaas
  app.post("/api/sync/clientes-asaas", async (req: Request, res: Response) => {
    try {
      const clientesSincronizados = [];
      
      // Configuração das duas contas Asaas
      const asaasAccounts = [
        {
          apiKey: process.env.ASAAS_TRATO,
          name: 'ASAAS_TRATO'
        },
        {
          apiKey: process.env.ASAAS_API_KEY,
          name: 'ASAAS_API_KEY'
        }
      ];

      const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
        ? 'https://www.asaas.com/api/v3' 
        : 'https://www.asaas.com/api/v3';

      // Buscar todos os clientes existentes
      const clientesExistentes = await storage.getAllClientes();
      
      for (const account of asaasAccounts) {
        if (!account.apiKey) {
          console.log(`❌ API Key não encontrada para ${account.name}`);
          continue;
        }
        
        console.log(`🔄 Sincronizando clientes da conta: ${account.name}`);
        
        // Buscar todos os pagamentos confirmados dos últimos 12 meses
        const umAnoAtras = new Date();
        umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
        const dataInicio = umAnoAtras.toISOString().split('T')[0];
        
        let offset = 0;
        const limit = 100;
        let hasMore = true;
        
        while (hasMore) {
          const paymentsResponse = await fetch(`${baseUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${dataInicio}&limit=${limit}&offset=${offset}`, {
            headers: {
              'access_token': account.apiKey,
              'Content-Type': 'application/json'
            }
          });

          if (!paymentsResponse.ok) {
            console.log(`❌ Erro ao buscar pagamentos de ${account.name}:`, paymentsResponse.status);
            break;
          }

          const paymentsData = await paymentsResponse.json();
          const payments = paymentsData.data || [];
          
          if (payments.length === 0) {
            hasMore = false;
            break;
          }

          // Processar pagamentos únicos por cliente
          const clientesUnicos = new Map();
          
          for (const payment of payments) {
            if (!clientesUnicos.has(payment.customer)) {
              clientesUnicos.set(payment.customer, payment);
            }
          }

          // Buscar dados dos clientes e criar/atualizar no banco
          for (const [customerId, payment] of clientesUnicos) {
            try {
              // Buscar dados do cliente
              const customerResponse = await fetch(`${baseUrl}/customers/${customerId}`, {
                headers: {
                  'access_token': account.apiKey,
                  'Content-Type': 'application/json'
                }
              });

              if (customerResponse.ok) {
                const customer = await customerResponse.json();
                
                // Verificar se cliente já existe
                const clienteExistente = clientesExistentes.find(c => 
                  c.asaasCustomerId === customerId || 
                  (c.email && customer.email && c.email.toLowerCase() === customer.email.toLowerCase())
                );

                if (!clienteExistente) {
                  // Calcular data de vencimento (30 dias após último pagamento)
                  const dataVencimento = new Date(payment.paymentDate || payment.confirmedDate);
                  dataVencimento.setDate(dataVencimento.getDate() + 30);

                  const novoCliente = await storage.createCliente({
                    nome: customer.name || 'Cliente Asaas',
                    email: customer.email || `cliente-${customerId}@asaas.temp`,
                    telefone: customer.phone || null,
                    cpf: customer.cpfCnpj || null,
                    asaasCustomerId: customerId,
                    origem: account.name,
                    planoNome: payment.description || 'Cobrança Asaas',
                    planoValor: payment.value.toString(),
                    formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                                   payment.billingType === 'PIX' ? 'PIX' : 
                                   payment.billingType === 'BOLETO' ? 'Boleto' : payment.billingType,
                    statusAssinatura: 'ATIVO',
                    dataInicioAssinatura: new Date(payment.paymentDate || payment.confirmedDate),
                    dataVencimentoAssinatura: dataVencimento
                  });
                  
                  clientesSincronizados.push({
                    ...novoCliente,
                    conta: account.name,
                    acao: 'CRIADO'
                  });
                  
                  console.log(`✅ Cliente criado: ${customer.name} (${account.name})`);
                } else {
                  // Atualizar dados se necessário
                  if (!clienteExistente.asaasCustomerId) {
                    await storage.updateCliente(clienteExistente.id, {
                      asaasCustomerId: customerId
                    });
                    
                    clientesSincronizados.push({
                      ...clienteExistente,
                      conta: account.name,
                      acao: 'ATUALIZADO'
                    });
                    
                    console.log(`🔄 Cliente atualizado: ${customer.name} (${account.name})`);
                  }
                }
              }
            } catch (error) {
              console.log(`❌ Erro ao processar cliente ${customerId}:`, error);
            }
          }

          offset += limit;
          
          // Se retornou menos que o limite, não há mais dados
          if (payments.length < limit) {
            hasMore = false;
          }
        }
      }

      res.json({
        success: true,
        message: `Sincronização concluída. ${clientesSincronizados.length} clientes processados.`,
        clientes: clientesSincronizados,
        total: clientesSincronizados.length
      });

    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  app.post("/api/v2/sync/asaas-andrey", async (req: Request, res: Response) => {
    try {
      const asaasService = new AsaasIntegrationService();
      const resultado = await asaasService.syncClientesAndrey();
      res.json(resultado);
    } catch (error) {
      console.error('Erro na sincronização Andrey:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro na sincronização com Asaas Andrey' 
      });
    }
  });

  // Criar assinatura via API Asaas (seguindo documentação oficial)
  app.post("/api/asaas/criar-assinatura", async (req: Request, res: Response) => {
    try {
      const { 
        customer,
        billingType,
        value,
        nextDueDate,
        description,
        cycle,
        discount,
        interest,
        fine,
        maxPayments
      } = req.body;

      if (!customer || !billingType || !value || !nextDueDate) {
        return res.status(400).json({ 
          error: 'Campos obrigatórios: customer, billingType, value, nextDueDate' 
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      
      if (!asaasApiKey) {
        return res.status(500).json({ 
          error: 'Chave da API Asaas não configurada. Configure ASAAS_TRATO nas variáveis de ambiente.' 
        });
      }

      // Criar assinatura seguindo exatamente a documentação do Asaas
      const subscriptionData = {
        customer,
        billingType,
        value: parseFloat(value),
        nextDueDate,
        description: description || 'Assinatura Trato de Barbados',
        cycle: cycle || 'MONTHLY',
        ...(discount && { discount: {
          value: parseFloat(discount.value),
          dueDateLimitDays: discount.dueDateLimitDays || 0
        }}),
        ...(interest && { interest: { value: parseFloat(interest.value) }}),
        ...(fine && { fine: { value: parseFloat(fine.value) }}),
        ...(maxPayments && { maxPayments: parseInt(maxPayments) })
      };

      console.log('🔄 Criando assinatura no Asaas:', subscriptionData);

      const response = await fetch('https://www.asaas.com/api/v3/subscriptions', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Erro ao criar assinatura:', responseData);
        return res.status(response.status).json({
          error: 'Erro ao criar assinatura no Asaas',
          details: responseData
        });
      }

      console.log('✅ Assinatura criada com sucesso:', responseData);

      // Criar link de checkout para a assinatura
      const checkoutResponse = await fetch(`https://www.asaas.com/api/v3/subscriptions/${responseData.id}/paymentBook`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (checkoutResponse.ok) {
        const checkoutData = await checkoutResponse.json();
        console.log('✅ Checkout da assinatura criado:', checkoutData);
        
        res.json({
          success: true,
          subscription: responseData,
          checkoutUrl: checkoutData.url,
          message: 'Assinatura e checkout criados com sucesso!'
        });
      } else {
        console.log('⚠️ Assinatura criada, mas checkout não pôde ser gerado');
        res.json({
          success: true,
          subscription: responseData,
          message: 'Assinatura criada! Cliente receberá cobrança por email.'
        });
      }

    } catch (error) {
      console.error('❌ Erro interno ao criar assinatura:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  });

  // Endpoint para criar plano de assinatura e gerar paymentLink automaticamente
  app.post("/api/assinatura/criar-plano", async (req: Request, res: Response) => {
    try {
      const { nome, descricao, valorMensal, categoria, servicosIncluidos } = req.body;

      if (!nome || !valorMensal) {
        return res.status(400).json({ 
          error: 'Nome e valor mensal são obrigatórios' 
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      
      if (!asaasApiKey) {
        return res.status(500).json({ 
          error: 'Chave da API Asaas não configurada' 
        });
      }

      // 1. Salvar plano no banco de dados
      const novoPlano = await db.insert(planosAssinatura).values({
        nome,
        descricao,
        valorMensal,
        categoria,
        servicosIncluidos: servicosIncluidos || []
      }).returning();

      const plano = novoPlano[0];
      
      // 2. Criar paymentLink no Asaas usando dados do plano
      const payload = {
        billingType: "CREDIT_CARD",
        chargeType: "RECURRENT",
        name: plano.nome,
        description: plano.descricao || `Assinatura ${plano.nome} - Renovação mensal automática`,
        value: parseFloat(plano.valorMensal),
        subscriptionCycle: "MONTHLY",
        dueDateLimitDays: 7,
        maxInstallmentCount: 1,
        notificationEnabled: true
      };

      console.log('Criando paymentLink para plano:', plano.nome, payload);

      const paymentLinkResponse = await fetch('https://www.asaas.com/api/v3/paymentLinks', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!paymentLinkResponse.ok) {
        const errorData = await paymentLinkResponse.json();
        console.error('Erro ao criar paymentLink:', errorData);
        
        // Remover plano do banco se falhou no Asaas
        await db.delete(planosAssinatura).where(eq(planosAssinatura.id, plano.id));
        
        return res.status(400).json({ 
          error: 'Erro ao criar link de pagamento no Asaas',
          details: errorData
        });
      }

      const paymentLinkData = await paymentLinkResponse.json();
      console.log('✅ PaymentLink criado:', paymentLinkData.url);

      // 3. Atualizar plano com URL do paymentLink
      await db.update(planosAssinatura)
        .set({ 
          asaasPaymentLinkId: paymentLinkData.id,
          asaasPaymentLinkUrl: paymentLinkData.url 
        })
        .where(eq(planosAssinatura.id, plano.id));

      res.json({
        success: true,
        plano: {
          ...plano,
          asaasPaymentLinkId: paymentLinkData.id,
          asaasPaymentLinkUrl: paymentLinkData.url
        },
        checkoutUrl: paymentLinkData.url
      });

    } catch (error) {
      console.error('Erro ao criar plano:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }
  });

  // API REST para fluxo completo: cadastrar cliente + criar paymentLink
  app.post("/api/create-customer-subscription", async (req: Request, res: Response) => {
    try {
      const { cliente, assinatura } = req.body;
      
      // Validação dos dados obrigatórios
      if (!cliente || !assinatura) {
        return res.status(400).json({
          error: 'Dados obrigatórios: cliente e assinatura'
        });
      }
      
      const { name, email, cpfCnpj, phone } = cliente;
      const { name: planName, description, value, subscriptionCycle } = assinatura;
      
      if (!name || !email || !cpfCnpj || !phone) {
        return res.status(400).json({
          error: 'Dados obrigatórios do cliente: name, email, cpfCnpj, phone'
        });
      }
      
      if (!planName || !description || !value || !subscriptionCycle) {
        return res.status(400).json({
          error: 'Dados obrigatórios da assinatura: name, description, value, subscriptionCycle'
        });
      }
      
      if (typeof value !== 'number' || value <= 0) {
        return res.status(400).json({
          error: 'O valor deve ser um número maior que zero'
        });
      }
      
      const validCycles = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'];
      if (!validCycles.includes(subscriptionCycle)) {
        return res.status(400).json({
          error: `subscriptionCycle deve ser um dos valores: ${validCycles.join(', ')}`
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      
      if (!asaasApiKey) {
        return res.status(500).json({ 
          error: 'Token de API do Asaas não configurado' 
        });
      }
      
      console.log('🔍 Verificando se cliente já existe no Asaas:', cpfCnpj);
      
      // Etapa 1: Verificar se cliente já existe no Asaas
      let customerId = null;
      const existingCustomerResponse = await fetch(`https://www.asaas.com/api/v3/customers?cpfCnpj=${cpfCnpj}`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (existingCustomerResponse.ok) {
        const existingCustomerData = await existingCustomerResponse.json();
        if (existingCustomerData.data && existingCustomerData.data.length > 0) {
          customerId = existingCustomerData.data[0].id;
          console.log('✅ Cliente já existe no Asaas:', customerId);
        }
      }
      
      // Etapa 2: Cadastrar cliente no Asaas se não existir
      if (!customerId) {
        console.log('🚀 Cadastrando novo cliente no Asaas:', JSON.stringify(cliente, null, 2));
        
        const customerData = {
          name: name,
          email: email,
          cpfCnpj: cpfCnpj.replace(/\D/g, ''), // Remove caracteres não numéricos
          phone: phone.replace(/\D/g, '') // Remove caracteres não numéricos
        };
        
        const customerResponse = await fetch('https://www.asaas.com/api/v3/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey
          },
          body: JSON.stringify(customerData)
        });
        
        const customerResponseData = await customerResponse.json();
        
        if (!customerResponse.ok) {
          console.error('❌ Erro ao cadastrar cliente:', customerResponseData);
          return res.status(customerResponse.status).json({
            error: 'Erro ao cadastrar cliente no Asaas',
            asaasError: customerResponseData
          });
        }
        
        customerId = customerResponseData.id;
        console.log('✅ Cliente cadastrado no Asaas:', customerId);
      }
      
      // Etapa 3: Criar assinatura recorrente verdadeira
      console.log('🚀 Criando assinatura recorrente no Asaas:', JSON.stringify({
        customer: customerId,
        name: planName,
        description,
        value,
        subscriptionCycle
      }, null, 2));
      
      const subscriptionData = {
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: parseFloat(value.toString()),
        nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cycle: subscriptionCycle,
        description: `${planName} - ${description}`,
        externalReference: `subscription_${Date.now()}`
      };
      
      const subscriptionResponse = await fetch('https://www.asaas.com/api/v3/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        },
        body: JSON.stringify(subscriptionData)
      });
      
      const subscriptionResponseData = await subscriptionResponse.json();
      
      if (!subscriptionResponse.ok) {
        console.error('❌ Erro ao criar assinatura:', subscriptionResponseData);
        return res.status(subscriptionResponse.status).json({
          error: 'Erro ao criar assinatura no Asaas',
          asaasError: subscriptionResponseData
        });
      }
      
      console.log('✅ Assinatura criada com sucesso:', subscriptionResponseData.id);
      
      // Aguardar um pouco para a primeira cobrança ser gerada
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Etapa 4: Buscar primeira cobrança da assinatura
      const paymentsResponse = await fetch(`https://www.asaas.com/api/v3/payments?subscription=${subscriptionResponseData.id}&limit=1`, {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        
        if (paymentsData.data && paymentsData.data.length > 0) {
          const firstPayment = paymentsData.data[0];
          console.log('✅ Primeira cobrança da assinatura encontrada:', firstPayment.id);
          
          // Gerar paymentBook da primeira cobrança (formato /i/)
          const paymentBookResponse = await fetch(`https://www.asaas.com/api/v3/payments/${firstPayment.id}/paymentBook`, {
            method: 'POST',
            headers: {
              'access_token': asaasApiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (paymentBookResponse.ok) {
            const paymentBookData = await paymentBookResponse.json();
            console.log('✅ PaymentBook criado (formato /i/):', paymentBookData.url);
            
            // Retornar dados completos
            // Disparar sincronização automática após criação da assinatura
            try {
              console.log('🔄 Disparando sincronização automática após criação de assinatura...');
              if (typeof global.triggerAsaasSync === 'function') {
                global.triggerAsaasSync();
              }
            } catch (error) {
              console.log('⚠️ Erro ao disparar sincronização automática:', error);
            }

            res.json({
              success: true,
              customer: {
                id: customerId,
                name: name,
                email: email,
                cpfCnpj: cpfCnpj,
                phone: phone
              },
              subscription: {
                id: subscriptionResponseData.id,
                name: planName,
                description: description,
                value: value,
                cycle: subscriptionCycle
              },
              paymentLink: {
                id: firstPayment.id,
                url: paymentBookData.url,
                name: planName,
                description: description,
                value: value,
                subscriptionCycle: subscriptionCycle
              },
              message: 'Cliente e assinatura recorrente criados com sucesso'
            });
            return;
          }
          
          // Fallback: usar invoiceUrl da cobrança
          const paymentUrl = firstPayment.invoiceUrl || `https://www.asaas.com/i/${firstPayment.id}`;
          console.log('✅ Usando URL da primeira cobrança:', paymentUrl);
          
          // Disparar sincronização automática após criação da assinatura
          try {
            console.log('🔄 Disparando sincronização automática após criação de assinatura...');
            if (typeof global.triggerAsaasSync === 'function') {
              global.triggerAsaasSync();
            }
          } catch (error) {
            console.log('⚠️ Erro ao disparar sincronização automática:', error);
          }

          res.json({
            success: true,
            customer: {
              id: customerId,
              name: name,
              email: email,
              cpfCnpj: cpfCnpj,
              phone: phone
            },
            subscription: {
              id: subscriptionResponseData.id,
              name: planName,
              description: description,
              value: value,
              cycle: subscriptionCycle
            },
            paymentLink: {
              id: firstPayment.id,
              url: paymentUrl,
              name: planName,
              description: description,
              value: value,
              subscriptionCycle: subscriptionCycle
            },
            message: 'Cliente e assinatura recorrente criados com sucesso'
          });
          return;
        }
      }
      
      // Fallback final: usar invoiceUrl da assinatura
      const finalUrl = subscriptionResponseData.invoiceUrl || `https://www.asaas.com/subscriptions/${subscriptionResponseData.id}`;
      console.log('✅ Usando URL da assinatura (fallback):', finalUrl);
      
      // Retornar dados completos com fallback
      res.json({
        success: true,
        customer: {
          id: customerId,
          name: name,
          email: email,
          cpfCnpj: cpfCnpj,
          phone: phone
        },
        subscription: {
          id: subscriptionResponseData.id,
          name: planName,
          description: description,
          value: value,
          cycle: subscriptionCycle
        },
        paymentLink: {
          id: subscriptionResponseData.id,
          url: finalUrl,
          name: planName,
          description: description,
          value: value,
          subscriptionCycle: subscriptionCycle
        },
        message: 'Cliente e assinatura recorrente criados com sucesso'
      });
      
    } catch (error) {
      console.error('💥 Erro geral:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Endpoint de teste para verificar se a API está funcionando
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'OK',
      message: 'API funcionando',
      timestamp: new Date().toISOString()
    });
  });

  // Endpoint para testar conexão com Asaas
  app.get('/api/test-asaas', async (req: Request, res: Response) => {
    try {
      const asaasApiKey = process.env.ASAAS_TRATO;
      
      if (!asaasApiKey) {
        return res.status(500).json({
          success: false,
          message: 'Token de API do Asaas não configurado'
        });
      }

      const response = await fetch('https://www.asaas.com/api/v3/customers', {
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      res.json({
        success: true,
        message: 'Conexão com Asaas OK',
        status: response.status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro na conexão com Asaas',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Rotas de callback para o checkout do Asaas
  app.get('/pagamento/sucesso', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pagamento Realizado</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8ff; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; }
          .btn { background: #365e78; color: white; padding: 12px 24px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅ Pagamento Realizado com Sucesso!</div>
          <div class="message">Sua assinatura foi ativada. Você receberá um e-mail de confirmação em breve.</div>
          <a href="/" class="btn">Voltar ao Site</a>
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
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fff5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .cancelled { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; }
          .btn { background: #365e78; color: white; padding: 12px 24px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="cancelled">❌ Pagamento Cancelado</div>
          <div class="message">Você cancelou o pagamento. Tente novamente quando estiver pronto.</div>
          <a href="/" class="btn">Voltar ao Site</a>
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
        <title>Checkout Expirado</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fffbf0; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .expired { color: #ffc107; font-size: 24px; margin-bottom: 20px; }
          .message { color: #666; margin-bottom: 30px; }
          .btn { background: #365e78; color: white; padding: 12px 24px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="expired">⏰ Checkout Expirado</div>
          <div class="message">O tempo para completar o pagamento expirou. Tente novamente.</div>
          <a href="/" class="btn">Voltar ao Site</a>
        </div>
      </body>
      </html>
    `);
  });

  // Webhook do Asaas para capturar pagamentos confirmados automaticamente
  app.post('/webhook/asaas', async (req: Request, res: Response) => {
    try {
      console.log('🔔 Webhook Asaas recebido:', JSON.stringify(req.body, null, 2));
      
      const { event, payment } = req.body;
      
      if (!event || !payment) {
        console.log('❌ Webhook inválido: dados faltando');
        return res.status(400).json({ error: 'Dados inválidos no webhook' });
      }

      console.log(`📋 Evento: ${event} | Pagamento: ${payment.id} | Cliente: ${payment.customer}`);

      // Determinar qual API usar baseado no payment ou customer
      let apiKey = process.env.ASAAS_API_KEY; // Padrão
      let accountName = 'ASAAS_API_KEY';
      
      // Processar eventos de pagamento
      if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event)) {
        console.log(`✅ Pagamento confirmado: ${payment.id} | Valor: R$ ${payment.value}`);
        
        await processarPagamentoConfirmado(payment, apiKey, accountName);
        
      } else if (['PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_OVERDUE'].includes(event)) {
        console.log(`❌ Pagamento cancelado/estornado/vencido: ${payment.id}`);
        
        await processarPagamentoCancelado(payment);
        
      } else if (event === 'PAYMENT_UPDATED') {
        console.log(`🔄 Status do pagamento atualizado: ${payment.id} | Status: ${payment.status}`);
        
        if (['RECEIVED', 'CONFIRMED'].includes(payment.status)) {
          await processarPagamentoConfirmado(payment, apiKey, accountName);
        } else if (['CANCELLED', 'REFUNDED', 'OVERDUE'].includes(payment.status)) {
          await processarPagamentoCancelado(payment);
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Webhook processado com sucesso',
        event: event,
        paymentId: payment.id
      });
      
    } catch (error) {
      console.error('💥 Erro no webhook Asaas:', error);
      res.status(500).json({ 
        success: false,
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Função para processar pagamento confirmado
  async function processarPagamentoConfirmado(payment: any, apiKey: string, accountName: string) {
    try {
      const baseUrl = 'https://www.asaas.com/api/v3';
      
      // Buscar dados completos do cliente
      let customer = null;
      
      // Tentar com a API principal
      try {
        const customerResponse = await fetch(`${baseUrl}/customers/${payment.customer}`, {
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (customerResponse.ok) {
          customer = await customerResponse.json();
          console.log(`👤 Dados do cliente obtidos com ${accountName}:`, customer.name);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao buscar cliente com ${accountName}, tentando ASAAS_TRATO...`);
      }

      // Se não conseguiu com a primeira API, tentar com ASAAS_TRATO
      if (!customer && process.env.ASAAS_TRATO) {
        try {
          const customerResponse = await fetch(`${baseUrl}/customers/${payment.customer}`, {
            headers: {
              'access_token': process.env.ASAAS_TRATO,
              'Content-Type': 'application/json'
            }
          });

          if (customerResponse.ok) {
            customer = await customerResponse.json();
            accountName = 'ASAAS_TRATO';
            console.log(`👤 Dados do cliente obtidos com ASAAS_TRATO:`, customer.name);
          }
        } catch (error) {
          console.log(`❌ Erro ao buscar cliente com ASAAS_TRATO também`);
        }
      }

      if (!customer) {
        console.log(`❌ Não foi possível obter dados do cliente ${payment.customer}`);
        return;
      }

      // Verificar se cliente já existe no sistema
      const clientesExistentes = await storage.getAllClientes();
      const clienteExistente = clientesExistentes.find(c => 
        c.asaasCustomerId === payment.customer || 
        (c.email && customer.email && c.email.toLowerCase() === customer.email.toLowerCase())
      );

      if (!clienteExistente) {
        // Criar novo cliente
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 30); // 30 dias de validade

        const novoCliente = await storage.createCliente({
          nome: customer.name || 'Cliente Asaas',
          email: customer.email || `cliente-${payment.customer}@asaas.temp`,
          telefone: customer.phone || null,
          cpf: customer.cpfCnpj || null,
          asaasCustomerId: payment.customer,
          origem: accountName,
          planoNome: payment.description || 'Pagamento Asaas',
          planoValor: payment.value.toString(),
          formaPagamento: payment.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                         payment.billingType === 'PIX' ? 'PIX' : 
                         payment.billingType === 'BOLETO' ? 'Boleto' : payment.billingType,
          statusAssinatura: 'ATIVO',
          dataInicioAssinatura: new Date(payment.paymentDate || payment.dateCreated),
          dataVencimentoAssinatura: dataVencimento
        });
        
        console.log(`✅ Novo cliente criado via webhook: ${customer.name} (ID: ${novoCliente.id})`);
        
      } else {
        // Atualizar cliente existente
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 30);

        await storage.updateCliente(clienteExistente.id, {
          statusAssinatura: 'ATIVO',
          dataVencimentoAssinatura: dataVencimento,
          asaasCustomerId: payment.customer // Garantir que o ID Asaas está salvo
        });
        
        console.log(`🔄 Cliente atualizado via webhook: ${customer.name} (ID: ${clienteExistente.id}) - Status: ATIVO`);
      }
      
    } catch (error) {
      console.error('💥 Erro ao processar pagamento confirmado:', error);
    }
  }

  // Função para processar pagamento cancelado/estornado/vencido
  async function processarPagamentoCancelado(payment: any) {
    try {
      // Buscar cliente pelo ID do Asaas
      const clientesExistentes = await storage.getAllClientes();
      const clienteExistente = clientesExistentes.find(c => c.asaasCustomerId === payment.customer);

      if (clienteExistente) {
        await storage.updateCliente(clienteExistente.id, {
          statusAssinatura: 'CANCELADO'
        });
        
        console.log(`❌ Cliente marcado como CANCELADO via webhook: ID ${clienteExistente.id}`);
      } else {
        console.log(`⚠️ Cliente não encontrado para cancelamento: ${payment.customer}`);
      }
      
    } catch (error) {
      console.error('💥 Erro ao processar pagamento cancelado:', error);
    }
  }

  app.post("/api/asaas/criar-cliente", async (req: Request, res: Response) => {
    try {
      const {
        name,
        email,
        phone,
        mobilePhone,
        cpfCnpj,
        postalCode,
        address,
        addressNumber,
        complement,
        province,
        city,
        state,
        country,
        externalReference,
        notificationDisabled,
        additionalEmails,
        municipalInscription,
        stateInscription,
        observations
      } = req.body;

      if (!name || !email) {
        return res.status(400).json({ 
          error: 'Nome e email são obrigatórios' 
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      
      if (!asaasApiKey) {
        return res.status(500).json({ 
          error: 'Chave da API Asaas não configurada. Configure ASAAS_TRATO nas variáveis de ambiente.' 
        });
      }

      // Criar cliente seguindo a documentação do Asaas
      const customerData = {
        name,
        email,
        ...(phone && { phone }),
        ...(mobilePhone && { mobilePhone }),
        ...(cpfCnpj && { cpfCnpj }),
        ...(postalCode && { postalCode }),
        ...(address && { address }),
        ...(addressNumber && { addressNumber }),
        ...(complement && { complement }),
        ...(province && { province }),
        ...(city && { city }),
        ...(state && { state }),
        ...(country && { country }),
        ...(externalReference && { externalReference }),
        ...(notificationDisabled !== undefined && { notificationDisabled }),
        ...(additionalEmails && { additionalEmails }),
        ...(municipalInscription && { municipalInscription }),
        ...(stateInscription && { stateInscription }),
        ...(observations && { observations })
      };

      console.log('🔄 Criando cliente no Asaas:', { name, email });

      const response = await fetch('https://www.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Erro ao criar cliente:', responseData);
        return res.status(response.status).json({
          error: 'Erro ao criar cliente no Asaas',
          details: responseData
        });
      }

      console.log('✅ Cliente criado com sucesso:', responseData);

      res.json({
        success: true,
        customer: responseData,
        message: 'Cliente criado com sucesso!'
      });

    } catch (error) {
      console.error('❌ Erro interno ao criar cliente:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
