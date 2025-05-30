-- Migration para adicionar tabela de controle de totais de serviços
-- Execute este script no Supabase SQL Editor

-- Criar tabela de controle de totais de serviços por mês
CREATE TABLE IF NOT EXISTS "total_servicos" (
  "id" serial PRIMARY KEY NOT NULL,
  "servico_id" integer NOT NULL,
  "mes" text NOT NULL,
  "total_mes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "total_servicos_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE CASCADE,
  CONSTRAINT "total_servicos_unique" UNIQUE("servico_id", "mes")
);

-- Inserir alguns totais de exemplo para maio 2025
INSERT INTO "total_servicos" ("servico_id", "mes", "total_mes") VALUES
(15, '2025-05', 100),  -- Corte: 100 por mês
(16, '2025-05', 60),   -- Corte e Barba: 60 por mês
(17, '2025-05', 40),   -- Barba: 40 por mês
(18, '2025-05', 20)    -- Acabamento: 20 por mês
ON CONFLICT (servico_id, mes) DO NOTHING;

-- Verificar se foi criado corretamente
SELECT 'Totais de serviços criados' as status, count(*) as total FROM total_servicos;