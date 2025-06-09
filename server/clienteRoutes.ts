import { Express, Request, Response } from 'express';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

function determinarStatusClientePorMes(cliente: any, mesFiltro: string): string {
  if (cliente.notificationDisabled || cliente.deleted) {
    return 'atrasado';
  }

  const dataCreated = new Date(cliente.dateCreated);
  const agora = new Date();
  const diasCriacao = Math.floor((agora.getTime() - dataCreated.getTime()) / (1000 * 3600 * 24));

  if (diasCriacao > 90 && cliente.notificationDisabled) {
    return 'atrasado';
  }

  return 'ativo';
}

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
      return 'ativo';
    }

    const data = await response.json();
    const cobrancas = data.data || [];

    if (cobrancas.length === 0) {
      return 'ativo';
    }

    cobrancas.sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const cobrancasPagas = cobrancas.filter((c: any) => c.status === 'RECEIVED' || c.status === 'CONFIRMED');
    const ultimaCobrancaPaga = cobrancasPagas.sort((a: any, b: any) =>
      new Date(b.paymentDate || b.clientPaymentDate || b.dueDate).getTime() -
      new Date(a.paymentDate || a.clientPaymentDate || a.dueDate).getTime()
    )[0];

    if (ultimaCobrancaPaga) {
      const dataPagamento = new Date(ultimaCobrancaPaga.paymentDate || ultimaCobrancaPaga.clientPaymentDate || ultimaCobrancaPaga.dueDate);
      const proximaCobranca = cobrancas.find((c: any) =>
        (c.status !== 'RECEIVED' && c.status !== 'CONFIRMED') && new Date(c.dueDate) > dataPagamento
      );

      let dataVencimentoAssinatura: Date;

      if (proximaCobranca) {
        dataVencimentoAssinatura = new Date(proximaCobranca.dueDate);
      } else {
        dataVencimentoAssinatura = new Date(dataPagamento);
        dataVencimentoAssinatura.setDate(dataVencimentoAssinatura.getDate() + 30);
      }

      if (hoje <= dataVencimentoAssinatura) {
        return 'ativo';
      }
    }

    const cobrancasPendentes = cobrancas.filter((c: any) => c.status !== 'RECEIVED' && c.status !== 'CONFIRMED');
    const cobrancasVencidasNaoPagas = cobrancasPendentes.filter((cobranca: any) => {
      const dataVencimento = new Date(cobranca.dueDate);
      dataVencimento.setHours(23, 59, 59, 999);
      return dataVencimento < hoje;
    });

    if (cobrancasVencidasNaoPagas.length > 0) {
      return 'inadimplente';
    }

    const cobrancasPendentesNoPrazo = cobrancasPendentes.filter((cobranca: any) => {
      const dataVencimento = new Date(cobranca.dueDate);
      dataVencimento.setHours(23, 59, 59, 999);
      return dataVencimento >= hoje;
    });

    if (cobrancasPendentesNoPrazo.length > 0) {
      return 'ativo';
    }

    return 'ativo';
  } catch (error) {
    console.error(`Erro ao verificar status do cliente ${cliente.id}:`, error);
    return 'ativo';
  }
}

