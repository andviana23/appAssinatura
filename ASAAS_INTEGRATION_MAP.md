# MAPEAMENTO COMPLETO DAS INTEGRAÇÕES ASAAS

## VARIÁVEIS DE AMBIENTE PADRONIZADAS

### Chaves ASAAS
- `ASAAS_TRATO` - Conta principal Trato de Barbados (via secrets)
- `ASAAS_ANDREY` - Conta secundária Andrey
- `ASAAS_ENVIRONMENT` - Ambiente (production/sandbox)

### Outras Variáveis
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Autenticação de sessões

## ENDPOINTS POR INTEGRAÇÃO ASAAS

### CONTA PRINCIPAL (ASAAS_TRATO)
```
ENDPOINTS QUE USAM ASAAS_TRATO:
- GET /api/clientes/unified - Busca clientes unificados (conta principal)
- GET /api/v2/estatisticas - Estatísticas consolidadas (conta principal)
- POST /api/v2/sync/asaas-principal - Sincronização conta principal
- POST /api/asaas/criar-cliente - Criar cliente (via TRATO)
- GET /api/clientes-trato-barbados - Clientes específicos da conta TRATO
```

### CONTA SECUNDÁRIA (ASAAS_ANDREY)
```
ENDPOINTS QUE USAM ASAAS_ANDREY:
- GET /api/clientes/unified - Busca clientes unificados (conta secundária)
- GET /api/v2/estatisticas - Estatísticas consolidadas (conta secundária)
- POST /api/v2/sync/asaas-andrey - Sincronização conta Andrey
- POST /api/asaas/criar-assinatura - Criar assinatura (via ANDREY)
- POST /api/assinatura/criar-plano - Criar plano (via ANDREY)
- POST /api/create-customer-subscription - Criar cliente + assinatura (via ANDREY)
- POST /webhook/asaas - Webhook principal (padrão ANDREY)
```

## INTEGRAÇÕES EXTERNAS ASAAS

### API ASAAS - ENDPOINTS UTILIZADOS
```
BASE URL: https://www.asaas.com/api/v3/ (production)
BASE URL: https://sandbox.asaas.com/api/v3/ (sandbox)

CUSTOMERS:
- GET /customers?limit=100 - Listar clientes
- GET /customers/{id} - Buscar cliente específico
- POST /customers - Criar cliente

SUBSCRIPTIONS:
- GET /subscriptions?status=ACTIVE&limit=100 - Assinaturas ativas
- POST /subscriptions - Criar assinatura

PAYMENTS:
- GET /payments?status=CONFIRMED - Pagamentos confirmados
- GET /payments?status=PENDING - Pagamentos pendentes
- POST /payments - Criar pagamento
- GET /payments/{id}/paymentBook - Link de pagamento

PIX:
- POST /pix/addressKeys - Configurar chaves PIX
```

## WEBHOOK ASAAS VALIDADO

### Endpoint: POST /webhook/asaas
```
VALIDAÇÕES DE SEGURANÇA:
- Verificação User-Agent (deve conter "asaas")
- Verificação de token de acesso
- Validação de dados obrigatórios (event, payment)
- Log detalhado para debugging

EVENTOS PROCESSADOS:
- PAYMENT_RECEIVED - Pagamento recebido
- PAYMENT_CONFIRMED - Pagamento confirmado
- PAYMENT_DELETED - Pagamento deletado
- PAYMENT_REFUNDED - Pagamento estornado
- PAYMENT_OVERDUE - Pagamento vencido
- PAYMENT_UPDATED - Status do pagamento atualizado
```

## ARQUIVOS ALTERADOS NA REESTRUTURAÇÃO

### Backend
```
✅ server/routes.ts - Padronizado ASAAS_TRATO e ASAAS_ANDREY
✅ server/services/asaas-integration.ts - Atualizado variáveis
✅ server/asaas-sync.ts - Padronizado variáveis
✅ .env - Atualizado para ASAAS_ANDREY
```

### Pendentes
```
🔄 Remover endpoints duplicados/órfãos
🔄 Atualizar frontend para usar endpoints corretos
🔄 Documentar todos os endpoints com comentários
🔄 Testar integrações em sandbox e produção
```

## LIMPEZA DE ENDPOINTS

### ENDPOINTS PARA REMOVER (Duplicados/Órfãos)
```
- GET /api/clientes-asaas-principal (órfão - não existe)
- GET /api/clientes-asaas-andrey (órfão - não existe)
- Múltiplas variações de sync endpoints
```

### ENDPOINTS PARA MANTER
```
✅ GET /api/clientes/unified - Principal unificado
✅ GET /api/clientes-externos - Clientes locais
✅ POST /api/v2/sync/asaas-principal - Sync TRATO
✅ POST /api/v2/sync/asaas-andrey - Sync ANDREY
✅ POST /webhook/asaas - Webhook validado
```

## TESTE DE INTEGRAÇÕES

### Validação Necessária
1. Verificar se ASAAS_TRATO e ASAAS_ANDREY funcionam em produção
2. Testar webhook com dados reais do Asaas
3. Validar sincronização de ambas as contas
4. Verificar se clientes aparecem corretamente na interface