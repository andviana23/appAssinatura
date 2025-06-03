import { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function registerRoutes(app: Express): Promise<Express> {
  
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

      // Combinar todos os clientes das duas contas
      const todosClientes = [...clientesAtivos, ...clientesAtrasados];
      
      console.log(`🔍 Analisando ${todosClientes.length} clientes para verificar status baseado em cobranças...`);
      
      // Processar cada cliente para verificar status baseado em cobranças
      for (const cliente of todosClientes) {
        try {
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

      // Buscar pagamentos da conta ASAAS_TRATO
      try {
        const responseTrato = await fetch(`https://www.asaas.com/api/v3/payments?status=RECEIVED,CONFIRMED&receivedInCashDate[ge]=${mesAtual}-01&receivedInCashDate[le]=${mesAtual}-31&limit=100`, {
          headers: {
            'access_token': asaasTrato,
            'Content-Type': 'application/json'
          }
        });

        if (responseTrato.ok) {
          const dataTrato = await responseTrato.json();
          for (const pagamento of dataTrato.data || []) {
            const cliente = await fetch(`https://www.asaas.com/api/v3/customers/${pagamento.customer}`, {
              headers: {
                'access_token': asaasTrato,
                'Content-Type': 'application/json'
              }
            });
            
            if (cliente.ok) {
              const dadosCliente = await cliente.json();
              clientesPagantes.push({
                id: dadosCliente.id,
                nome: dadosCliente.name,
                email: dadosCliente.email,
                telefone: dadosCliente.mobilePhone,
                valorPago: pagamento.value,
                dataPagamento: pagamento.paymentDate || pagamento.clientPaymentDate,
                descricao: pagamento.description,
                conta: 'ASAAS_TRATO'
              });
              valorTotalPago += pagamento.value;
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar pagamentos ASAAS_TRATO:', error);
      }

      // Buscar pagamentos da conta ASAAS_AND
      try {
        const responseAndrey = await fetch(`https://www.asaas.com/api/v3/payments?status=RECEIVED,CONFIRMED&receivedInCashDate[ge]=${mesAtual}-01&receivedInCashDate[le]=${mesAtual}-31&limit=100`, {
          headers: {
            'access_token': asaasAndrey,
            'Content-Type': 'application/json'
          }
        });

        if (responseAndrey.ok) {
          const dataAndrey = await responseAndrey.json();
          for (const pagamento of dataAndrey.data || []) {
            const cliente = await fetch(`https://www.asaas.com/api/v3/customers/${pagamento.customer}`, {
              headers: {
                'access_token': asaasAndrey,
                'Content-Type': 'application/json'
              }
            });
            
            if (cliente.ok) {
              const dadosCliente = await cliente.json();
              clientesPagantes.push({
                id: dadosCliente.id,
                nome: dadosCliente.name,
                email: dadosCliente.email,
                telefone: dadosCliente.mobilePhone,
                valorPago: pagamento.value,
                dataPagamento: pagamento.paymentDate || pagamento.clientPaymentDate,
                descricao: pagamento.description,
                conta: 'ASAAS_AND'
              });
              valorTotalPago += pagamento.value;
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar pagamentos ASAAS_AND:', error);
      }

      // Remover duplicatas baseado no ID + conta
      const clientesUnicos = clientesPagantes.reduce((acc, cliente) => {
        const chave = `${cliente.id}-${cliente.conta}`;
        if (!acc.has(chave)) {
          acc.set(chave, cliente);
        }
        return acc;
      }, new Map());

      const clientesPagantesUnicos = Array.from(clientesUnicos.values());

      console.log(`✅ ${clientesPagantesUnicos.length} clientes pagantes encontrados no mês ${mesAtual}`);
      console.log(`💰 Valor total pago: R$ ${valorTotalPago.toFixed(2)}`);

      res.json({
        success: true,
        totalClientes: clientesPagantesUnicos.length,
        valorTotal: valorTotalPago,
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
  // AUTENTICAÇÃO BÁSICA
  // =====================================================

  // Login simplificado
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    
    res.json({
      success: true,
      user: {
        id: 1,
        email: email,
        name: "Admin Trato"
      }
    });
  });

  // Logout simplificado
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  });

  // Dados do usuário
  app.get('/api/auth/me', (req: Request, res: Response) => {
    res.json({
      id: 1,
      email: "admin@tratobarbados.com",
      name: "Admin Trato"
    });
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

  return app;
}