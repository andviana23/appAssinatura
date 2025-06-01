import type { Express } from "express";
import { createServer, type Server } from "http";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { storage } from "./storage";
import { insertBarbeiroSchema, insertServicoSchema, insertPlanoAssinaturaSchema, insertUserSchema, insertAtendimentoDiarioSchema, insertAgendamentoSchema, insertClienteSchema } from "@shared/schema";
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

  // Endpoint para verificar chaves PIX disponíveis
  app.get('/api/asaas/pix-keys', async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnvironment = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Configuração da API Asaas não encontrada' });
      }

      const baseUrl = asaasEnvironment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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

  // Rota para clientes unificados (Asaas + Externos)
  app.get("/api/clientes/unified", requireAuth, async (req, res) => {
    try {
      const clientesUnificados = [];
      
      // Buscar todos os clientes do banco local
      const clientesExternos = await storage.getAllClientes();
      const hoje = new Date();
      
      // Adicionar clientes externos (cadastrados diretamente no banco)
      for (const cliente of clientesExternos) {
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
              origem: cliente.asaasCustomerId ? 'ASAAS' : 'EXTERNO'
            });
          }
        }
      }

      // Buscar cobranças confirmadas do Asaas no mês atual
      const asaasApiKey = process.env.ASAAS_API_KEY;
      if (asaasApiKey) {
        try {
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://api.asaas.com/v3' 
            : 'https://sandbox.asaas.com/api/v3';

          // Buscar cobranças confirmadas do mês atual
          const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
          const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
          
          const paymentsResponse = await fetch(`${baseUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${inicioMes}&receivedInCashDate[le]=${fimMes}&limit=100`, {
            headers: {
              'access_token': asaasApiKey,
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
                    'access_token': asaasApiKey,
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
            
            // Adicionar clientes únicos à lista
            clientesUnificados.push(...Array.from(clientesUnicos.values()));
          }
        } catch (asaasError) {
          console.error("Erro ao buscar dados do Asaas:", asaasError);
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

      // Contar clientes externos ativos
      const clientesExternos = await storage.getAllClientes();
      for (const cliente of clientesExternos) {
        if (cliente.dataVencimentoAssinatura) {
          const validade = new Date(cliente.dataVencimentoAssinatura);
          if (validade >= hoje) {
            totalExternalClients++;
            totalActiveClients++;
            totalMonthlyRevenue += parseFloat(cliente.planoValor?.toString() || '0');
            
            const dataInicio = new Date(cliente.dataInicioAssinatura || cliente.createdAt);
            if (dataInicio >= inicioMes) {
              newClientsThisMonth++;
            }
          }
        }
      }

      // Buscar estatísticas das cobranças confirmadas do Asaas no mês atual
      const asaasApiKey = process.env.ASAAS_API_KEY;
      if (asaasApiKey) {
        try {
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://api.asaas.com/v3' 
            : 'https://sandbox.asaas.com/api/v3';

          // Buscar cobranças confirmadas do mês atual
          const inicioMesStr = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
          const fimMesStr = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
          
          const paymentsResponse = await fetch(`${baseUrl}/payments?status=CONFIRMED&receivedInCashDate[ge]=${inicioMesStr}&receivedInCashDate[le]=${fimMesStr}&limit=100`, {
            headers: {
              'access_token': asaasApiKey,
              'Content-Type': 'application/json'
            }
          });

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            
            // Contar clientes únicos que pagaram no mês
            const clientesUnicosAsaas = new Set();
            
            for (const payment of paymentsData.data || []) {
              clientesUnicosAsaas.add(payment.customer);
              totalMonthlyRevenue += payment.value || 0;
              
              const dataPagamento = new Date(payment.paymentDate || payment.confirmedDate);
              if (dataPagamento >= inicioMes) {
                newClientsThisMonth++;
              }
            }
            
            totalAsaasClients = clientesUnicosAsaas.size;
            totalActiveClients += totalAsaasClients;
          }
        } catch (asaasError) {
          console.error("Erro ao buscar stats do Asaas:", asaasError);
        }
      }

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
            ? 'https://api.asaas.com/v3' 
            : 'https://sandbox.asaas.com/api/v3';

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
      const validatedData = insertAgendamentoSchema.parse(req.body);
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
      
      // Buscar receita total de assinatura
      const clientesStats = await storage.getClientesUnifiedStats();
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
      const { nome, email, cpf, paymentMethod, planoNome, planoValor } = req.body;

      if (!nome || !email || !paymentMethod || !planoNome) {
        return res.status(400).json({ message: 'Dados obrigatórios não fornecidos' });
      }

      // Data de início: agora
      const dataInicio = new Date();
      // Data de vencimento: 30 dias corridos
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const cliente = await storage.createCliente({
        nome,
        email,
        cpf: cpf || null,
        planoNome,
        planoValor: planoValor.toString(),
        formaPagamento: paymentMethod,
        statusAssinatura: 'ATIVO',
        dataInicioAssinatura: dataInicio,
        dataVencimentoAssinatura: dataVencimento,
      });

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

  // Endpoint para criar link de pagamento personalizado do Asaas
  app.post('/api/asaas/checkout', async (req, res) => {
    try {
      const asaasApiKey = process.env.ASAAS_API_KEY;
      const asaasEnvironment = process.env.ASAAS_ENVIRONMENT || 'sandbox';
      
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Configuração da API Asaas não encontrada' });
      }

      const baseUrl = asaasEnvironment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

      const { nome, email, cpf, billingType } = req.body;

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
      
      let chargePayload: any = {
        customer: customerId,
        billingType: billingType || 'CREDIT_CARD',
        value: 5.00,
        dueDate: tomorrow.toISOString().split('T')[0],
        description: 'Clube do Trato Único - Teste de Funcionalidade',
        externalReference: `teste-${Date.now()}`
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
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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

  // === LISTA DA VEZ ===

  // GET /api/lista-da-vez/fila-mensal/:mes - Obter fila mensal completa (Recepcionista)
  app.get('/api/lista-da-vez/fila-mensal/:mes', requireAuth, async (req, res) => {
    try {
      const { mes } = req.params; // formato "YYYY-MM"
      
      if (req.session.userRole !== 'admin' && req.session.userRole !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const filaMensal = await storage.getFilaMensal(mes);
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

  const httpServer = createServer(app);
  return httpServer;
}
