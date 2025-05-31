import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, AlertTriangle, DollarSign, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ClienteVencimento {
  id: string;
  nome: string;
  email: string;
  planoNome: string;
  planoValor: string;
  dataVencimentoAssinatura: string;
  diasRestantes: number;
  status: string;
}

export default function RecepcionistaDashboard() {
  // Query para clientes com assinaturas próximas ao vencimento
  const { data: clientesVencendo = [] } = useQuery({
    queryKey: ["/api/clientes/expiring"],
  });

  // Query para clientes com assinaturas vencidas
  const { data: clientesVencidos = [] } = useQuery({
    queryKey: ["/api/clientes/expired"],
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(value || '0'));
  };

  const getStatusBadge = (diasRestantes: number) => {
    if (diasRestantes < 0) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else if (diasRestantes <= 3) {
      return <Badge variant="destructive">Vence em {diasRestantes} dias</Badge>;
    } else if (diasRestantes <= 7) {
      return <Badge className="bg-yellow-500 text-white">Vence em {diasRestantes} dias</Badge>;
    } else {
      return <Badge variant="secondary">Vence em {diasRestantes} dias</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Dashboard Recepcionista</h1>
        <p className="text-gray-600">
          Gerencie agendamentos e acompanhe assinaturas dos clientes
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas ao Vencimento</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {Array.isArray(clientesVencendo) ? clientesVencendo.length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Até 7 dias</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Vencidas</CardTitle>
            <Calendar className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Array.isArray(clientesVencidos) ? clientesVencidos.length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <User className="h-4 w-4 text-[#8B4513]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8B4513]">
              {(Array.isArray(clientesVencendo) ? clientesVencendo.length : 0) + 
               (Array.isArray(clientesVencidos) ? clientesVencidos.length : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Com assinaturas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Assinaturas Próximas ao Vencimento */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#8B4513] flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
              Assinaturas Próximas ao Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(clientesVencendo) && clientesVencendo.length > 0 ? (
              <div className="space-y-4">
                {clientesVencendo.slice(0, 5).map((cliente: ClienteVencimento) => (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{cliente.nome}</div>
                      <div className="text-sm text-gray-600">{cliente.planoNome}</div>
                      <div className="text-xs text-gray-500">{cliente.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(cliente.planoValor)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {cliente.dataVencimentoAssinatura
                          ? format(new Date(cliente.dataVencimentoAssinatura), "dd/MM/yyyy", { locale: ptBR })
                          : 'Data não definida'
                        }
                      </div>
                      {getStatusBadge(cliente.diasRestantes || 0)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma assinatura próxima ao vencimento</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assinaturas Vencidas */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#8B4513] flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-red-600" />
              Assinaturas Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(clientesVencidos) && clientesVencidos.length > 0 ? (
              <div className="space-y-4">
                {clientesVencidos.slice(0, 5).map((cliente: ClienteVencimento) => (
                  <div
                    key={cliente.id}
                    className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{cliente.nome}</div>
                      <div className="text-sm text-gray-600">{cliente.planoNome}</div>
                      <div className="text-xs text-gray-500">{cliente.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(cliente.planoValor)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {cliente.dataVencimentoAssinatura
                          ? format(new Date(cliente.dataVencimentoAssinatura), "dd/MM/yyyy", { locale: ptBR })
                          : 'Data não definida'
                        }
                      </div>
                      <Badge variant="destructive">Vencida</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma assinatura vencida</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}