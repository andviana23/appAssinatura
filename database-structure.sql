-- =====================================================
-- SISTEMA DE CADASTRO DE CLIENTES - ESTRUTURA COMPLETA
-- Desenvolvido seguindo Clean Code e boas práticas SQL
-- Integração com APIs Asaas (Principal e Andrey)
-- =====================================================

-- =====================================================
-- 1. TABELAS AUXILIARES E DOMÍNIOS
-- =====================================================

-- Tabela para tipos de documento
CREATE TABLE IF NOT EXISTS tipos_documento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE, -- CPF, CNPJ, RG, etc
    descricao VARCHAR(100) NOT NULL,
    formato_validacao VARCHAR(50), -- Regex para validação
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para status de cliente
CREATE TABLE IF NOT EXISTS status_cliente (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE, -- ATIVO, INATIVO, SUSPENSO, etc
    descricao VARCHAR(100) NOT NULL,
    permite_agendamento BOOLEAN DEFAULT true,
    cor_interface VARCHAR(7) DEFAULT '#000000', -- Cor hexadecimal para UI
    ordem_exibicao INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para categorias de cliente
CREATE TABLE IF NOT EXISTS categorias_cliente (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    cor_identificacao VARCHAR(7) DEFAULT '#000000',
    prioridade_atendimento INTEGER DEFAULT 1, -- 1=Normal, 2=Prioritário, etc
    desconto_padrao DECIMAL(5,2) DEFAULT 0.00,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para tipos de plano/produto
CREATE TABLE IF NOT EXISTS tipos_plano (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    valor_base DECIMAL(10,2) NOT NULL,
    duracao_dias INTEGER NOT NULL DEFAULT 30,
    permite_desconto BOOLEAN DEFAULT true,
    limite_agendamentos INTEGER, -- NULL = ilimitado
    servicos_incluidos TEXT[], -- Array de IDs de serviços
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para origem dos dados
CREATE TABLE IF NOT EXISTS origens_dados (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE, -- ASAAS_PRINCIPAL, ASAAS_ANDREY, MANUAL, etc
    nome VARCHAR(100) NOT NULL,
    endpoint_api VARCHAR(255),
    requer_sincronizacao BOOLEAN DEFAULT false,
    ultimo_sync TIMESTAMP,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. TABELA PRINCIPAL DE CLIENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS clientes_master (
    -- Chaves primárias e identificação
    id SERIAL PRIMARY KEY,
    id_asaas_principal VARCHAR(50), -- ID da conta principal Asaas
    id_asaas_andrey VARCHAR(50), -- ID da conta Andrey Asaas
    id_asaas_numerico INTEGER, -- Conversão numérica do ID Asaas
    codigo_interno VARCHAR(20) UNIQUE, -- Código interno gerado automaticamente
    
    -- Dados pessoais básicos
    nome_completo VARCHAR(255) NOT NULL,
    nome_social VARCHAR(255), -- Nome social para casos específicos
    email VARCHAR(255) NOT NULL,
    email_secundario VARCHAR(255),
    
    -- Documentos
    tipo_documento_id INTEGER REFERENCES tipos_documento(id),
    numero_documento VARCHAR(20),
    documento_secundario VARCHAR(20), -- RG quando CPF é principal, etc
    
    -- Contatos
    telefone_principal VARCHAR(20),
    telefone_secundario VARCHAR(20),
    telefone_whatsapp VARCHAR(20),
    prefere_whatsapp BOOLEAN DEFAULT false,
    
    -- Endereço completo
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(10),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    pais VARCHAR(3) DEFAULT 'BRA',
    endereco_cobranca_diferente BOOLEAN DEFAULT false,
    
    -- Endereço de cobrança (quando diferente)
    cep_cobranca VARCHAR(10),
    logradouro_cobranca VARCHAR(255),
    numero_cobranca VARCHAR(10),
    complemento_cobranca VARCHAR(100),
    bairro_cobranca VARCHAR(100),
    cidade_cobranca VARCHAR(100),
    estado_cobranca VARCHAR(2),
    
    -- Dados do plano/assinatura
    tipo_plano_id INTEGER REFERENCES tipos_plano(id),
    valor_plano_atual DECIMAL(10,2),
    valor_plano_original DECIMAL(10,2),
    desconto_aplicado DECIMAL(5,2) DEFAULT 0.00,
    data_inicio_plano DATE,
    data_vencimento_plano DATE,
    dia_vencimento INTEGER DEFAULT 1, -- Dia do mês para cobrança
    
    -- Status e categorização
    status_id INTEGER REFERENCES status_cliente(id) NOT NULL,
    categoria_id INTEGER REFERENCES categorias_cliente(id),
    origem_dados_id INTEGER REFERENCES origens_dados(id) NOT NULL,
    
    -- Dados financeiros
    forma_pagamento_preferida VARCHAR(50),
    limite_credito DECIMAL(10,2) DEFAULT 0.00,
    desconto_fidelidade DECIMAL(5,2) DEFAULT 0.00,
    total_gasto_historico DECIMAL(12,2) DEFAULT 0.00,
    
    -- Preferências e observações
    observacoes TEXT,
    observacoes_internas TEXT, -- Apenas para funcionários
    preferencias_agendamento JSONB, -- Horários preferenciais, etc
    restricoes_servicos TEXT[], -- Array de serviços que não pode fazer
    
    -- Controle de qualidade e relacionamento
    satisfacao_ultima_avaliacao INTEGER CHECK (satisfacao_ultima_avaliacao BETWEEN 1 AND 5),
    data_ultima_avaliacao DATE,
    total_agendamentos INTEGER DEFAULT 0,
    total_cancelamentos INTEGER DEFAULT 0,
    total_no_shows INTEGER DEFAULT 0,
    
    -- Dados de controle do sistema
    ativo BOOLEAN DEFAULT true,
    bloqueado BOOLEAN DEFAULT false,
    motivo_bloqueio TEXT,
    aceita_marketing BOOLEAN DEFAULT true,
    aceita_lembrete_whatsapp BOOLEAN DEFAULT true,
    aceita_lembrete_email BOOLEAN DEFAULT true,
    
    -- Sincronização com APIs
    sincronizado_asaas_principal BOOLEAN DEFAULT false,
    sincronizado_asaas_andrey BOOLEAN DEFAULT false,
    data_ultima_sincronizacao TIMESTAMP,
    hash_dados_sync VARCHAR(64), -- Para detectar mudanças
    
    -- Timestamps de controle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete
    
    -- Constraints
    CONSTRAINT email_valido CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT documento_unico UNIQUE (tipo_documento_id, numero_documento),
    CONSTRAINT datas_plano_validas CHECK (data_vencimento_plano >= data_inicio_plano),
    CONSTRAINT valores_positivos CHECK (valor_plano_atual >= 0 AND valor_plano_original >= 0),
    CONSTRAINT desconto_valido CHECK (desconto_aplicado >= 0 AND desconto_aplicado <= 100)
);

-- =====================================================
-- 3. TABELAS DE HISTÓRICO E AUDITORIA
-- =====================================================

-- Histórico de alterações nos dados do cliente
CREATE TABLE IF NOT EXISTS clientes_historico (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes_master(id) ON DELETE CASCADE,
    campo_alterado VARCHAR(100) NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    motivo_alteracao TEXT,
    usuario_alteracao VARCHAR(100),
    ip_alteracao INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Log de sincronizações com APIs
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    origem_dados_id INTEGER REFERENCES origens_dados(id),
    tipo_operacao VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE, SYNC
    registros_processados INTEGER DEFAULT 0,
    registros_erro INTEGER DEFAULT 0,
    tempo_processamento INTERVAL,
    detalhes_erro TEXT,
    status VARCHAR(20) DEFAULT 'EXECUTANDO', -- EXECUTANDO, SUCESSO, ERRO
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);

-- =====================================================
-- 4. ÍNDICES PARA OTIMIZAÇÃO
-- =====================================================

-- Índices primários para busca
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes_master(email);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes_master(numero_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes_master(telefone_principal);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes_master(nome_completo);

-- Índices para IDs externos
CREATE INDEX IF NOT EXISTS idx_clientes_asaas_principal ON clientes_master(id_asaas_principal);
CREATE INDEX IF NOT EXISTS idx_clientes_asaas_andrey ON clientes_master(id_asaas_andrey);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_interno ON clientes_master(codigo_interno);

-- Índices compostos para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_clientes_status_ativo ON clientes_master(status_id, ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_origem_sync ON clientes_master(origem_dados_id, sincronizado_asaas_principal, sincronizado_asaas_andrey);
CREATE INDEX IF NOT EXISTS idx_clientes_vencimento ON clientes_master(data_vencimento_plano) WHERE ativo = true;

-- Índices para tabelas auxiliares
CREATE INDEX IF NOT EXISTS idx_historico_cliente_data ON clientes_historico(cliente_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_data ON sync_log(created_at, status);

-- =====================================================
-- 5. TRIGGERS E FUNÇÕES AUXILIARES
-- =====================================================

-- Função para atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_clientes_master_updated_at 
    BEFORE UPDATE ON clientes_master 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar código interno automático
CREATE OR REPLACE FUNCTION gerar_codigo_interno()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo_interno IS NULL THEN
        NEW.codigo_interno := 'CLT' || LPAD(NEW.id::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para gerar código interno
CREATE TRIGGER trigger_gerar_codigo_interno
    BEFORE INSERT ON clientes_master
    FOR EACH ROW EXECUTE FUNCTION gerar_codigo_interno();

-- Função para converter ID Asaas para numérico
CREATE OR REPLACE FUNCTION converter_id_asaas_para_numerico()
RETURNS TRIGGER AS $$
BEGIN
    -- Converte ID Asaas para numérico (remove prefixos e usa apenas números)
    IF NEW.id_asaas_principal IS NOT NULL AND NEW.id_asaas_numerico IS NULL THEN
        NEW.id_asaas_numerico := (regexp_replace(NEW.id_asaas_principal, '[^0-9]', '', 'g'))::integer;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para converter ID Asaas
CREATE TRIGGER trigger_converter_id_asaas
    BEFORE INSERT OR UPDATE ON clientes_master
    FOR EACH ROW EXECUTE FUNCTION converter_id_asaas_para_numerico();

-- =====================================================
-- 6. DADOS INICIAIS PADRÃO
-- =====================================================

-- Inserir tipos de documento padrão
INSERT INTO tipos_documento (codigo, descricao, formato_validacao) VALUES
('CPF', 'Cadastro de Pessoa Física', '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$'),
('CNPJ', 'Cadastro Nacional de Pessoa Jurídica', '^[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}$'),
('RG', 'Registro Geral', '^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9XxKk]{1}$'),
('PASSAPORTE', 'Passaporte', '^[A-Z]{2}[0-9]{6}$')
ON CONFLICT (codigo) DO NOTHING;

-- Inserir status de cliente padrão
INSERT INTO status_cliente (codigo, descricao, permite_agendamento, cor_interface, ordem_exibicao) VALUES
('ATIVO', 'Cliente Ativo', true, '#22c55e', 1),
('INATIVO', 'Cliente Inativo', false, '#6b7280', 2),
('SUSPENSO', 'Cliente Suspenso', false, '#f59e0b', 3),
('BLOQUEADO', 'Cliente Bloqueado', false, '#ef4444', 4),
('PENDENTE', 'Pendente de Aprovação', false, '#8b5cf6', 5)
ON CONFLICT (codigo) DO NOTHING;

-- Inserir categorias de cliente padrão
INSERT INTO categorias_cliente (nome, descricao, prioridade_atendimento, desconto_padrao) VALUES
('VIP', 'Cliente VIP com benefícios especiais', 3, 10.00),
('REGULAR', 'Cliente regular', 1, 0.00),
('CORPORATIVO', 'Cliente corporativo', 2, 5.00),
('ESTUDANTE', 'Estudante com desconto', 1, 15.00)
ON CONFLICT (nome) DO NOTHING;

-- Inserir origens de dados
INSERT INTO origens_dados (codigo, nome, requer_sincronizacao) VALUES
('ASAAS_PRINCIPAL', 'API Asaas Conta Principal', true),
('ASAAS_ANDREY', 'API Asaas Conta Andrey', true),
('MANUAL', 'Cadastro Manual', false),
('IMPORT_CSV', 'Importação CSV', false),
('API_EXTERNA', 'API Externa', true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- 7. VIEWS PARA CONSULTAS OTIMIZADAS
-- =====================================================

-- View para dados completos do cliente
CREATE OR REPLACE VIEW vw_clientes_completo AS
SELECT 
    c.id,
    c.codigo_interno,
    c.nome_completo,
    c.email,
    c.telefone_principal,
    c.numero_documento,
    td.descricao as tipo_documento,
    sc.descricao as status_cliente,
    sc.cor_interface as cor_status,
    cc.nome as categoria_cliente,
    tp.nome as tipo_plano,
    c.valor_plano_atual,
    c.data_vencimento_plano,
    od.nome as origem_dados,
    c.total_agendamentos,
    c.satisfacao_ultima_avaliacao,
    c.created_at,
    c.updated_at,
    CASE 
        WHEN c.data_vencimento_plano < CURRENT_DATE THEN 'VENCIDO'
        WHEN c.data_vencimento_plano <= CURRENT_DATE + INTERVAL '7 days' THEN 'VENCE_EM_BREVE'
        ELSE 'EM_DIA'
    END as situacao_plano
FROM clientes_master c
LEFT JOIN tipos_documento td ON c.tipo_documento_id = td.id
LEFT JOIN status_cliente sc ON c.status_id = sc.id
LEFT JOIN categorias_cliente cc ON c.categoria_id = cc.id
LEFT JOIN tipos_plano tp ON c.tipo_plano_id = tp.id
LEFT JOIN origens_dados od ON c.origem_dados_id = od.id
WHERE c.deleted_at IS NULL;

-- View para estatísticas rápidas
CREATE OR REPLACE VIEW vw_estatisticas_clientes AS
SELECT 
    COUNT(*) as total_clientes,
    COUNT(*) FILTER (WHERE sc.codigo = 'ATIVO') as clientes_ativos,
    COUNT(*) FILTER (WHERE c.data_vencimento_plano < CURRENT_DATE) as planos_vencidos,
    COUNT(*) FILTER (WHERE c.data_vencimento_plano <= CURRENT_DATE + INTERVAL '7 days') as vencimentos_proximos,
    SUM(c.valor_plano_atual) FILTER (WHERE sc.codigo = 'ATIVO') as receita_mensal_ativa,
    AVG(c.satisfacao_ultima_avaliacao) as satisfacao_media
FROM clientes_master c
LEFT JOIN status_cliente sc ON c.status_id = sc.id
WHERE c.deleted_at IS NULL;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE clientes_master IS 'Tabela principal para armazenamento de dados de clientes integrados com APIs Asaas';
COMMENT ON COLUMN clientes_master.id_asaas_numerico IS 'Conversão numérica do ID Asaas para facilitar integrações';
COMMENT ON COLUMN clientes_master.hash_dados_sync IS 'Hash MD5 dos dados para detectar alterações durante sincronização';
COMMENT ON COLUMN clientes_master.preferencias_agendamento IS 'JSON com preferências de horário, profissional, etc';
COMMENT ON COLUMN clientes_master.restricoes_servicos IS 'Array de IDs de serviços que o cliente não pode/deve fazer';

COMMENT ON TABLE clientes_historico IS 'Auditoria de todas as alterações feitas nos dados dos clientes';
COMMENT ON TABLE sync_log IS 'Log de todas as operações de sincronização com APIs externas';

-- =====================================================
-- SCRIPTS DE VALIDAÇÃO E INTEGRIDADE
-- =====================================================

-- Função para validar integridade dos dados
CREATE OR REPLACE FUNCTION validar_integridade_clientes()
RETURNS TABLE(problema TEXT, quantidade BIGINT) AS $$
BEGIN
    -- Clientes sem email válido
    RETURN QUERY 
    SELECT 'Clientes com email inválido'::TEXT, 
           COUNT(*) FROM clientes_master 
           WHERE email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
           AND deleted_at IS NULL;
    
    -- Clientes sem status
    RETURN QUERY
    SELECT 'Clientes sem status definido'::TEXT,
           COUNT(*) FROM clientes_master 
           WHERE status_id IS NULL AND deleted_at IS NULL;
    
    -- Clientes com planos vencidos há mais de 30 dias
    RETURN QUERY
    SELECT 'Clientes com planos vencidos há mais de 30 dias'::TEXT,
           COUNT(*) FROM clientes_master 
           WHERE data_vencimento_plano < CURRENT_DATE - INTERVAL '30 days' 
           AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;