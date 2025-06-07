import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Search, 
  RefreshCw, 
  UserPlus,
  Phone,
  User
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { LoadingClientsState, GenericErrorState } from "@/components/error-illustrations";

interface Cliente {
  id: string;
  nomeCompleto: string;
  telefone?: string;
  email?: string;
}

interface ApiResponse {
  success: boolean;
  total: number;
  clientes: Cliente[];
}

export default function ClientesSimples() {
  const [busca, setBusca] = useState("");
  const [, navigate] = useLocation();

  // Buscar todos os clientes cadastrados
  const { data: dadosClientes, isLoading, error, refetch } = useQuery<ApiResponse>({
    queryKey: ["/api/clientes/todos"],
    queryFn: async () => {
      const response = await fetch('/api/clientes/todos');
      if (!response.ok) {
        throw new Error("Erro ao carregar clientes");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Remover duplicatas baseado no telefone e filtrar por busca
  const clientesUnicos = useMemo(() => {
    if (!dadosClientes?.clientes) return [];

    // Mapa para rastrear telefones já vistos
    const telefoneMap = new Map<string, Cliente>();
    const clientesSemTelefone: Cliente[] = [];

    dadosClientes.clientes.forEach((cliente) => {
      if (cliente.telefone && cliente.telefone.trim()) {
        const telefoneNormalizado = cliente.telefone.replace(/\D/g, '');
        
        // Se o telefone já existe, manter o primeiro encontrado
        if (!telefoneMap.has(telefoneNormalizado)) {
          telefoneMap.set(telefoneNormalizado, cliente);
        }
      } else {
        // Clientes sem telefone são mantidos separadamente
        clientesSemTelefone.push(cliente);
      }
    });

    // Combinar clientes únicos por telefone + clientes sem telefone
    const clientesUnicos = [...telefoneMap.values(), ...clientesSemTelefone];

    // Aplicar filtro de busca
    if (!busca) return clientesUnicos;
    
    return clientesUnicos.filter((cliente) =>
      cliente.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.telefone?.toLowerCase().includes(busca.toLowerCase()) ||
      cliente.email?.toLowerCase().includes(busca.toLowerCase())
    );
  }, [dadosClientes?.clientes, busca]);

  const formatarTelefone = (telefone?: string) => {
    if (!telefone) return "Não informado";
    
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length === 11) {
      return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (numeros.length === 10) {
      return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
  };

  if (isLoading) {
    return <LoadingClientsState />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar clientes</h2>
          <p className="text-muted-foreground mb-4">Não foi possível carregar a lista de clientes.</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const totalDuplicatasRemovidas = (dadosClientes?.clientes.length || 0) - clientesUnicos.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lista de Clientes</h1>
          <p className="text-muted-foreground">
            Todos os clientes cadastrados no sistema
          </p>
          {totalDuplicatasRemovidas > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              {totalDuplicatasRemovidas} duplicata(s) removida(s) automaticamente
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate("/clientes/cadastro")} 
            variant="default" 
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar Cliente
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes Cadastrados ({clientesUnicos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientesUnicos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientesUnicos.map((cliente) => (
                <div 
                  key={cliente.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {cliente.nomeCompleto}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{formatarTelefone(cliente.telefone)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}