# Product Requirements Document (PRD)
## Sistema SaaS de Gestão de Assinaturas para Barbearia Trato de Barbados

---

### 1. Visão Geral
Este documento descreve os requisitos funcionais e não funcionais para o desenvolvimento de um sistema SaaS voltado para gerenciamento de assinaturas e comissões da Barbearia Trato de Barbados.

**Objetivo:** Fornecer uma plataforma web intuitiva e eficiente que permita:
- Controle de assinaturas mensais de clientes.
- Distribuição automática de comissões entre barbeiros.
- Visualização de métricas-chave em um dashboard central.

### 2. Escopo do Produto
**Inclusões:**
- Autenticação e autorização.
- Dashboard administrativo.
- CRUD de barbeiros, serviços e planos.
- Distribuição de pontos e cálculo de comissões.
- Visão individual para barbeiros.
- Integração com Supabase (banco e autenticação).
- Importação automática de dados de clientes via API Asaas.

**Exclusões:**
- Gestão de estoque.
- Processamento de pagamentos (é feito no Asaas).
- Funcionalidades de marketing (push, e-mail marketing).

### 3. Stakeholders
- **Administrador da Barbearia**: configura sistema, monitora métricas, gerencia comissões.
- **Barbeiro**: consulta histórico de atendimentos e comissões.
- **Equipe Técnica**: desenvolvedores, DevOps, QA.

### 4. Requisitos Funcionais
#### 4.1 Autenticação
- Tela de Login (e-mail + senha).
- Proteção de rotas baseado em roles (admin vs barbeiro).
- Documentação em Português para configuração de variáveis de conexão Supabase.
  - Variáveis de ambiente: `SUPABASE_URL`, `SUPABASE_KEY`, etc.

#### 4.2 Dashboard (Admin)
Exibe:
- Total de faturamento do mês atual.
- Ranking de barbeiros (por faturamento ou minutos trabalhados).
- Total de tempo gasto por barbeiros.
- Top 5 assinaturas próximas do vencimento, indicando data de expiração.

#### 4.3 CRUD de Barbeiros
- Tela para cadastrar/editar/excluir barbeiros.
- Campos: Nome (string), E-mail (string), Ativo (boolean).
- Tabela no banco: `Barbeiro { id, nome, email, ativo }`.

#### 4.4 CRUD de Serviços
- Tela para cadastrar/editar/excluir serviços.
- Campos: Nome (string), Tempo padrão (minutos, inteiro), `isAssinatura` (boolean).
- Tabela no banco: `Servico { id, nome, tempoMinutos, isAssinatura }`.

#### 4.5 CRUD de Planos de Assinatura
- Tela para criar/editar/remover planos.
- Campos: nome, valorMensal, descrição, lista de serviços incluídos.
- Tabela: `PlanoAssinatura { id, nome, valorMensal, descricao, servicosIncluidos (JSON) }`.

#### 4.6 Distribuição de Pontos & Cálculo de Comissão
##### 4.6.1 Tela “Distribuição de Pontos”
- Seletor de período (data início/fim).
- Input de faturamento total (ou obtido de "Configurações do Mês").
- Input de percentual de comissão (default 40%).
- Grade dinâmica (linhas: barbeiros; colunas: serviços de assinatura).
- Campos de inputs de quantidade de atendimentos.

##### 4.6.2 Fluxo de Cálculo (Backend)
1. Carrega barbeiros e serviços com `isAssinatura = true`.
2. Soma minutos totais do pool:
   ```js
   totalMinutesPool = Σ(contagem * tempoMinutos)
   ```
3. Calcula valor do pool de comissão:
   ```js
   poolValue = faturamentoTotal * percentualComissao
   ```
4. Para cada barbeiro:
   - `minutesWorked` = Σ(contagem * tempoMinutos)
   - `participationRate` = minutesWorked / totalMinutesPool
   - `revenueShare` = faturamentoTotal * participationRate
   - `commission`   = poolValue * participationRate
5. Retorna JSON com resultados para exibição.

##### 4.6.3 Exibição & Ações
- Tabela: Barbeiro | Minutos Trabalhados | % Participação | R$ Faturamento | R$ Comissão.
- Botões: “Exportar CSV”, “Salvar Distribuição” (gravar histórico no banco).

#### 4.7 Visão do Barbeiro
- Tela própria onde o barbeiro vê apenas:
  - Seus atendimentos realizados no mês.
  - Comissão estimada para o mês atual.

#### 4.8 Integração com Asaas (Cadastro de Clientes)
- Ao gravar assinatura, o cliente deve ser cadastrado automaticamente.
- API full reset Asaas:
  - Endpoint sugerido: `https://api.asaas.com/v3/webhooks`.
  - Chave API: `aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjY4NGRiNmQ3LWJjZTMtNDQyZS1hM2FhLTE4ZDkyMDJjMTc3OTo6JGFhY2hfNWU5NTdkMzUtNzRiNS00YjU4LWJmYWItN2U4Y2ExZDAxMzBl`.
- Documentar em cada chamada onde inserir chave e URL.

### 5. Requisitos Não Funcionais
- **Tecnologia:** Frontend (React + Tailwind), Backend (Node.js/Express ou similar), Banco (Supabase/PostgreSQL).
- **Documentação:** Comentários em Português no código, README com instruções de setup.
- **Performance:** Respostas < 300ms para operações CRUD simples.
- **Segurança:** HTTPS, armazenamento seguro de credenciais.
- **UX/UI:** Clean, responsiva, espaçamento de 24px, cantos 2xl, sombras suaves.

### 6. Arquitetura de Dados
- **Barbeiro** (id, nome, email, ativo)
- **Servico** (id, nome, tempoMinutos, isAssinatura)
- **PlanoAssinatura** (id, nome, valorMensal, descricao, servicosIncluidos)
- **Distribuicao** (id, periodoInicio, periodoFim, faturamentoTotal, percentualComissao)
- **DistribuicaoItem** (id, distribuicaoId, barbeiroId, servicoId, quantidade, minutesWorked, revenueShare, commission)
- **Comissao** (id, barbeiroId, mes, valor)
- **Cliente** (id, nome, email, asaasCustomerId)

*Data de Criação:* 29/05/2025  
*Autor:* Equipe de Produto  
*Versão:* 1.0
