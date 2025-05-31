import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBarbeiroSchema, insertServicoSchema, insertPlanoAssinaturaSchema, insertUserSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";

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
        barbeiroId: user.barbeiroId
      });
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
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
    } catch (error) {
      console.error("Erro ao criar barbeiro:", error);
      res.status(400).json({ message: "Dados inválidos para criação do barbeiro" });
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
      const asaasResponse = await fetch("https://api.asaas.com/v3/customers", {
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

  // Asaas API Integration - Cobranças Recorrentes
  app.get("/api/asaas/clientes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: "Chave da API do Asaas não configurada" });
      }

      const baseUrl = asaasEnv === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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
                
                // Calcular dias restantes usando a data real da próxima cobrança
                const nextDue = new Date(subscription.nextDueDate);
                const today = new Date();
                const daysRemaining = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                subscriptions.push({
                  id: subscription.id,
                  subscriptionId: subscription.id,
                  customerId: customerData.id,
                  customerName: customerData.name,
                  customerEmail: customerData.email,
                  customerPhone: customerData.phone,
                  customerCpfCnpj: customerData.cpfCnpj,
                  status: subscription.status,
                  value: parseFloat(subscription.value),
                  cycle: subscription.cycle,
                  billingType: subscription.billingType,
                  nextDueDate: subscription.nextDueDate,
                  daysRemaining: daysRemaining,
                  description: subscription.description,
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
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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

      const stats = {
        totalActiveClients: activeData.totalCount || 0,
        totalMonthlyRevenue: totalMonthlyRevenue,
        newClientsThisMonth: newClientsThisMonth,
        overdueClients: overdueData.totalCount || 0 // Apenas OVERDUE são inadimplentes
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas do Asaas:", error);
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
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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

  const httpServer = createServer(app);
  return httpServer;
}
