import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq, like, sql, and, gte, lte } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Middleware de autorização baseado exclusivamente no campo role
function requireRole(allowedRoles: string[]) {
  return (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: 'Acesso negado',
        requiredRole: allowedRoles,
        userRole: userRole
      });
    }

    next();
  };
}

// Middleware específicos para cada role
const requireAdmin = requireRole(['admin']);
const requireBarbeiro = requireRole(['admin', 'barbeiro']);
const requireRecepcionista = requireRole(['admin', 'recepcionista']);
const requireAnyRole = requireRole(['admin', 'barbeiro', 'recepcionista']);

export async function registerRoutes(app: Express): Promise<Express> {
  // Middleware para adicionar tipagem ao Request
  app.use((req: any, res: any, next: any) => {
    next();
  });
  
  // Middleware de autenticação para anexar usuário à requisição
  app.use(async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.cookies?.user_id;
      
      if (userId) {
        // Buscar usuário no banco
        const [user] = await db.select().from(schema.users).where(eq(schema.users.id, parseInt(userId)));
        
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            nome: user.nome
          };
        }
      }
      
      next();
    } catch (error) {
      console.error('Erro no middleware de autenticação:', error);
      next();
    }
  });
  
  // Nova função para determinar status baseado no mês e lógica de pagamentos vencidos
  function determinarStatusClientePorMes(cliente: any, mesFiltro: string): string {
    // Regra: Cliente é ATIVO se está em dia ou cobrança ainda não venceu
    // Regra: Cliente é ATRASADO apenas se pagamento venceu e não foi confirmado
    
    // Para simplificação inicial, vamos usar a lógica baseada em:
    // - notificationDisabled = true -> provavelmente cancelado/inativo
    // - Cliente muito recente (menos de 30 dias) -> ativo (ainda dentro do prazo)
    // - Clientes antigos sem notificationDisabled -> ativos (presumindo em dia)
    
    if (cliente.notificationDisabled || cliente.deleted) {
      return 'atrasado'; // Cliente com notificação desabilitada ou deletado = atrasado/cancelado
    }
    
    const dataCreated = new Date(cliente.dateCreated);
    const agora = new Date();
    const diasCriacao = Math.floor((agora.getTime() - dataCreated.getTime()) / (1000 * 3600 * 24));
    
    // Clientes muito antigos (mais de 90 dias) sem atividade recente podem estar atrasados
    if (diasCriacao > 90 && cliente.notificationDisabled) {
      return 'atrasado';
    }
    
    // Por padrão, considera ativo (em dia ou dentro do prazo)
    return 'ativo';
  }

  // Função auxiliar para verificar status do cliente baseado em cobranças
  async function verificarStatusCliente(cliente: any, apiKey: string): Promise<'ativo' | 'inadimplente'> {
    try {
      const response = await fetch(`https://www.asaas.com/api/v3/payments?customer=${cliente.id}&limit=50`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`Erro ao buscar cobranças do cliente ${cliente.id}`);
        return 'ativo'; // Default para ativo em caso de erro
      }

      const data = await response.json();
      const cobrancas = data.data || [];
      
      if (cobrancas.length === 0) {
        return 'ativo'; // Cliente sem cobranças = ativo
      }

      // Ordenar por data de vencimento (mais recente primeiro)
      cobrancas.sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Buscar a última cobrança paga (RECEIVED ou CONFIRMED)
      const cobrancasPagas = cobrancas.filter((c: any) => c.status === 'RECEIVED' || c.status === 'CONFIRMED');
      const ultimaCobrancaPaga = cobrancasPagas.sort((a: any, b: any) => 
        new Date(b.paymentDate || b.clientPaymentDate || b.dueDate).getTime() - new Date(a.paymentDate || a.clientPaymentDate || a.dueDate).getTime()
      )[0];

      // Verificar se cliente tem período ativo baseado na última cobrança paga
      if (ultimaCobrancaPaga) {
        const dataPagamento = new Date(ultimaCobrancaPaga.paymentDate || ultimaCobrancaPaga.clientPaymentDate || ultimaCobrancaPaga.dueDate);
        
        // Verificar se existe próxima cobrança registrada
        const proximaCobranca = cobrancas.find((c: any) => 
          (c.status !== 'RECEIVED' && c.status !== 'CONFIRMED') && new Date(c.dueDate) > dataPagamento
        );
        
        let dataVencimentoAssinatura: Date;
        
        if (proximaCobranca) {
          // Se tem próxima cobrança, usar a data de vencimento dela
          dataVencimentoAssinatura = new Date(proximaCobranca.dueDate);
        } else {
          // Se não tem próxima cobrança, considerar 30 dias a partir do pagamento
          dataVencimentoAssinatura = new Date(dataPagamento);
          dataVencimentoAssinatura.setDate(dataVencimentoAssinatura.getDate() + 30);
        }
        
        // Se ainda está dentro do período válido = ativo
        if (hoje <= dataVencimentoAssinatura) {
          console.log(`Cliente ${cliente.id} ativo: dentro do período válido da assinatura`);
          return 'ativo';
        }
      }

      // Verificar se tem cobrança pendente vencida
      const cobrancasPendentes = cobrancas.filter((c: any) => c.status !== 'RECEIVED' && c.status !== 'CONFIRMED');
      const cobrancasVencidasNaoPagas = cobrancasPendentes.filter((cobranca: any) => {
        const dataVencimento = new Date(cobranca.dueDate);
        dataVencimento.setHours(23, 59, 59, 999);
        return dataVencimento < hoje;
      });

      // Se tem cobrança vencida não paga = inadimplente
      if (cobrancasVencidasNaoPagas.length > 0) {
        console.log(`Cliente ${cliente.id} inadimplente: ${cobrancasVencidasNaoPagas.length} cobrança(s) vencida(s)`);
        return 'inadimplente';
      }

      // Verificar se tem cobrança pendente dentro do prazo
      const cobrancasPendentesNoPrazo = cobrancasPendentes.filter((cobranca: any) => {
        const dataVencimento = new Date(cobranca.dueDate);
        dataVencimento.setHours(23, 59, 59, 999);
        return dataVencimento >= hoje;
      });

      // Se tem cobrança pendente no prazo = ativo
      if (cobrancasPendentesNoPrazo.length > 0) {
        console.log(`Cliente ${cliente.id} ativo: cobrança pendente ainda no prazo`);
        return 'ativo';
      }

      // Por padrão, considera ativo (clientes novos ou sem cobranças)
      console.log(`Cliente ${cliente.id} ativo: cliente novo ou sem cobranças pendentes`);
      return 'ativo';
      
    } catch (error) {
      console.error(`Erro ao verificar status do cliente ${cliente.id}:`, error);
      return 'ativo'; // Default para ativo em caso de erro
    }
  }
  
  // =====================================================
  // ROTA UNIFICADA CLIENTES ASAAS POR STATUS
  // =====================================================

  app.get('/api/clientes/unificados-status', async (req: Request, res: Response) => {
    try {
      const mesFiltro = req.query.mes as string || new Date().toISOString().slice(0, 7); // YYYY-MM
      console.log(`📅 Filtrando clientes por mês: ${mesFiltro}`);
      
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;
      
      const clientesAtivos: any[] = [];
      const clientesAtrasados: any[] = [];
      
      // Buscar clientes da conta ASAAS_TRATO
      if (asaasTrato) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasTrato,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            data.data.forEach((cliente: any) => {
              const clienteFormatado = {
                ...cliente,
                conta: 'ASAAS_TRATO'
              };
              
              const status = determinarStatusClientePorMes(clienteFormatado, mesFiltro);
              if (status === 'ativo') {
                clientesAtivos.push({...clienteFormatado, status: 'ativo'});
              } else {
                clientesAtrasados.push({...clienteFormatado, status: 'atrasado'});
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar clientes ASAAS_TRATO:', error);
        }
      }
      
      // Buscar clientes da conta ASAAS_AND
      if (asaasAndrey) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasAndrey,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            data.data.forEach((cliente: any) => {
              const clienteFormatado = {
                ...cliente,
                conta: 'ASAAS_AND'
              };
              
              const status = determinarStatusClientePorMes(clienteFormatado, mesFiltro);
              if (status === 'ativo') {
                clientesAtivos.push({...clienteFormatado, status: 'ativo'});
              } else {
                clientesAtrasados.push({...clienteFormatado, status: 'atrasado'});
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar clientes ASAAS_AND:', error);
        }
      }
      
      // Organizar clientes por status baseado em cobranças
      const ativos: any[] = [];
      const inadimplentes: any[] = [];
      const aguardandoPagamento: any[] = [];

      // Buscar clientes externos e adicioná-los como ativos
      let clientesExternos: any[] = [];
      try {
        const clientesDB = await db.select().from(schema.clientes)
          .where(eq(schema.clientes.origem, 'EXTERNO'));

        clientesExternos = clientesDB.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          valor: parseFloat(cliente.planoValor),
          plano: cliente.planoNome,
          dataVencimento: cliente.dataVencimentoAssinatura,
          dataInicio: cliente.dataInicioAssinatura,
          status: 'ativo',
          conta: 'PAGAMENTO_EXTERNO',
          formaPagamento: cliente.formaPagamento
        }));

        console.log(`📊 PAGAMENTO_EXTERNO: ${clientesExternos.length} clientes encontrados`);
      } catch (error) {
        console.error('Erro ao buscar clientes externos:', error);
      }

      // Combinar todos os clientes das duas contas + externos e eliminar duplicatas
      const todosClientesTemp = [...clientesAtivos, ...clientesAtrasados, ...clientesExternos];
      
      // Eliminar duplicatas usando email como chave única
      const clientesUnicosMap = new Map();
      todosClientesTemp.forEach(cliente => {
        const chave = cliente.email || cliente.nome;
        if (!clientesUnicosMap.has(chave)) {
          clientesUnicosMap.set(chave, cliente);
        } else {
          // Manter o cliente com valor maior (assinatura mais recente/cara)
          const clienteExistente = clientesUnicosMap.get(chave);
          if (cliente.valor > clienteExistente.valor) {
            clientesUnicosMap.set(chave, cliente);
          }
        }
      });
      
      const todosClientes = Array.from(clientesUnicosMap.values());
      
      console.log(`🔍 Analisando ${todosClientes.length} clientes únicos para verificar status baseado em cobranças...`);
      
      // Processar cada cliente para verificar status baseado em cobranças
      for (const cliente of todosClientes) {
        try {
          // Clientes externos são sempre ativos
          if (cliente.conta === 'PAGAMENTO_EXTERNO') {
            ativos.push({...cliente, status: 'ativo', origem: 'Pagamento Externo'});
            continue;
          }

          const apiKey = cliente.conta === 'ASAAS_TRATO' ? asaasTrato : asaasAndrey;
          if (apiKey) {
            const status = await verificarStatusCliente(cliente, apiKey);
            
            if (status === 'inadimplente') {
              inadimplentes.push({...cliente, status: 'inadimplente'});
            } else {
              ativos.push({...cliente, status: 'ativo'});
            }
          } else {
            // Se não tem API key, considera ativo por padrão
            ativos.push({...cliente, status: 'ativo'});
          }
        } catch (error) {
          console.error(`Erro ao processar cliente ${cliente.id}:`, error);
          // Em caso de erro, considera ativo
          ativos.push({...cliente, status: 'ativo'});
        }
      }

      console.log(`✅ Análise concluída: ${ativos.length} ativos, ${inadimplentes.length} inadimplentes`);

      res.json({
        success: true,
        total: ativos.length + inadimplentes.length,
        ativos: {
          total: ativos.length,
          clientes: ativos
        },
        inativos: {
          total: inadimplentes.length,
          clientes: inadimplentes
        },
        aguardandoPagamento: {
          total: 0,
          clientes: []
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro na rota clientes unificados:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // API GESTÃO DE ASSINATURAS E CLIENTES
  // =====================================================

  // Endpoint para buscar clientes pagantes do mês vigente
  app.get('/api/clientes/pagamentos-mes', async (req: Request, res: Response) => {
    try {
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;
      
      if (!asaasTrato || !asaasAndrey) {
        return res.status(500).json({ 
          success: false, 
          error: 'Chaves de API do Asaas não configuradas' 
        });
      }

      const hoje = new Date();
      const mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
      
      console.log(`📅 Buscando pagamentos do mês: ${mesAtual}...`);

      let clientesPagantes: any[] = [];
      let valorTotalPago = 0;
      const cacheClientes = new Map(); // Cache para evitar requisições duplicadas

      // Função otimizada para buscar dados do cliente com cache
      const buscarDadosCliente = async (customerId: string, apiKey: string) => {
        const chaveCache = `${customerId}-${apiKey}`;
        if (cacheClientes.has(chaveCache)) {
          return cacheClientes.get(chaveCache);
        }

        try {
          const response = await fetch(`https://www.asaas.com/api/v3/customers/${customerId}`, {
            headers: {
              'access_token': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const dadosCliente = await response.json();
            cacheClientes.set(chaveCache, dadosCliente);
            return dadosCliente;
          }
        } catch (error) {
          console.error(`Erro ao buscar cliente ${customerId}:`, error);
        }
        return null;
      };

      // Buscar pagamentos CONFIRMED da conta ASAAS_TRATO do mês vigente
      try {
        const responseTrato = await fetch(`https://www.asaas.com/api/v3/payments?status=CONFIRMED&confirmedDate[ge]=${mesAtual}-01&confirmedDate[le]=${mesAtual}-31&limit=50`, {
          headers: {
            'access_token': asaasTrato,
            'Content-Type': 'application/json'
          }
        });

        if (responseTrato.ok) {
          const dataTrato = await responseTrato.json();
          console.log(`📊 ASAAS_TRATO: ${dataTrato.data.length} pagamentos CONFIRMED encontrados`);
          
          // Processar pagamentos em lote para melhor performance
          const promessasClientes = dataTrato.data.map(async (pagamento: any) => {
            const dadosCliente = await buscarDadosCliente(pagamento.customer, asaasTrato);
            if (dadosCliente) {
              return {
                id: dadosCliente.id,
                nome: dadosCliente.name,
                email: dadosCliente.email,
                telefone: dadosCliente.mobilePhone,
                valorPago: pagamento.value,
                dataPagamento: pagamento.confirmedDate,
                descricao: pagamento.description,
                conta: 'ASAAS_TRATO'
              };
            }
            return null;
          });

          const resultadosTrato = await Promise.all(promessasClientes);
          const clientesValidosTrato = resultadosTrato.filter(cliente => cliente !== null);
          
          clientesPagantes.push(...clientesValidosTrato);
          valorTotalPago += dataTrato.data.reduce((sum: number, p: any) => sum + p.value, 0);
        }
      } catch (error) {
        console.error('Erro ao buscar pagamentos ASAAS_TRATO:', error);
      }

      // Buscar pagamentos CONFIRMED da conta ASAAS_AND do mês vigente
      try {
        const responseAndrey = await fetch(`https://www.asaas.com/api/v3/payments?status=CONFIRMED&confirmedDate[ge]=${mesAtual}-01&confirmedDate[le]=${mesAtual}-31&limit=50`, {
          headers: {
            'access_token': asaasAndrey,
            'Content-Type': 'application/json'
          }
        });

        if (responseAndrey.ok) {
          const dataAndrey = await responseAndrey.json();
          console.log(`📊 ASAAS_AND: ${dataAndrey.data.length} pagamentos CONFIRMED encontrados`);
          
          // Processar pagamentos em lote para melhor performance
          const promessasClientes = dataAndrey.data.map(async (pagamento: any) => {
            const dadosCliente = await buscarDadosCliente(pagamento.customer, asaasAndrey);
            if (dadosCliente) {
              return {
                id: dadosCliente.id,
                nome: dadosCliente.name,
                email: dadosCliente.email,
                telefone: dadosCliente.mobilePhone,
                valorPago: pagamento.value,
                dataPagamento: pagamento.confirmedDate,
                descricao: pagamento.description,
                conta: 'ASAAS_AND'
              };
            }
            return null;
          });

          const resultadosAndrey = await Promise.all(promessasClientes);
          const clientesValidosAndrey = resultadosAndrey.filter(cliente => cliente !== null);
          
          clientesPagantes.push(...clientesValidosAndrey);
          valorTotalPago += dataAndrey.data.reduce((sum: number, p: any) => sum + p.value, 0);
        }
      } catch (error) {
        console.error('Erro ao buscar pagamentos ASAAS_AND:', error);
      }

      // Buscar clientes externos com pagamento confirmado no mês atual
      try {
        const clientesExternos = await db.select().from(schema.clientes)
          .where(eq(schema.clientes.origem, 'EXTERNO'));

        for (const cliente of clientesExternos) {
          const dataInicio = new Date(cliente.dataInicioAssinatura);
          const mesCliente = dataInicio.getFullYear() + '-' + String(dataInicio.getMonth() + 1).padStart(2, '0');
          
          if (mesCliente === mesAtual) {
            clientesPagantes.push({
              id: cliente.id,
              nome: cliente.nome,
              email: cliente.email,
              telefone: cliente.telefone,
              valorPago: parseFloat(cliente.planoValor),
              dataPagamento: cliente.dataInicioAssinatura,
              descricao: cliente.planoNome,
              conta: 'PAGAMENTO_EXTERNO'
            });
            valorTotalPago += parseFloat(cliente.planoValor);
          }
        }

        console.log(`📊 PAGAMENTO_EXTERNO: ${clientesExternos.filter(c => {
          const dataInicio = new Date(c.dataInicioAssinatura);
          const mesCliente = dataInicio.getFullYear() + '-' + String(dataInicio.getMonth() + 1).padStart(2, '0');
          return mesCliente === mesAtual;
        }).length} pagamentos externos encontrados`);

      } catch (error) {
        console.error('Erro ao buscar clientes externos:', error);
      }

      // Remover duplicatas baseado no email (cliente único independente da conta)
      const clientesUnicos = clientesPagantes.reduce((acc, cliente) => {
        const chave = cliente.email || cliente.nome; // Usar email como chave única, fallback para nome
        if (!acc.has(chave)) {
          acc.set(chave, cliente);
        } else {
          // Se cliente já existe, manter apenas o maior valor (assinatura mais recente/cara)
          const clienteExistente = acc.get(chave);
          if (cliente.valorPago > clienteExistente.valorPago) {
            acc.set(chave, cliente);
          }
        }
        return acc;
      }, new Map());

      const clientesPagantesUnicos = Array.from(clientesUnicos.values());
      
      // Recalcular valor total baseado apenas nos clientes únicos
      const valorTotalUnico = clientesPagantesUnicos.reduce((total, cliente) => total + cliente.valorPago, 0);

      console.log(`✅ ${clientesPagantesUnicos.length} clientes pagantes encontrados no mês ${mesAtual}`);
      console.log(`💰 Valor total pago: R$ ${valorTotalUnico.toFixed(2)}`);

      res.json({
        success: true,
        totalClientes: clientesPagantesUnicos.length,
        valorTotal: valorTotalUnico,
        mes: mesAtual,
        clientes: clientesPagantesUnicos
      });

    } catch (error) {
      console.error('Erro ao buscar clientes pagantes do mês:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
  });

  app.get('/api/clientes/assinaturas', async (req: Request, res: Response) => {
    try {
      const mesFiltro = req.query.mes as string || new Date().toISOString().slice(0, 7); // YYYY-MM
      console.log(`🔄 Buscando clientes com assinaturas para o mês: ${mesFiltro}...`);
      
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAnd = process.env.ASAAS_AND;
      
      if (!asaasTrato && !asaasAnd) {
        return res.status(500).json({ 
          success: false, 
          message: 'Chaves ASAAS não configuradas' 
        });
      }

      const baseUrl = 'https://www.asaas.com/api/v3';
      const clientesComAssinaturas: any[] = [];
      let totalFaturado = 0;
      let quantidadeAssinaturas = 0;

      // Buscar assinaturas da conta ASAAS_TRATO
      if (asaasTrato) {
        try {
          const response = await fetch(`${baseUrl}/subscriptions?limit=100`, {
            headers: {
              'access_token': asaasTrato,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            for (const assinatura of data.data) {
              // Buscar dados do cliente
              const clienteResponse = await fetch(`${baseUrl}/customers/${assinatura.customer}`, {
                headers: {
                  'access_token': asaasTrato,
                  'Content-Type': 'application/json'
                }
              });

              if (clienteResponse.ok) {
                const cliente = await clienteResponse.json();
                
                // Buscar último pagamento da assinatura
                const pagamentosResponse = await fetch(`${baseUrl}/payments?subscription=${assinatura.id}&limit=1`, {
                  headers: {
                    'access_token': asaasTrato,
                    'Content-Type': 'application/json'
                  }
                });

                let valorPago = 0;
                let statusPagamento = 'PENDING';
                let dataVencimento = assinatura.nextDueDate;

                if (pagamentosResponse.ok) {
                  const pagamentos = await pagamentosResponse.json();
                  if (pagamentos.data.length > 0) {
                    const ultimoPagamento = pagamentos.data[0];
                    valorPago = ultimoPagamento.value;
                    statusPagamento = ultimoPagamento.status;
                    
                    // Se pagamento confirmado no mês filtrado, conta no faturamento
                    if (statusPagamento === 'CONFIRMED' && ultimoPagamento.paymentDate?.startsWith(mesFiltro)) {
                      totalFaturado += valorPago;
                      quantidadeAssinaturas++;
                    }
                  }
                }

                clientesComAssinaturas.push({
                  id: cliente.id,
                  nome: cliente.name,
                  email: cliente.email,
                  telefone: cliente.phone,
                  valorPago: valorPago,
                  nomePlano: assinatura.description || 'Plano Standard',
                  statusPagamento: statusPagamento,
                  dataVencimento: dataVencimento,
                  assinaturaId: assinatura.id,
                  conta: 'ASAAS_TRATO'
                });
              }
            }
            
            console.log(`✅ ${data.data.length} assinaturas processadas da conta ASAAS_TRATO`);
          }
        } catch (error) {
          console.error('Erro ao buscar assinaturas ASAAS_TRATO:', error);
        }
      }

      // Buscar assinaturas da conta ASAAS_AND
      if (asaasAnd) {
        try {
          const response = await fetch(`${baseUrl}/subscriptions?limit=100`, {
            headers: {
              'access_token': asaasAnd,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            for (const assinatura of data.data) {
              // Buscar dados do cliente
              const clienteResponse = await fetch(`${baseUrl}/customers/${assinatura.customer}`, {
                headers: {
                  'access_token': asaasAnd,
                  'Content-Type': 'application/json'
                }
              });

              if (clienteResponse.ok) {
                const cliente = await clienteResponse.json();
                
                // Buscar último pagamento da assinatura
                const pagamentosResponse = await fetch(`${baseUrl}/payments?subscription=${assinatura.id}&limit=1`, {
                  headers: {
                    'access_token': asaasAnd,
                    'Content-Type': 'application/json'
                  }
                });

                let valorPago = 0;
                let statusPagamento = 'PENDING';
                let dataVencimento = assinatura.nextDueDate;

                if (pagamentosResponse.ok) {
                  const pagamentos = await pagamentosResponse.json();
                  if (pagamentos.data.length > 0) {
                    const ultimoPagamento = pagamentos.data[0];
                    valorPago = ultimoPagamento.value;
                    statusPagamento = ultimoPagamento.status;
                    
                    // Se pagamento confirmado no mês filtrado, conta no faturamento
                    if (statusPagamento === 'CONFIRMED' && ultimoPagamento.paymentDate?.startsWith(mesFiltro)) {
                      totalFaturado += valorPago;
                      quantidadeAssinaturas++;
                    }
                  }
                }

                clientesComAssinaturas.push({
                  id: cliente.id,
                  nome: cliente.name,
                  email: cliente.email,
                  telefone: cliente.phone,
                  valorPago: valorPago,
                  nomePlano: assinatura.description || 'Plano Standard',
                  statusPagamento: statusPagamento,
                  dataVencimento: dataVencimento,
                  assinaturaId: assinatura.id,
                  conta: 'ASAAS_AND'
                });
              }
            }
            
            console.log(`✅ ${data.data.length} assinaturas processadas da conta ASAAS_AND`);
          }
        } catch (error) {
          console.error('Erro ao buscar assinaturas ASAAS_AND:', error);
        }
      }

      res.json({
        success: true,
        clientes: clientesComAssinaturas,
        faturamento: {
          totalFaturado: totalFaturado,
          quantidadeAssinaturas: quantidadeAssinaturas,
          mes: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())
        }
      });

    } catch (error) {
      console.error('Erro ao buscar clientes com assinaturas:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao buscar dados dos clientes',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Cancelar assinatura no Asaas
  app.post('/api/assinaturas/:assinaturaId/cancelar', async (req: Request, res: Response) => {
    try {
      const { assinaturaId } = req.params;
      const { clienteId } = req.body;

      console.log(`🔄 Cancelando assinatura ${assinaturaId} do cliente ${clienteId}...`);
      
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAnd = process.env.ASAAS_AND;
      
      const baseUrl = 'https://www.asaas.com/api/v3';
      let cancelado = false;

      // Tentar cancelar na conta ASAAS_TRATO primeiro
      if (asaasTrato && !cancelado) {
        try {
          const response = await fetch(`${baseUrl}/subscriptions/${assinaturaId}`, {
            method: 'DELETE',
            headers: {
              'access_token': asaasTrato,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            cancelado = true;
            console.log(`✅ Assinatura ${assinaturaId} cancelada na conta ASAAS_TRATO`);
          }
        } catch (error) {
          console.log('Assinatura não encontrada na conta ASAAS_TRATO, tentando ASAAS_AND...');
        }
      }

      // Se não cancelou na primeira conta, tentar na segunda
      if (asaasAnd && !cancelado) {
        try {
          const response = await fetch(`${baseUrl}/subscriptions/${assinaturaId}`, {
            method: 'DELETE',
            headers: {
              'access_token': asaasAnd,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            cancelado = true;
            console.log(`✅ Assinatura ${assinaturaId} cancelada na conta ASAAS_AND`);
          }
        } catch (error) {
          console.error('Erro ao cancelar assinatura na conta ASAAS_AND:', error);
        }
      }

      if (cancelado) {
        res.json({
          success: true,
          message: 'Assinatura cancelada com sucesso'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Assinatura não encontrada ou erro ao cancelar'
        });
      }

    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // TESTE DE CONECTIVIDADE ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.get('/api/test-asaas', async (req: Request, res: Response) => {
    try {
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;
      
      console.log('🔍 Debug - Variáveis de ambiente:');
      console.log('ASAAS_TRATO:', asaasTrato ? `${asaasTrato.substring(0, 20)}...` : 'NÃO DEFINIDA');
      console.log('ASAAS_AND:', asaasAndrey ? `${asaasAndrey.substring(0, 20)}...` : 'NÃO DEFINIDA');
      
      const resultados = [];

      // Testar ASAAS_TRATO (sempre produção)
      if (asaasTrato) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasTrato,
              'Content-Type': 'application/json'
            }
          });
          
          resultados.push({
            conta: 'ASAAS_TRATO',
            status: response.status,
            ok: response.ok,
            url: 'https://www.asaas.com/api/v3/',
            dados: response.ok ? await response.json() : null
          });
        } catch (error) {
          resultados.push({
            conta: 'ASAAS_TRATO',
            erro: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      // Testar ASAAS_AND (sempre produção)
      if (asaasAndrey) {
        try {
          const response = await fetch('https://www.asaas.com/api/v3/customers?limit=100', {
            headers: {
              'access_token': asaasAndrey,
              'Content-Type': 'application/json'
            }
          });
          
          resultados.push({
            conta: 'ASAAS_AND',
            status: response.status,
            ok: response.ok,
            url: 'https://www.asaas.com/api/v3/',
            dados: response.ok ? await response.json() : null
          });
        } catch (error) {
          resultados.push({
            conta: 'ASAAS_AND',
            erro: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }

      res.json({
        success: true,
        ambiente: 'PRODUÇÃO APENAS',
        baseUrl: 'https://www.asaas.com/api/v3/',
        resultados,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro no teste ASAAS:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // SINCRONIZAÇÃO CLIENTES ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post("/api/sync/clientes-asaas", async (req: Request, res: Response) => {
    try {
      console.log('🔄 Sincronizando clientes da conta: ASAAS_TRATO');
      
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;
      
      if (!asaasTrato && !asaasAndrey) {
        return res.status(500).json({ 
          success: false, 
          message: 'Nenhuma chave ASAAS configurada' 
        });
      }

      let totalSincronizados = 0;
      const resultados = [];

      // PRODUÇÃO APENAS: URL fixa para produção
      const baseUrl = 'https://www.asaas.com/api/v3';

      // Sincronizar ASAAS_TRATO
      if (asaasTrato) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_TRATO');
        
        const response = await fetch(`${baseUrl}/customers?limit=100`, {
          headers: {
            'access_token': asaasTrato,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          resultados.push({
            conta: 'ASAAS_TRATO',
            total: data.totalCount || 0,
            url: baseUrl,
            status: 'sucesso'
          });
        } else {
          resultados.push({
            conta: 'ASAAS_TRATO',
            erro: `HTTP ${response.status}`,
            url: baseUrl
          });
        }
      }

      // Sincronizar ASAAS_AND
      if (asaasAndrey) {
        console.log('🔄 Sincronizando clientes da conta: ASAAS_AND');
        
        const response = await fetch(`${baseUrl}/customers?limit=100`, {
          headers: {
            'access_token': asaasAndrey,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          resultados.push({
            conta: 'ASAAS_AND',
            total: data.totalCount || 0,
            url: baseUrl,
            status: 'sucesso'
          });
        } else {
          resultados.push({
            conta: 'ASAAS_AND',
            erro: `HTTP ${response.status}`,
            url: baseUrl
          });
        }
      }

      res.json({
        success: true,
        message: 'Sincronização concluída (PRODUÇÃO)',
        ambiente: 'PRODUÇÃO APENAS',
        baseUrl: baseUrl,
        totalSincronizados,
        resultados
      });

    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro na sincronização',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CRIAR CLIENTE NO ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post("/api/asaas/criar-cliente", async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, cpf } = req.body;
      
      if (!nome) {
        return res.status(400).json({ message: 'Nome é obrigatório' });
      }

      const asaasApiKey = process.env.ASAAS_AND;
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Chave API ASAAS não configurada' });
      }

      const customerData = {
        name: nome,
        email: email || undefined,
        phone: telefone || undefined,
        cpfCnpj: cpf || undefined
      };

      // PRODUÇÃO APENAS: URL fixa para produção
      const baseUrl = 'https://www.asaas.com/api/v3';

      const response = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const result = await response.json();

      if (response.ok) {
        res.json({
          success: true,
          customer: result,
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          message: 'Cliente criado com sucesso'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erro ao criar cliente',
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          error: result
        });
      }
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CRIAR PLANO DE ASSINATURA (ENDPOINT GERENCIAR-ASSINATURAS)
  // =====================================================

  app.post("/api/assinatura/criar-plano", async (req: Request, res: Response) => {
    try {
      const { nome, descricao, valorMensal, categoria, servicosIncluidos } = req.body;
      
      if (!nome || !valorMensal || !categoria) {
        return res.status(400).json({ 
          success: false,
          message: 'Nome, valor mensal e categoria são obrigatórios' 
        });
      }

      // Salvar plano no banco de dados local
      const novoPlano = await db.insert(schema.planosPersonalizados).values({
        nome,
        descricao: descricao || `Plano ${nome} - ${categoria}`,
        valor: valorMensal.toString(),
        categoria
      }).returning();

      res.json({
        success: true,
        plano: novoPlano[0],
        message: 'Plano criado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao criar plano:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // FINALIZAR PAGAMENTO EXTERNO
  // =====================================================

  app.post("/api/clientes-externos/finalizar-pagamento", async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, planoNome, planoValor, formaPagamento, origem } = req.body;
      
      if (!nome || !planoNome || !planoValor || !formaPagamento) {
        return res.status(400).json({ 
          success: false,
          message: 'Nome, plano, valor e forma de pagamento são obrigatórios' 
        });
      }

      // Salvar cliente externo no banco de dados
      const novoCliente = await db.insert(schema.clientes).values({
        nome,
        email: email || '',
        telefone: telefone || '',
        origem: 'EXTERNO',
        planoNome,
        planoValor: planoValor.toString(),
        formaPagamento,
        statusAssinatura: 'ATIVO',
        dataInicioAssinatura: new Date(),
        dataVencimentoAssinatura: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      }).returning();

      res.json({
        success: true,
        cliente: novoCliente[0],
        message: 'Cliente cadastrado com sucesso para pagamento externo'
      });

    } catch (error) {
      console.error('Erro ao finalizar pagamento externo:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // LISTAR PLANOS DE ASSINATURA
  // =====================================================

  app.get("/api/planos-assinatura", async (req: Request, res: Response) => {
    try {
      const planos = await db.select().from(schema.planosPersonalizados).where(eq(schema.planosPersonalizados.ativo, true));
      
      res.json(planos.map(plano => ({
        id: plano.id,
        nome: plano.nome,
        descricao: plano.descricao,
        valorMensal: parseFloat(plano.valor),
        valor: parseFloat(plano.valor),
        categoria: plano.categoria,
        createdAt: plano.createdAt
      })));

    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CRIAR ASSINATURA NO ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post("/api/asaas/criar-assinatura", async (req: Request, res: Response) => {
    try {
      const { customerId, value, description } = req.body;
      
      if (!customerId || !value) {
        return res.status(400).json({ message: 'customerId e value são obrigatórios' });
      }

      const asaasApiKey = process.env.ASAAS_AND;
      if (!asaasApiKey) {
        return res.status(500).json({ message: 'Chave API ASAAS não configurada' });
      }

      const subscriptionData = {
        customer: customerId,
        billingType: 'PIX',
        nextDueDate: new Date().toISOString().split('T')[0],
        value: value,
        cycle: 'MONTHLY',
        description: description || 'Assinatura Mensal'
      };

      // PRODUÇÃO APENAS: URL fixa para produção
      const baseUrl = 'https://www.asaas.com/api/v3';

      const response = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const result = await response.json();

      if (response.ok) {
        res.json({
          success: true,
          subscription: result,
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          message: 'Assinatura criada com sucesso'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Erro ao criar assinatura',
          ambiente: 'PRODUÇÃO',
          baseUrl: baseUrl,
          error: result
        });
      }
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // WEBHOOK ASAAS (APENAS PRODUÇÃO)
  // =====================================================

  app.post('/webhook/asaas', async (req: Request, res: Response) => {
    try {
      // Validar origem da requisição
      const userAgent = req.get('User-Agent');
      if (!userAgent || !userAgent.includes('Asaas')) {
        console.log('❌ Webhook rejeitado - User-Agent inválido:', userAgent);
        return res.status(400).json({ message: 'Origem não autorizada' });
      }

      const { event, payment } = req.body;
      
      if (!event || !payment) {
        console.log('❌ Webhook rejeitado - Dados incompletos');
        return res.status(400).json({ message: 'Dados do webhook incompletos' });
      }

      console.log('📨 Webhook ASAAS recebido (PRODUÇÃO):', {
        event,
        paymentId: payment.id,
        customerId: payment.customer,
        value: payment.value,
        status: payment.status,
        ambiente: 'PRODUÇÃO'
      });

      // Processar evento
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
          console.log(`✅ Pagamento confirmado: ${payment.id}`);
          break;
        
        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_DELETED':
          console.log(`❌ Pagamento cancelado: ${payment.id}`);
          break;
        
        default:
          console.log(`ℹ️ Evento não processado: ${event}`);
      }

      res.status(200).json({ 
        message: 'Webhook processado com sucesso',
        ambiente: 'PRODUÇÃO'
      });

    } catch (error) {
      console.error('❌ Erro no webhook ASAAS:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });



  // =====================================================
  // ROTAS CONSOLIDADAS - OTIMIZAÇÃO DE PERFORMANCE
  // =====================================================

  // ROTAS CONSOLIDADAS - OTIMIZAÇÃO DE PERFORMANCE
  
  // Clientes unificados com filtros - FONTE ÚNICA DE DADOS
  app.get('/api/clientes', async (req: Request, res: Response) => {
    try {
      const { status, forAgendamento, page = 1, limit = 100, search } = req.query;
      
      let whereClause = eq(schema.clientes.id, schema.clientes.id); // Always true base condition
      
      // Filtros aplicados
      if (status === 'ativo' || forAgendamento === 'true') {
        whereClause = eq(schema.clientes.statusAssinatura, 'ATIVO');
      }
      
      let clientes = await db.select().from(schema.clientes).where(whereClause).orderBy(schema.clientes.nome);
      
      // Aplicar filtro de busca se fornecido
      if (search && typeof search === 'string') {
        const searchTerm = search.toLowerCase();
        clientes = clientes.filter(cliente => 
          cliente.nome.toLowerCase().includes(searchTerm) ||
          cliente.email.toLowerCase().includes(searchTerm) ||
          (cliente.telefone && cliente.telefone.includes(searchTerm)) ||
          (cliente.cpf && cliente.cpf.includes(searchTerm))
        );
      }
      
      // Validação anti-duplicidade por email, telefone ou CPF
      const clientesUnicos = new Map();
      clientes.forEach(cliente => {
        const chaveEmail = cliente.email?.toLowerCase();
        const chaveTelefone = cliente.telefone;
        const chaveCpf = cliente.cpf;
        
        // Verificar se já existe cliente com mesmo email, telefone ou CPF
        let isDuplicate = false;
        for (const existingCliente of clientesUnicos.values()) {
          if ((chaveEmail && existingCliente.email?.toLowerCase() === chaveEmail) ||
              (chaveTelefone && existingCliente.telefone === chaveTelefone) ||
              (chaveCpf && existingCliente.cpf === chaveCpf)) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          clientesUnicos.set(cliente.id, cliente);
        }
      });
      
      const clientesFinais = Array.from(clientesUnicos.values());
      
      // Paginação
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedClientes = clientesFinais.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedClientes,
        total: clientesFinais.length,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Serviços consolidados com filtros
  app.get('/api/servicos', async (req: Request, res: Response) => {
    try {
      const { categoria, page = 1, limit = 50 } = req.query;
      
      let whereClause = eq(schema.servicos.id, schema.servicos.id); // Always true base condition
      
      // Filtros aplicados
      if (categoria === 'assinatura') {
        whereClause = eq(schema.servicos.isAssinatura, true);
      }
      
      const servicos = await db.select().from(schema.servicos).where(whereClause).orderBy(schema.servicos.nome);
      
      // Paginação
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedServicos = servicos.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedServicos,
        total: servicos.length,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Agendamentos com filtros otimizados e JOINs completos
  app.get('/api/agendamentos', async (req: Request, res: Response) => {
    try {
      const { date, data } = req.query;
      const dataFiltro = date || data; // Aceita tanto 'date' quanto 'data'
      
      if (!dataFiltro) {
        return res.status(400).json({ message: 'Data é obrigatória' });
      }
      
      // Query com JOINs para retornar dados completos e filtro de horário
      const agendamentos = await db
        .select({
          id: schema.agendamentos.id,
          clienteId: schema.agendamentos.clienteId,
          barbeiroId: schema.agendamentos.barbeiroId,
          servicoId: schema.agendamentos.servicoId,
          dataHora: schema.agendamentos.dataHora,
          status: schema.agendamentos.status,
          observacoes: schema.agendamentos.observacoes,
          cliente: {
            nome: schema.clientes.nome
          },
          barbeiro: {
            nome: schema.profissionais.nome
          },
          servico: {
            nome: schema.servicos.nome,
            tempoMinutos: schema.servicos.tempoMinutos
          }
        })
        .from(schema.agendamentos)
        .leftJoin(schema.clientes, eq(schema.agendamentos.clienteId, schema.clientes.id))
        .leftJoin(schema.profissionais, eq(schema.agendamentos.barbeiroId, schema.profissionais.id))
        .leftJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
        .where(sql`CAST(${schema.agendamentos.dataHora} AS TEXT) LIKE ${`${dataFiltro}%`} 
                   AND EXTRACT(HOUR FROM ${schema.agendamentos.dataHora}) >= 8 
                   AND EXTRACT(HOUR FROM ${schema.agendamentos.dataHora}) <= 20`)
        .orderBy(schema.agendamentos.dataHora);
      
      res.json(agendamentos);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Função auxiliar para buscar ou criar cliente automaticamente
  async function buscarOuCriarCliente(dadosCliente: any): Promise<{ clienteId: number, tipoOperacao: 'existente' | 'criado' }> {
    const { email, telefone, cpf, cnpj, nome, asaasCustomerId } = dadosCliente;
    
    // Verificar se cliente já existe por email, telefone ou CPF/CNPJ (com validação de nulos)
    let clienteExistente = [];
    
    if (email) {
      clienteExistente = await db.select()
        .from(schema.clientes)
        .where(eq(schema.clientes.email, email))
        .limit(1);
    }
    
    if (clienteExistente.length === 0 && telefone) {
      clienteExistente = await db.select()
        .from(schema.clientes)
        .where(eq(schema.clientes.telefone, telefone))
        .limit(1);
    }
    
    if (clienteExistente.length === 0 && (cpf || cnpj)) {
      clienteExistente = await db.select()
        .from(schema.clientes)
        .where(eq(schema.clientes.cpf, cpf || cnpj))
        .limit(1);
    }

    if (clienteExistente.length > 0) {
      console.log(`Cliente existente encontrado: ID ${clienteExistente[0].id}, Nome: ${clienteExistente[0].nome}`);
      return {
        clienteId: clienteExistente[0].id,
        tipoOperacao: 'existente'
      };
    }

    // Cliente não existe, criar novo
    const [novoCliente] = await db.insert(schema.clientes)
      .values({
        nome: nome || 'Cliente',
        email: email || 'cliente@email.com',
        telefone: telefone || null,
        cpf: cpf || cnpj || null,
        asaasCustomerId: asaasCustomerId || null,
        origem: 'AGENDAMENTO_AUTOMATICO',
        planoNome: 'Plano Básico',
        planoValor: '50.00',
        formaPagamento: 'PIX',
        statusAssinatura: 'ATIVO',
        dataInicioAssinatura: new Date(),
        dataVencimentoAssinatura: new Date(new Date().setMonth(new Date().getMonth() + 1))
      })
      .returning();

    console.log(`Novo cliente criado: ID ${novoCliente.id}, Nome: ${novoCliente.nome}`);
    return {
      clienteId: novoCliente.id,
      tipoOperacao: 'criado'
    };
  }

  // POST Agendamentos - Implementação com busca/criação automática de cliente
  app.post('/api/agendamentos', async (req: Request, res: Response) => {
    try {
      console.log('=== INÍCIO DO AGENDAMENTO ===');
      console.log('Body recebido:', JSON.stringify(req.body, null, 2));
      
      const { 
        clienteId, 
        dadosCliente, 
        barbeiroId, 
        servicoId, 
        dataHora, 
        observacoes 
      } = req.body;
      
      console.log('Valores extraídos:', { clienteId, dadosCliente, barbeiroId, servicoId, dataHora });

      let clienteIdFinal = clienteId;
      let tipoOperacaoCliente: 'existente' | 'criado' | 'fornecido' = 'fornecido';

      // Se não foi fornecido clienteId mas foram fornecidos dadosCliente, buscar ou criar cliente
      if (!clienteId && dadosCliente) {
        const resultado = await buscarOuCriarCliente(dadosCliente);
        clienteIdFinal = resultado.clienteId;
        tipoOperacaoCliente = resultado.tipoOperacao;
      } else if (!clienteId) {
        return res.status(400).json({
          message: 'ClienteId ou dadosCliente são obrigatórios'
        });
      }

      // Validação básica dos campos obrigatórios
      if (!barbeiroId || !servicoId || !dataHora) {
        return res.status(400).json({
          message: 'BarbeiroId, servicoId e dataHora são obrigatórios'
        });
      }

      // Validar horário permitido (08:00 às 20:00)
      const dataHoraValidacao = new Date(dataHora);
      const hour = dataHoraValidacao.getHours();
      
      if (hour < 8 || hour > 20) {
        return res.status(400).json({
          message: 'Agendamentos só são permitidos entre 08:00 e 20:00'
        });
      }

      // Validar se cliente existe e está ativo
      const cliente = await db.select()
        .from(schema.clientes)
        .where(eq(schema.clientes.id, clienteIdFinal))
        .limit(1);

      if (cliente.length === 0) {
        return res.status(400).json({
          message: 'Cliente não encontrado'
        });
      }

      if (cliente[0].statusAssinatura !== 'ATIVO') {
        return res.status(400).json({
          message: 'Cliente não possui assinatura ativa'
        });
      }

      // Validar se barbeiro existe e está ativo
      const barbeiro = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.id, barbeiroId),
          eq(schema.profissionais.tipo, 'barbeiro')
        ))
        .limit(1);

      if (barbeiro.length === 0) {
        return res.status(400).json({
          message: 'Barbeiro não encontrado'
        });
      }

      if (!barbeiro[0].ativo) {
        return res.status(400).json({
          message: 'Barbeiro não está ativo no sistema'
        });
      }

      // Validar se serviço existe
      const servico = await db.select()
        .from(schema.servicos)
        .where(eq(schema.servicos.id, servicoId))
        .limit(1);

      if (servico.length === 0) {
        return res.status(400).json({
          message: 'Serviço não encontrado'
        });
      }

      // Verificar conflito de horário usando SQL direto
      const agendamentoExistente = await db.select()
        .from(schema.agendamentos)
        .where(
          sql`${schema.agendamentos.barbeiroId} = ${barbeiroId} 
              AND ${schema.agendamentos.dataHora} = ${dataHora}::timestamp
              AND ${schema.agendamentos.status} = 'AGENDADO'`
        )
        .limit(1);

      if (agendamentoExistente.length > 0) {
        return res.status(409).json({
          message: 'Já existe um agendamento para este barbeiro no horário selecionado'
        });
      }

      // Converter string para Date object (renomeando para evitar conflito)
      const dataHoraFinal = new Date(dataHora);
      
      // Criar o agendamento usando Drizzle ORM
      const [novoAgendamento] = await db.insert(schema.agendamentos)
        .values({
          clienteId: clienteIdFinal,
          barbeiroId: barbeiroId,
          servicoId: servicoId,
          dataHora: dataHoraFinal,
          observacoes: observacoes || null,
          status: 'AGENDADO'
        })
        .returning({ id: schema.agendamentos.id });

      const agendamentoId = novoAgendamento.id;
      console.log(`Agendamento criado com ID: ${agendamentoId}`);

      // Resposta conforme especificado
      if (tipoOperacaoCliente === 'criado') {
        res.status(201).json({
          success: true,
          cliente: 'criado',
          clienteId: clienteIdFinal,
          agendamentoId: agendamentoId
        });
      } else {
        res.status(201).json({
          success: true,
          cliente: 'existente',
          clienteId: clienteIdFinal,
          agendamentoId: agendamentoId
        });
      }

    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor ao criar agendamento' 
      });
    }
  });

  // =====================================================
  // BACKEND COMPLETO SERVIÇOS - CLEAN CODE & PERFORMANCE
  // =====================================================

  /**
   * SERVICES CONTROLLER - Gestão completa de serviços
   * Implementação RESTful com validações, paginação e performance otimizada
   */

  // Validador de dados de serviço
  const validateServicoData = (data: any) => {
    const errors: string[] = [];
    
    if (!data.nome || typeof data.nome !== 'string' || data.nome.trim().length === 0) {
      errors.push('Nome é obrigatório e deve ser uma string válida');
    }
    
    if (!data.tempoMinutos || typeof data.tempoMinutos !== 'number' || data.tempoMinutos <= 0) {
      errors.push('Tempo é obrigatório e deve ser um número positivo em minutos');
    }
    
    if (data.nome && data.nome.trim().length > 100) {
      errors.push('Nome deve ter no máximo 100 caracteres');
    }
    
    if (data.tempoMinutos && (data.tempoMinutos > 480 || data.tempoMinutos < 5)) {
      errors.push('Tempo deve estar entre 5 e 480 minutos (8 horas)');
    }
    
    return errors;
  };

  /**
   * GET /api/servicos
   * Lista todos os serviços com filtros e paginação
   * Query params: ?status=ativo|inativo&page=1&limit=50&search=nome
   */
  app.get('/api/servicos', async (req: Request, res: Response) => {
    try {
      const { 
        status = 'ativo', 
        page = 1, 
        limit = 50, 
        search = '',
        categoria 
      } = req.query;
      
      // Construir filtros dinamicamente
      const filters = [];
      
      // Filtro por status ativo/inativo (soft delete)
      if (status === 'ativo') {
        filters.push(eq(schema.servicos.isAssinatura, true));
      } else if (status === 'inativo') {
        filters.push(eq(schema.servicos.isAssinatura, false));
      }
      
      // Filtro por categoria (assinatura)
      if (categoria === 'assinatura') {
        filters.push(eq(schema.servicos.isAssinatura, true));
      }
      
      // Busca por nome
      let servicos;
      if (search && typeof search === 'string' && search.trim()) {
        servicos = await db.select().from(schema.servicos)
          .where(sql`${schema.servicos.nome} ILIKE ${`%${search.trim()}%`}`)
          .orderBy(schema.servicos.nome);
      } else {
        // Query base com filtros
        const whereCondition = filters.length > 0 ? 
          sql`${filters.map((_, i) => `$${i + 1}`).join(' AND ')}` : 
          sql`1=1`;
          
        servicos = await db.select().from(schema.servicos)
          .orderBy(schema.servicos.nome);
      }
      
      // Aplicar paginação
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const offset = (pageNum - 1) * limitNum;
      
      const paginatedServicos = servicos.slice(offset, offset + limitNum);
      
      res.json({
        success: true,
        data: paginatedServicos,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: servicos.length,
          totalPages: Math.ceil(servicos.length / limitNum)
        },
        filters: {
          status,
          search: search || null,
          categoria: categoria || null
        }
      });
      
    } catch (error) {
      console.error('Erro ao listar serviços:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor ao listar serviços' 
      });
    }
  });

  /**
   * POST /api/servicos
   * Cadastra novo serviço com validação e verificação de duplicatas
   * Body: { nome: string, tempoMinutos: number }
   */
  app.post('/api/servicos', async (req: Request, res: Response) => {
    try {
      const { nome, tempoMinutos } = req.body;
      
      // Validação de entrada
      const validationErrors = validateServicoData({ nome, tempoMinutos });
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: validationErrors
        });
      }
      
      // Verificar duplicação de nome com lógica inteligente para ativos/inativos
      const nomeFormatado = nome.trim().toLowerCase();
      const servicoExistente = await db.select().from(schema.servicos)
        .where(sql`LOWER(TRIM(${schema.servicos.nome})) = ${nomeFormatado}`)
        .limit(1);
      
      if (servicoExistente.length > 0) {
        const servico = servicoExistente[0];
        
        // Se o serviço está ATIVO, não permitir duplicação
        if (servico.isAssinatura) {
          return res.status(400).json({
            success: false,
            message: `Já existe um serviço ativo com o nome "${servico.nome}"`,
            errors: ['Nome duplicado'],
            servicoStatus: 'ativo',
            servicoExistente: servico
          });
        }
        
        // Se o serviço está INATIVO, oferecer opção de reativação
        return res.status(409).json({
          success: false,
          message: `Existe um serviço inativo com o nome "${servico.nome}"`,
          errors: ['Serviço inativo encontrado'],
          servicoStatus: 'inativo',
          servicoExistente: servico,
          opcoes: {
            reativar: true,
            criarNovo: false
          },
          sugestao: 'Deseja reativar o serviço existente ou escolher outro nome?'
        });
      }
      
      // Criar serviço
      const [novoServico] = await db.insert(schema.servicos).values({
        nome: nome.trim(),
        tempoMinutos: Number(tempoMinutos),
        isAssinatura: true, // Por padrão, todos são de assinatura
        percentualComissao: '40.00' // Valor padrão
      }).returning();
      
      res.status(201).json({
        success: true,
        message: 'Serviço cadastrado com sucesso',
        data: novoServico
      });
      
    } catch (error) {
      console.error('Erro ao cadastrar serviço:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor ao cadastrar serviço' 
      });
    }
  });

  /**
   * PUT /api/servicos/:id
   * Atualiza serviço existente (nome e/ou tempo)
   * Body: { nome?: string, tempoMinutos?: number }
   */
  app.put('/api/servicos/:id', async (req: Request, res: Response) => {
    try {
      const servicoId = parseInt(req.params.id);
      const { nome, tempoMinutos } = req.body;
      
      if (isNaN(servicoId) || servicoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ID do serviço inválido'
        });
      }
      
      // Verificar se serviço existe
      const [servicoExistente] = await db.select().from(schema.servicos)
        .where(eq(schema.servicos.id, servicoId))
        .limit(1);
      
      if (!servicoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Serviço não encontrado'
        });
      }
      
      // Preparar dados para atualização
      const dadosAtualizacao: any = {};
      
      if (nome !== undefined) {
        const validationErrors = validateServicoData({ nome, tempoMinutos: servicoExistente.tempoMinutos });
        if (validationErrors.some(err => err.includes('Nome'))) {
          return res.status(400).json({
            success: false,
            message: 'Nome inválido',
            errors: validationErrors.filter(err => err.includes('Nome'))
          });
        }
        
        // Verificar duplicação de nome (excluindo o próprio registro)
        const nomeFormatado = nome.trim().toLowerCase();
        const servicoDuplicado = await db.select().from(schema.servicos)
          .where(sql`LOWER(${schema.servicos.nome}) = ${nomeFormatado} AND ${schema.servicos.id} != ${servicoId}`)
          .limit(1);
        
        if (servicoDuplicado.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Já existe outro serviço com este nome',
            errors: ['Nome duplicado']
          });
        }
        
        dadosAtualizacao.nome = nome.trim();
      }
      
      if (tempoMinutos !== undefined) {
        const validationErrors = validateServicoData({ nome: servicoExistente.nome, tempoMinutos });
        if (validationErrors.some(err => err.includes('Tempo'))) {
          return res.status(400).json({
            success: false,
            message: 'Tempo inválido',
            errors: validationErrors.filter(err => err.includes('Tempo'))
          });
        }
        
        dadosAtualizacao.tempoMinutos = Number(tempoMinutos);
      }
      
      // Se não há dados para atualizar
      if (Object.keys(dadosAtualizacao).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum dado válido fornecido para atualização'
        });
      }
      
      // Realizar atualização
      const [servicoAtualizado] = await db.update(schema.servicos)
        .set(dadosAtualizacao)
        .where(eq(schema.servicos.id, servicoId))
        .returning();
      
      res.json({
        success: true,
        message: 'Serviço atualizado com sucesso',
        data: servicoAtualizado
      });
      
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor ao atualizar serviço' 
      });
    }
  });

  /**
   * PATCH /api/servicos/:id/reativar
   * Reativa serviço inativo
   */
  app.patch('/api/servicos/:id/reativar', async (req: Request, res: Response) => {
    try {
      const servicoId = parseInt(req.params.id);
      
      if (isNaN(servicoId) || servicoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ID do serviço inválido'
        });
      }
      
      // Verificar se serviço existe e está inativo
      const [servicoExistente] = await db.select().from(schema.servicos)
        .where(eq(schema.servicos.id, servicoId))
        .limit(1);
      
      if (!servicoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Serviço não encontrado'
        });
      }
      
      if (servicoExistente.isAssinatura) {
        return res.status(400).json({
          success: false,
          message: 'Serviço já está ativo'
        });
      }
      
      // Reativar serviço
      const [servicoReativado] = await db.update(schema.servicos)
        .set({ isAssinatura: true })
        .where(eq(schema.servicos.id, servicoId))
        .returning();
      
      res.json({
        success: true,
        message: 'Serviço reativado com sucesso',
        data: servicoReativado
      });
      
    } catch (error) {
      console.error('Erro ao reativar serviço:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor ao reativar serviço' 
      });
    }
  });

  /**
   * DELETE /api/servicos/:id
   * Inativa serviço (soft delete) mantendo histórico
   * Não remove fisicamente, apenas marca como inativo
   */
  app.delete('/api/servicos/:id', async (req: Request, res: Response) => {
    try {
      const servicoId = parseInt(req.params.id);
      
      if (isNaN(servicoId) || servicoId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ID do serviço inválido'
        });
      }
      
      // Verificar se serviço existe e está ativo
      const [servicoExistente] = await db.select().from(schema.servicos)
        .where(eq(schema.servicos.id, servicoId))
        .limit(1);
      
      if (!servicoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Serviço não encontrado'
        });
      }
      
      if (!servicoExistente.isAssinatura) {
        return res.status(400).json({
          success: false,
          message: 'Serviço já está inativo'
        });
      }
      
      // Verificar se serviço está sendo usado em agendamentos ativos
      const agendamentosAtivos = await db.select().from(schema.agendamentos)
        .where(eq(schema.agendamentos.servicoId, servicoId))
        .limit(1);
      
      if (agendamentosAtivos.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível inativar serviço com agendamentos ativos',
          errors: ['Serviço em uso']
        });
      }
      
      // Soft delete - marcar como inativo
      const [servicoInativado] = await db.update(schema.servicos)
        .set({ isAssinatura: false })
        .where(eq(schema.servicos.id, servicoId))
        .returning();
      
      res.json({
        success: true,
        message: 'Serviço inativado com sucesso',
        data: servicoInativado
      });
      
    } catch (error) {
      console.error('Erro ao inativar serviço:', error);
      res.status(500).json({ 
        success: false,
        message: 'Erro interno do servidor ao inativar serviço' 
      });
    }
  });

  // PATCH Finalizar agendamento
  app.patch('/api/agendamentos/:id/finalizar', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [agendamento] = await db.update(schema.agendamentos)
        .set({ status: 'FINALIZADO' })
        .where(eq(schema.agendamentos.id, id))
        .returning();
      res.json(agendamento);
    } catch (error) {
      console.error('Erro ao finalizar agendamento:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // PATCH Cancelar agendamento
  app.patch('/api/agendamentos/:id/cancelar', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.delete(schema.agendamentos).where(eq(schema.agendamentos.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // DELETE Cancelar agendamento (remover completamente)
  app.delete('/api/agendamentos/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID do agendamento inválido' 
        });
      }

      // Verificar se o agendamento existe
      const agendamentoExistente = await db.select()
        .from(schema.agendamentos)
        .where(eq(schema.agendamentos.id, id))
        .limit(1);

      if (agendamentoExistente.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Agendamento não encontrado' 
        });
      }

      // Deletar o agendamento
      await db.delete(schema.agendamentos).where(eq(schema.agendamentos.id, id));
      
      res.json({ 
        success: true, 
        message: 'Agendamento cancelado com sucesso' 
      });
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }
  });

  // =====================================================
  // AUTENTICAÇÃO BÁSICA
  // =====================================================

  // Login com autenticação real usando cookies
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
      }
      
      // Buscar usuário no banco
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
      
      if (!user) {
        return res.status(401).json({ message: 'Email ou senha incorretos' });
      }
      
      // Verificar senha
      const senhaValida = await bcrypt.compare(password, user.password);
      if (!senhaValida) {
        return res.status(401).json({ message: 'Email ou senha incorretos' });
      }
      
      // Configurar cookie de autenticação
      res.cookie('user_id', user.id.toString(), { 
        httpOnly: true, 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });
      res.cookie('user_email', user.email, { 
        httpOnly: true, 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000 
      });
      res.cookie('user_role', user.role, { 
        httpOnly: true, 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000 
      });
      
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          nome: user.nome
        }
      });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Logout com limpeza completa dos cookies
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.clearCookie('user_id');
    res.clearCookie('user_email');
    res.clearCookie('user_role');
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });

  // Dados do usuário com verificação via cookies
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const userId = req.cookies.user_id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Não autenticado' });
      }
      
      // Buscar dados atualizados do usuário
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, parseInt(userId)));
      
      if (!user) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        nome: user.nome
      });
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // =====================================================
  // SISTEMA DE PROFISSIONAIS (BARBEIROS E RECEPCIONISTAS)
  // =====================================================

  // Redefinir senha de profissional (ADMIN)
  app.patch('/api/profissionais/:id/redefinir-senha', async (req: Request, res: Response) => {
    try {
      // Verificação manual de autenticação e autorização
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'Usuário não autenticado' 
        });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          message: 'Apenas administradores podem redefinir senhas' 
        });
      }

      const { id } = req.params;
      const { novaSenha, usarSenhaPadrao } = req.body;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID do profissional inválido'
        });
      }

      // Buscar profissional por ID na tabela profissionais
      const profissional = await db.select()
        .from(schema.profissionais)
        .where(eq(schema.profissionais.id, parseInt(id)))
        .limit(1);

      if (profissional.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Profissional não encontrado'
        });
      }

      let senhaParaUsar = novaSenha;
      
      // Se marcou para usar senha padrão ou não informou nova senha
      if (usarSenhaPadrao || !novaSenha) {
        senhaParaUsar = '12345678';
      }

      // Validar senha (mínimo 8 caracteres)
      if (senhaParaUsar.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Senha deve ter pelo menos 8 caracteres'
        });
      }

      // Hash da nova senha
      const saltRounds = 10;
      const novaSenhaHash = await bcrypt.hash(senhaParaUsar, saltRounds);

      // Atualizar senha na tabela profissionais
      await db.update(schema.profissionais)
        .set({
          senha: novaSenhaHash,
          updatedAt: new Date()
        })
        .where(eq(schema.profissionais.id, parseInt(id)));

      // Sincronizar com tabela users para manter consistência no login
      const userExistente = await db.select()
        .from(schema.users)
        .where(eq(schema.users.email, profissional[0].email))
        .limit(1);

      if (userExistente.length > 0) {
        // Atualizar usuário existente na tabela users
        await db.update(schema.users)
          .set({
            password: novaSenhaHash,
            nome: profissional[0].nome
          })
          .where(eq(schema.users.email, profissional[0].email));
      } else {
        // Criar usuário na tabela users se não existir
        await db.insert(schema.users).values({
          nome: profissional[0].nome,
          email: profissional[0].email,
          password: novaSenhaHash,
          role: profissional[0].tipo
        });
      }

      res.json({
        success: true,
        message: `Senha ${usarSenhaPadrao ? 'redefinida para padrão' : 'alterada'} com sucesso`,
        senhaUsada: usarSenhaPadrao ? 'Senha padrão: 12345678' : 'Nova senha definida'
      });

    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Cadastrar novo profissional
  app.post('/api/profissionais', async (req: Request, res: Response) => {
    try {
      const validation = schema.insertProfissionalSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const { nome, telefone, email, tipo, ativo } = validation.data;

      // SEMPRE usar senha padrão para novos barbeiros e recepcionistas
      const senhaAprovada = '12345678';

      // Verificar se email já existe na tabela profissionais
      const emailExistenteProfissionais = await db.select()
        .from(schema.profissionais)
        .where(eq(schema.profissionais.email, email))
        .limit(1);

      if (emailExistenteProfissionais.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email já está em uso por outro profissional'
        });
      }

      // Verificar se email já existe na tabela users
      const emailExistenteUsers = await db.select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (emailExistenteUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email já está em uso no sistema'
        });
      }

      // Hash da senha padrão com bcrypt
      const saltRounds = 10;
      const senhaHash = await bcrypt.hash(senhaAprovada, saltRounds);

      // Inserir profissional na tabela profissionais
      const novoProfissional = await db.insert(schema.profissionais).values({
        nome,
        telefone: telefone || null,
        email,
        senha: senhaHash,
        tipo,
        ativo: ativo !== undefined ? ativo : true,
        dataCadastro: new Date(),
        updatedAt: new Date()
      }).returning({
        id: schema.profissionais.id,
        nome: schema.profissionais.nome,
        telefone: schema.profissionais.telefone,
        email: schema.profissionais.email,
        tipo: schema.profissionais.tipo,
        ativo: schema.profissionais.ativo
      });

      // Também inserir na tabela users para permitir login
      await db.insert(schema.users).values({
        nome,
        email,
        password: senhaHash,
        role: tipo
      });

      res.status(201).json({
        success: true,
        message: 'Profissional cadastrado com sucesso',
        data: novoProfissional[0]
      });

    } catch (error) {
      console.error('Erro ao cadastrar profissional:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Listar todos os profissionais
  app.get('/api/profissionais', async (req: Request, res: Response) => {
    try {
      const profissionais = await db.select({
        id: schema.profissionais.id,
        nome: schema.profissionais.nome,
        telefone: schema.profissionais.telefone,
        email: schema.profissionais.email,
        tipo: schema.profissionais.tipo,
        ativo: schema.profissionais.ativo,
        dataCadastro: schema.profissionais.dataCadastro,
        ultimoLogin: schema.profissionais.ultimoLogin
      }).from(schema.profissionais)
        .orderBy(schema.profissionais.dataCadastro);

      res.json({
        success: true,
        data: profissionais,
        total: profissionais.length
      });

    } catch (error) {
      console.error('Erro ao listar profissionais:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Buscar profissional por ID
  app.get('/api/profissionais/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID do profissional inválido'
        });
      }

      const profissional = await db.select({
        id: schema.profissionais.id,
        nome: schema.profissionais.nome,
        telefone: schema.profissionais.telefone,
        email: schema.profissionais.email,
        tipo: schema.profissionais.tipo,
        ativo: schema.profissionais.ativo,
        dataCadastro: schema.profissionais.dataCadastro,
        ultimoLogin: schema.profissionais.ultimoLogin
      }).from(schema.profissionais)
        .where(eq(schema.profissionais.id, parseInt(id)))
        .limit(1);

      if (profissional.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Profissional não encontrado'
        });
      }

      res.json({
        success: true,
        data: profissional[0]
      });

    } catch (error) {
      console.error('Erro ao buscar profissional:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Atualizar dados do profissional
  app.put('/api/profissionais/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID do profissional inválido'
        });
      }

      const validation = schema.updateProfissionalSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      // Verificar se profissional existe
      const profissionalExistente = await db.select()
        .from(schema.profissionais)
        .where(eq(schema.profissionais.id, parseInt(id)))
        .limit(1);

      if (profissionalExistente.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Profissional não encontrado'
        });
      }

      // Se email foi alterado, verificar se já existe
      if (validation.data.email && validation.data.email !== profissionalExistente[0].email) {
        const emailExistente = await db.select()
          .from(schema.profissionais)
          .where(eq(schema.profissionais.email, validation.data.email))
          .limit(1);

        if (emailExistente.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Email já está em uso por outro profissional'
          });
        }
      }

      // Atualizar profissional
      const profissionalAtualizado = await db.update(schema.profissionais)
        .set({
          ...validation.data,
          updatedAt: new Date()
        })
        .where(eq(schema.profissionais.id, parseInt(id)))
        .returning({
          id: schema.profissionais.id,
          nome: schema.profissionais.nome,
          telefone: schema.profissionais.telefone,
          email: schema.profissionais.email,
          tipo: schema.profissionais.tipo,
          ativo: schema.profissionais.ativo,
          dataCadastro: schema.profissionais.dataCadastro,
          updatedAt: schema.profissionais.updatedAt
        });

      res.json({
        success: true,
        message: 'Profissional atualizado com sucesso',
        data: profissionalAtualizado[0]
      });

    } catch (error) {
      console.error('Erro ao atualizar profissional:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Alterar senha do profissional (requer autenticação)
  app.patch('/api/profissionais/:id/alterar-senha', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID do profissional inválido'
        });
      }

      const validation = schema.alterarSenhaSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const { senhaAtual, novaSenha } = validation.data;

      // Buscar profissional
      const profissional = await db.select()
        .from(schema.profissionais)
        .where(eq(schema.profissionais.id, parseInt(id)))
        .limit(1);

      if (profissional.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Profissional não encontrado'
        });
      }

      // Verificar senha atual
      const senhaValida = await bcrypt.compare(senhaAtual, profissional[0].senha);

      if (!senhaValida) {
        return res.status(401).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Hash da nova senha
      const saltRounds = 12;
      const novaSenhaHash = await bcrypt.hash(novaSenha, saltRounds);

      // Atualizar senha
      await db.update(schema.profissionais)
        .set({
          senha: novaSenhaHash,
          updatedAt: new Date()
        })
        .where(eq(schema.profissionais.id, parseInt(id)));

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });

    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Login do profissional
  app.post('/api/profissionais/login', async (req: Request, res: Response) => {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({
          success: false,
          message: 'Email e senha são obrigatórios'
        });
      }

      // Buscar profissional por email
      const profissional = await db.select()
        .from(schema.profissionais)
        .where(eq(schema.profissionais.email, email))
        .limit(1);

      if (profissional.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha incorretos'
        });
      }

      // Verificar se profissional está ativo
      if (!profissional[0].ativo) {
        return res.status(401).json({
          success: false,
          message: 'Profissional inativo. Entre em contato com o administrador.'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, profissional[0].senha);

      if (!senhaValida) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha incorretos'
        });
      }

      // Atualizar último login
      await db.update(schema.profissionais)
        .set({
          ultimoLogin: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.profissionais.id, profissional[0].id));

      // Retornar dados do profissional (sem senha)
      const { senha: _, ...profissionalDados } = profissional[0];

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: profissionalDados
      });

    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Deletar profissional (soft delete - marca como inativo)
  app.delete('/api/profissionais/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: 'ID do profissional inválido'
        });
      }

      // Verificar se profissional existe
      const profissionalExistente = await db.select()
        .from(schema.profissionais)
        .where(eq(schema.profissionais.id, parseInt(id)))
        .limit(1);

      if (profissionalExistente.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Profissional não encontrado'
        });
      }

      // Marcar como inativo (soft delete)
      await db.update(schema.profissionais)
        .set({
          ativo: false,
          updatedAt: new Date()
        })
        .where(eq(schema.profissionais.id, parseInt(id)));

      res.json({
        success: true,
        message: 'Profissional removido com sucesso'
      });

    } catch (error) {
      console.error('Erro ao deletar profissional:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CANCELAR E DELETAR CLIENTES
  // =====================================================

  // Cancelar cliente (marcar como cancelado)
  app.post('/api/clientes/:clienteId/cancelar', async (req: Request, res: Response) => {
    try {
      const { clienteId } = req.params;

      // Atualizar status do cliente para "cancelado"
      await db.update(schema.clientes)
        .set({ 
          status: 'cancelado',
          dataCancelamento: new Date()
        })
        .where(eq(schema.clientes.id, parseInt(clienteId)));

      res.json({ 
        success: true, 
        message: 'Cliente marcado como cancelado. Será removido automaticamente ao fim do período.'
      });

    } catch (error) {
      console.error('Erro ao cancelar cliente:', error);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Deletar cliente
  app.delete('/api/clientes/:clienteId/deletar', async (req: Request, res: Response) => {
    try {
      const { clienteId } = req.params;

      await db.delete(schema.clientes)
        .where(eq(schema.clientes.id, parseInt(clienteId)));

      res.json({ 
        success: true, 
        message: 'Cliente deletado com sucesso'
      });

    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // =====================================================
  // ENDPOINT DE SAÚDE
  // =====================================================

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok',
      ambiente: 'PRODUÇÃO APENAS',
      asaasBaseUrl: 'https://www.asaas.com/api/v3/',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  });

  // =====================================================
  // CRIAR CLIENTE + ASSINATURA RECORRENTE (ENDPOINT COMPLETO)
  // =====================================================
  
  app.post("/api/create-customer-subscription", async (req: Request, res: Response) => {
    try {
      const { cliente, assinatura, formaPagamento } = req.body;
      
      if (!cliente || !assinatura) {
        return res.status(400).json({ 
          success: false,
          message: 'Dados do cliente e assinatura são obrigatórios' 
        });
      }

      if (!cliente.name || !assinatura.value) {
        return res.status(400).json({ 
          success: false,
          message: 'Nome do cliente e valor da assinatura são obrigatórios' 
        });
      }

      // Se for pagamento externo, não gera link do Asaas
      if (formaPagamento === 'EXTERNAL') {
        return res.json({
          success: true,
          external: true,
          message: 'Cliente deve escolher método de pagamento externo'
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      if (!asaasApiKey) {
        return res.status(500).json({ 
          success: false,
          message: 'Chave API ASAAS_TRATO não configurada' 
        });
      }

      // 1. Criar cliente no ASAAS primeiro
      const customerData = {
        name: cliente.name,
        email: cliente.email || undefined,
        phone: cliente.phone || undefined,
        cpfCnpj: cliente.cpfCnpj || undefined
      };

      console.log('🔄 Criando cliente no ASAAS_TRATO:', customerData);

      const customerResponse = await fetch('https://www.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const customerResult = await customerResponse.json();

      if (!customerResponse.ok) {
        console.error('❌ Erro ao criar cliente:', customerResult);
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar cliente no ASAAS',
          error: customerResult
        });
      }

      console.log('✅ Cliente criado com ID:', customerResult.id);

      // 2. Gerar link personalizado para esse cliente específico
      const paymentLinkData = {
        billingType: 'CREDIT_CARD',
        chargeType: 'RECURRENT',
        name: assinatura.name || 'Assinatura Trato de Barbados',
        description: assinatura.description || 'Plano Mensal Barbearia',
        value: parseFloat(assinatura.value),
        subscriptionCycle: 'MONTHLY',
        customer: customerResult.id // ID do cliente criado
      };

      console.log('🔄 Criando paymentLink personalizado para cliente:', customerResult.id);

      const paymentLinkResponse = await fetch('https://www.asaas.com/api/v3/paymentLinks', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentLinkData)
      });

      const paymentLinkResult = await paymentLinkResponse.json();

      if (!paymentLinkResponse.ok) {
        console.error('❌ Erro ao criar paymentLink:', paymentLinkResult);
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar link de pagamento',
          error: paymentLinkResult
        });
      }

      console.log('✅ PaymentLink personalizado criado:', paymentLinkResult.url);

      // Resposta de sucesso com informações completas
      res.json({
        success: true,
        customer: {
          id: customerResult.id,
          name: customerResult.name
        },
        paymentLink: {
          id: paymentLinkResult.id,
          url: paymentLinkResult.url
        },
        message: 'Cliente criado e link personalizado gerado com sucesso'
      });

    } catch (error) {
      console.error('💥 Erro ao criar paymentLink recorrente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // CRIAR PLANO DE ASSINATURA COM LINK /i/ INDIVIDUALIZADO
  // =====================================================
  
  app.post("/api/planos/criar-assinatura", async (req: Request, res: Response) => {
    try {
      const { nome, email, telefone, cpfCnpj, plano } = req.body;
      
      // 1. Validar dados obrigatórios
      if (!nome || !email || !telefone) {
        return res.status(400).json({ 
          success: false,
          message: 'Campos obrigatórios: nome, email, telefone' 
        });
      }

      if (!plano || !plano.nome || !plano.valor) {
        return res.status(400).json({ 
          success: false,
          message: 'Dados do plano obrigatórios: nome, valor' 
        });
      }

      const asaasApiKey = process.env.ASAAS_TRATO;
      if (!asaasApiKey) {
        return res.status(500).json({ 
          success: false,
          message: 'Chave API ASAAS não configurada' 
        });
      }

      // 2. Criar cliente no Asaas
      const customerData = {
        name: nome,
        email: email,
        phone: telefone,
        cpfCnpj: cpfCnpj || undefined
      };

      console.log('🔄 Criando cliente no Asaas:', customerData);

      const customerResponse = await fetch('https://www.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const customerResult = await customerResponse.json();

      if (!customerResponse.ok) {
        console.error('❌ Erro ao criar cliente:', customerResult);
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar cliente no Asaas',
          error: customerResult
        });
      }

      const customerId = customerResult.id;
      console.log('✅ Cliente criado com ID:', customerId);

      // 4. Gerar link de pagamento recorrente individualizado (/i/)
      const paymentLinkData = {
        billingType: 'CREDIT_CARD',
        chargeType: 'RECURRENT',
        name: `${plano.nome} – ${nome}`,
        description: plano.descricao || `Assinatura mensal ${plano.nome}`,
        value: parseFloat(plano.valor),
        subscriptionCycle: 'MONTHLY',
        customer: customerId,
        notificationDisabled: false
      };

      console.log('🔄 Criando paymentLink individualizado:', paymentLinkData);

      const paymentLinkResponse = await fetch('https://www.asaas.com/api/v3/paymentLinks', {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentLinkData)
      });

      const paymentLinkResult = await paymentLinkResponse.json();

      if (!paymentLinkResponse.ok) {
        console.error('❌ Erro ao criar paymentLink:', paymentLinkResult);
        return res.status(400).json({
          success: false,
          message: 'Erro ao criar link de pagamento',
          error: paymentLinkResult
        });
      }

      console.log('✅ PaymentLink criado - Resposta completa:', JSON.stringify(paymentLinkResult, null, 2));

      // Extrair o link correto da resposta
      const linkUrl = paymentLinkResult.url || paymentLinkResult.shortUrl || paymentLinkResult.invoiceUrl;
      
      console.log('🔗 Link extraído:', linkUrl);

      // 5. Salvar no banco de dados local (opcional - você pode implementar depois)
      // TODO: Salvar customerResult.id, paymentLinkResult.id, linkUrl no banco

      // 6. Retornar link para o frontend
      res.json({
        success: true,
        cliente: {
          id: customerId,
          nome: customerResult.name
        },
        assinatura: {
          id: paymentLinkResult.subscription || paymentLinkResult.id,
          linkId: paymentLinkResult.id
        },
        linkUrl: linkUrl, // Link do Asaas
        paymentLinkResponse: paymentLinkResult, // Resposta completa para debug
        message: 'Plano de assinatura criado com link individualizado'
      });

    } catch (error) {
      console.error('💥 Erro ao criar plano de assinatura:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // =====================================================
  // ENDPOINTS DE COMISSÃO
  // =====================================================

  // GET - Estatísticas de comissão baseadas em assinaturas pagas e tempo trabalhado
  app.get('/api/comissao/stats', async (req: Request, res: Response) => {
    try {
      // Buscar todas as assinaturas com status ATIVO (pagas)
      const assinaturasPagas = await db.select({
        valor: schema.clientes.planoValor,
        status: schema.clientes.statusAssinatura
      })
      .from(schema.clientes)
      .where(eq(schema.clientes.statusAssinatura, 'ATIVO'));

      // Calcular receita total de assinaturas pagas
      const receitaTotalAssinatura = assinaturasPagas.reduce((total, assinatura) => {
        return total + (parseFloat(assinatura.valor || '0'));
      }, 0);

      // Calcular comissão total (40% da receita)
      const totalComissao = receitaTotalAssinatura * 0.4;

      // Buscar total de minutos trabalhados de agendamentos finalizados
      const agendamentosFinalizados = await db.select({
        tempoMinutos: schema.servicos.tempoMinutos
      })
      .from(schema.agendamentos)
      .innerJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
      .where(eq(schema.agendamentos.status, 'FINALIZADO'));

      const totalMinutosGerais = agendamentosFinalizados.reduce((total, agendamento) => {
        return total + (agendamento.tempoMinutos || 0);
      }, 0);

      res.json({
        faturamentoTotalAssinatura: receitaTotalAssinatura,
        totalComissao: totalComissao,
        totalMinutosGerais: totalMinutosGerais
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas de comissão:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // GET - Dados de comissão por barbeiro baseado em tempo trabalhado
  app.get('/api/comissao/barbeiros', async (req: Request, res: Response) => {
    try {
      // Buscar barbeiros ativos
      const barbeiros = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.tipo, 'barbeiro'),
          eq(schema.profissionais.ativo, true)
        ));

      // Buscar receita total de assinaturas pagas
      const assinaturasPagas = await db.select({
        valor: schema.clientes.planoValor
      })
      .from(schema.clientes)
      .where(eq(schema.clientes.statusAssinatura, 'ATIVO'));

      const receitaTotalAssinatura = assinaturasPagas.reduce((total, assinatura) => {
        return total + (parseFloat(assinatura.valor || '0'));
      }, 0);

      // Calcular comissão total (40% da receita)
      const comissaoTotal = receitaTotalAssinatura * 0.4;

      // Buscar agendamentos finalizados com tempo de serviço por barbeiro
      const agendamentosFinalizados = await db.select({
        barbeiroId: schema.agendamentos.barbeiroId,
        tempoMinutos: schema.servicos.tempoMinutos
      })
      .from(schema.agendamentos)
      .innerJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
      .where(eq(schema.agendamentos.status, 'FINALIZADO'));

      // Calcular tempo trabalhado por barbeiro
      const tempoTrabalhadoPorBarbeiro = new Map<number, number>();
      let totalMinutosTrabalhados = 0;

      agendamentosFinalizados.forEach(agendamento => {
        const minutos = agendamento.tempoMinutos || 0;
        const barbeiroId = agendamento.barbeiroId;
        
        tempoTrabalhadoPorBarbeiro.set(
          barbeiroId, 
          (tempoTrabalhadoPorBarbeiro.get(barbeiroId) || 0) + minutos
        );
        totalMinutosTrabalhados += minutos;
      });

      // Calcular número de serviços por barbeiro
      const servicosPorBarbeiro = new Map<number, number>();
      agendamentosFinalizados.forEach(agendamento => {
        const barbeiroId = agendamento.barbeiroId;
        servicosPorBarbeiro.set(
          barbeiroId,
          (servicosPorBarbeiro.get(barbeiroId) || 0) + 1
        );
      });

      // Gerar resultado com distribuição proporcional
      const resultado = barbeiros.map(barbeiro => {
        const minutosTrabalhadosBarbeiro = tempoTrabalhadoPorBarbeiro.get(barbeiro.id) || 0;
        const numeroServicos = servicosPorBarbeiro.get(barbeiro.id) || 0;
        
        // Calcular percentual de trabalho
        const percentualTempo = totalMinutosTrabalhados > 0 
          ? (minutosTrabalhadosBarbeiro / totalMinutosTrabalhados) * 100 
          : 0;

        // Distribuir comissão e faturamento proporcionalmente
        const comissaoAssinatura = (percentualTempo / 100) * comissaoTotal;
        const faturamentoAssinatura = (percentualTempo / 100) * receitaTotalAssinatura;

        // Formatar horas trabalhadas
        const horas = Math.floor(minutosTrabalhadosBarbeiro / 60);
        const minutosRestantes = minutosTrabalhadosBarbeiro % 60;
        const horasTrabalhadasMes = horas > 0 
          ? `${horas}h ${minutosRestantes}min` 
          : `${minutosRestantes}min`;

        return {
          barbeiro: {
            id: barbeiro.id,
            nome: barbeiro.nome,
            ativo: barbeiro.ativo
          },
          faturamentoAssinatura: faturamentoAssinatura,
          comissaoAssinatura: comissaoAssinatura,
          minutosTrabalhadosMes: minutosTrabalhadosBarbeiro,
          horasTrabalhadasMes: horasTrabalhadasMes,
          numeroServicos: numeroServicos,
          percentualTempo: percentualTempo
        };
      });

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao buscar dados de comissão por barbeiro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // =====================================================
  // ENDPOINTS DA LISTA DA VEZ
  // =====================================================

  // GET - Buscar fila mensal de atendimentos por barbeiro
  app.get('/api/lista-da-vez/fila-mensal', async (req: Request, res: Response) => {
    try {
      const { mes } = req.query;
      
      if (!mes) {
        return res.status(400).json({ message: 'Parâmetro mes é obrigatório' });
      }

      // Buscar todos os barbeiros ativos
      const barbeiros = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.tipo, 'barbeiro'),
          eq(schema.profissionais.ativo, true)
        ));

      // Buscar atendimentos da lista-da-vez do mês para cada barbeiro
      const resultado = await Promise.all(barbeiros.map(async (barbeiro) => {
        // Contar atendimentos da lista-da-vez do mês
        const atendimentosListaVez = await db.select()
          .from(schema.listaVezAtendimentos)
          .where(and(
            eq(schema.listaVezAtendimentos.barbeiroId, barbeiro.id),
            eq(schema.listaVezAtendimentos.mesAno, mes),
            eq(schema.listaVezAtendimentos.tipoAcao, 'ATENDIMENTO')
          ));

        // Contar quantas vezes passou a vez no mês
        const passouVez = await db.select()
          .from(schema.listaVezAtendimentos)
          .where(and(
            eq(schema.listaVezAtendimentos.barbeiroId, barbeiro.id),
            eq(schema.listaVezAtendimentos.mesAno, mes),
            eq(schema.listaVezAtendimentos.tipoAcao, 'PASSOU_VEZ')
          ));

        return {
          barbeiro: {
            id: barbeiro.id,
            nome: barbeiro.nome,
            email: barbeiro.email,
            ativo: barbeiro.ativo
          },
          totalAtendimentosMes: atendimentosListaVez.length,
          diasPassouAVez: passouVez.length
        };
      }));

      res.json(resultado);

    } catch (error) {
      console.error('Erro ao buscar fila mensal:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // POST - Adicionar atendimento automático (próximo da fila)
  app.post('/api/lista-da-vez/adicionar-atendimento', async (req: Request, res: Response) => {
    try {
      const { data, mesAno, tipoAtendimento } = req.body;

      if (!data || !mesAno) {
        return res.status(400).json({ message: 'Data e mesAno são obrigatórios' });
      }

      // Buscar o barbeiro com menos atendimentos no mês
      const barbeiros = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.tipo, 'barbeiro'),
          eq(schema.profissionais.ativo, true)
        ));

      if (barbeiros.length === 0) {
        return res.status(400).json({ message: 'Nenhum barbeiro ativo encontrado' });
      }

      // Contar atendimentos da lista-da-vez de cada barbeiro no mês
      const barbeirosComContagem = await Promise.all(barbeiros.map(async (barbeiro) => {
        const atendimentos = await db.select()
          .from(schema.listaVezAtendimentos)
          .where(and(
            eq(schema.listaVezAtendimentos.barbeiroId, barbeiro.id),
            eq(schema.listaVezAtendimentos.mesAno, mesAno),
            eq(schema.listaVezAtendimentos.tipoAcao, 'ATENDIMENTO')
          ));

        return {
          ...barbeiro,
          totalAtendimentos: atendimentos.length
        };
      }));

      // Encontrar barbeiro com menos atendimentos na lista-da-vez
      const proximoBarbeiro = barbeirosComContagem.reduce((menor, atual) => 
        atual.totalAtendimentos < menor.totalAtendimentos ? atual : menor
      );

      // Registrar atendimento na lista-da-vez (sistema isolado)
      const novoRegistro = await db.insert(schema.listaVezAtendimentos)
        .values({
          barbeiroId: proximoBarbeiro.id,
          data: data,
          mesAno: mesAno,
          tipoAcao: 'ATENDIMENTO'
        })
        .returning();

      res.json({
        success: true,
        proximoBarbeiro: {
          id: proximoBarbeiro.id,
          nome: proximoBarbeiro.nome
        },
        registro: novoRegistro[0],
        message: 'Atendimento registrado na lista-da-vez com sucesso'
      });

    } catch (error) {
      console.error('Erro ao adicionar atendimento:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // POST - Adicionar atendimento manual para barbeiro específico
  app.post('/api/lista-da-vez/adicionar-atendimento-manual', async (req: Request, res: Response) => {
    try {
      const { barbeiroId, data, mesAno, tipoAtendimento } = req.body;

      if (!barbeiroId || !data || !mesAno) {
        return res.status(400).json({ message: 'BarbeiroId, data e mesAno são obrigatórios' });
      }

      // Verificar se o barbeiro existe
      const barbeiro = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.id, parseInt(barbeiroId)),
          eq(schema.profissionais.tipo, 'barbeiro'),
          eq(schema.profissionais.ativo, true)
        ))
        .limit(1);

      if (barbeiro.length === 0) {
        return res.status(400).json({ message: 'Barbeiro não encontrado ou inativo' });
      }

      // Registrar atendimento manual na lista-da-vez (sistema isolado)
      const novoRegistro = await db.insert(schema.listaVezAtendimentos)
        .values({
          barbeiroId: parseInt(barbeiroId),
          data: data,
          mesAno: mesAno,
          tipoAcao: 'ATENDIMENTO'
        })
        .returning();

      res.json({
        success: true,
        barbeiro: {
          id: barbeiro[0].id,
          nome: barbeiro[0].nome
        },
        registro: novoRegistro[0],
        message: 'Atendimento manual registrado na lista-da-vez com sucesso'
      });

    } catch (error) {
      console.error('Erro ao adicionar atendimento manual:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // POST - Passar a vez (incrementa contador de atendimentos)
  app.post('/api/lista-da-vez/passar-a-vez', async (req: Request, res: Response) => {
    try {
      const { barbeiroId, data, mesAno } = req.body;

      if (!barbeiroId || !data || !mesAno) {
        return res.status(400).json({ message: 'BarbeiroId, data e mesAno são obrigatórios' });
      }

      // Verificar se o barbeiro existe
      const barbeiro = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.id, parseInt(barbeiroId)),
          eq(schema.profissionais.tipo, 'barbeiro'),
          eq(schema.profissionais.ativo, true)
        ))
        .limit(1);

      if (barbeiro.length === 0) {
        return res.status(400).json({ message: 'Barbeiro não encontrado ou inativo' });
      }

      // Registrar "passou a vez" na lista-da-vez (sistema isolado)
      const novoRegistro = await db.insert(schema.listaVezAtendimentos)
        .values({
          barbeiroId: parseInt(barbeiroId),
          data: data,
          mesAno: mesAno,
          tipoAcao: 'PASSOU_VEZ'
        })
        .returning();

      res.json({
        success: true,
        barbeiro: {
          id: barbeiro[0].id,
          nome: barbeiro[0].nome
        },
        registro: novoRegistro[0],
        message: 'Vez passada registrada na lista-da-vez com sucesso'
      });

    } catch (error) {
      console.error('Erro ao passar a vez:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoints para o painel reformulado do barbeiro

  // GET - Estatísticas do mês para o barbeiro
  app.get('/api/barbeiro/estatisticas-mes', async (req: any, res: Response) => {
    try {
      // Verificar autenticação
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // Buscar o profissional correspondente ao usuário logado
      let profissionalId: number;
      
      if (req.user.role === 'admin' && req.query.barbeiroId) {
        profissionalId = parseInt(req.query.barbeiroId as string);
      } else {
        // Buscar profissional pelo email do usuário logado
        const profissional = await db.select()
          .from(schema.profissionais)
          .where(and(
            eq(schema.profissionais.email, req.user.email),
            eq(schema.profissionais.tipo, 'barbeiro')
          ))
          .limit(1);

        if (profissional.length === 0) {
          return res.status(404).json({ message: 'Profissional barbeiro não encontrado' });
        }

        profissionalId = profissional[0].id;
      }

      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

      // Buscar agendamentos finalizados do barbeiro no mês
      const agendamentosFinalizados = await db.select()
        .from(schema.agendamentos)
        .leftJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
        .where(and(
          eq(schema.agendamentos.barbeiroId, profissionalId),
          eq(schema.agendamentos.status, 'FINALIZADO'),
          gte(schema.agendamentos.dataHora, inicioMes),
          lte(schema.agendamentos.dataHora, fimMes)
        ));

      // Calcular estatísticas
      const servicosFinalizados = agendamentosFinalizados.length;
      const tempoTrabalhadoMinutos = agendamentosFinalizados.reduce((total, ag) => {
        return total + (ag.servicos?.tempoMinutos || 30);
      }, 0);

      // Agrupar por tipo de serviço
      const servicosPorTipo = agendamentosFinalizados.reduce((acc: any[], ag) => {
        const nomeServico = ag.servicos?.nome || 'Serviço Padrão';
        const tempoServico = ag.servicos?.tempoMinutos || 30;
        
        const existente = acc.find(s => s.nome === nomeServico);
        if (existente) {
          existente.quantidade += 1;
          existente.tempoTotal += tempoServico;
        } else {
          acc.push({
            nome: nomeServico,
            quantidade: 1,
            tempoTotal: tempoServico
          });
        }
        return acc;
      }, []);

      // Calcular métricas adicionais
      const diasUteis = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const tempoMedioPorServico = servicosFinalizados > 0 ? Math.round(tempoTrabalhadoMinutos / servicosFinalizados) : 0;
      const mediaAtendimentosPorDia = servicosFinalizados > 0 ? (servicosFinalizados / diasUteis).toFixed(1) : '0';

      res.json({
        servicosFinalizados,
        tempoTrabalhadoMinutos,
        servicosPorTipo,
        tempoMedioPorServico,
        mediaAtendimentosPorDia: parseFloat(mediaAtendimentosPorDia),
        produtividade: Math.min(Math.round((servicosFinalizados / (diasUteis * 8)) * 100), 100), // Máximo 8 atendimentos por dia
        crescimentoMensal: 0 // Seria necessário comparar com mês anterior
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas do barbeiro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // GET - Agenda do barbeiro para um dia específico
  app.get('/api/barbeiro/agenda', async (req: any, res: Response) => {
    try {
      // Verificar autenticação
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // Buscar o profissional correspondente ao usuário logado
      let profissionalId: number;
      
      if (req.user.role === 'admin' && req.query.barbeiroId) {
        profissionalId = parseInt(req.query.barbeiroId as string);
      } else {
        // Buscar profissional pelo email do usuário logado
        const profissional = await db.select()
          .from(schema.profissionais)
          .where(and(
            eq(schema.profissionais.email, req.user.email),
            eq(schema.profissionais.tipo, 'barbeiro')
          ))
          .limit(1);

        if (profissional.length === 0) {
          return res.status(404).json({ message: 'Profissional barbeiro não encontrado' });
        }

        profissionalId = profissional[0].id;
      }

      const { data } = req.query;
      if (!data) {
        return res.status(400).json({ message: 'Data é obrigatória' });
      }

      const dataInicio = new Date(data as string + 'T00:00:00');
      const dataFim = new Date(data as string + 'T23:59:59');

      const agendamentos = await db.select({
        id: schema.agendamentos.id,
        dataHora: schema.agendamentos.dataHora,
        status: schema.agendamentos.status,
        observacoes: schema.agendamentos.observacoes,
        cliente: {
          id: schema.clientes.id,
          nome: schema.clientes.nome
        },
        servico: {
          id: schema.servicos.id,
          nome: schema.servicos.nome,
          tempoMinutos: schema.servicos.tempoMinutos
        }
      })
      .from(schema.agendamentos)
      .leftJoin(schema.clientes, eq(schema.agendamentos.clienteId, schema.clientes.id))
      .leftJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
      .where(and(
        eq(schema.agendamentos.barbeiroId, profissionalId),
        gte(schema.agendamentos.dataHora, dataInicio),
        lte(schema.agendamentos.dataHora, dataFim)
      ))
      .orderBy(schema.agendamentos.dataHora);

      res.json({ agendamentos });

    } catch (error) {
      console.error('Erro ao buscar agenda do barbeiro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // GET - Dados da lista da vez do barbeiro
  app.get('/api/barbeiro/lista-da-vez', async (req: any, res: Response) => {
    try {
      // Verificar autenticação
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // Buscar o profissional correspondente ao usuário logado
      let profissionalId: number;
      
      if (req.user.role === 'admin' && req.query.barbeiroId) {
        profissionalId = parseInt(req.query.barbeiroId as string);
      } else {
        // Buscar profissional pelo email do usuário logado
        const profissional = await db.select()
          .from(schema.profissionais)
          .where(and(
            eq(schema.profissionais.email, req.user.email),
            eq(schema.profissionais.tipo, 'barbeiro')
          ))
          .limit(1);

        if (profissional.length === 0) {
          return res.status(404).json({ message: 'Profissional barbeiro não encontrado' });
        }

        profissionalId = profissional[0].id;
      }

      const hoje = new Date();
      const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

      // Buscar registros da lista da vez do barbeiro no mês atual
      const registros = await db.select()
        .from(schema.listaVezAtendimentos)
        .where(and(
          eq(schema.listaVezAtendimentos.barbeiroId, profissionalId),
          eq(schema.listaVezAtendimentos.mesAno, mesAno)
        ));

      const atendimentos = registros.filter(r => r.tipoAcao === 'ATENDIMENTO').length;
      const passouVez = registros.filter(r => r.tipoAcao === 'PASSOU_VEZ').length;

      // Calcular posição atual (simplificado)
      const posicaoAtual = Math.max(1, atendimentos - passouVez);

      res.json({
        posicaoAtual,
        atendimentos,
        passouVez
      });

    } catch (error) {
      console.error('Erro ao buscar dados da lista da vez:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // GET - Comissão do mês do barbeiro
  app.get('/api/barbeiro/comissao-mes', async (req: any, res: Response) => {
    try {
      // Verificar autenticação
      if (!req.user) {
        return res.status(401).json({ message: 'Não autenticado' });
      }

      // Buscar o profissional correspondente ao usuário logado
      let profissionalId: number;
      
      if (req.user.role === 'admin' && req.query.barbeiroId) {
        profissionalId = parseInt(req.query.barbeiroId as string);
      } else {
        // Buscar profissional pelo email do usuário logado
        const profissional = await db.select()
          .from(schema.profissionais)
          .where(and(
            eq(schema.profissionais.email, req.user.email),
            eq(schema.profissionais.tipo, 'barbeiro')
          ))
          .limit(1);

        if (profissional.length === 0) {
          return res.status(404).json({ message: 'Profissional barbeiro não encontrado' });
        }

        profissionalId = profissional[0].id;
      }

      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

      // Buscar agendamentos finalizados do barbeiro no mês
      const agendamentosFinalizados = await db.select()
        .from(schema.agendamentos)
        .leftJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
        .where(and(
          eq(schema.agendamentos.barbeiroId, profissionalId),
          eq(schema.agendamentos.status, 'FINALIZADO'),
          gte(schema.agendamentos.dataHora, inicioMes),
          lte(schema.agendamentos.dataHora, fimMes)
        ));

      // Calcular tempo trabalhado em minutos
      const tempoTrabalhadoMinutos = agendamentosFinalizados.reduce((total, ag) => {
        return total + (ag.servicos?.tempoMinutos || 30);
      }, 0);

      // Buscar faturamento total de assinaturas no mês para calcular comissão
      const clientesAtivos = await db.select()
        .from(schema.clientes)
        .where(eq(schema.clientes.statusAssinatura, 'ATIVO'));

      const faturamentoTotalAssinatura = clientesAtivos.reduce((total, cliente) => {
        return total + (parseFloat(cliente.planoValor) || 0);
      }, 0);

      // Buscar total de minutos trabalhados por todos os barbeiros
      const todosBarbeiros = await db.select()
        .from(schema.profissionais)
        .where(and(
          eq(schema.profissionais.tipo, 'barbeiro'),
          eq(schema.profissionais.ativo, true)
        ));

      let totalMinutosGerais = 0;
      for (const barbeiro of todosBarbeiros) {
        const agendamentosBarbeiro = await db.select()
          .from(schema.agendamentos)
          .leftJoin(schema.servicos, eq(schema.agendamentos.servicoId, schema.servicos.id))
          .where(and(
            eq(schema.agendamentos.barbeiroId, barbeiro.id),
            eq(schema.agendamentos.status, 'FINALIZADO'),
            gte(schema.agendamentos.dataHora, inicioMes),
            lte(schema.agendamentos.dataHora, fimMes)
          ));

        const minutosBareiro = agendamentosBarbeiro.reduce((total, ag) => {
          return total + (ag.servicos?.tempoMinutos || 30);
        }, 0);

        totalMinutosGerais += minutosBareiro;
      }

      // Calcular comissão proporcional
      const porcentagemComissao = 0.40; // 40%
      const proporcaoTempo = totalMinutosGerais > 0 ? tempoTrabalhadoMinutos / totalMinutosGerais : 0;
      const valorComissao = faturamentoTotalAssinatura * porcentagemComissao * proporcaoTempo;

      res.json({
        valorComissao: Math.max(0, valorComissao),
        faturamentoTotalAssinatura,
        tempoTrabalhadoMinutos,
        totalMinutosGerais,
        proporcaoTempo: (proporcaoTempo * 100).toFixed(2)
      });

    } catch (error) {
      console.error('Erro ao calcular comissão do barbeiro:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  return app;
}