import { db } from "../db";
import { 
  clientesMaster, 
  statusClienteNovo, 
  origensDados, 
  categoriasClienteNovo,
  tiposDocumento,
  tiposPlanoNovo,
  type ClienteMaster, 
  type InsertClienteMaster 
} from "../../shared/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export class ClientesMasterService {
  
  // Buscar todos os clientes ativos
  async getAllClientes(): Promise<ClienteMaster[]> {
    return await db
      .select()
      .from(clientesMaster)
      .where(and(
        eq(clientesMaster.ativo, true),
        isNull(clientesMaster.deletedAt)
      ))
      .orderBy(desc(clientesMaster.createdAt));
  }

  // Buscar cliente por ID
  async getClienteById(id: number): Promise<ClienteMaster | null> {
    const result = await db
      .select()
      .from(clientesMaster)
      .where(and(
        eq(clientesMaster.id, id),
        isNull(clientesMaster.deletedAt)
      ))
      .limit(1);
    
    return result[0] || null;
  }

  // Buscar cliente por email
  async getClienteByEmail(email: string): Promise<ClienteMaster | null> {
    const result = await db
      .select()
      .from(clientesMaster)
      .where(and(
        eq(clientesMaster.email, email),
        isNull(clientesMaster.deletedAt)
      ))
      .limit(1);
    
    return result[0] || null;
  }

  // Buscar cliente por ID Asaas
  async getClienteByAsaasId(idAsaas: string, conta: 'principal' | 'andrey'): Promise<ClienteMaster | null> {
    const campo = conta === 'principal' ? clientesMaster.idAsaasPrincipal : clientesMaster.idAsaasAndrey;
    
    const result = await db
      .select()
      .from(clientesMaster)
      .where(and(
        eq(campo, idAsaas),
        isNull(clientesMaster.deletedAt)
      ))
      .limit(1);
    
    return result[0] || null;
  }

  // Criar novo cliente
  async createCliente(dados: InsertClienteMaster): Promise<ClienteMaster> {
    const result = await db
      .insert(clientesMaster)
      .values(dados)
      .returning();
    
    return result[0];
  }

  // Atualizar cliente
  async updateCliente(id: number, dados: Partial<InsertClienteMaster>): Promise<ClienteMaster | null> {
    const result = await db
      .update(clientesMaster)
      .set({
        ...dados,
        updatedAt: new Date()
      })
      .where(eq(clientesMaster.id, id))
      .returning();
    
    return result[0] || null;
  }

  // Soft delete do cliente
  async deleteCliente(id: number): Promise<boolean> {
    const result = await db
      .update(clientesMaster)
      .set({
        ativo: false,
        deletedAt: new Date()
      })
      .where(eq(clientesMaster.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Buscar clientes com informações completas (com joins)
  async getClientesCompletos() {
    return await db
      .select({
        // Dados do cliente
        id: clientesMaster.id,
        codigoInterno: clientesMaster.codigoInterno,
        nomeCompleto: clientesMaster.nomeCompleto,
        email: clientesMaster.email,
        telefonePrincipal: clientesMaster.telefonePrincipal,
        numeroDocumento: clientesMaster.numeroDocumento,
        valorPlanoAtual: clientesMaster.valorPlanoAtual,
        dataVencimentoPlano: clientesMaster.dataVencimentoPlano,
        totalAgendamentos: clientesMaster.totalAgendamentos,
        createdAt: clientesMaster.createdAt,
        
        // Dados relacionados
        statusDescricao: statusClienteNovo.descricao,
        statusCor: statusClienteNovo.corInterface,
        origemNome: origensDados.nome,
        categoriaNome: categoriasClienteNovo.nome,
        tipoDocumento: tiposDocumento.descricao,
        tipoPlano: tiposPlanoNovo.nome
      })
      .from(clientesMaster)
      .leftJoin(statusClienteNovo, eq(clientesMaster.statusId, statusClienteNovo.id))
      .leftJoin(origensDados, eq(clientesMaster.origemDadosId, origensDados.id))
      .leftJoin(categoriasClienteNovo, eq(clientesMaster.categoriaId, categoriasClienteNovo.id))
      .leftJoin(tiposDocumento, eq(clientesMaster.tipoDocumentoId, tiposDocumento.id))
      .leftJoin(tiposPlanoNovo, eq(clientesMaster.tipoPlanoId, tiposPlanoNovo.id))
      .where(and(
        eq(clientesMaster.ativo, true),
        isNull(clientesMaster.deletedAt)
      ))
      .orderBy(desc(clientesMaster.createdAt));
  }

  // Estatísticas dos clientes
  async getEstatisticas() {
    const result = await db
      .select({
        totalClientes: sql<number>`count(*)`,
        clientesAtivos: sql<number>`count(*) filter (where ${statusClienteNovo.codigo} = 'ATIVO')`,
        receitaMensalAtiva: sql<number>`sum(${clientesMaster.valorPlanoAtual}) filter (where ${statusClienteNovo.codigo} = 'ATIVO')`,
        planosVencidos: sql<number>`count(*) filter (where ${clientesMaster.dataVencimentoPlano} < current_date)`,
        vencimentosProximos: sql<number>`count(*) filter (where ${clientesMaster.dataVencimentoPlano} <= current_date + interval '7 days')`,
        satisfacaoMedia: sql<number>`avg(${clientesMaster.satisfacaoUltimaAvaliacao})`
      })
      .from(clientesMaster)
      .leftJoin(statusClienteNovo, eq(clientesMaster.statusId, statusClienteNovo.id))
      .where(and(
        eq(clientesMaster.ativo, true),
        isNull(clientesMaster.deletedAt)
      ));

    return result[0];
  }

  // Buscar clientes por origem
  async getClientesByOrigem(origemCodigo: string): Promise<ClienteMaster[]> {
    return await db
      .select()
      .from(clientesMaster)
      .leftJoin(origensDados, eq(clientesMaster.origemDadosId, origensDados.id))
      .where(and(
        eq(origensDados.codigo, origemCodigo),
        eq(clientesMaster.ativo, true),
        isNull(clientesMaster.deletedAt)
      ))
      .orderBy(desc(clientesMaster.createdAt));
  }

  // Buscar clientes que precisam de sincronização
  async getClientesParaSincronizar(conta: 'principal' | 'andrey'): Promise<ClienteMaster[]> {
    const campoSync = conta === 'principal' 
      ? clientesMaster.sincronizadoAsaasPrincipal 
      : clientesMaster.sincronizadoAsaasAndrey;

    return await db
      .select()
      .from(clientesMaster)
      .where(and(
        eq(campoSync, false),
        eq(clientesMaster.ativo, true),
        isNull(clientesMaster.deletedAt)
      ))
      .orderBy(desc(clientesMaster.createdAt));
  }

  // Marcar cliente como sincronizado
  async marcarComoSincronizado(id: number, conta: 'principal' | 'andrey'): Promise<boolean> {
    const updates = conta === 'principal' 
      ? { sincronizadoAsaasPrincipal: true }
      : { sincronizadoAsaasAndrey: true };

    const result = await db
      .update(clientesMaster)
      .set({
        ...updates,
        dataUltimaSincronizacao: new Date()
      })
      .where(eq(clientesMaster.id, id))
      .returning();

    return result.length > 0;
  }

  // Buscar clientes criados hoje
  async getClientesHoje(): Promise<ClienteMaster[]> {
    return await db
      .select()
      .from(clientesMaster)
      .where(and(
        sql`DATE(${clientesMaster.createdAt}) = CURRENT_DATE`,
        eq(clientesMaster.ativo, true),
        isNull(clientesMaster.deletedAt)
      ))
      .orderBy(desc(clientesMaster.createdAt));
  }

  // Validar integridade dos dados
  async validarIntegridade() {
    const result = await db.execute(sql`SELECT * FROM validar_integridade_clientes()`);
    return result.rows;
  }
}