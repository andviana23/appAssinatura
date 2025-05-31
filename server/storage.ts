import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { config } from "dotenv";

// Load environment variables
config();
import {
  barbeiros,
  servicos,
  planosAssinatura,
  clientes,
  distribuicoes,
  distribuicaoItens,
  comissoes,
  users,
  atendimentos,
  totalServicos,
  agendamentos,
  type Barbeiro,
  type InsertBarbeiro,
  type Servico,
  type InsertServico,
  type PlanoAssinatura,
  type InsertPlanoAssinatura,
  type Cliente,
  type InsertCliente,
  type Distribuicao,
  type InsertDistribuicao,
  type DistribuicaoItem,
  type InsertDistribuicaoItem,
  type Comissao,
  type InsertComissao,
  type User,
  type InsertUser,
  type Atendimento,
  type InsertAtendimento,
  type TotalServico,
  type InsertTotalServico,
} from "@shared/schema";

// Debug da conexão
console.log('DATABASE_URL existe:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL primeiro chars:', process.env.DATABASE_URL?.substring(0, 30));

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;

  // Barbeiros
  getAllBarbeiros(): Promise<Barbeiro[]>;
  getBarbeiroById(id: number): Promise<Barbeiro | undefined>;
  createBarbeiro(barbeiro: InsertBarbeiro): Promise<Barbeiro>;
  updateBarbeiro(id: number, barbeiro: Partial<InsertBarbeiro>): Promise<Barbeiro>;
  deleteBarbeiro(id: number): Promise<void>;

  // Serviços
  getAllServicos(): Promise<Servico[]>;
  getServicoById(id: number): Promise<Servico | undefined>;
  getServicosAssinatura(): Promise<Servico[]>;
  createServico(servico: InsertServico): Promise<Servico>;
  updateServico(id: number, servico: Partial<InsertServico>): Promise<Servico>;
  deleteServico(id: number): Promise<void>;

  // Planos de Assinatura
  getAllPlanos(): Promise<PlanoAssinatura[]>;
  getPlanoById(id: number): Promise<PlanoAssinatura | undefined>;
  createPlano(plano: InsertPlanoAssinatura): Promise<PlanoAssinatura>;
  updatePlano(id: number, plano: Partial<InsertPlanoAssinatura>): Promise<PlanoAssinatura>;
  deletePlano(id: number): Promise<void>;

  // Clientes
  getAllClientes(): Promise<Cliente[]>;
  getClienteById(id: number): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente>;
  getClientesUnifiedStats(): Promise<{
    totalActiveClients: number;
    totalSubscriptionRevenue: number;
    totalExpiringSubscriptions: number;
  }>;

  // Distribuições
  getAllDistribuicoes(): Promise<Distribuicao[]>;
  getDistribuicaoById(id: number): Promise<Distribuicao | undefined>;
  createDistribuicao(distribuicao: InsertDistribuicao): Promise<Distribuicao>;
  getDistribuicaoItens(distribuicaoId: number): Promise<DistribuicaoItem[]>;
  createDistribuicaoItem(item: InsertDistribuicaoItem): Promise<DistribuicaoItem>;

  // Comissões
  getComissoesByBarbeiro(barbeiroId: number): Promise<Comissao[]>;
  getComissoesByMes(mes: string): Promise<Comissao[]>;
  createComissao(comissao: InsertComissao): Promise<Comissao>;

  // Atendimentos
  getAllAtendimentos(): Promise<Atendimento[]>;
  getAtendimentosByBarbeiro(barbeiroId: number, mes?: string): Promise<Atendimento[]>;
  createAtendimento(atendimento: InsertAtendimento): Promise<Atendimento>;
  updateAtendimento(id: number, atendimento: Partial<InsertAtendimento>): Promise<Atendimento>;
  deleteAtendimento(id: number): Promise<void>;
  getAtendimentosResumo(barbeiroId: number, mes: string): Promise<Array<{
    servico: Servico;
    totalQuantidade: number;
    totalMinutos: number;
    dias: Array<{ data: string; quantidade: number }>;
  }>>;

  // Total de Serviços (Controle Admin)
  getTotalServicosByMes(mes: string): Promise<TotalServico[]>;
  createOrUpdateTotalServico(data: InsertTotalServico): Promise<TotalServico>;
  getTotalServicoByMesAndServico(mes: string, servicoId: number): Promise<TotalServico | undefined>;
  
  // Validações
  validateAtendimentoLimits(mes: string): Promise<{
    valid: boolean;
    violations: Array<{ servicoId: number; used: number; limit: number }>;
  }>;

  // Comissões calculadas em tempo real
  getComissaoAtualBarbeiro(barbeiroId: number, mes: string): Promise<{
    minutosTrabalhadosMes: number;
    comissaoCalculada: number;
    faturamentoProporcional: number;
    percentualParticipacao: number;
  }>;

  // Agendamentos
  getAllAgendamentos(): Promise<any[]>;
  getAgendamentosByDate(date: string): Promise<any[]>;
  createAgendamento(agendamento: any): Promise<any>;
  finalizarAgendamento(id: number): Promise<any>;

  // Métricas
  getDashboardMetrics(): Promise<{
    faturamentoMensal: number;
    assinaturasAtivas: number;
    horasTrabalhadas: number;
    comissoesPagas: number;
  }>;
  getBarbeiroRanking(): Promise<Array<{
    barbeiro: Barbeiro;
    faturamento: number;
    comissao: number;
    horas: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllBarbeiros(): Promise<Barbeiro[]> {
    return await db.select().from(barbeiros).orderBy(barbeiros.nome);
  }

  async getBarbeiroById(id: number): Promise<Barbeiro | undefined> {
    const [barbeiro] = await db.select().from(barbeiros).where(eq(barbeiros.id, id));
    return barbeiro;
  }

  async createBarbeiro(barbeiro: InsertBarbeiro): Promise<Barbeiro> {
    const [created] = await db.insert(barbeiros).values(barbeiro).returning();
    return created;
  }

  async updateBarbeiro(id: number, barbeiro: Partial<InsertBarbeiro>): Promise<Barbeiro> {
    const [updated] = await db
      .update(barbeiros)
      .set(barbeiro)
      .where(eq(barbeiros.id, id))
      .returning();
    return updated;
  }

  async deleteBarbeiro(id: number): Promise<void> {
    // Primeiro, atualizar usuários que referenciam este barbeiro
    await db
      .update(users)
      .set({ barbeiroId: null })
      .where(eq(users.barbeiroId, id));
    
    // Excluir agendamentos relacionados ao barbeiro
    await db.delete(agendamentos).where(eq(agendamentos.barbeiroId, id));
    
    // Excluir comissões relacionadas ao barbeiro
    await db.delete(comissoes).where(eq(comissoes.barbeiroId, id));
    
    // Excluir atendimentos relacionados ao barbeiro
    await db.delete(atendimentos).where(eq(atendimentos.barbeiroId, id));
    
    // Por fim, excluir o barbeiro
    await db.delete(barbeiros).where(eq(barbeiros.id, id));
  }

  async getAllServicos(): Promise<Servico[]> {
    return await db.select().from(servicos).orderBy(servicos.nome);
  }

  async getServicoById(id: number): Promise<Servico | undefined> {
    const [servico] = await db.select().from(servicos).where(eq(servicos.id, id));
    return servico;
  }

  async getServicosAssinatura(): Promise<Servico[]> {
    return await db.select().from(servicos).where(eq(servicos.isAssinatura, true));
  }

  async createServico(servico: InsertServico): Promise<Servico> {
    const [created] = await db.insert(servicos).values(servico).returning();
    return created;
  }

  async updateServico(id: number, servico: Partial<InsertServico>): Promise<Servico> {
    const [updated] = await db
      .update(servicos)
      .set(servico)
      .where(eq(servicos.id, id))
      .returning();
    return updated;
  }

  async deleteServico(id: number): Promise<void> {
    await db.delete(servicos).where(eq(servicos.id, id));
  }

  async getAllPlanos(): Promise<PlanoAssinatura[]> {
    return await db.select().from(planosAssinatura).orderBy(planosAssinatura.nome);
  }

  async getPlanoById(id: number): Promise<PlanoAssinatura | undefined> {
    const [plano] = await db.select().from(planosAssinatura).where(eq(planosAssinatura.id, id));
    return plano;
  }

  async createPlano(plano: InsertPlanoAssinatura): Promise<PlanoAssinatura> {
    const [created] = await db.insert(planosAssinatura).values({
      ...plano,
      servicosIncluidos: plano.servicosIncluidos as number[]
    }).returning();
    return created;
  }

  async updatePlano(id: number, plano: Partial<InsertPlanoAssinatura>): Promise<PlanoAssinatura> {
    const [updated] = await db
      .update(planosAssinatura)
      .set(plano)
      .where(eq(planosAssinatura.id, id))
      .returning();
    return updated;
  }

  async deletePlano(id: number): Promise<void> {
    await db.delete(planosAssinatura).where(eq(planosAssinatura.id, id));
  }

  async getAllClientes(): Promise<Cliente[]> {
    return await db.select().from(clientes).orderBy(clientes.nome);
  }

  async getClienteById(id: number): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
    return cliente;
  }

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    const [created] = await db.insert(clientes).values(cliente).returning();
    return created;
  }

  async updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente> {
    const [updated] = await db
      .update(clientes)
      .set(cliente)
      .where(eq(clientes.id, id))
      .returning();
    return updated;
  }

  async getClientesUnifiedStats(): Promise<{
    totalActiveClients: number;
    totalSubscriptionRevenue: number;
    totalExpiringSubscriptions: number;
  }> {
    const allClientes = await this.getAllClientes();
    
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    
    // Clientes ativos (que pagaram no mês atual)
    const activeClientes = allClientes.filter(cliente => {
      if (!cliente.dataInicioAssinatura) return false;
      const dataPagamento = new Date(cliente.dataInicioAssinatura);
      const paymentMonth = dataPagamento.toISOString().slice(0, 7);
      return paymentMonth === currentMonth && cliente.statusAssinatura === 'ATIVA';
    });
    
    // Receita total de assinatura
    const totalSubscriptionRevenue = activeClientes.reduce((total, cliente) => {
      if (!cliente.planoValor) return total;
      return total + parseFloat(cliente.planoValor.toString());
    }, 0);
    
    // Assinaturas expirando nos próximos 7 dias
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const expiringClientes = allClientes.filter(cliente => {
      if (!cliente.dataVencimentoAssinatura) return false;
      const validadeDate = new Date(cliente.dataVencimentoAssinatura);
      return validadeDate >= now && validadeDate <= nextWeek;
    });
    
    return {
      totalActiveClients: activeClientes.length,
      totalSubscriptionRevenue,
      totalExpiringSubscriptions: expiringClientes.length,
    };
  }

  async getAllDistribuicoes(): Promise<Distribuicao[]> {
    return await db.select().from(distribuicoes).orderBy(desc(distribuicoes.createdAt));
  }

  async getDistribuicaoById(id: number): Promise<Distribuicao | undefined> {
    const [distribuicao] = await db.select().from(distribuicoes).where(eq(distribuicoes.id, id));
    return distribuicao;
  }

  async createDistribuicao(distribuicao: InsertDistribuicao): Promise<Distribuicao> {
    const [created] = await db.insert(distribuicoes).values(distribuicao).returning();
    return created;
  }

  async getDistribuicaoItens(distribuicaoId: number): Promise<DistribuicaoItem[]> {
    return await db
      .select()
      .from(distribuicaoItens)
      .where(eq(distribuicaoItens.distribuicaoId, distribuicaoId));
  }

  async createDistribuicaoItem(item: InsertDistribuicaoItem): Promise<DistribuicaoItem> {
    const [created] = await db.insert(distribuicaoItens).values(item).returning();
    return created;
  }

  async getComissoesByBarbeiro(barbeiroId: number): Promise<Comissao[]> {
    return await db
      .select()
      .from(comissoes)
      .where(eq(comissoes.barbeiroId, barbeiroId))
      .orderBy(desc(comissoes.mes));
  }

  async getComissoesByMes(mes: string): Promise<Comissao[]> {
    return await db.select().from(comissoes).where(eq(comissoes.mes, mes));
  }

  async createComissao(comissao: InsertComissao): Promise<Comissao> {
    const [created] = await db.insert(comissoes).values(comissao).returning();
    return created;
  }

  // Métodos para Atendimentos
  async getAllAtendimentos(): Promise<Atendimento[]> {
    return await db.select().from(atendimentos).orderBy(desc(atendimentos.dataAtendimento));
  }

  async getAtendimentosByBarbeiro(barbeiroId: number, mes?: string): Promise<Atendimento[]> {
    if (mes) {
      return await db.select().from(atendimentos)
        .where(and(eq(atendimentos.barbeiroId, barbeiroId), eq(atendimentos.mes, mes)))
        .orderBy(desc(atendimentos.dataAtendimento));
    }
    return await db.select().from(atendimentos)
      .where(eq(atendimentos.barbeiroId, barbeiroId))
      .orderBy(desc(atendimentos.dataAtendimento));
  }

  async createAtendimento(atendimento: InsertAtendimento): Promise<Atendimento> {
    const [created] = await db.insert(atendimentos).values(atendimento).returning();
    return created;
  }

  async updateAtendimento(id: number, atendimento: Partial<InsertAtendimento>): Promise<Atendimento> {
    const [updated] = await db.update(atendimentos)
      .set(atendimento)
      .where(eq(atendimentos.id, id))
      .returning();
    return updated;
  }

  async deleteAtendimento(id: number): Promise<void> {
    await db.delete(atendimentos).where(eq(atendimentos.id, id));
  }

  async getAtendimentosResumo(barbeiroId: number, mes: string): Promise<Array<{
    servico: Servico;
    totalQuantidade: number;
    totalMinutos: number;
    dias: Array<{ data: string; quantidade: number }>;
  }>> {
    const atendimentosData = await db
      .select({
        atendimento: atendimentos,
        servico: servicos,
      })
      .from(atendimentos)
      .innerJoin(servicos, eq(atendimentos.servicoId, servicos.id))
      .where(and(
        eq(atendimentos.barbeiroId, barbeiroId),
        eq(atendimentos.mes, mes)
      ))
      .orderBy(atendimentos.dataAtendimento);

    // Agrupar por serviço
    const grouped = atendimentosData.reduce((acc, item) => {
      const servicoId = item.servico.id;
      if (!acc[servicoId]) {
        acc[servicoId] = {
          servico: item.servico,
          totalQuantidade: 0,
          totalMinutos: 0,
          dias: []
        };
      }
      
      acc[servicoId].totalQuantidade += item.atendimento.quantidade;
      acc[servicoId].totalMinutos += item.atendimento.quantidade * item.servico.tempoMinutos;
      
      const dataFormatted = item.atendimento.dataAtendimento.toISOString().split('T')[0];
      acc[servicoId].dias.push({
        data: dataFormatted,
        quantidade: item.atendimento.quantidade
      });
      
      return acc;
    }, {} as Record<number, any>);

    return Object.values(grouped);
  }

  // Métodos para Total de Serviços
  async getTotalServicosByMes(mes: string): Promise<TotalServico[]> {
    return await db.select().from(totalServicos)
      .where(eq(totalServicos.mes, mes))
      .orderBy(totalServicos.servicoId);
  }

  async getTotalServicoByMesAndServico(mes: string, servicoId: number): Promise<TotalServico | undefined> {
    const [result] = await db.select().from(totalServicos)
      .where(and(eq(totalServicos.mes, mes), eq(totalServicos.servicoId, servicoId)));
    return result;
  }

  async createOrUpdateTotalServico(data: InsertTotalServico): Promise<TotalServico> {
    const existing = await this.getTotalServicoByMesAndServico(data.mes, data.servicoId);
    
    if (existing) {
      const [updated] = await db.update(totalServicos)
        .set({ totalMes: data.totalMes })
        .where(eq(totalServicos.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(totalServicos).values(data).returning();
      return created;
    }
  }

  async validateAtendimentoLimits(mes: string): Promise<{
    valid: boolean;
    violations: Array<{ servicoId: number; used: number; limit: number }>;
  }> {
    const totaisServicos = await this.getTotalServicosByMes(mes);
    const violations = [];

    for (const totalServico of totaisServicos) {
      const [usedResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${atendimentos.quantidade}), 0)`,
        })
        .from(atendimentos)
        .where(and(
          eq(atendimentos.mes, mes),
          eq(atendimentos.servicoId, totalServico.servicoId)
        ));

      const used = Number(usedResult?.total || 0);
      
      if (used > totalServico.totalMes) {
        violations.push({
          servicoId: totalServico.servicoId,
          used,
          limit: totalServico.totalMes
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  async getComissaoAtualBarbeiro(barbeiroId: number, mes: string): Promise<{
    minutosTrabalhadosMes: number;
    comissaoCalculada: number;
    faturamentoProporcional: number;
    percentualParticipacao: number;
  }> {
    // Buscar atendimentos do barbeiro no mês
    const atendimentosBarbeiro = await db
      .select({
        atendimento: atendimentos,
        servico: servicos,
      })
      .from(atendimentos)
      .innerJoin(servicos, eq(atendimentos.servicoId, servicos.id))
      .where(and(
        eq(atendimentos.barbeiroId, barbeiroId),
        eq(atendimentos.mes, mes)
      ));

    // Calcular minutos trabalhados pelo barbeiro
    const minutosTrabalhadosMes = atendimentosBarbeiro.reduce((total, item) => {
      return total + (item.atendimento.quantidade * item.servico.tempoMinutos);
    }, 0);

    // Buscar total de minutos de todos os barbeiros no mês
    const [totalMinutosResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${atendimentos.quantidade} * ${servicos.tempoMinutos}), 0)`,
      })
      .from(atendimentos)
      .innerJoin(servicos, eq(atendimentos.servicoId, servicos.id))
      .where(eq(atendimentos.mes, mes));

    const totalMinutosMes = Number(totalMinutosResult?.total || 0);

    // Calcular percentual de participação
    const percentualParticipacao = totalMinutosMes > 0 
      ? (minutosTrabalhadosMes / totalMinutosMes) * 100 
      : 0;

    // Buscar última distribuição salva para obter faturamento e percentual de comissão
    const [ultimaDistribuicao] = await db
      .select()
      .from(distribuicoes)
      .where(eq(distribuicoes.periodoInicio, new Date(mes + '-01')))
      .orderBy(desc(distribuicoes.createdAt))
      .limit(1);

    const faturamentoTotal = Number(ultimaDistribuicao?.faturamentoTotal || 15000);
    const percentualComissao = ultimaDistribuicao?.percentualComissao || 40;

    // Calcular faturamento proporcional e comissão
    const faturamentoProporcional = (faturamentoTotal * percentualParticipacao) / 100;
    const comissaoCalculada = (faturamentoProporcional * percentualComissao) / 100;

    return {
      minutosTrabalhadosMes,
      comissaoCalculada,
      faturamentoProporcional,
      percentualParticipacao,
    };
  }

  async getDashboardMetrics(): Promise<{
    faturamentoMensal: number;
    assinaturasAtivas: number;
    horasTrabalhadas: number;
    comissoesPagas: number;
  }> {
    // Para demo, retorna valores calculados das comissões e distribuições
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const [comissoesResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${comissoes.valor}), 0)`,
      })
      .from(comissoes)
      .where(eq(comissoes.mes, currentMonth));

    const faturamentoMensal = Number(comissoesResult?.total || 0) * 2.5; // Estima faturamento baseado em comissões
    const comissoesPagas = Number(comissoesResult?.total || 0);

    return {
      faturamentoMensal,
      assinaturasAtivas: 142, // Pode ser calculado de outra tabela quando implementada
      horasTrabalhadas: 1840, // Pode ser calculado das distribuições
      comissoesPagas,
    };
  }

  async getBarbeiroRanking(): Promise<Array<{
    barbeiro: Barbeiro;
    faturamento: number;
    comissao: number;
    horas: number;
  }>> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Busca barbeiros com suas comissões do mês atual
    const result = await db
      .select({
        barbeiro: barbeiros,
        comissao: sql<number>`COALESCE(${comissoes.valor}, 0)`,
      })
      .from(barbeiros)
      .leftJoin(comissoes, and(
        eq(comissoes.barbeiroId, barbeiros.id),
        eq(comissoes.mes, currentMonth)
      ))
      .where(eq(barbeiros.ativo, true))
      .orderBy(desc(sql`COALESCE(${comissoes.valor}, 0)`));

    return result.map(row => ({
      barbeiro: row.barbeiro,
      faturamento: Number(row.comissao) * 2.5, // Estima faturamento
      comissao: Number(row.comissao),
      horas: Math.floor(Number(row.comissao) / 15), // Estima horas baseado em comissão
    }));
  }

  // Implementação dos métodos de agendamento
  async getAllAgendamentos(): Promise<any[]> {
    const result = await db
      .select({
        agendamento: agendamentos,
        cliente: clientes,
        barbeiro: barbeiros,
        servico: servicos,
      })
      .from(agendamentos)
      .leftJoin(clientes, eq(agendamentos.clienteId, clientes.id))
      .leftJoin(barbeiros, eq(agendamentos.barbeiroId, barbeiros.id))
      .leftJoin(servicos, eq(agendamentos.servicoId, servicos.id))
      .orderBy(desc(agendamentos.dataHora));

    return result.map(row => ({
      ...row.agendamento,
      cliente: row.cliente,
      barbeiro: row.barbeiro,
      servico: row.servico,
    }));
  }

  async getAgendamentosByDate(date: string): Promise<any[]> {
    const startDate = new Date(date + 'T00:00:00');
    const endDate = new Date(date + 'T23:59:59');
    
    const result = await db
      .select({
        agendamento: agendamentos,
        cliente: clientes,
        barbeiro: barbeiros,
        servico: servicos,
      })
      .from(agendamentos)
      .leftJoin(clientes, eq(agendamentos.clienteId, clientes.id))
      .leftJoin(barbeiros, eq(agendamentos.barbeiroId, barbeiros.id))
      .leftJoin(servicos, eq(agendamentos.servicoId, servicos.id))
      .where(and(
        gte(agendamentos.dataHora, startDate),
        lte(agendamentos.dataHora, endDate)
      ))
      .orderBy(agendamentos.dataHora);

    return result.map(row => ({
      ...row.agendamento,
      cliente: row.cliente,
      barbeiro: row.barbeiro,
      servico: row.servico,
    }));
  }

  async createAgendamento(agendamento: any): Promise<any> {
    const [created] = await db
      .insert(agendamentos)
      .values({
        clienteId: agendamento.clienteId,
        barbeiroId: agendamento.barbeiroId,
        servicoId: agendamento.servicoId,
        dataHora: new Date(agendamento.dataHora),
      })
      .returning();

    return created;
  }

  async finalizarAgendamento(id: number): Promise<any> {
    // Atualizar status do agendamento
    const [agendamento] = await db
      .update(agendamentos)
      .set({ status: 'FINALIZADO' })
      .where(eq(agendamentos.id, id))
      .returning();

    if (!agendamento) {
      throw new Error('Agendamento não encontrado');
    }

    // Buscar dados do agendamento para criar atendimento
    const agendamentoCompleto = await db
      .select({
        agendamento: agendamentos,
        servico: servicos,
      })
      .from(agendamentos)
      .leftJoin(servicos, eq(agendamentos.servicoId, servicos.id))
      .where(eq(agendamentos.id, id))
      .limit(1);

    if (agendamentoCompleto.length > 0) {
      const { agendamento: ag, servico } = agendamentoCompleto[0];
      const mes = ag.dataHora.toISOString().slice(0, 7);

      // Criar registro de atendimento para cálculo de comissão
      await db.insert(atendimentos).values({
        barbeiroId: ag.barbeiroId,
        servicoId: ag.servicoId,
        dataAtendimento: ag.dataHora,
        quantidade: 1,
        mes: mes,
      });
    }

    return agendamento;
  }
}

export const storage = new DatabaseStorage();
