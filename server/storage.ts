import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, gte, lte, sql, like, lt, count } from "drizzle-orm";
import { config } from "dotenv";

// Load environment variables
config();
import {
  barbeiros,
  servicos,
  planosAssinatura,
  planosPersonalizados,
  clientes,
  distribuicoes,
  distribuicaoItens,
  comissoes,
  users,
  atendimentos,
  totalServicos,
  agendamentos,
  atendimentosDiarios,
  sequenciaBarbeiros,
  ordemFila,
  type Barbeiro,
  type InsertBarbeiro,
  type Servico,
  type InsertServico,
  type PlanoAssinatura,
  type InsertPlanoAssinatura,
  type PlanoPersonalizado,
  type InsertPlanoPersonalizado,
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
  type AtendimentoDiario,
  type InsertAtendimentoDiario,
  type SequenciaBarbeiro,
  type InsertSequenciaBarbeiro,
  type OrdemFila,
  type InsertOrdemFila,
  type Agendamento,
  type InsertAgendamento,
} from "@shared/schema";

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
export const db = drizzle(client);

export interface IStorage {
  // Barbeiros
  getAllBarbeiros(): Promise<Barbeiro[]>;
  getBarbeiroById(id: number): Promise<Barbeiro | undefined>;
  createBarbeiro(barbeiro: InsertBarbeiro): Promise<Barbeiro>;
  updateBarbeiro(id: number, barbeiro: Partial<InsertBarbeiro>): Promise<Barbeiro | undefined>;
  deleteBarbeiro(id: number): Promise<boolean>;

  // Serviços
  getAllServicos(): Promise<Servico[]>;
  getServicoById(id: number): Promise<Servico | undefined>;
  createServico(servico: InsertServico): Promise<Servico>;
  updateServico(id: number, servico: Partial<InsertServico>): Promise<Servico | undefined>;
  deleteServico(id: number): Promise<boolean>;

  // Planos de Assinatura
  getAllPlanosAssinatura(): Promise<PlanoAssinatura[]>;
  getPlanoAssinaturaById(id: number): Promise<PlanoAssinatura | undefined>;
  createPlanoAssinatura(plano: InsertPlanoAssinatura): Promise<PlanoAssinatura>;
  updatePlanoAssinatura(id: number, plano: Partial<InsertPlanoAssinatura>): Promise<PlanoAssinatura | undefined>;
  deletePlanoAssinatura(id: number): Promise<boolean>;

  // SISTEMA CENTRAL UNIFICADO - CLIENTES
  getAllClientes(): Promise<Cliente[]>;
  getClienteById(id: number): Promise<Cliente | undefined>;
  getClienteByEmail(email: string): Promise<Cliente | undefined>;
  getClienteByAsaasId(asaasCustomerId: string): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente | undefined>;
  deleteCliente(id: number): Promise<boolean>;
  
  // Estatísticas centralizadas
  getTotalClientes(): Promise<number>;
  getClientesPorOrigem(): Promise<{ origem: string; total: number }[]>;
  getValorTotalAssinaturas(): Promise<number>;

  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<User | undefined>;

  // Agendamentos
  getAllAgendamentos(): Promise<Agendamento[]>;
  createAgendamento(agendamento: InsertAgendamento): Promise<Agendamento>;
  updateAgendamento(id: number, agendamento: Partial<InsertAgendamento>): Promise<Agendamento | undefined>;
  deleteAgendamento(id: number): Promise<boolean>;

  // Atendimentos
  getAllAtendimentos(): Promise<Atendimento[]>;
  createAtendimento(atendimento: InsertAtendimento): Promise<Atendimento>;

  // Distribuições e Comissões
  getAllDistribuicoes(): Promise<Distribuicao[]>;
  createDistribuicao(distribuicao: InsertDistribuicao): Promise<Distribuicao>;
  
  // Ordem da Fila
  getOrdemFila(): Promise<OrdemFila[]>;
  updateOrdemFila(items: InsertOrdemFila[]): Promise<void>;
  
