import { pgTable, text, serial, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Barbeiro table
export const barbeiros = pgTable("barbeiros", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Serviço table
export const servicos = pgTable("servicos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tempoMinutos: integer("tempo_minutos").notNull(),
  isAssinatura: boolean("is_assinatura").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Plano de Assinatura table
export const planosAssinatura = pgTable("planos_assinatura", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  valorMensal: decimal("valor_mensal", { precision: 10, scale: 2 }).notNull(),
  descricao: text("descricao"),
  servicosIncluidos: json("servicos_incluidos").$type<number[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cliente table
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  asaasCustomerId: text("asaas_customer_id"),
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
  role: text("role").notNull().default("barbeiro"), // 'admin' or 'barbeiro'
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

// Insert schemas
export const insertBarbeiroSchema = createInsertSchema(barbeiros).omit({
  id: true,
  createdAt: true,
});

export const insertServicoSchema = createInsertSchema(servicos).omit({
  id: true,
  createdAt: true,
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

// Types
export type Barbeiro = typeof barbeiros.$inferSelect;
export type InsertBarbeiro = z.infer<typeof insertBarbeiroSchema>;

export type Servico = typeof servicos.$inferSelect;
export type InsertServico = z.infer<typeof insertServicoSchema>;

export type PlanoAssinatura = typeof planosAssinatura.$inferSelect;
export type InsertPlanoAssinatura = z.infer<typeof insertPlanoAssinaturaSchema>;

export type Cliente = typeof clientes.$inferSelect;
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
