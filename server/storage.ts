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
}

export const storage = new DatabaseStorage();
