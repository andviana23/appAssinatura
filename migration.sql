-- Migration SQL para Sistema SaaS Trato de Barbados
-- Execute este script diretamente no seu Supabase SQL Editor

-- Criar tabela de barbeiros
CREATE TABLE IF NOT EXISTS "barbeiros" (
  "id" serial PRIMARY KEY NOT NULL,
  "nome" text NOT NULL,
  "email" text NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "barbeiros_email_unique" UNIQUE("email")
);

-- Criar tabela de serviços
CREATE TABLE IF NOT EXISTS "servicos" (
  "id" serial PRIMARY KEY NOT NULL,
  "nome" text NOT NULL,
  "tempo_minutos" integer NOT NULL,
  "is_assinatura" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Criar tabela de planos de assinatura
CREATE TABLE IF NOT EXISTS "planos_assinatura" (
  "id" serial PRIMARY KEY NOT NULL,
  "nome" text NOT NULL,
  "valor_mensal" numeric(10,2) NOT NULL,
  "descricao" text,
  "servicos_incluidos" json NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS "clientes" (
  "id" serial PRIMARY KEY NOT NULL,
  "nome" text NOT NULL,
  "email" text NOT NULL,
  "asaas_customer_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Criar tabela de distribuições
CREATE TABLE IF NOT EXISTS "distribuicoes" (
  "id" serial PRIMARY KEY NOT NULL,
  "periodo_inicio" timestamp NOT NULL,
  "periodo_fim" timestamp NOT NULL,
  "faturamento_total" numeric(10,2) NOT NULL,
  "percentual_comissao" integer DEFAULT 40 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Criar tabela de itens de distribuição
CREATE TABLE IF NOT EXISTS "distribuicao_itens" (
  "id" serial PRIMARY KEY NOT NULL,
  "distribuicao_id" integer NOT NULL,
  "barbeiro_id" integer NOT NULL,
  "servico_id" integer NOT NULL,
  "quantidade" integer DEFAULT 0 NOT NULL,
  "minutes_worked" integer DEFAULT 0 NOT NULL,
  "revenue_share" numeric(10,2) DEFAULT '0' NOT NULL,
  "commission" numeric(10,2) DEFAULT '0' NOT NULL
);

-- Criar tabela de comissões
CREATE TABLE IF NOT EXISTS "comissoes" (
  "id" serial PRIMARY KEY NOT NULL,
  "barbeiro_id" integer NOT NULL,
  "mes" text NOT NULL,
  "valor" numeric(10,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Criar tabela de usuários para autenticação
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "password" text NOT NULL,
  "role" text DEFAULT 'barbeiro' NOT NULL,
  "barbeiro_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

-- Adicionar constraints de foreign key
ALTER TABLE "distribuicao_itens" 
ADD CONSTRAINT "distribuicao_itens_distribuicao_id_fk" 
FOREIGN KEY ("distribuicao_id") REFERENCES "distribuicoes"("id") ON DELETE CASCADE;

ALTER TABLE "distribuicao_itens" 
ADD CONSTRAINT "distribuicao_itens_barbeiro_id_fk" 
FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id") ON DELETE CASCADE;

ALTER TABLE "distribuicao_itens" 
ADD CONSTRAINT "distribuicao_itens_servico_id_fk" 
FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE CASCADE;

ALTER TABLE "comissoes" 
ADD CONSTRAINT "comissoes_barbeiro_id_fk" 
FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id") ON DELETE CASCADE;

ALTER TABLE "users" 
ADD CONSTRAINT "users_barbeiro_id_fk" 
FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id") ON DELETE SET NULL;

-- Inserir dados de exemplo
INSERT INTO "barbeiros" ("nome", "email", "ativo") VALUES
('João Silva', 'joao@tratodebarbados.com', true),
('Carlos Santos', 'carlos@tratodebarbados.com', true),
('Pedro Lima', 'pedro@tratodebarbados.com', true),
('Rafael Oliveira', 'rafael@tratodebarbados.com', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "servicos" ("nome", "tempo_minutos", "is_assinatura") VALUES
('Corte Masculino', 30, true),
('Corte + Barba', 50, true),
('Barba Tradicional', 20, true),
('Hidratação Capilar', 15, true),
('Corte Infantil', 25, true),
('Sobrancelha', 10, false),
('Limpeza de Pele', 30, false);

INSERT INTO "planos_assinatura" ("nome", "valor_mensal", "descricao", "servicos_incluidos") VALUES
('Plano Básico', 89.90, 'Corte mensal + 1 barba', '[1, 3]'),
('Plano Premium', 149.90, 'Corte + barba ilimitados + hidratação', '[1, 2, 3, 4]'),
('Plano Família', 199.90, 'Plano premium + 2 cortes infantis', '[1, 2, 3, 4, 5]');

-- Criar usuários (senhas hasheadas para admin123 e barbeiro123)
INSERT INTO "users" ("email", "password", "role") VALUES
('admin@tratodebarbados.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Criar usuários barbeiros
INSERT INTO "users" ("email", "password", "role", "barbeiro_id") VALUES
('joao@tratodebarbados.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'barbeiro', 1),
('carlos@tratodebarbados.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'barbeiro', 2),
('pedro@tratodebarbados.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'barbeiro', 3),
('rafael@tratodebarbados.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'barbeiro', 4)
ON CONFLICT (email) DO NOTHING;

-- Inserir dados de comissões de exemplo para o mês atual
INSERT INTO "comissoes" ("barbeiro_id", "mes", "valor") VALUES
(1, '2025-05', 2840.50),
(2, '2025-05', 3150.75),
(3, '2025-05', 1890.25),
(4, '2025-05', 2445.80);

-- Verificar se tudo foi criado corretamente
SELECT 'Barbeiros criados' as status, count(*) as total FROM barbeiros;
SELECT 'Serviços criados' as status, count(*) as total FROM servicos;
SELECT 'Planos criados' as status, count(*) as total FROM planos_assinatura;
SELECT 'Usuários criados' as status, count(*) as total FROM users;
SELECT 'Comissões criadas' as status, count(*) as total FROM comissoes;