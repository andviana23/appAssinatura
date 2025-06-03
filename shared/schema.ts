import { pgTable, text, serial, integer, boolean, timestamp, decimal, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Barbeiro table
export const barbeiros = pgTable("barbeiros", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  telefone: text("telefone"),
  endereco: text("endereco"),
  comissao: integer("comissao").default(50), // Percentual de comissão
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Serviço table
export const servicos = pgTable("servicos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tempoMinutos: integer("tempo_minutos").notNull(),
  percentualComissao: decimal("percentual_comissao", { precision: 5, scale: 2 }).notNull().default("40.00"),
  isAssinatura: boolean("is_assinatura").notNull().default(true), // Apenas serviços de assinatura
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Plano de Assinatura table
export const planosAssinatura = pgTable("planos_assinatura", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  valorMensal: text("valor_mensal").notNull(),
  descricao: text("descricao"),
  categoria: text("categoria"),
  servicosIncluidos: json("servicos_incluidos").$type<number[]>().notNull(),
  asaasPaymentLinkId: text("asaas_payment_link_id"),
  asaasPaymentLinkUrl: text("asaas_payment_link_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Planos Personalizados (criados pelo admin)
export const planosPersonalizados = pgTable("planos_personalizados", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  categoria: text("categoria").notNull(),
  billingType: text("billing_type").notNull().default("CREDIT_CARD"), // CREDIT_CARD, PIX, BOLETO
  cycle: text("cycle").notNull().default("MONTHLY"), // MONTHLY, YEARLY
  limitesServicos: json("limites_servicos").$type<Record<string, number>>().notNull().default({}),
  beneficios: json("beneficios").$type<string[]>().notNull().default([]),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// TABELA CENTRAL ÚNICA - TODOS OS CLIENTES (Sistema Unificado)
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  telefone: text("telefone"),
  cpf: text("cpf"),
  
  // Campo para identificar origem do cliente
  origem: text("origem").notNull(), // 'ASAAS_PRINCIPAL', 'ASAAS_ANDREY', 'EXTERNO'
  asaasCustomerId: text("asaas_customer_id"), // Opcional - apenas para clientes Asaas
  
  // Campos para controle de assinaturas (obrigatórios para todos)
  planoNome: text("plano_nome").notNull(),
  planoValor: decimal("plano_valor", { precision: 10, scale: 2 }).notNull(),
  formaPagamento: text("forma_pagamento").notNull(), // CREDIT_CARD, BOLETO, PIX, Cartão Débito, Dinheiro
  statusAssinatura: text("status_assinatura").default("ATIVO"), // ATIVO, INATIVO, CANCELADO
  dataInicioAssinatura: timestamp("data_inicio_assinatura").notNull(),
  dataVencimentoAssinatura: timestamp("data_vencimento_assinatura").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Distribuição table
export const distribuicoes = pgTable("distribuicoes", {
  id: serial("id").primaryKey(),
  periodoInicio: timestamp("periodo_inicio").notNull(),
  periodoFim: timestamp("periodo_fim").notNull(),
  faturamentoTotal: decimal("faturamento_total", { precision: 10, scale: 2 }).notNull(),
  percentualComissao: integer("percentual_comissao").notNull().default(40),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Distribuição Item table
export const distribuicaoItens = pgTable("distribuicao_itens", {
  id: serial("id").primaryKey(),
  distribuicaoId: integer("distribuicao_id").references(() => distribuicoes.id).notNull(),
  barbeiroId: integer("barbeiro_id").references(() => barbeiros.id).notNull(),
  servicoId: integer("servico_id").references(() => servicos.id).notNull(),
  quantidade: integer("quantidade").notNull().default(0),
  minutesWorked: integer("minutes_worked").notNull().default(0),
  revenueShare: decimal("revenue_share", { precision: 10, scale: 2 }).notNull().default("0"),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull().default("0"),
});

// Comissão table
export const comissoes = pgTable("comissoes", {
  id: serial("id").primaryKey(),
  barbeiroId: integer("barbeiro_id").references(() => barbeiros.id).notNull(),
  mes: text("mes").notNull(), // YYYY-MM format
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Auth users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("barbeiro"), // 'admin', 'barbeiro', or 'recepcionista'
  nome: text("nome"),
  fotoPerfil: text("foto_perfil"),
  barbeiroId: integer("barbeiro_id").references(() => barbeiros.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Nova tabela para atendimentos com datas
export const atendimentos = pgTable("atendimentos", {
  id: serial("id").primaryKey(),
  barbeiroId: integer("barbeiro_id").notNull().references(() => barbeiros.id, { onDelete: "cascade" }),
  servicoId: integer("servico_id").notNull().references(() => servicos.id, { onDelete: "cascade" }),
  dataAtendimento: timestamp("data_atendimento").notNull(),
  quantidade: integer("quantidade").notNull().default(1),
  mes: text("mes").notNull(), // formato YYYY-MM
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela para controle do total de serviços por mês (administrador define o limite)
export const totalServicos = pgTable("total_servicos", {
  id: serial("id").primaryKey(),
  servicoId: integer("servico_id").notNull().references(() => servicos.id, { onDelete: "cascade" }),
  mes: text("mes").notNull(), // formato YYYY-MM
  totalMes: integer("total_mes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agendamentos table
export const agendamentos = pgTable("agendamentos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id).notNull(),
  barbeiroId: integer("barbeiro_id").references(() => barbeiros.id).notNull(),
  servicoId: integer("servico_id").references(() => servicos.id).notNull(),
  dataHora: timestamp("data_hora").notNull(),
  status: text("status", { enum: ["AGENDADO", "FINALIZADO"] }).notNull().default("AGENDADO"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lista da Vez - Atendimentos Diários
export const atendimentosDiarios = pgTable("atendimentos_diarios", {
  id: serial("id").primaryKey(),
  barbeiroId: integer("barbeiro_id").references(() => barbeiros.id).notNull(),
  data: text("data").notNull(), // formato "YYYY-MM-DD"
  mesAno: text("mes_ano").notNull(), // formato "YYYY-MM"
  tipoAtendimento: text("tipo_atendimento").default("NORMAL"), // NORMAL, MANUAL, PASSOU_VEZ
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueBarbeiroDataMes: unique("unique_barbeiro_data_mes").on(table.barbeiroId, table.data, table.mesAno),
}));

// Configuração da sequência de barbeiros
export const sequenciaBarbeiros = pgTable("sequencia_barbeiros", {
  id: serial("id").primaryKey(),
  barbeiroId: integer("barbeiro_id").references(() => barbeiros.id).notNull().unique(),
  ordem: integer("ordem").notNull(),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertBarbeiroSchema = createInsertSchema(barbeiros).omit({
  id: true,
  createdAt: true,
});

export const insertServicoSchema = createInsertSchema(servicos).omit({
  id: true,
  createdAt: true,
  isAssinatura: true, // Sempre true, não precisa no form
}).extend({
  percentualComissao: z.union([z.string(), z.number()]).transform(val => String(val))
});

export const insertPlanoAssinaturaSchema = createInsertSchema(planosAssinatura).omit({
  id: true,
  createdAt: true,
});

export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  createdAt: true,
});

export const insertDistribuicaoSchema = createInsertSchema(distribuicoes).omit({
  id: true,
  createdAt: true,
});

export const insertDistribuicaoItemSchema = createInsertSchema(distribuicaoItens).omit({
  id: true,
});

export const insertComissaoSchema = createInsertSchema(comissoes).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAtendimentoSchema = createInsertSchema(atendimentos).omit({
  id: true,
  createdAt: true,
});

export const insertTotalServicoSchema = createInsertSchema(totalServicos).omit({
  id: true,
  createdAt: true,
});

export const insertPlanoPersonalizadoSchema = createInsertSchema(planosPersonalizados).omit({
  id: true,
  createdAt: true,
});

export const insertAgendamentoSchema = createInsertSchema(agendamentos).omit({
  id: true,
  createdAt: true,
  status: true,
}).extend({
  clienteId: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? parseInt(val) : val
  ),
  barbeiroId: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? parseInt(val) : val
  ),
  servicoId: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? parseInt(val) : val
  ),
  dataHora: z.union([z.string(), z.date()]).transform(val => 
    typeof val === 'string' ? new Date(val) : val
  )
});

export const insertAtendimentoDiarioSchema = createInsertSchema(atendimentosDiarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tabela para gerenciar ordem personalizada da fila
export const ordemFila = pgTable("ordem_fila", {
  id: serial("id").primaryKey(),
  barbeiroId: integer("barbeiro_id").notNull().references(() => barbeiros.id),
  ordemCustomizada: integer("ordem_customizada").notNull(), // Posição definida pelo admin
  ativo: boolean("ativo").notNull().default(true), // Status ativo/inativo na fila
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueBarbeiro: unique().on(table.barbeiroId),
  };
});

export type OrdemFila = typeof ordemFila.$inferSelect;
export type InsertOrdemFila = typeof ordemFila.$inferInsert;

export const insertOrdemFilaSchema = createInsertSchema(ordemFila).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSequenciaBarbeiroSchema = createInsertSchema(sequenciaBarbeiros).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Barbeiro = typeof barbeiros.$inferSelect;
export type InsertBarbeiro = z.infer<typeof insertBarbeiroSchema>;

export type Servico = typeof servicos.$inferSelect;
export type InsertServico = z.infer<typeof insertServicoSchema>;

export type PlanoAssinatura = typeof planosAssinatura.$inferSelect;
export type InsertPlanoAssinatura = z.infer<typeof insertPlanoAssinaturaSchema>;

export type Cliente = typeof clientes.$inferSelect;

export type PlanoPersonalizado = typeof planosPersonalizados.$inferSelect;
export type InsertPlanoPersonalizado = z.infer<typeof insertPlanoPersonalizadoSchema>;
export type InsertCliente = z.infer<typeof insertClienteSchema>;

export type Distribuicao = typeof distribuicoes.$inferSelect;
export type InsertDistribuicao = z.infer<typeof insertDistribuicaoSchema>;

export type DistribuicaoItem = typeof distribuicaoItens.$inferSelect;
export type InsertDistribuicaoItem = z.infer<typeof insertDistribuicaoItemSchema>;

export type Comissao = typeof comissoes.$inferSelect;
export type InsertComissao = z.infer<typeof insertComissaoSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Atendimento = typeof atendimentos.$inferSelect;
export type InsertAtendimento = z.infer<typeof insertAtendimentoSchema>;

export type TotalServico = typeof totalServicos.$inferSelect;
export type InsertTotalServico = z.infer<typeof insertTotalServicoSchema>;

export type Agendamento = typeof agendamentos.$inferSelect;
export type InsertAgendamento = z.infer<typeof insertAgendamentoSchema>;

export type AtendimentoDiario = typeof atendimentosDiarios.$inferSelect;
export type InsertAtendimentoDiario = z.infer<typeof insertAtendimentoDiarioSchema>;

export type SequenciaBarbeiro = typeof sequenciaBarbeiros.$inferSelect;
export type InsertSequenciaBarbeiro = z.infer<typeof insertSequenciaBarbeiroSchema>;

// =====================================================
// NOVA ESTRUTURA DE CLIENTES - SISTEMA MODERNO
// =====================================================

// Tabelas auxiliares para a nova estrutura
export const tiposDocumento = pgTable("tipos_documento", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  descricao: text("descricao").notNull(),
  formatoValidacao: text("formato_validacao"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statusClienteNovo = pgTable("status_cliente", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  descricao: text("descricao").notNull(),
  permiteAgendamento: boolean("permite_agendamento").default(true),
  corInterface: text("cor_interface").default('#000000'),
  ordemExibicao: integer("ordem_exibicao").default(0),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categoriasClienteNovo = pgTable("categorias_cliente", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  descricao: text("descricao"),
  corIdentificacao: text("cor_identificacao").default('#000000'),
  prioridadeAtendimento: integer("prioridade_atendimento").default(1),
  descontoPadrao: decimal("desconto_padrao", { precision: 5, scale: 2 }).default("0.00"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tiposPlanoNovo = pgTable("tipos_plano", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  valorBase: decimal("valor_base", { precision: 10, scale: 2 }).notNull(),
  duracaoDias: integer("duracao_dias").notNull().default(30),
  permiteDesconto: boolean("permite_desconto").default(true),
  limiteAgendamentos: integer("limite_agendamentos"),
  servicosIncluidos: json("servicos_incluidos").$type<string[]>(),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const origensDados = pgTable("origens_dados", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  nome: text("nome").notNull(),
  endpointApi: text("endpoint_api"),
  requerSincronizacao: boolean("requer_sincronizacao").default(false),
  ultimoSync: timestamp("ultimo_sync"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabela principal de clientes - Nova estrutura moderna
export const clientesMaster = pgTable("clientes_master", {
  id: serial("id").primaryKey(),
  idAsaasPrincipal: text("id_asaas_principal"),
  idAsaasAndrey: text("id_asaas_andrey"),
  idAsaasNumerico: integer("id_asaas_numerico"),
  codigoInterno: text("codigo_interno").unique(),
  
  // Dados pessoais
  nomeCompleto: text("nome_completo").notNull(),
  nomeSocial: text("nome_social"),
  email: text("email").notNull(),
  emailSecundario: text("email_secundario"),
  
  // Documentos
  tipoDocumentoId: integer("tipo_documento_id").references(() => tiposDocumento.id),
  numeroDocumento: text("numero_documento"),
  documentoSecundario: text("documento_secundario"),
  
  // Contatos
  telefonePrincipal: text("telefone_principal"),
  telefoneSecundario: text("telefone_secundario"),
  telefoneWhatsapp: text("telefone_whatsapp"),
  prefereWhatsapp: boolean("prefere_whatsapp").default(false),
  
  // Endereço
  cep: text("cep"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: text("estado"),
  pais: text("pais").default('BRA'),
  
  // Dados do plano
  tipoPlanoId: integer("tipo_plano_id").references(() => tiposPlanoNovo.id),
  valorPlanoAtual: decimal("valor_plano_atual", { precision: 10, scale: 2 }),
  valorPlanoOriginal: decimal("valor_plano_original", { precision: 10, scale: 2 }),
  descontoAplicado: decimal("desconto_aplicado", { precision: 5, scale: 2 }).default("0.00"),
  dataInicioPlano: timestamp("data_inicio_plano"),
  dataVencimentoPlano: timestamp("data_vencimento_plano"),
  diaVencimento: integer("dia_vencimento").default(1),
  
  // Status e categorização
  statusId: integer("status_id").references(() => statusClienteNovo.id).notNull(),
  categoriaId: integer("categoria_id").references(() => categoriasClienteNovo.id),
  origemDadosId: integer("origem_dados_id").references(() => origensDados.id).notNull(),
  
  // Dados financeiros
  formaPagamentoPreferida: text("forma_pagamento_preferida"),
  limiteCredito: decimal("limite_credito", { precision: 10, scale: 2 }).default("0.00"),
  descontoFidelidade: decimal("desconto_fidelidade", { precision: 5, scale: 2 }).default("0.00"),
  totalGastoHistorico: decimal("total_gasto_historico", { precision: 12, scale: 2 }).default("0.00"),
  
  // Preferências
  observacoes: text("observacoes"),
  observacoesInternas: text("observacoes_internas"),
  preferencasAgendamento: json("preferencias_agendamento"),
  restricoesServicos: json("restricoes_servicos").$type<string[]>(),
  
  // Controle de qualidade
  satisfacaoUltimaAvaliacao: integer("satisfacao_ultima_avaliacao"),
  dataUltimaAvaliacao: timestamp("data_ultima_avaliacao"),
  totalAgendamentos: integer("total_agendamentos").default(0),
  totalCancelamentos: integer("total_cancelamentos").default(0),
  totalNoShows: integer("total_no_shows").default(0),
  
  // Controle do sistema
  ativo: boolean("ativo").default(true),
  bloqueado: boolean("bloqueado").default(false),
  motivoBloqueio: text("motivo_bloqueio"),
  aceitaMarketing: boolean("aceita_marketing").default(true),
  aceitaLembreteWhatsapp: boolean("aceita_lembrete_whatsapp").default(true),
  aceitaLembreteEmail: boolean("aceita_lembrete_email").default(true),
  
  // Sincronização
  sincronizadoAsaasPrincipal: boolean("sincronizado_asaas_principal").default(false),
  sincronizadoAsaasAndrey: boolean("sincronizado_asaas_andrey").default(false),
  dataUltimaSincronizacao: timestamp("data_ultima_sincronizacao"),
  hashDadosSync: text("hash_dados_sync"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// Histórico de alterações
export const clientesHistorico = pgTable("clientes_historico", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientesMaster.id),
  campoAlterado: text("campo_alterado").notNull(),
  valorAnterior: text("valor_anterior"),
  valorNovo: text("valor_novo"),
  motivoAlteracao: text("motivo_alteracao"),
  usuarioAlteracao: text("usuario_alteracao"),
  ipAlteracao: text("ip_alteracao"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Log de sincronizações
export const syncLog = pgTable("sync_log", {
  id: serial("id").primaryKey(),
  origemDadosId: integer("origem_dados_id").references(() => origensDados.id),
  tipoOperacao: text("tipo_operacao").notNull(),
  registrosProcessados: integer("registros_processados").default(0),
  registrosErro: integer("registros_erro").default(0),
  tempoProcessamento: text("tempo_processamento"),
  detalhesErro: text("detalhes_erro"),
  status: text("status").default("EXECUTANDO"),
  createdAt: timestamp("created_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
});

// Schemas de inserção para as novas tabelas
export const insertClienteMasterSchema = createInsertSchema(clientesMaster).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  codigoInterno: true,
  idAsaasNumerico: true,
});

export const insertTipoDocumentoSchema = createInsertSchema(tiposDocumento).omit({
  id: true,
  createdAt: true,
});

export const insertStatusClienteNovoSchema = createInsertSchema(statusClienteNovo).omit({
  id: true,
  createdAt: true,
});

export const insertCategoriaClienteNovoSchema = createInsertSchema(categoriasClienteNovo).omit({
  id: true,
  createdAt: true,
});

export const insertTipoPlanoNovoSchema = createInsertSchema(tiposPlanoNovo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrigemDadosSchema = createInsertSchema(origensDados).omit({
  id: true,
  createdAt: true,
});

// Tipos para as novas tabelas
export type ClienteMaster = typeof clientesMaster.$inferSelect;
export type InsertClienteMaster = z.infer<typeof insertClienteMasterSchema>;

export type TipoDocumento = typeof tiposDocumento.$inferSelect;
export type InsertTipoDocumento = z.infer<typeof insertTipoDocumentoSchema>;

export type StatusClienteNovo = typeof statusClienteNovo.$inferSelect;
export type InsertStatusClienteNovo = z.infer<typeof insertStatusClienteNovoSchema>;

export type CategoriaClienteNovo = typeof categoriasClienteNovo.$inferSelect;
export type InsertCategoriaClienteNovo = z.infer<typeof insertCategoriaClienteNovoSchema>;

export type TipoPlanoNovo = typeof tiposPlanoNovo.$inferSelect;
export type InsertTipoPlanoNovo = z.infer<typeof insertTipoPlanoNovoSchema>;

export type OrigemDados = typeof origensDados.$inferSelect;
export type InsertOrigemDados = z.infer<typeof insertOrigemDadosSchema>;

export type ClienteHistorico = typeof clientesHistorico.$inferSelect;
export type SyncLog = typeof syncLog.$inferSelect;

// =====================================================
// TABELA DE PROFISSIONAIS (BARBEIROS E RECEPCIONISTAS)
// =====================================================

export const profissionais = pgTable("profissionais", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  telefone: text("telefone"),
  email: text("email").notNull().unique(),
  senha: text("senha").notNull(), // Hash da senha com bcrypt
  tipo: text("tipo").notNull(), // 'barbeiro' ou 'recepcionista'
  ativo: boolean("ativo").notNull().default(true),
  dataCadastro: timestamp("data_cadastro").defaultNow().notNull(),
  ultimoLogin: timestamp("ultimo_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema de inserção para profissionais
export const insertProfissionalSchema = createInsertSchema(profissionais).omit({
  id: true,
  dataCadastro: true,
  createdAt: true,
  updatedAt: true,
  ultimoLogin: true,
}).extend({
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  email: z.string().email("Email inválido"),
  tipo: z.enum(["barbeiro", "recepcionista"], {
    errorMap: () => ({ message: "Tipo deve ser 'barbeiro' ou 'recepcionista'" })
  }),
});

// Schema para atualização de profissional
export const updateProfissionalSchema = createInsertSchema(profissionais).omit({
  id: true,
  dataCadastro: true,
  createdAt: true,
  updatedAt: true,
  ultimoLogin: true,
  senha: true, // Senha não pode ser atualizada por este schema
}).extend({
  email: z.string().email("Email inválido").optional(),
  tipo: z.enum(["barbeiro", "recepcionista"], {
    errorMap: () => ({ message: "Tipo deve ser 'barbeiro' ou 'recepcionista'" })
  }).optional(),
});

// Schema para mudança de senha
export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Senha atual é obrigatória"),
  novaSenha: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmarSenha: z.string().min(6, "Confirmação de senha deve ter pelo menos 6 caracteres"),
}).refine((data) => data.novaSenha === data.confirmarSenha, {
  message: "Nova senha e confirmação devem ser iguais",
  path: ["confirmarSenha"],
});

// Tipos para profissionais
export type Profissional = typeof profissionais.$inferSelect;
export type InsertProfissional = z.infer<typeof insertProfissionalSchema>;
export type UpdateProfissional = z.infer<typeof updateProfissionalSchema>;
export type AlterarSenha = z.infer<typeof alterarSenhaSchema>;