export function registerClienteRoutes(app: Express) {
  // Rota unificada por status
  app.get('/api/clientes/unificados-status', async (req: Request, res: Response) => {
    try {
      const mesFiltro = req.query.mes as string || new Date().toISOString().slice(0, 7);
      const asaasTrato = process.env.ASAAS_TRATO;
      const asaasAndrey = process.env.ASAAS_AND;

      const clientesAtivos: any[] = [];
      const clientesAtrasados: any[] = [];

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
                clientesAtivos.push({ ...clienteFormatado, status: 'ativo' });
              } else {
                clientesAtrasados.push({ ...clienteFormatado, status: 'atrasado' });
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar clientes ASAAS_TRATO:', error);
        }
      }

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
                clientesAtivos.push({ ...clienteFormatado, status: 'ativo' });
              } else {
                clientesAtrasados.push({ ...clienteFormatado, status: 'atrasado' });
              }
            });
          }
        } catch (error) {
          console.error('Erro ao buscar clientes ASAAS_AND:', error);
        }
      }

      const ativos: any[] = [];
      const inadimplentes: any[] = [];
      const aguardandoPagamento: any[] = [];

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
      } catch (error) {
        console.error('Erro ao buscar clientes externos:', error);
      }

      const todosClientesTemp = [...clientesAtivos, ...clientesAtrasados, ...clientesExternos];
      const clientesUnicosMap = new Map();
      todosClientesTemp.forEach(cliente => {
        const chave = cliente.email || cliente.nome;
        if (!clientesUnicosMap.has(chave)) {
          clientesUnicosMap.set(chave, cliente);
        } else {
          const clienteExistente = clientesUnicosMap.get(chave);
          if (cliente.valor > clienteExistente.valor) {
            clientesUnicosMap.set(chave, cliente);
          }
        }
      });

      const todosClientes = Array.from(clientesUnicosMap.values());

      for (const cliente of todosClientes) {
        try {
          if (cliente.conta === 'PAGAMENTO_EXTERNO') {
            ativos.push({ ...cliente, status: 'ativo', origem: 'Pagamento Externo' });
            continue;
          }

          const apiKey = cliente.conta === 'ASAAS_TRATO' ? asaasTrato : asaasAndrey;
          if (apiKey) {
            const status = await verificarStatusCliente(cliente, apiKey);

            if (status === 'inadimplente') {
              inadimplentes.push({ ...cliente, status: 'inadimplente' });
            } else {
              ativos.push({ ...cliente, status: 'ativo' });
            }
          } else {
            ativos.push({ ...cliente, status: 'ativo' });
          }
        } catch (error) {
          console.error(`Erro ao processar cliente ${cliente.id}:`, error);
          ativos.push({ ...cliente, status: 'ativo' });
        }
      }

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
          total: aguardandoPagamento.length,
          clientes: aguardandoPagamento
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

  // Cadastro manual de cliente
  app.post('/api/clientes/cadastro-manual', async (req: Request, res: Response) => {
    try {
      const { nome, telefone, email } = req.body;

      if (!nome || !telefone || !email) {
        return res.status(400).json({
          success: false,
          message: 'Nome, telefone e email são obrigatórios'
        });
      }

      const clienteExistente = await db.select()
        .from(schema.clientes)
        .where(sql`${schema.clientes.email} = ${email} OR ${schema.clientes.telefone} = ${telefone}`)
        .limit(1);

      let clienteId: number;
      let isUpdate = false;

      if (clienteExistente.length > 0) {
        const cliente = clienteExistente[0];

        await db.update(schema.clientes)
          .set({
            nome,
            telefone,
            email
          })
          .where(eq(schema.clientes.id, cliente.id));

        clienteId = cliente.id;
        isUpdate = true;
      } else {
        const novoCliente = await db.insert(schema.clientes)
          .values({
            nome,
            telefone,
            email,
            origem: 'EXTERNO',
            planoNome: 'Cadastro Manual',
            planoValor: '0.00',
            formaPagamento: 'PENDENTE',
            statusAssinatura: 'INATIVO',
            dataInicioAssinatura: new Date(),
            dataVencimentoAssinatura: new Date()
          })
          .returning({ id: schema.clientes.id });

        clienteId = novoCliente[0].id;
      }

      res.json({
        success: true,
        clienteId,
        isUpdate,
        message: isUpdate ? 'Dados do cliente atualizados com sucesso' : 'Cliente cadastrado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // Importação em lote
  app.post('/api/clientes/importar-lote', async (req: Request, res: Response) => {
    try {
      const { clientes } = req.body;

      if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Lista de clientes é obrigatória'
        });
      }

      let novos = 0;
      let atualizados = 0;
      const erros: { linha: number; motivo: string }[] = [];

      for (let index = 0; index < clientes.length; index++) {
        const cliente = clientes[index];
        const linha = index + 2;

        try {
          const { nome, telefone, email } = cliente;

          if (!nome || nome.trim().length < 2) {
            erros.push({ linha, motivo: 'Nome deve ter pelo menos 2 caracteres' });
            continue;
          }

          if (!telefone || telefone.trim().length < 10) {
            erros.push({ linha, motivo: 'Telefone deve ter pelo menos 10 dígitos' });
            continue;
          }

          let emailValidado = null as string | null;
          if (email && email.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
              erros.push({ linha, motivo: 'Email inválido' });
              continue;
            }
            emailValidado = email.trim();
          }

          let whereCondition;
          if (emailValidado) {
            whereCondition = sql`${schema.clientes.email} = ${emailValidado} OR ${schema.clientes.telefone} = ${telefone.trim()}`;
          } else {
            whereCondition = sql`${schema.clientes.telefone} = ${telefone.trim()}`;
          }

          const clienteExistente = await db.select()
            .from(schema.clientes)
            .where(whereCondition)
            .limit(1);

          if (clienteExistente.length > 0) {
            const clienteAtual = clienteExistente[0];

            const updateData: any = {
              nome: nome.trim(),
              telefone: telefone.trim()
            };

            if (emailValidado) {
              updateData.email = emailValidado;
            }

            await db.update(schema.clientes)
              .set(updateData)
              .where(eq(schema.clientes.id, clienteAtual.id));

            atualizados++;
          } else {
            const insertData: any = {
              nome: nome.trim(),
              telefone: telefone.trim(),
              email: emailValidado || 'sem-email@exemplo.com',
              origem: 'EXTERNO',
              planoNome: 'Importação Excel',
              planoValor: '0.00',
              formaPagamento: 'PENDENTE',
              statusAssinatura: 'INATIVO',
              dataInicioAssinatura: new Date(),
              dataVencimentoAssinatura: new Date()
            };

            await db.insert(schema.clientes).values(insertData);

            novos++;
          }
        } catch (error) {
          erros.push({
            linha,
            motivo: `Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          });
        }
      }

      res.json({
        success: true,
        novos,
        atualizados,
        erros,
        message: `Importação concluída: ${novos} novos clientes, ${atualizados} atualizados`
      });
    } catch (error) {
      console.error('Erro na importação em lote:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor na importação',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
}
