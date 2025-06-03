import { ClientesMasterService } from "./clientes-master";
import { db } from "../db";
import { origensDados, statusClienteNovo, syncLog } from "../../shared/schema";
import { eq } from "drizzle-orm";

interface AsaasCustomer {
  object: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  country?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
  groupName?: string;
  company?: string;
}

interface AsaasSubscription {
  object: string;
  id: string;
  customer: string;
  billingType: string;
  cycle: string;
  value: number;
  nextDueDate: string;
  description?: string;
  status: string;
  discount?: any;
  interest?: any;
  fine?: any;
  deleted: boolean;
}

interface AsaasApiResponse<T> {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

export class AsaasIntegrationService {
  private clientesMasterService: ClientesMasterService;

  constructor() {
    this.clientesMasterService = new ClientesMasterService();
  }

  // Sincronizar clientes da conta Principal
  async syncClientesPrincipal(): Promise<{ success: boolean; total: number; sincronizados: number; erros: number }> {
    const logId = await this.iniciarLogSync('ASAAS_PRINCIPAL', 'SYNC_CLIENTES');
    
    try {
      const apiKey = process.env.ASAAS_API_KEY;
      if (!apiKey) {
        throw new Error('ASAAS_API_KEY não configurada');
      }

      // Buscar assinaturas ativas da API Asaas Principal
      const subscriptions = await this.buscarAssinaturasAsaas(apiKey);
      let sincronizados = 0;
      let erros = 0;

      for (const subscription of subscriptions) {
        try {
          // Buscar dados do cliente
          const customer = await this.buscarClienteAsaas(apiKey, subscription.customer);
          
          if (customer) {
            await this.sincronizarClienteAsaas(customer, subscription, 'ASAAS_PRINCIPAL');
            sincronizados++;
          }
        } catch (error) {
          console.error(`Erro ao sincronizar cliente ${subscription.customer}:`, error);
          erros++;
        }
      }

      await this.finalizarLogSync(logId, 'SUCESSO', subscriptions.length, erros);
      
      return {
        success: true,
        total: subscriptions.length,
        sincronizados,
        erros
      };

    } catch (error) {
      await this.finalizarLogSync(logId, 'ERRO', 0, 1, String(error));
      throw error;
    }
  }

  // Sincronizar clientes da conta Andrey
  async syncClientesAndrey(): Promise<{ success: boolean; total: number; sincronizados: number; erros: number }> {
    const logId = await this.iniciarLogSync('ASAAS_ANDREY', 'SYNC_CLIENTES');
    
    try {
      const apiKey = process.env.ASAAS_API_KEY_ANDREY;
      if (!apiKey) {
        throw new Error('ASAAS_API_KEY_ANDREY não configurada');
      }

      const subscriptions = await this.buscarAssinaturasAsaas(apiKey);
      let sincronizados = 0;
      let erros = 0;

      for (const subscription of subscriptions) {
        try {
          const customer = await this.buscarClienteAsaas(apiKey, subscription.customer);
          
          if (customer) {
            await this.sincronizarClienteAsaas(customer, subscription, 'ASAAS_ANDREY');
            sincronizados++;
          }
        } catch (error) {
          console.error(`Erro ao sincronizar cliente ${subscription.customer}:`, error);
          erros++;
        }
      }

      await this.finalizarLogSync(logId, 'SUCESSO', subscriptions.length, erros);
      
      return {
        success: true,
        total: subscriptions.length,
        sincronizados,
        erros
      };

    } catch (error) {
      await this.finalizarLogSync(logId, 'ERRO', 0, 1, String(error));
      throw error;
    }
  }

  // Buscar assinaturas ativas da API Asaas
  private async buscarAssinaturasAsaas(apiKey: string): Promise<AsaasSubscription[]> {
    const response = await fetch('https://www.asaas.com/api/v3/subscriptions?status=ACTIVE&limit=100', {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API Asaas: ${response.status} - ${response.statusText}`);
    }

    const data: AsaasApiResponse<AsaasSubscription> = await response.json();
    return data.data || [];
  }

  // Buscar dados completos do cliente
  private async buscarClienteAsaas(apiKey: string, customerId: string): Promise<AsaasCustomer | null> {
    try {
      const response = await fetch(`https://www.asaas.com/api/v3/customers/${customerId}`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Erro ao buscar cliente ${customerId}: ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Erro ao buscar cliente ${customerId}:`, error);
      return null;
    }
  }

  // Sincronizar cliente individual
  private async sincronizarClienteAsaas(
    customer: AsaasCustomer, 
    subscription: AsaasSubscription, 
    origem: 'ASAAS_PRINCIPAL' | 'ASAAS_ANDREY'
  ) {
    // Buscar IDs das referências
    const [origemData] = await db.select().from(origensDados).where(eq(origensDados.codigo, origem));
    const [statusAtivo] = await db.select().from(statusClienteNovo).where(eq(statusClienteNovo.codigo, 'ATIVO'));

    if (!origemData || !statusAtivo) {
      throw new Error('Dados de referência não encontrados');
    }

    // Verificar se cliente já existe
    const clienteExistente = await this.clientesMasterService.getClienteByAsaasId(
      customer.id, 
      origem === 'ASAAS_PRINCIPAL' ? 'principal' : 'andrey'
    );

    const dadosCliente = {
      // IDs do Asaas
      ...(origem === 'ASAAS_PRINCIPAL' ? { idAsaasPrincipal: customer.id } : { idAsaasAndrey: customer.id }),
      
      // Dados pessoais
      nomeCompleto: customer.name,
      email: customer.email,
      telefonePrincipal: customer.phone || customer.mobilePhone || null,
      numeroDocumento: customer.cpfCnpj || null,
      
      // Endereço
      cep: customer.postalCode || null,
      logradouro: customer.address || null,
      numero: customer.addressNumber || null,
      complemento: customer.complement || null,
      bairro: customer.province || null,
      cidade: customer.city || null,
      estado: customer.state || null,
      
      // Dados do plano
      valorPlanoAtual: String(subscription.value),
      valorPlanoOriginal: String(subscription.value),
      dataVencimentoPlano: new Date(subscription.nextDueDate),
      formaPagamentoPreferida: subscription.billingType,
      
      // Status e origem
      statusId: statusAtivo.id,
      origemDadosId: origemData.id,
      
      // Controle de sincronização
      ...(origem === 'ASAAS_PRINCIPAL' ? 
        { sincronizadoAsaasPrincipal: true } : 
        { sincronizadoAsaasAndrey: true }
      ),
      
      // Observações
      observacoes: customer.observations || null,
    };

    if (clienteExistente) {
      // Atualizar cliente existente
      await this.clientesMasterService.updateCliente(clienteExistente.id, dadosCliente);
    } else {
      // Criar novo cliente
      await this.clientesMasterService.createCliente(dadosCliente);
    }
  }

  // Obter estatísticas consolidadas
  async getEstatisticasConsolidadas() {
    try {
      // Estatísticas da nova estrutura
      const estatisticasModernas = await this.clientesMasterService.getEstatisticas();
      
      // Clientes criados hoje
      const clientesHoje = await this.clientesMasterService.getClientesHoje();
      
      // Estatísticas das APIs Asaas
      const [principalStats, andreyStats] = await Promise.all([
        this.getStatsAsaas(process.env.ASAAS_API_KEY, 'Principal'),
        this.getStatsAsaas(process.env.ASAAS_API_KEY_ANDREY, 'Andrey')
      ]);

      return {
        moderna: {
          totalClientes: estatisticasModernas.totalClientes || 0,
          clientesAtivos: estatisticasModernas.clientesAtivos || 0,
          receitaMensalAtiva: estatisticasModernas.receitaMensalAtiva || 0,
          clientesHoje: clientesHoje.length,
          receita: clientesHoje.reduce((sum, c) => sum + parseFloat(c.valorPlanoAtual || '0'), 0)
        },
        asaasPrincipal: principalStats,
        asaasAndrey: andreyStats,
        consolidado: {
          totalClientes: (principalStats.assinaturasAtivas || 0) + (andreyStats.assinaturasAtivas || 0),
          receitaTotal: (principalStats.receitaAtiva || 0) + (andreyStats.receitaAtiva || 0)
        }
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        moderna: { totalClientes: 0, clientesAtivos: 0, receitaMensalAtiva: 0, clientesHoje: 0, receita: 0 },
        asaasPrincipal: { assinaturasAtivas: 0, receitaAtiva: 0 },
        asaasAndrey: { assinaturasAtivas: 0, receitaAtiva: 0 },
        consolidado: { totalClientes: 0, receitaTotal: 0 }
      };
    }
  }

  // Obter estatísticas de uma conta Asaas
  private async getStatsAsaas(apiKey: string | undefined, nome: string) {
    if (!apiKey) {
      console.log(`${nome} API key não configurada`);
      return { assinaturasAtivas: 0, receitaAtiva: 0 };
    }

    try {
      const subscriptions = await this.buscarAssinaturasAsaas(apiKey);
      const receitaAtiva = subscriptions.reduce((sum, sub) => sum + sub.value, 0);
      
      return {
        assinaturasAtivas: subscriptions.length,
        receitaAtiva
      };
    } catch (error) {
      console.error(`Erro ao obter stats ${nome}:`, error);
      return { assinaturasAtivas: 0, receitaAtiva: 0 };
    }
  }

  // Log de sincronização
  private async iniciarLogSync(origem: string, operacao: string): Promise<number> {
    const [origemData] = await db.select().from(origensDados).where(eq(origensDados.codigo, origem));
    
    const result = await db.insert(syncLog).values({
      origemDadosId: origemData?.id || null,
      tipoOperacao: operacao,
      status: 'EXECUTANDO'
    }).returning();

    return result[0].id;
  }

  private async finalizarLogSync(
    logId: number, 
    status: 'SUCESSO' | 'ERRO', 
    processados: number, 
    erros: number, 
    detalhesErro?: string
  ) {
    await db.update(syncLog)
      .set({
        status,
        registrosProcessados: processados,
        registrosErro: erros,
        detalhesErro,
        finishedAt: new Date()
      })
      .where(eq(syncLog.id, logId));
  }
}