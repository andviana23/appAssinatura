import { storage } from "./storage";

export async function limparDadosAntigos() {
  try {
    console.log("🧹 Iniciando limpeza de dados antigos...");
    
    // 1. Buscar todos os clientes
    const todosClientes = await storage.getAllClientes();
    console.log(`📊 Total de clientes encontrados: ${todosClientes.length}`);
    
    // 2. Filtrar clientes com data de criação de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const clientesHoje = todosClientes.filter(cliente => {
      const dataCliente = new Date(cliente.createdAt);
      dataCliente.setHours(0, 0, 0, 0);
      return dataCliente.getTime() === hoje.getTime();
    });
    
    console.log(`📅 Clientes criados hoje: ${clientesHoje.length}`);
    
    // 3. Mostrar clientes que serão mantidos
    clientesHoje.forEach(cliente => {
      console.log(`✅ Mantendo: ${cliente.nome} (${cliente.origem}) - R$ ${cliente.planoValor}`);
    });
    
    // 4. Clientes antigos que serão inativados
    const clientesAntigos = todosClientes.filter(cliente => {
      const dataCliente = new Date(cliente.createdAt);
      dataCliente.setHours(0, 0, 0, 0);
      return dataCliente.getTime() !== hoje.getTime() && cliente.statusAssinatura === 'ATIVO';
    });
    
    console.log(`🗑️ Clientes antigos para inativar: ${clientesAntigos.length}`);
    
    // 5. Inativar clientes antigos
    for (const cliente of clientesAntigos) {
      console.log(`❌ Inativando: ${cliente.nome} (criado em ${cliente.createdAt})`);
      await storage.updateCliente(cliente.id, { statusAssinatura: 'INATIVO' });
    }
    
    console.log("✅ Limpeza concluída!");
    
    return {
      totalClientes: todosClientes.length,
      clientesHoje: clientesHoje.length,
      clientesInativados: clientesAntigos.length
    };
    
  } catch (error) {
    console.error("❌ Erro na limpeza:", error);
    throw error;
  }
}