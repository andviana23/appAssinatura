import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Settings, 
  UserCheck, 
  UserX,
  Save,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function GerenciarFila() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [ordemModificada, setOrdemModificada] = useState<any[]>([]);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState(false);

  // Buscar configuração atual da ordem da fila
  const { data: ordemFila, isLoading } = useQuery({
    queryKey: ["/api/ordem-fila"],
    queryFn: () => apiRequest("/api/ordem-fila"),
    enabled: isAdmin
  });

  // Sincronizar dados quando carregados
  React.useEffect(() => {
    console.log("DADOS RECEBIDOS:", ordemFila);
    console.log("ESTADO ATUAL ordemModificada:", ordemModificada);
    if (ordemFila && Array.isArray(ordemFila)) {
      console.log("EXECUTANDO setOrdemModificada com:", ordemFila);
      setOrdemModificada([...ordemFila]);
    }
  }, [ordemFila]);

  // Inicializar ordem da fila
  const inicializarOrdem = useMutation({
    mutationFn: () => apiRequest("/api/ordem-fila/inicializar", "POST"),
    onSuccess: () => {
      toast({ title: "Ordem da fila inicializada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/ordem-fila"] });
      setAlteracoesPendentes(false);
    },
    onError: () => {
      toast({ title: "Erro ao inicializar ordem da fila", variant: "destructive" });
    }
  });

  // Salvar nova ordem
  const salvarOrdem = useMutation({
    mutationFn: async (novaOrdem: any[]) => {
      const dadosParaEnvio = novaOrdem.map((item, index) => ({
        barbeiroId: item.barbeiroId,
        ordemCustomizada: index + 1
      }));
      
      const response = await fetch("/api/ordem-fila/reordenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaOrdem: dadosParaEnvio })
      });
      
      if (!response.ok) throw new Error('Erro ao salvar ordem');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Ordem da fila atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/ordem-fila"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
      setAlteracoesPendentes(false);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar ordem da fila", variant: "destructive" });
    }
  });

  // Toggle status do barbeiro
  const toggleBarbeiro = useMutation({
    mutationFn: async ({ barbeiroId, ativo }: { barbeiroId: number; ativo: boolean }) => {
      const response = await fetch(`/api/ordem-fila/${barbeiroId}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo })
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar status');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status do barbeiro atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/ordem-fila"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lista-da-vez/fila-mensal"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status do barbeiro", variant: "destructive" });
    }
  });

  // Verificar se é admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600 mb-4">
              Esta funcionalidade é exclusiva para administradores.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const moverBarbeiro = (index: number, direcao: 'up' | 'down') => {
    const novaOrdem = [...ordemModificada];
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    
    if (novoIndex >= 0 && novoIndex < novaOrdem.length) {
      [novaOrdem[index], novaOrdem[novoIndex]] = [novaOrdem[novoIndex], novaOrdem[index]];
      setOrdemModificada(novaOrdem);
      setAlteracoesPendentes(true);
    }
  };

  const toggleStatusLocal = (index: number) => {
    const novaOrdem = [...ordemModificada];
    const barbeiroId = novaOrdem[index].barbeiroId;
    const novoStatus = !novaOrdem[index].ativo;
    
    novaOrdem[index].ativo = novoStatus;
    setOrdemModificada(novaOrdem);
    
    // Aplicar mudança no servidor imediatamente
    toggleBarbeiro.mutate({ barbeiroId, ativo: novoStatus });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#365e78] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando configuração da fila...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-[#365e78] hover:text-[#2a4a5e] transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-gradient-to-br from-[#365e78] to-[#2a4a5e] rounded-2xl flex items-center justify-center shadow-lg">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#365e78] to-[#2a4a5e] bg-clip-text text-transparent">
                  Gerenciar Lista da Vez
                </h1>
                <p className="text-gray-600 mt-1">Configuração da ordem e status dos profissionais</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-3">
            {!ordemModificada || ordemModificada.length === 0 ? (
              <Button
                onClick={() => inicializarOrdem.mutate()}
                disabled={inicializarOrdem.isPending}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {inicializarOrdem.isPending ? 'Inicializando...' : 'Inicializar Ordem'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => inicializarOrdem.mutate()}
                  disabled={inicializarOrdem.isPending}
                  variant="outline"
                  className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {inicializarOrdem.isPending ? 'Resetando...' : 'Resetar Ordem'}
                </Button>
                
                {alteracoesPendentes && (
                  <Button
                    onClick={() => salvarOrdem.mutate(ordemModificada)}
                    disabled={salvarOrdem.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {salvarOrdem.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Conteúdo Principal */}
        {isLoading ? (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando configuração...</p>
            </CardContent>
          </Card>
        ) : (!ordemModificada || ordemModificada.length === 0) ? (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Ordem da Fila Não Configurada
              </h3>
              <p className="text-gray-600 mb-6">
                Para começar a gerenciar a ordem da fila, você precisa inicializar a configuração com todos os barbeiros ativos.
              </p>
              <Button
                onClick={() => inicializarOrdem.mutate()}
                disabled={inicializarOrdem.isPending}
                className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] hover:from-[#2a4a5e] hover:to-[#1f3746] text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {inicializarOrdem.isPending ? 'Inicializando...' : 'Inicializar Agora'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-[#365e78] to-[#2a4a5e] text-white rounded-t-xl">
              <CardTitle className="text-xl">Ordem Personalizada dos Profissionais</CardTitle>
              <CardDescription className="text-blue-100">
                Use os controles para reordenar os profissionais e ativar/desativar sua participação na fila
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {ordemModificada.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
                      item.ativo 
                        ? 'border-green-200 bg-green-50 hover:border-green-300' 
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                        item.ativo 
                          ? 'bg-[#365e78] text-white' 
                          : 'bg-gray-400 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.barbeiro?.nome}</h3>
                        <p className="text-sm text-gray-600">{item.barbeiro?.email}</p>
                      </div>
                      
                      <Badge 
                        variant={item.ativo ? "default" : "secondary"}
                        className={item.ativo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                      >
                        {item.ativo ? (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <UserX className="h-3 w-3 mr-1" />
                            Inativo
                          </>
                        )}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Controles de reordenação */}
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moverBarbeiro(index, 'up')}
                          disabled={index === 0}
                          className="h-8 w-8 p-0"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moverBarbeiro(index, 'down')}
                          disabled={index === ordemModificada.length - 1}
                          className="h-8 w-8 p-0"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Toggle ativo/inativo */}
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-sm font-medium text-gray-700">
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <Switch
                          checked={item.ativo}
                          onCheckedChange={() => toggleStatusLocal(index)}
                          disabled={toggleBarbeiro.isPending}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {alteracoesPendentes && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">
                      Você tem alterações pendentes na ordem da fila.
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Clique em "Salvar Alterações" para aplicar a nova ordem.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Informações de Ajuda */}
        <Card className="shadow-lg border-0 bg-blue-50/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#365e78]">Como Usar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold mb-2">Reordenação Manual</h4>
                <ul className="space-y-1">
                  <li>• Use as setas ↑ ↓ para mover profissionais</li>
                  <li>• A ordem será mantida mesmo com novos atendimentos</li>
                  <li>• Números originais de atendimento são preservados</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Controle de Status</h4>
                <ul className="space-y-1">
                  <li>• Use o switch para ativar/desativar profissionais</li>
                  <li>• Profissionais inativos não aparecem na fila pública</li>
                  <li>• Dados são preservados para reativação posterior</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}