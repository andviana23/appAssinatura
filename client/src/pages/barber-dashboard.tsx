import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils";
import {
  Scissors,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  User,
} from "lucide-react";
import type { Comissao } from "@shared/schema";

interface BarberStats {
  monthlyServices: number;
  hoursWorked: number;
  estimatedCommission: number;
  participationRate: number;
}

interface RecentService {
  date: string;
  clientName: string;
  phone: string;
  serviceName: string;
  planName: string;
  duration: number;
  value: number;
}

export default function BarberDashboard() {
  const { user } = useAuth();

  const { data: comissoes, isLoading: comissoesLoading } = useQuery<Comissao[]>({
    queryKey: ["/api/comissoes/barbeiro", user?.barbeiroId],
    enabled: !!user?.barbeiroId,
  });

  const { data: barbeiro } = useQuery({
    queryKey: ["/api/barbeiros", user?.barbeiroId],
    enabled: !!user?.barbeiroId,
  });

  // Mock data para demonstração - em produção viria da API
  const stats: BarberStats = {
    monthlyServices: 105,
    hoursWorked: 40.5,
    estimatedCommission: 4689,
    participationRate: 41.2,
  };

  const recentServices: RecentService[] = [
    {
      date: "2025-05-29",
      clientName: "Carlos Silva",
      phone: "+55 11 99999-9999",
      serviceName: "Corte + Barba",
      planName: "Plano Premium",
      duration: 50,
      value: 85,
    },
    {
      date: "2025-05-28",
      clientName: "Pedro Santos",
      phone: "+55 11 88888-8888",
      serviceName: "Corte Clássico",
      planName: "Plano Básico",
      duration: 30,
      value: 55,
    },
    {
      date: "2025-05-28",
      clientName: "Marcos Lima",
      phone: "+55 11 77777-7777",
      serviceName: "Hidratação Capilar",
      planName: "Plano Premium",
      duration: 15,
      value: 35,
    },
  ];

  const currentMonth = getCurrentMonth();
  const currentMonthCommission = comissoes?.find(c => c.mes === currentMonth);

  if (comissoesLoading) {
    return (
      <div className="space-y-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-24">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-24 mb-4" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-24">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-barbershop-brown rounded-2xl p-24 text-white">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Bem-vindo, {barbeiro?.nome || "Barbeiro"}!</h1>
            <p className="text-white/80 mt-2">
              Aqui você pode acompanhar seus atendimentos e comissões do mês
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-24">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Atendimentos do Mês
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.monthlyServices}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  <Scissors className="inline h-3 w-3 mr-1" />
                  Serviços realizados
                </p>
              </div>
              <div className="h-16 w-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Scissors className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Horas Trabalhadas
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {stats.hoursWorked}h
                </p>
                <p className="text-sm text-purple-600 mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {Math.round(stats.hoursWorked * 60)} minutos
                </p>
              </div>
              <div className="h-16 w-16 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Comissão Estimada
                </p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency(currentMonthCommission ? parseFloat(currentMonthCommission.valor) : stats.estimatedCommission)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  {stats.participationRate}% do pool
                </p>
              </div>
              <div className="h-16 w-16 bg-green-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Services */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Atendimentos Recentes</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Últimos 7 dias</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentServices.map((service, index) => (
                <TableRow key={index} className="hover:bg-accent">
                  <TableCell className="font-medium">
                    {formatDate(service.date)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{service.clientName}</div>
                      <div className="text-sm text-muted-foreground">{service.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{service.serviceName}</div>
                      <Badge variant="secondary" className="text-xs">
                        {service.planName}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>{service.duration} min</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-green-600">
                    {formatCurrency(service.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Commission History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Histórico de Comissões</CardTitle>
            <Badge variant="outline">Últimos meses</Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {comissoes?.slice(0, 3).map((comissao, index) => (
              <div 
                key={comissao.id} 
                className={`rounded-2xl p-4 ${
                  index === 0 ? "bg-green-50 border border-green-200" : "bg-accent"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    index === 0 ? "text-green-700" : "text-muted-foreground"
                  }`}>
                    {new Date(comissao.mes + "-01").toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                  <span className={`text-xs ${
                    index === 0 ? "text-green-600" : "text-muted-foreground"
                  }`}>
                    {index === 0 ? "Atual" : "Pago"}
                  </span>
                </div>
                <div className={`text-2xl font-bold mb-1 ${
                  index === 0 ? "text-green-700" : "text-foreground"
                }`}>
                  {formatCurrency(parseFloat(comissao.valor))}
                </div>
                <div className={`text-sm ${
                  index === 0 ? "text-green-600" : "text-muted-foreground"
                }`}>
                  Comissão mensal
                </div>
              </div>
            )) || (
              // Placeholder se não houver comissões
              <div className="col-span-3 text-center py-8">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma comissão registrada ainda
                </p>
              </div>
            )}
          </div>

          {comissoes && comissoes.length > 3 && (
            <div className="mt-6 text-center">
              <Button variant="ghost" className="text-primary hover:text-primary-dark">
                Ver histórico completo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
