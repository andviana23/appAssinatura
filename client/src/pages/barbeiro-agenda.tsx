import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, ArrowLeft, CalendarDays } from "lucide-react";

export default function BarbeiroAgenda() {
  // Obter data da URL ou usar hoje
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data');
  const [selectedDate, setSelectedDate] = useState(() => {
    if (dataParam) {
      return parseISO(dataParam);
    }
    return new Date();
  });

  // Buscar agendamentos do dia
  const { data: agendaDia, isLoading } = useQuery({
    queryKey: ['/api/barbeiro/agenda', selectedDate],
    queryFn: async () => {
      const dataFormatada = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch(`/api/barbeiro/agenda?data=${dataFormatada}`);
      if (!response.ok) throw new Error('Erro ao buscar agenda');
      return response.json();
    }
  });

  const navegarData = (direcao: 'anterior' | 'proximo') => {
    setSelectedDate(prevDate => {
      if (direcao === 'anterior') {
        return subDays(prevDate, 1);
      } else {
        return addDays(prevDate, 1);
      }
    });
  };

  const formatarHorario = (dataHora: string) => {
    try {
      // Parse da data ISO do banco e formatação para horário local
      const data = parseISO(dataHora);
      return format(data, "HH:mm", { locale: ptBR });
    } catch (error) {
      console.error('Erro ao formatar horário:', error);
      return '00:00';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AGENDADO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'FINALIZADO':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CANCELADO':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Agenda Pessoal
            </h1>
          </div>
          
          {/* Filtro de Data */}
          <Card className="p-4">
            <div className="flex flex-col lg:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <Label className="font-medium">Selecionar Data:</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Input 
                  type="date"
                  value={format(selectedDate, "yyyy-MM-dd")}
                  onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                  className="w-auto"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navegarData('anterior')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-medium min-w-[140px] text-center px-3 py-1 bg-muted rounded">
                  {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navegarData('proximo')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => setSelectedDate(new Date())}
                className="flex items-center gap-2"
              >
                Hoje
              </Button>
            </div>
          </Card>
        </div>

        {/* Resumo do Dia */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Total Agendamentos</span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {agendaDia?.agendamentos?.filter((a: any) => {
                  const hora = parseISO(a.dataHora).getHours();
                  return hora >= 8 && hora < 20;
                }).length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Finalizados</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {agendaDia?.agendamentos?.filter((a: any) => {
                  const hora = parseISO(a.dataHora).getHours();
                  return hora >= 8 && hora < 20 && a.status === 'FINALIZADO';
                }).length || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-muted-foreground">Pendentes</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-orange-600">
                {agendaDia?.agendamentos?.filter((a: any) => {
                  const hora = parseISO(a.dataHora).getHours();
                  return hora >= 8 && hora < 20 && a.status === 'AGENDADO';
                }).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Agendamentos */}
        <Card>
          <CardHeader>
            <CardTitle>Agendamentos do Dia</CardTitle>
          </CardHeader>
          <CardContent>
            {agendaDia?.agendamentos?.filter((agendamento: any) => {
              const hora = parseISO(agendamento.dataHora).getHours();
              return hora >= 8 && hora < 20;
            }).length > 0 ? (
              <div className="space-y-4">
                {agendaDia.agendamentos
                  .filter((agendamento: any) => {
                    const hora = parseISO(agendamento.dataHora).getHours();
                    return hora >= 8 && hora < 20;
                  })
                  .sort((a: any, b: any) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
                  .map((agendamento: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-semibold text-blue-600">
                            {formatarHorario(agendamento.dataHora)}
                          </div>
                          <Badge className={getStatusColor(agendamento.status)}>
                            {agendamento.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {agendamento.cliente?.nome || 'Cliente não informado'}
                            </span>
                          </div>
                          
                          {agendamento.servico?.nome && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                <span className="font-medium">{agendamento.servico.nome}</span>
                                {agendamento.servico?.tempoMinutos && ` • ${agendamento.servico.tempoMinutos}min`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum agendamento</h3>
                <p className="text-muted-foreground">
                  Não há agendamentos no horário de funcionamento (08:00-20:00) para {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}