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
  clientesExternos,
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
  type ClienteExterno,
  type InsertClienteExterno,
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
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;

  // Barbeiros
  getAllBarbeiros(): Promise<Barbeiro[]>;
  getBarbeiroById(id: number): Promise<Barbeiro | undefined>;
  createBarbeiro(barbeiro: InsertBarbeiro): Promise<Barbeiro>;
  updateBarbeiro(id: number, barbeiro: Partial<InsertBarbeiro>): Promise<Barbeiro>;
  deleteBarbeiro(id: number): Promise<void>;
  
  // Profissionais (Barbeiros + Recepcionistas)
  getAllProfissionais(): Promise<Array<{
    id: number;
    nome: string;
    email: string;
    ativo: boolean;
    tipo: string;
    telefone?: string;
    endereco?: string;
    comissao?: number;
  }>>;

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

  // Clientes Asaas
  getAllClientes(): Promise<Cliente[]>;
  getClienteById(id: number): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: Partial<InsertCliente>): Promise<Cliente>;
  
  // Clientes Externos
  getAllClientesExternos(): Promise<ClienteExterno[]>;
  getClienteExternoById(id: number): Promise<ClienteExterno | undefined>;
  createClienteExterno(cliente: InsertClienteExterno): Promise<ClienteExterno>;
  updateClienteExterno(id: number, cliente: Partial<InsertClienteExterno>): Promise<ClienteExterno>;
  
  // Unificado - todos os clientes
  getClientesUnifiedStats(mes?: string, ano?: string): Promise<{
    totalActiveClients: number;
    totalSubscriptionRevenue: number;
    totalExpiringSubscriptions: number;
    clientesPagantesDoMes: number;
  }>;
  
  getAllClientesUnified(): Promise<Array<{
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    cpf: string | null;
    planoNome: string | null;
    planoValor: string | null;
    formaPagamento: string | null;
    statusAssinatura: string | null;
    dataInicioAssinatura: Date | null;
    dataVencimentoAssinatura: Date | null;
    origem: 'ASAAS' | 'EXTERNO';
    createdAt: Date;
  }>>;

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
  cancelarAgendamento(id: number): Promise<any>;

  // Lista da Vez - Atendimentos Diários
  getAtendimentosDiarios(data: string): Promise<AtendimentoDiario[]>;
  getAtendimentosDiariosByMes(mesAno: string): Promise<AtendimentoDiario[]>;
  createOrUpdateAtendimentoDiario(atendimento: InsertAtendimentoDiario): Promise<AtendimentoDiario>;
  getFilaMensal(mesAno: string): Promise<Array<{
    barbeiro: Barbeiro;
    totalAtendimentosMes: number;
    posicaoMensal: number;
    diasPassouAVez: number;
  }>>;
  getBarbeiroFilaMensal(barbeiroId: number, mesAno: string): Promise<{
    posicaoMensal: number;
    totalAtendimentosMes: number;
  }>;
  zerarAtendimentosMes(mesAno: string): Promise<void>;

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

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updated;
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

  async getAllProfissionais(): Promise<Array<{
    id: number;
    nome: string;
    email: string;
    ativo: boolean;
    tipo: string;
    telefone?: string;
    endereco?: string;
    comissao?: number;
  }>> {
    // Buscar todos os barbeiros
    const barbeirosList = await db.select().from(barbeiros).orderBy(barbeiros.nome);
    
    // Buscar todos os usuários recepcionistas
    const recepcionistasList = await db
      .select()
      .from(users)
      .where(eq(users.role, 'recepcionista'))
      .orderBy(users.email);
    
    // Combinar e padronizar os dados
    const profissionais = [
      ...barbeirosList.map(barbeiro => ({
        id: barbeiro.id,
        nome: barbeiro.nome,
        email: barbeiro.email,
        ativo: barbeiro.ativo,
        tipo: 'barbeiro',
        telefone: barbeiro.telefone || undefined,
        endereco: barbeiro.endereco || undefined,
        comissao: barbeiro.comissao || undefined
      })),
      ...recepcionistasList.map(recepcionista => ({
        id: recepcionista.id,
        nome: recepcionista.nome || recepcionista.email.split('@')[0],
        email: recepcionista.email,
        ativo: true, // Assumir que usuários cadastrados estão ativos
        tipo: 'recepcionista',
        telefone: undefined,
        endereco: undefined,
        comissao: undefined
      }))
    ];
    
    return profissionais.sort((a, b) => a.nome.localeCompare(b.nome));
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

  // Método removido - não existe tabela clientesExternos no schema atual

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

  // ===== CLIENTES EXTERNOS =====
  async getAllClientesExternos(): Promise<ClienteExterno[]> {
    return await db.select().from(clientesExternos).orderBy(desc(clientesExternos.createdAt));
  }

  async getClienteExternoById(id: number): Promise<ClienteExterno | undefined> {
    const [cliente] = await db.select().from(clientesExternos).where(eq(clientesExternos.id, id));
    return cliente;
  }

  async createClienteExterno(cliente: InsertClienteExterno): Promise<ClienteExterno> {
    const [created] = await db.insert(clientesExternos).values(cliente).returning();
    return created;
  }

  async updateClienteExterno(id: number, cliente: Partial<InsertClienteExterno>): Promise<ClienteExterno> {
    const [updated] = await db
      .update(clientesExternos)
      .set(cliente)
      .where(eq(clientesExternos.id, id))
      .returning();
    return updated;
  }

  // ===== CLIENTES UNIFICADOS =====
  async getAllClientesUnified(): Promise<Array<{
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    cpf: string | null;
    planoNome: string | null;
    planoValor: string | null;
    formaPagamento: string | null;
    statusAssinatura: string | null;
    dataInicioAssinatura: Date | null;
    dataVencimentoAssinatura: Date | null;
    origem: 'ASAAS' | 'EXTERNO';
    createdAt: Date;
  }>> {
    // Buscar clientes Asaas
    const clientesAsaas = await this.getAllClientes();
    
    // Buscar clientes externos
    const clientesExternosData = await this.getAllClientesExternos();
    
    // Unificar os dados
    const clientesUnificados = [
      ...clientesAsaas.map(cliente => ({
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        cpf: cliente.cpf,
        planoNome: cliente.planoNome,
        planoValor: cliente.planoValor,
        formaPagamento: cliente.formaPagamento,
        statusAssinatura: cliente.statusAssinatura,
        dataInicioAssinatura: cliente.dataInicioAssinatura,
        dataVencimentoAssinatura: cliente.dataVencimentoAssinatura,
        origem: 'ASAAS' as const,
        createdAt: cliente.createdAt,
      })),
      ...clientesExternosData.map(cliente => ({
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        cpf: cliente.cpf,
        planoNome: cliente.planoNome,
        planoValor: cliente.planoValor,
        formaPagamento: cliente.formaPagamento,
        statusAssinatura: cliente.statusAssinatura,
        dataInicioAssinatura: cliente.dataInicioAssinatura,
        dataVencimentoAssinatura: cliente.dataVencimentoAssinatura,
        origem: 'EXTERNO' as const,
        createdAt: cliente.createdAt,
      }))
    ];

    // Ordenar por data de criação (mais recentes primeiro)
    return clientesUnificados.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getClientesUnifiedStats(mes?: string, ano?: string): Promise<{
    totalActiveClients: number;
    totalSubscriptionRevenue: number;
    totalExpiringSubscriptions: number;
    clientesPagantesDoMes: number;
  }> {
    // Usar o método unificado para pegar todos os clientes
    const allClientes = await this.getAllClientesUnified();
    
    const now = new Date();
    
    // Se mês/ano não fornecidos, usar o mês atual
    const targetMonth = mes && ano ? `${ano}-${mes.padStart(2, '0')}` : now.toISOString().slice(0, 7);
    
    // Clientes ativos = status ATIVO e dentro da validade
    const activeClientes = allClientes.filter(cliente => {
      if (cliente.statusAssinatura !== 'ATIVO') return false;
      if (!cliente.dataVencimentoAssinatura) return false;
      
      const vencimento = new Date(cliente.dataVencimentoAssinatura);
      return vencimento >= now; // Ainda não venceu
    });
    
    // Clientes que fizeram pagamentos especificamente no mês selecionado
    const clientesPagantesDoMes = allClientes.filter(cliente => {
      if (cliente.statusAssinatura !== 'ATIVO') return false;
      if (!cliente.dataInicioAssinatura || !cliente.planoValor) return false;
      
      const dataInicio = new Date(cliente.dataInicioAssinatura);
      const paymentMonth = dataInicio.toISOString().slice(0, 7);
      
      return paymentMonth === targetMonth; // Apenas pagamentos do mês selecionado
    });
    
    // Receita APENAS dos pagamentos feitos no mês selecionado
    const monthlySubscriptionRevenue = clientesPagantesDoMes.reduce((total, cliente) => {
      return total + parseFloat(cliente.planoValor!.toString());
    }, 0);
    
    // Assinaturas expirando nos próximos 7 dias
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const expiringClientes = activeClientes.filter(cliente => {
      if (!cliente.dataVencimentoAssinatura) return false;
      const validadeDate = new Date(cliente.dataVencimentoAssinatura);
      return validadeDate >= now && validadeDate <= nextWeek;
    });
    
    return {
      totalActiveClients: activeClientes.length,
      totalSubscriptionRevenue: monthlySubscriptionRevenue, // Apenas do mês selecionado
      totalExpiringSubscriptions: expiringClientes.length,
      clientesPagantesDoMes: clientesPagantesDoMes.length, // Quantidade de clientes que pagaram no mês
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

  async cancelarAgendamento(id: number): Promise<any> {
    // Atualizar status do agendamento para CANCELADO
    const [agendamento] = await db
      .update(agendamentos)
      .set({ status: 'CANCELADO' })
      .where(eq(agendamentos.id, id))
      .returning();

    if (!agendamento) {
      throw new Error('Agendamento não encontrado');
    }

    // Remover qualquer atendimento relacionado (se existir) para cancelar comissão
    await db
      .delete(atendimentos)
      .where(
        and(
          eq(atendimentos.barbeiroId, agendamento.barbeiroId),
          eq(atendimentos.servicoId, agendamento.servicoId),
          eq(atendimentos.dataAtendimento, agendamento.dataHora)
        )
      );

    return agendamento;
  }

  // Lista da Vez - Atendimentos Diários
  async getAtendimentosDiarios(data: string): Promise<AtendimentoDiario[]> {
    return await db
      .select()
      .from(atendimentosDiarios)
      .where(eq(atendimentosDiarios.data, data))
      .orderBy(atendimentosDiarios.barbeiroId);
  }

  async getAtendimentosDiariosByMes(mesAno: string): Promise<AtendimentoDiario[]> {
    // mesAno formato "YYYY-MM"
    return await db
      .select()
      .from(atendimentosDiarios)
      .where(eq(atendimentosDiarios.mesAno, mesAno))
      .orderBy(atendimentosDiarios.data, atendimentosDiarios.barbeiroId);
  }

  async createOrUpdateAtendimentoDiario(atendimento: InsertAtendimentoDiario): Promise<AtendimentoDiario> {
    // Sempre criar novo registro para permitir múltiplos atendimentos por barbeiro por dia
    const [created] = await db
      .insert(atendimentosDiarios)
      .values(atendimento)
      .returning();
    return created;
  }

  async getFilaMensal(mesAno: string): Promise<Array<{
    barbeiro: Barbeiro;
    totalAtendimentosMes: number;
    posicaoMensal: number;
    diasPassouAVez: number;
  }>> {
    // Buscar todos os barbeiros ativos
    const barbeirosList = await this.getAllBarbeiros();
    const atendimentosMes = await this.getAtendimentosDiariosByMes(mesAno);

    // Calcular totais para cada barbeiro
    const barbeirosComTotais = barbeirosList.map(barbeiro => {
      const atendimentosBarbeiro = atendimentosMes.filter(a => a.barbeiroId === barbeiro.id);
      
      // Contar atendimentos normais e manuais
      const totalAtendimentos = atendimentosBarbeiro.filter(a => 
        a.tipoAtendimento === 'NORMAL' || a.tipoAtendimento === 'MANUAL'
      ).length;
      
      // Contar quantas vezes passou a vez
      const diasPassouAVez = atendimentosBarbeiro.filter(a => 
        a.tipoAtendimento === 'PASSOU_VEZ'
      ).length;

      return {
        barbeiro,
        totalAtendimentosMes: totalAtendimentos,
        diasPassouAVez
      };
    });

    // Ordenar conforme regras: menor total primeiro, depois menor "passou a vez", depois ordem alfabética
    barbeirosComTotais.sort((a, b) => {
      if (a.totalAtendimentosMes !== b.totalAtendimentosMes) {
        return a.totalAtendimentosMes - b.totalAtendimentosMes;
      }
      if (a.diasPassouAVez !== b.diasPassouAVez) {
        return a.diasPassouAVez - b.diasPassouAVez;
      }
      return a.barbeiro.nome.localeCompare(b.barbeiro.nome);
    });

    // Adicionar posição mensal
    return barbeirosComTotais.map((item, index) => ({
      ...item,
      posicaoMensal: index + 1
    }));
  }

  async getBarbeiroFilaMensal(barbeiroId: number, mesAno: string): Promise<{
    posicaoMensal: number;
    totalAtendimentosMes: number;
  }> {
    const filaMensal = await this.getFilaMensal(mesAno);
    const barbeiroNaFila = filaMensal.find(item => item.barbeiro.id === barbeiroId);
    
    if (!barbeiroNaFila) {
      return {
        posicaoMensal: filaMensal.length + 1,
        totalAtendimentosMes: 0
      };
    }

    return {
      posicaoMensal: barbeiroNaFila.posicaoMensal,
      totalAtendimentosMes: barbeiroNaFila.totalAtendimentosMes
    };
  }

  async zerarAtendimentosMes(mesAno: string): Promise<void> {
    await db
      .delete(atendimentosDiarios)
      .where(eq(atendimentosDiarios.mesAno, mesAno));
  }

  // Novos métodos para gestão de assinaturas externas
  
  // Cancelar assinatura externa (muda status para CANCELADO)
  async cancelarAssinaturaExterna(clienteId: number): Promise<ClienteExterno> {
    const [updated] = await db
      .update(clientesExternos)
      .set({ statusAssinatura: "CANCELADO" })
      .where(eq(clientesExternos.id, clienteId))
      .returning();
    return updated;
  }

  // Cancelar assinatura Asaas (muda status para CANCELADO)
  async cancelarAssinaturaAsaas(clienteId: number): Promise<Cliente> {
    const [updated] = await db
      .update(clientes)
      .set({ statusAssinatura: "CANCELADO" })
      .where(eq(clientes.id, clienteId))
      .returning();
    return updated;
  }

  // Excluir assinatura externa completamente
  async excluirAssinaturaExterna(clienteId: number): Promise<void> {
    await db.delete(clientesExternos).where(eq(clientesExternos.id, clienteId));
  }

  // Excluir assinatura Asaas completamente
  async excluirAssinaturaAsaas(clienteId: number): Promise<void> {
    await db.delete(clientes).where(eq(clientes.id, clienteId));
  }

  // Métodos para estatísticas do barbeiro
  
  async getTotalAtendimentosBarbeiro(barbeiroId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(agendamentos)
      .where(and(
        eq(agendamentos.barbeiroId, barbeiroId),
        eq(agendamentos.status, 'FINALIZADO')
      ));
    return result[0]?.count || 0;
  }

  async getAtendimentosBarbeiroPeriodo(barbeiroId: number, dataInicio: Date, dataFim: Date): Promise<Agendamento[]> {
    return await db
      .select()
      .from(agendamentos)
      .where(and(
        eq(agendamentos.barbeiroId, barbeiroId),
        eq(agendamentos.status, 'FINALIZADO'),
        gte(agendamentos.dataHora, dataInicio),
        lte(agendamentos.dataHora, dataFim)
      ));
  }

  async getServicosPorTipoBarbeiro(barbeiroId: number, dataInicio: Date, dataFim: Date): Promise<Array<{
    servicoNome: string;
    quantidade: number;
  }>> {
    const result = await db
      .select({
        servicoNome: servicos.nome,
        quantidade: count()
      })
      .from(agendamentos)
      .leftJoin(servicos, eq(agendamentos.servicoId, servicos.id))
      .where(and(
        eq(agendamentos.barbeiroId, barbeiroId),
        eq(agendamentos.status, 'FINALIZADO'),
        gte(agendamentos.dataHora, dataInicio),
        lte(agendamentos.dataHora, dataFim)
      ))
      .groupBy(servicos.id, servicos.nome)
      .orderBy(desc(count()));

    return result.map(item => ({
      servicoNome: item.servicoNome || 'Serviço não encontrado',
      quantidade: item.quantidade
    }));
  }

  // Buscar assinaturas canceladas que expiraram (para limpeza automática)
  async getAssinaturasCanceladasExpiradas(): Promise<(Cliente | ClienteExterno)[]> {
    const now = new Date();
    
    // Buscar clientes Asaas cancelados e vencidos
    const clientesAsaasCancelados = await db
      .select()
      .from(clientes)
      .where(and(
        eq(clientes.statusAssinatura, "CANCELADO"),
        lte(clientes.dataVencimentoAssinatura, now)
      ));

    // Buscar clientes externos cancelados e vencidos
    const clientesExternosCancelados = await db
      .select()
      .from(clientesExternos)
      .where(and(
        eq(clientesExternos.statusAssinatura, "CANCELADO"),
        lte(clientesExternos.dataVencimentoAssinatura, now)
      ));

    return [...clientesAsaasCancelados, ...clientesExternosCancelados];
  }

  // === MÉTODOS PARA GERENCIAMENTO DE ORDEM DA FILA ===

  async getOrdemFila(): Promise<any[]> {
    const resultado = await db
      .select({
        id: ordemFila.id,
        barbeiroId: ordemFila.barbeiroId,
        ordemCustomizada: ordemFila.ordemCustomizada,
        ativo: ordemFila.ativo,
        barbeiro: {
          id: barbeiros.id,
          nome: barbeiros.nome,
          email: barbeiros.email,
          ativo: barbeiros.ativo
        }
      })
      .from(ordemFila)
      .leftJoin(barbeiros, eq(ordemFila.barbeiroId, barbeiros.id))
      .orderBy(ordemFila.ordemCustomizada);
    
    return resultado;
  }

  async reordenarFila(novaOrdem: { barbeiroId: number; ordemCustomizada: number }[]): Promise<any[]> {
    // Atualizar ordem personalizada de cada barbeiro
    for (const item of novaOrdem) {
      await db
        .update(ordemFila)
        .set({ 
          ordemCustomizada: item.ordemCustomizada,
          updatedAt: new Date()
        })
        .where(eq(ordemFila.barbeiroId, item.barbeiroId));
    }

    // Retornar ordem atualizada
    return this.getOrdemFila();
  }

  // === MÉTODOS PARA PLANOS PERSONALIZADOS ===

  async getAllPlanos(): Promise<PlanoPersonalizado[]> {
    return await db
      .select()
      .from(planosPersonalizados)
      .where(eq(planosPersonalizados.ativo, true))
      .orderBy(planosPersonalizados.categoria, planosPersonalizados.nome);
  }

  async createPlano(data: InsertPlanoPersonalizado): Promise<PlanoPersonalizado> {
    const [created] = await db
      .insert(planosPersonalizados)
      .values(data)
      .returning();
    return created;
  }

  async updatePlano(id: number, data: Partial<InsertPlanoPersonalizado>): Promise<PlanoPersonalizado> {
    const [updated] = await db
      .update(planosPersonalizados)
      .set(data)
      .where(eq(planosPersonalizados.id, id))
      .returning();
    return updated;
  }

  async deletePlano(id: number): Promise<void> {
    await db
      .update(planosPersonalizados)
      .set({ ativo: false })
      .where(eq(planosPersonalizados.id, id));
  }

  async getPlanoById(id: number): Promise<PlanoPersonalizado | undefined> {
    const [plano] = await db
      .select()
      .from(planosPersonalizados)
      .where(and(eq(planosPersonalizados.id, id), eq(planosPersonalizados.ativo, true)));
    return plano;
  }

  async toggleBarbeiroFila(barbeiroId: number, ativo: boolean): Promise<any> {
    const [resultado] = await db
      .update(ordemFila)
      .set({ 
        ativo,
        updatedAt: new Date()
      })
      .where(eq(ordemFila.barbeiroId, barbeiroId))
      .returning();

    return resultado;
  }

  async inicializarOrdemFila(): Promise<any[]> {
    // Buscar todos os barbeiros ativos
    const barbeirosAtivos = await db
      .select()
      .from(barbeiros)
      .where(eq(barbeiros.ativo, true))
      .orderBy(barbeiros.id);

    // Para cada barbeiro, criar ou atualizar entrada na ordem da fila
    for (let i = 0; i < barbeirosAtivos.length; i++) {
      const barbeiro = barbeirosAtivos[i];
      
      // Verificar se já existe entrada para este barbeiro
      const existeOrdem = await db
        .select()
        .from(ordemFila)
        .where(eq(ordemFila.barbeiroId, barbeiro.id))
        .limit(1);

      if (existeOrdem.length === 0) {
        // Criar nova entrada
        await db
          .insert(ordemFila)
          .values({
            barbeiroId: barbeiro.id,
            ordemCustomizada: i + 1,
            ativo: true
          });
      }
    }

    return this.getOrdemFila();
  }

  async getFilaMensalComOrdem(mes: string): Promise<any[]> {
    // Buscar fila mensal atual
    const filaMensalOriginal = await this.getFilaMensal(mes);
    
    // Buscar ordem personalizada
    const ordemPersonalizada = await this.getOrdemFila();
    
    // Se não há ordem personalizada, retornar fila original ordenada por atendimentos
    if (ordemPersonalizada.length === 0) {
      return filaMensalOriginal.sort((a: any, b: any) => a.totalAtendimentos - b.totalAtendimentos);
    }

    // Filtrar apenas barbeiros ativos da ordem personalizada
    const barbeirosAtivos = ordemPersonalizada.filter(item => item.ativo);
    
    // Se não há barbeiros ativos, retornar array vazio
    if (barbeirosAtivos.length === 0) {
      return [];
    }

    // Buscar apenas barbeiros ativos da fila mensal e adicionar ordem configurada
    const filaComOrdem = filaMensalOriginal
      .filter((fila: any) => {
        return barbeirosAtivos.some(item => item.barbeiroId === fila.barbeiro.id);
      })
      .map((fila: any) => {
        const ordemItem = barbeirosAtivos.find(item => item.barbeiroId === fila.barbeiro.id);
        return {
          ...fila,
          ordemCustomizada: ordemItem?.ordemCustomizada || 999
        };
      });

    // Ordenar primeiro pela ordem configurada, depois por atendimentos
    filaComOrdem.sort((a: any, b: any) => {
      // Primeiro critério: número de atendimentos (quem atendeu menos fica primeiro)
      if (a.totalAtendimentos !== b.totalAtendimentos) {
        return a.totalAtendimentos - b.totalAtendimentos;
      }
      // Segundo critério: ordem configurada no gerenciamento
      return a.ordemCustomizada - b.ordemCustomizada;
    });

    return filaComOrdem;
  }
}

export const storage = new DatabaseStorage();
