-- Migration para adicionar tabela de atendimentos
-- Execute este script no Supabase SQL Editor

-- Criar tabela de atendimentos
CREATE TABLE IF NOT EXISTS "atendimentos" (
  "id" serial PRIMARY KEY NOT NULL,
  "barbeiro_id" integer NOT NULL,
  "servico_id" integer NOT NULL,
  "data_atendimento" timestamp NOT NULL,
  "quantidade" integer DEFAULT 1 NOT NULL,
  "mes" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "atendimentos_barbeiro_id_fk" FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id") ON DELETE CASCADE,
  CONSTRAINT "atendimentos_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE CASCADE
);

-- Inserir alguns dados de exemplo para teste
INSERT INTO "atendimentos" ("barbeiro_id", "servico_id", "data_atendimento", "quantidade", "mes") VALUES
(1, 15, '2025-05-10 09:00:00', 2, '2025-05'),
(1, 16, '2025-05-10 14:00:00', 1, '2025-05'),
(1, 17, '2025-05-12 10:30:00', 3, '2025-05'),
(2, 15, '2025-05-11 11:00:00', 1, '2025-05'),
(2, 16, '2025-05-15 16:00:00', 2, '2025-05'),
(3, 17, '2025-05-14 13:00:00', 1, '2025-05'),
(4, 15, '2025-05-16 08:30:00', 2, '2025-05');

-- Verificar se foi criado corretamente
SELECT 'Atendimentos criados' as status, count(*) as total FROM atendimentos;