  // Métodos adicionais necessários
  getAllUsers(): Promise<User[]>;
  getAllProfissionais(): Promise<User[]>;
  getAllPlanos(): Promise<PlanoAssinatura[]>;
  createPlano(plano: InsertPlanoAssinatura): Promise<PlanoAssinatura>;
  updatePlano(id: number, plano: Partial<InsertPlanoAssinatura>): Promise<PlanoAssinatura | undefined>;
  deletePlano(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Barbeiros
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

  async updateBarbeiro(id: number, barbeiro: Partial<InsertBarbeiro>): Promise<Barbeiro | undefined> {
    const [updated] = await db.update(barbeiros).set(barbeiro).where(eq(barbeiros.id, id)).returning();
    return updated;
  }

  async deleteBarbeiro(id: number): Promise<boolean> {
    const result = await db.delete(barbeiros).where(eq(barbeiros.id, id));
    return result.length > 0;
  }

  // Serviços
  async getAllServicos(): Promise<Servico[]> {
    return await db.select().from(servicos).orderBy(servicos.nome);
  }

  async getServicoById(id: number): Promise<Servico | undefined> {
    const [servico] = await db.select().from(servicos).where(eq(servicos.id, id));
    return servico;
  }

  async createServico(servico: InsertServico): Promise<Servico> {
    const [created] = await db.insert(servicos).values(servico).returning();
    return created;
  }

  async updateServico(id: number, servico: Partial<InsertServico>): Promise<Servico | undefined> {
    const [updated] = await db.update(servicos).set(servico).where(eq(servicos.id, id)).returning();
    return updated;
  }

  async deleteServico(id: number): Promise<boolean> {
    const result = await db.delete(servicos).where(eq(servicos.id, id));
    return result.length > 0;
  }

  // Planos de Assinatura
  async getAllPlanosAssinatura(): Promise<PlanoAssinatura[]> {
    return await db.select().from(planosAssinatura).orderBy(planosAssinatura.nome);
  }

  async getPlanoAssinaturaById(id: number): Promise<PlanoAssinatura | undefined> {
    const [plano] = await db.select().from(planosAssinatura).where(eq(planosAssinatura.id, id));
    return plano;
  }

  async createPlanoAssinatura(plano: InsertPlanoAssinatura): Promise<PlanoAssinatura> {
    const [created] = await db.insert(planosAssinatura).values(plano).returning();
    return created;
  }

  async updatePlanoAssinatura(id: number, plano: Partial<InsertPlanoAssinatura>): Promise<PlanoAssinatura | undefined> {
    const [updated] = await db.update(planosAssinatura).set(plano).where(eq(planosAssinatura.id, id)).returning();
    return updated;
  }

  async deletePlanoAssinatura(id: number): Promise<boolean> {
    const result = await db.delete(planosAssinatura).where(eq(planosAssinatura.id, id));
    return result.length > 0;
  }

  // SISTEMA CENTRAL UNIFICADO - CLIENTES
  async getAllClientes(): Promise<Cliente[]> {
    return await db.select().from(clientes).orderBy(clientes.nome);
  }

  async getClienteById(id: number): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
    return cliente;
  }

