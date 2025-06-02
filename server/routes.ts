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
  // Lista todos os clientes (Asaas + Externos) de forma unificada
  app.get("/api/clientes-unified", requireAuth, async (req, res) => {
    try {
      const clientesUnificados = await storage.getAllClientesUnified();
      res.json(clientesUnificados);
    } catch (error) {
      console.error("Erro ao buscar clientes unificados:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Stats unificados (para Dashboard)
  app.get("/api/clientes-unified/stats", requireAuth, async (req, res) => {
    try {
      const { mes, ano } = req.query;
      const stats = await storage.getClientesUnifiedStats(mes as string, ano as string);
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de clientes:", error);
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
      const { nome, descricao, valor, categoria, billingType, cycle, limitesServicos, beneficios } = req.body;
      
      if (!nome || !valor || !categoria) {
        return res.status(400).json({ message: 'Nome, valor e categoria são obrigatórios' });
      }

      const novoPlano = await storage.createPlano({
        nome,
        descricao,
        valor,
        categoria,
        billingType: billingType || 'CREDIT_CARD',
        cycle: cycle || 'MONTHLY',
        limitesServicos: limitesServicos || {},
        beneficios: beneficios || [],
        ativo: true
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
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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
      
      // Primeiro, sincronizar clientes do Asaas (se houver)
      let clientesAsaasSincronizados = new Set();

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
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

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
      const clientesStats = await storage.getClientesUnifiedStats(mesNum, ano);
      
      // Calcular KPIs com dados reais do mês
      const totalAtendimentos = agendamentosFiltrados.length;
      
      // Receita real das assinaturas do mês vigente
      const receitaTotal = clientesStats.totalSubscriptionRevenue || 0;
      
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
            ? 'https://api.asaas.com/v3' 
            : 'https://sandbox.asaas.com/api/v3';
          
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

      // Buscar clientes do banco local primeiro
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

      // Buscar clientes da API do Asaas (mesma lógica do endpoint unificado)
      if (process.env.ASAAS_API_KEY) {
        try {
          const asaasApiKey = process.env.ASAAS_API_KEY;
          const baseUrl = process.env.ASAAS_ENVIRONMENT === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://sandbox.asaas.com/api/v3';

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
            ? 'https://api.asaas.com/v3' 
            : 'https://sandbox.asaas.com/api/v3';

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

  const httpServer = createServer(app);
  return httpServer;
}
