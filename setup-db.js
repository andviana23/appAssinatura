import postgres from 'postgres';
import bcrypt from 'bcrypt';

const sql = postgres(process.env.DATABASE_URL);

async function setupDatabase() {
  try {
    console.log('🔧 Configurando banco de dados...');
    
    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS "barbeiros" (
        "id" serial PRIMARY KEY NOT NULL,
        "nome" text NOT NULL,
        "email" text NOT NULL,
        "ativo" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "barbeiros_email_unique" UNIQUE("email")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "servicos" (
        "id" serial PRIMARY KEY NOT NULL,
        "nome" text NOT NULL,
        "tempo_minutos" integer NOT NULL,
        "is_assinatura" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "planos_assinatura" (
        "id" serial PRIMARY KEY NOT NULL,
        "nome" text NOT NULL,
        "valor_mensal" numeric(10,2) NOT NULL,
        "descricao" text,
        "servicos_incluidos" json NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "clientes" (
        "id" serial PRIMARY KEY NOT NULL,
        "nome" text NOT NULL,
        "email" text NOT NULL,
        "asaas_customer_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "distribuicoes" (
        "id" serial PRIMARY KEY NOT NULL,
        "periodo_inicio" timestamp NOT NULL,
        "periodo_fim" timestamp NOT NULL,
        "faturamento_total" numeric(10,2) NOT NULL,
        "percentual_comissao" integer DEFAULT 40 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "comissoes" (
        "id" serial PRIMARY KEY NOT NULL,
        "barbeiro_id" integer NOT NULL,
        "mes" text NOT NULL,
        "valor" numeric(10,2) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "email" text NOT NULL,
        "password" text NOT NULL,
        "role" text DEFAULT 'barbeiro' NOT NULL,
        "barbeiro_id" integer,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
      );
    `;

    console.log('✅ Tabelas criadas com sucesso');

    // Add foreign key constraints
    try {
      await sql`
        ALTER TABLE "distribuicao_itens" 
        ADD CONSTRAINT "distribuicao_itens_distribuicao_id_fk" 
        FOREIGN KEY ("distribuicao_id") REFERENCES "distribuicoes"("id")
      `;
    } catch (e) {
      // Constraint may already exist
    }

    try {
      await sql`
        ALTER TABLE "distribuicao_itens" 
        ADD CONSTRAINT "distribuicao_itens_barbeiro_id_fk" 
        FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id")
      `;
    } catch (e) {
      // Constraint may already exist
    }

    try {
      await sql`
        ALTER TABLE "distribuicao_itens" 
        ADD CONSTRAINT "distribuicao_itens_servico_id_fk" 
        FOREIGN KEY ("servico_id") REFERENCES "servicos"("id")
      `;
    } catch (e) {
      // Constraint may already exist
    }

    try {
      await sql`
        ALTER TABLE "comissoes" 
        ADD CONSTRAINT "comissoes_barbeiro_id_fk" 
        FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id")
      `;
    } catch (e) {
      // Constraint may already exist
    }

    try {
      await sql`
        ALTER TABLE "users" 
        ADD CONSTRAINT "users_barbeiro_id_fk" 
        FOREIGN KEY ("barbeiro_id") REFERENCES "barbeiros"("id")
      `;
    } catch (e) {
      // Constraint may already exist
    }

    console.log('✅ Constraints adicionadas');

    // Insert sample data
    await sql`
      INSERT INTO "barbeiros" ("nome", "email", "ativo") VALUES
      ('João Silva', 'joao@tratodebarbados.com', true),
      ('Carlos Santos', 'carlos@tratodebarbados.com', true),
      ('Pedro Lima', 'pedro@tratodebarbados.com', true),
      ('Rafael Oliveira', 'rafael@tratodebarbados.com', true)
      ON CONFLICT (email) DO NOTHING
    `;

    await sql`
      INSERT INTO "servicos" ("nome", "tempo_minutos", "is_assinatura") VALUES
      ('Corte Masculino', 30, true),
      ('Corte + Barba', 50, true),
      ('Barba Tradicional', 20, true),
      ('Hidratação Capilar', 15, true),
      ('Corte Infantil', 25, true),
      ('Sobrancelha', 10, false),
      ('Limpeza de Pele', 30, false)
    `;

    await sql`
      INSERT INTO "planos_assinatura" ("nome", "valor_mensal", "descricao", "servicos_incluidos") VALUES
      ('Plano Básico', 89.90, 'Corte mensal + 1 barba', '[1, 3]'),
      ('Plano Premium', 149.90, 'Corte + barba ilimitados + hidratação', '[1, 2, 3, 4]'),
      ('Plano Família', 199.90, 'Plano premium + 2 cortes infantis', '[1, 2, 3, 4, 5]')
    `;

    // Create hashed passwords
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const barbeiroPasswordHash = await bcrypt.hash('barbeiro123', 10);

    // Create admin user
    await sql`
      INSERT INTO "users" ("email", "password", "role") VALUES
      ('admin@tratodebarbados.com', ${adminPasswordHash}, 'admin')
      ON CONFLICT (email) DO NOTHING
    `;

    // Create barbeiro users - get barbeiro IDs first
    const barbeiros = await sql`SELECT id, email FROM barbeiros`;
    
    for (const barbeiro of barbeiros) {
      await sql`
        INSERT INTO "users" ("email", "password", "role", "barbeiro_id") VALUES
        (${barbeiro.email}, ${barbeiroPasswordHash}, 'barbeiro', ${barbeiro.id})
        ON CONFLICT (email) DO NOTHING
      `;
    }

    // Sample commission data for current month
    await sql`
      INSERT INTO "comissoes" ("barbeiro_id", "mes", "valor") VALUES
      (1, '2025-05', 2840.50),
      (2, '2025-05', 3150.75),
      (3, '2025-05', 1890.25),
      (4, '2025-05', 2445.80)
      ON CONFLICT DO NOTHING
    `;

    console.log('✅ Dados de exemplo inseridos');
    console.log('');
    console.log('🎉 Banco de dados configurado com sucesso!');
    console.log('');
    console.log('👤 Usuários criados:');
    console.log('   Admin: admin@tratodebarbados.com / admin123');
    console.log('   Barbeiros: {email}@tratodebarbados.com / barbeiro123');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase();