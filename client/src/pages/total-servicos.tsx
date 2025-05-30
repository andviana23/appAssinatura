import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentMonth } from "@/lib/utils";
import { Save, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { Servico, TotalServico } from "@shared/schema";

export default function TotalServicos() {
  const [mes, setMes] = useState(getCurrentMonth());
  const [totais, setTotais] = useState<Record<number, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: servicos = [], isLoading: servicosLoading } = useQuery({
    queryKey: ['/api/servicos'],
  });

  const { data: totaisServicos = [], isLoading: totaisLoading } = useQuery({
    queryKey: ['/api/total-servicos', mes],
    enabled: !!mes,
  });

  const { data: validation } = useQuery({
    queryKey: ['/api/validate-limits', mes],
    enabled: !!mes,
    refetchInterval: 30000, // Revalida a cada 30 segundos
  });

  const saveMutation = useMutation({
    mutationFn: (data: { servicoId: number; mes: string; totalMes: number }) =>
      apiRequest('/api/total-servicos', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/total-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validate-limits'] });
      toast({
        title: "Sucesso",
        description: "Total de serviços atualizado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar total de serviços",
        variant: "destructive",
      });
    },
  });

  // Inicializar totais com dados existentes
  useState(() => {
    if (totaisServicos.length > 0) {
      const initialTotais: Record<number, number> = {};
      totaisServicos.forEach((total: TotalServico) => {
        initialTotais[total.servicoId] = total.totalMes;
      });
      setTotais(initialTotais);
    }
  }, [totaisServicos]);

  const handleSave = async (servicoId: number) => {
    const totalMes = totais[servicoId] || 0;
    
    if (totalMes < 0) {
      toast({
        title: "Erro",
        description: "O total não pode ser negativo",
        variant: "destructive",
      });
      return;
    }

    await saveMutation.mutateAsync({
      servicoId,
      mes,
      totalMes,
    });
  };

  const getViolationForServico = (servicoId: number) => {
    return validation?.violations?.find(v => v.servicoId === servicoId);
  };

  const getTotalUsado = (servicoId: number) => {
    const violation = getViolationForServico(servicoId);
    return violation?.used || 0;
  };

  if (servicosLoading || totaisLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Controle de Totais de Serviços</h2>
          <p className="text-muted-foreground">Defina o limite máximo de cada serviço por mês</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div>
            <Label htmlFor="mes">Mês</Label>
            <Input
              id="mes"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Alertas de validação */}
      {validation && !validation.valid && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Limites Ultrapassados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Os seguintes serviços ultrapassaram o limite definido:
            </p>
            <div className="space-y-2">
              {validation.violations?.map((violation) => {
                const servico = servicos.find((s: Servico) => s.id === violation.servicoId);
                return (
                  <div key={violation.servicoId} className="flex items-center justify-between bg-destructive/10 p-3 rounded-lg">
                    <span className="font-medium">{servico?.nome}</span>
                    <span className="text-sm text-destructive">
                      Usado: {violation.used} / Limite: {violation.limit}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Controle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Totais do Mês: {mes}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-center">Tempo (min)</TableHead>
                  <TableHead className="text-center">Total Definido</TableHead>
                  <TableHead className="text-center">Total Usado</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicos.map((servico: Servico) => {
                  const totalUsado = getTotalUsado(servico.id);
                  const totalDefinido = totais[servico.id] || 0;
                  const isOverLimit = totalUsado > totalDefinido;
                  const hasDeficit = totalDefinido > 0 && totalUsado < totalDefinido;

                  return (
                    <TableRow key={servico.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                            <Clock className="h-4 w-4 text-white" />
                          </div>
                          <span>{servico.nome}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        {servico.tempoMinutos}min
                      </TableCell>

                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={totais[servico.id] || 0}
                          onChange={(e) => setTotais(prev => ({
                            ...prev,
                            [servico.id]: parseInt(e.target.value) || 0
                          }))}
                          className="w-20 text-center mx-auto"
                        />
                      </TableCell>

                      <TableCell className="text-center font-medium">
                        {totalUsado}
                      </TableCell>

                      <TableCell className="text-center">
                        {isOverLimit ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Excedido
                          </Badge>
                        ) : hasDeficit ? (
                          <Badge variant="secondary">
                            Disponível
                          </Badge>
                        ) : totalDefinido > 0 ? (
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completo
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Não definido
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleSave(servico.id)}
                          disabled={saveMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Controle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {servicos.length}
              </div>
              <div className="text-sm text-muted-foreground">Total de Serviços</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {validation ? servicos.length - (validation.violations?.length || 0) : servicos.length}
              </div>
              <div className="text-sm text-muted-foreground">Dentro do Limite</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {validation?.violations?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Excedidos</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}