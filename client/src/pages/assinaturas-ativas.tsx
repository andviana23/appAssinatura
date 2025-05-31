import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, ChevronLeft, ChevronRight, Calendar, DollarSign, User, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface AssinaturaAtiva {
  id: string;
  nome: string;
  email: string;
  planoNome: string;
  planoValor: string;
  dataInicioAssinatura: string;
  dataVencimentoAssinatura: string;
  statusAssinatura: string;
}

type SortField = 'nome' | 'planoNome' | 'planoValor' | 'dataVencimentoAssinatura';
type SortDirection = 'asc' | 'desc';

export default function AssinaturasAtivas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('dataVencimentoAssinatura');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const itemsPerPage = 10;

  // Query para buscar assinaturas ativas
  const { data: assinaturasData, isLoading } = useQuery({
    queryKey: ["/api/clientes/assinaturas-ativas"],
    queryFn: () => apiRequest("/api/clientes/assinaturas-ativas"),
  });

  const assinaturas: AssinaturaAtiva[] = assinaturasData || [];

  // Filtrar assinaturas com base na busca
  const filteredAssinaturas = assinaturas.filter(assinatura =>
    assinatura.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assinatura.planoNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assinatura.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ordenar assinaturas
  const sortedAssinaturas = [...filteredAssinaturas].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'planoValor') {
      aValue = parseFloat(aValue || '0');
      bValue = parseFloat(bValue || '0');
    } else if (sortField === 'dataVencimentoAssinatura') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else {
      aValue = String(aValue || '').toLowerCase();
      bValue = String(bValue || '').toLowerCase();
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Paginação
  const totalPages = Math.ceil(sortedAssinaturas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAssinaturas = sortedAssinaturas.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(value || '0'));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVA':
        return <Badge className="bg-green-100 text-green-800">Ativa</Badge>;
      case 'VENCIDA':
        return <Badge variant="destructive">Vencida</Badge>;
      case 'CANCELADA':
        return <Badge variant="secondary">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isVencendoEm7Dias = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diff = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 7 && diff >= 0;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Assinaturas Ativas</h1>
        <p className="text-gray-600">
          Gerenciamento completo de todas as assinaturas ativas da barbearia
        </p>
      </div>

      {/* Estatísticas resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Assinaturas</CardTitle>
            <User className="h-4 w-4 text-[#8B4513]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8B4513]">{assinaturas.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal Total</CardTitle>
            <DollarSign className="h-4 w-4 text-[#8B4513]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#8B4513]">
              {formatCurrency(
                assinaturas.reduce((total, a) => total + parseFloat(a.planoValor || '0'), 0).toString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em 7 dias</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {assinaturas.filter(a => isVencendoEm7Dias(a.dataVencimentoAssinatura)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome do cliente, plano ou email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela de assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#8B4513]">
            Lista de Assinaturas Ativas
            {searchTerm && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({filteredAssinaturas.length} de {assinaturas.length} resultados)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentAssinaturas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "Nenhuma assinatura encontrada com os critérios de busca." : "Nenhuma assinatura ativa encontrada."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('nome')}
                          className="flex items-center space-x-1 hover:text-[#8B4513] font-medium"
                        >
                          <span>Nome do Cliente</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('planoNome')}
                          className="flex items-center space-x-1 hover:text-[#8B4513] font-medium"
                        >
                          <span>Plano de Assinatura</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-right p-3">
                        <button
                          onClick={() => handleSort('planoValor')}
                          className="flex items-center justify-end space-x-1 hover:text-[#8B4513] font-medium"
                        >
                          <span>Valor Mensal</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">Data de Início</th>
                      <th className="text-center p-3">
                        <button
                          onClick={() => handleSort('dataVencimentoAssinatura')}
                          className="flex items-center space-x-1 hover:text-[#8B4513] font-medium mx-auto"
                        >
                          <span>Data de Vencimento</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAssinaturas.map((assinatura, index) => (
                      <tr
                        key={assinatura.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                          isVencendoEm7Dias(assinatura.dataVencimentoAssinatura) ? 'bg-orange-50' : ''
                        }`}
                        onClick={() => {
                          // Navegar para detalhes do cliente
                          window.location.href = `/clientes?search=${assinatura.email}`;
                        }}
                      >
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-[#8B4513]">{assinatura.nome}</div>
                            <div className="text-sm text-gray-600">{assinatura.email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{assinatura.planoNome || 'N/A'}</div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="font-semibold text-green-600">
                            {formatCurrency(assinatura.planoValor)}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="text-sm">
                            {assinatura.dataInicioAssinatura
                              ? format(new Date(assinatura.dataInicioAssinatura), "dd/MM/yyyy", { locale: ptBR })
                              : 'N/A'
                            }
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className={`text-sm ${isVencendoEm7Dias(assinatura.dataVencimentoAssinatura) ? 'font-semibold text-orange-600' : ''}`}>
                            {assinatura.dataVencimentoAssinatura
                              ? format(new Date(assinatura.dataVencimentoAssinatura), "dd/MM/yyyy", { locale: ptBR })
                              : 'N/A'
                            }
                            {isVencendoEm7Dias(assinatura.dataVencimentoAssinatura) && (
                              <div className="text-xs text-orange-600 font-medium mt-1">
                                Vence em breve!
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(assinatura.statusAssinatura)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-600">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredAssinaturas.length)} de {filteredAssinaturas.length} assinaturas
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => 
                          page === 1 || 
                          page === totalPages || 
                          Math.abs(page - currentPage) <= 1
                        )
                        .map((page, index, array) => (
                          <div key={page} className="flex items-center">
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="text-gray-400 mx-1">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className={currentPage === page ? "bg-[#8B4513] hover:bg-[#A0522D]" : ""}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}