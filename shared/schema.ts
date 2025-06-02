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
  valorMensal: decimal("valor_mensal", { precision: 10, scale: 2 }).notNull(),
  descricao: text("descricao"),
  categoria: text("categoria"),
  servicosIncluidos: json("servicos_incluidos").$type<number[]>().notNull(),
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

// Cliente ASAAS table (apenas clientes vindos do Asaas)
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  telefone: text("telefone"),
  cpf: text("cpf"),
  asaasCustomerId: text("asaas_customer_id").notNull(), // Obrigatório para clientes Asaas
  // Campos para controle de assinaturas
  planoNome: text("plano_nome"),
  planoValor: decimal("plano_valor", { precision: 10, scale: 2 }),
  formaPagamento: text("forma_pagamento"), // CREDIT_CARD, BOLETO, PIX
  statusAssinatura: text("status_assinatura").default("ATIVO"), // ATIVO, INATIVO, CANCELADO
  dataInicioAssinatura: timestamp("data_inicio_assinatura"),
  dataVencimentoAssinatura: timestamp("data_vencimento_assinatura"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cliente EXTERNO table (pagamentos PIX/Cartão no próprio sistema)
export const clientesExternos = pgTable("clientes_externos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  telefone: text("telefone"),
  cpf: text("cpf"),
  planoNome: text("plano_nome").notNull(),
  planoValor: decimal("plano_valor", { precision: 10, scale: 2 }).notNull(),
  formaPagamento: text("forma_pagamento").notNull(), // PIX, Cartão Débito, Dinheiro
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

export const insertClienteExternoSchema = createInsertSchema(clientesExternos).omit({
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

export type ClienteExterno = typeof clientesExternos.$inferSelect;
export type InsertClienteExterno = z.infer<typeof insertClienteExternoSchema>;

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