  async getClienteByEmail(email: string): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.email, email));
    return cliente;
  }

  async getClienteByAsaasId(asaasCustomerId: string): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.asaasCustomerId, asaasCustomerId));
    return cliente;
  }

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    const [created] = await db.insert(clientes).values(cliente).returning();
    return created;
  }

  async updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente | undefined> {
    const [updated] = await db.update(clientes).set(cliente).where(eq(clientes.id, id)).returning();
    return updated;
  }

  async deleteCliente(id: number): Promise<boolean> {
    const result = await db.delete(clientes).where(eq(clientes.id, id));
    return result.length > 0;
  }

  // Estatísticas centralizadas
  async getTotalClientes(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(clientes);
    return result.count;
  }

  async getClientesPorOrigem(): Promise<{ origem: string; total: number }[]> {
    const result = await db
      .select({
        origem: clientes.origem,
        total: count(),
      })
      .from(clientes)
      .groupBy(clientes.origem);
    return result;
  }

  async getValorTotalAssinaturas(): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`SUM(CAST(${clientes.planoValor} AS DECIMAL))`,
      })
      .from(clientes)
      .where(eq(clientes.statusAssinatura, 'ATIVO'));
    return result[0]?.total || 0;
  }

  // Users
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return updated;
  }

  // Agendamentos
  async getAllAgendamentos(): Promise<Agendamento[]> {
    return await db.select().from(agendamentos).orderBy(desc(agendamentos.createdAt));
  }

  async createAgendamento(agendamento: InsertAgendamento): Promise<Agendamento> {
    const [created] = await db.insert(agendamentos).values(agendamento).returning();
    return created;
  }

  async updateAgendamento(id: number, agendamento: Partial<InsertAgendamento>): Promise<Agendamento | undefined> {
    const [updated] = await db.update(agendamentos).set(agendamento).where(eq(agendamentos.id, id)).returning();
    return updated;
  }

  async deleteAgendamento(id: number): Promise<boolean> {
    const result = await db.delete(agendamentos).where(eq(agendamentos.id, id));
    return result.length > 0;
  }

  // Atendimentos
  async getAllAtendimentos(): Promise<Atendimento[]> {
    return await db.select().from(atendimentos).orderBy(desc(atendimentos.dataAtendimento));
  }

  async createAtendimento(atendimento: InsertAtendimento): Promise<Atendimento> {
    const [created] = await db.insert(atendimentos).values(atendimento).returning();
    return created;
  }

  // Distribuições e Comissões
  async getAllDistribuicoes(): Promise<Distribuicao[]> {
    return await db.select().from(distribuicoes).orderBy(desc(distribuicoes.createdAt));
  }

  async createDistribuicao(distribuicao: InsertDistribuicao): Promise<Distribuicao> {
    const [created] = await db.insert(distribuicoes).values(distribuicao).returning();
    return created;
  }

  // Ordem da Fila
  async getOrdemFila(): Promise<OrdemFila[]> {
    return await db.select().from(ordemFila).orderBy(ordemFila.ordem);
  }

  async updateOrdemFila(items: InsertOrdemFila[]): Promise<void> {
    await db.delete(ordemFila);
    if (items.length > 0) {
      await db.insert(ordemFila).values(items);
    }
  }

  // ===== MÉTODOS ADICIONAIS NECESSÁRIOS =====
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.nomeCompleto);
  }

  async getAllProfissionais(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'barbeiro')).orderBy(users.nomeCompleto);
  }

  async getAllPlanos(): Promise<PlanoAssinatura[]> {
    return await db.select().from(planosAssinatura).orderBy(planosAssinatura.nome);
  }

  async createPlano(plano: InsertPlanoAssinatura): Promise<PlanoAssinatura> {
    const [created] = await db.insert(planosAssinatura).values(plano).returning();
    return created;
  }

  async updatePlano(id: number, plano: Partial<InsertPlanoAssinatura>): Promise<PlanoAssinatura | undefined> {
    const [updated] = await db.update(planosAssinatura).set(plano).where(eq(planosAssinatura.id, id)).returning();
    return updated;
  }

  async deletePlano(id: number): Promise<boolean> {
    const result = await db.delete(planosAssinatura).where(eq(planosAssinatura.id, id));
    return result.length > 0;
  }

  // MÉTODOS CONSOLIDADOS - OTIMIZAÇÃO DE PERFORMANCE
  async getAgendamentosByDate(data: string): Promise<Agendamento[]> {
    return await db.select().from(agendamentos).where(like(agendamentos.dataHora, `${data}%`)).orderBy(agendamentos.dataHora);
  }

  async finalizarAgendamento(id: number): Promise<Agendamento | undefined> {
    const [updated] = await db.update(agendamentos).set({ status: 'FINALIZADO' }).where(eq(agendamentos.id, id)).returning();
    return updated;
  }

  async cancelarAgendamento(id: number): Promise<boolean> {
    const result = await db.delete(agendamentos).where(eq(agendamentos.id, id));
    return result.length > 0;
  }

  async getAllServicos(): Promise<Servico[]> {
    return await db.select().from(servicos).orderBy(servicos.nome);
  }

  async getServicosAssinatura(): Promise<Servico[]> {
    return await db.select().from(servicos).where(eq(servicos.isAssinatura, true)).orderBy(servicos.nome);
  }

  async getAllClientesExternos(): Promise<Cliente[]> {
    return await db.select().from(clientes).where(eq(clientes.origem, 'EXTERNO'));
  }

  async getClienteExternoById(id: number): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(and(eq(clientes.id, id), eq(clientes.origem, 'EXTERNO')));
    return cliente;
  }

  async createClienteExterno(clienteData: InsertCliente): Promise<Cliente> {
    const [created] = await db.insert(clientes).values(clienteData).returning();
    return created;
  }

  async updateClienteExterno(id: number, cliente: Partial<InsertCliente>): Promise<Cliente | undefined> {
    const [updated] = await db.update(clientes).set(cliente).where(eq(clientes.id, id)).returning();
    return updated;
  }

  async getDashboardMetrics(): Promise<any> {
    const totalClientes = await db.select({ count: count() }).from(clientes);
    const clientesAtivos = await db.select({ count: count() }).from(clientes).where(eq(clientes.statusAssinatura, 'ATIVO'));
    return {
      totalClientes: totalClientes[0]?.count || 0,
      clientesAtivos: clientesAtivos[0]?.count || 0
    };
  }

  async getBarbeiroRanking(): Promise<any[]> {
    return await db.select().from(barbeiros).orderBy(barbeiros.nome);
  }

  async createComissao(comissao: InsertComissao): Promise<Comissao> {
    const [created] = await db.insert(comissoes).values(comissao).returning();
    return created;
  }

  async getAtendimentosByBarbeiro(barbeiroId: number): Promise<Atendimento[]> {
    return await db.select().from(atendimentos).where(eq(atendimentos.barbeiroId, barbeiroId));
  }

  async getAtendimentosResumo(): Promise<any[]> {
    return await db.select().from(atendimentos).orderBy(desc(atendimentos.dataAtendimento));
  }

  async updateAtendimento(id: number, atendimento: Partial<InsertAtendimento>): Promise<Atendimento | undefined> {
    const [updated] = await db.update(atendimentos).set(atendimento).where(eq(atendimentos.id, id)).returning();
    return updated;
  }

  async deleteAtendimento(id: number): Promise<boolean> {
    const result = await db.delete(atendimentos).where(eq(atendimentos.id, id));
    return result.length > 0;
  }

  async getTotalServicosByMes(): Promise<TotalServico[]> {
    return await db.select().from(totalServicos).orderBy(desc(totalServicos.createdAt));
  }

  async createOrUpdateTotalServico(totalServico: InsertTotalServico): Promise<TotalServico> {
    const [created] = await db.insert(totalServicos).values(totalServico).returning();
    return created;
  }

  async validateAtendimentoLimits(): Promise<boolean> {
    return true; // Implementar validação se necessário
  }

  async getComissaoAtualBarbeiro(barbeiroId: number): Promise<Comissao | undefined> {
    const [comissao] = await db.select().from(comissoes).where(eq(comissoes.barbeiroId, barbeiroId)).orderBy(desc(comissoes.createdAt));
    return comissao;
  }

  async getComissoesByBarbeiro(barbeiroId: number): Promise<Comissao[]> {
    return await db.select().from(comissoes).where(eq(comissoes.barbeiroId, barbeiroId)).orderBy(desc(comissoes.createdAt));
  }

  async getComissoesByMes(): Promise<Comissao[]> {
    return await db.select().from(comissoes).orderBy(desc(comissoes.createdAt));
  }

  async getFilaMensal(): Promise<any[]> {
    return await db.select().from(ordemFila).orderBy(ordemFila.ordemCustomizada);
  }

  async reordenarFila(novaOrdem: any[]): Promise<void> {
    await db.delete(ordemFila);
    if (novaOrdem.length > 0) {
      await db.insert(ordemFila).values(novaOrdem);
    }
  }

  async toggleBarbeiroFila(barbeiroId: number): Promise<void> {
    // Implementar toggle do barbeiro na fila
    console.log(`Toggle barbeiro ${barbeiroId} na fila`);
  }

  async inicializarOrdemFila(): Promise<void> {
    const barbeirosAtivos = await db.select().from(barbeiros);
    const ordemInicial = barbeirosAtivos.map((barbeiro, index) => ({
      barbeiroId: barbeiro.id,
      ordemCustomizada: index + 1,
      ativo: true
    }));
    
    await db.delete(ordemFila);
    if (ordemInicial.length > 0) {
      await db.insert(ordemFila).values(ordemInicial);
    }
  }
}

// Exportar a classe Storage
export { Storage };

export const storage = new DatabaseStorage();