import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Trophy, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface PosicaoBarbeiro {
  posicaoMensal: number;
  totalAtendimentosMes: number;
}

export default function ListaDaVezBarbeiro() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Obter mês atual
  const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  // Buscar posição do barbeiro atual
  const { data: posicao, isLoading } = useQuery<PosicaoBarbeiro>({
    queryKey: ['/api/lista-da-vez/barbeiro', user?.barbeiroId, mesAtual],
    enabled: !!user?.barbeiroId && !!mesAtual,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Lista da Vez
            </h1>
          </div>
          <div className="text-center py-8">
            <p>Carregando sua posição...</p>
          </div>
        </div>
      </div>
    );
  }

  const isPrimeiroPosicao = posicao?.posicaoMensal === 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Lista da Vez
          </h1>
        </div>

        {/* Status da Posição */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card Principal - Posição */}
          <Card className="md:col-span-2">
            <CardContent className="p-8">
              <div className="text-center">
                {isPrimeiroPosicao ? (
                  <>
                    <div className="mb-4">
                      <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                      É a sua vez de atender!
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                      Você está em 1º lugar na fila mensal
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <Users className="w-16 h-16 mx-auto text-blue-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-700 dark:text-gray-200 mb-2">
                      Você está em {posicao?.posicaoMensal}ª posição
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                      Aguarde sua vez na fila mensal
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card de Estatísticas - Atendimentos do Mês */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Atendimentos este Mês
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {posicao?.totalAtendimentosMes || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Total acumulado em {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </CardContent>
          </Card>

          {/* Card de Posição Detalhada */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Posição na Fila
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {posicao?.posicaoMensal || 0}º lugar
              </div>
              <p className="text-xs text-muted-foreground">
                {isPrimeiroPosicao 
                  ? "Próximo a atender" 
                  : `${(posicao?.posicaoMensal || 1) - 1} na sua frente`
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Informações Adicionais */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Como Funciona a Lista da Vez</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                A ordem é determinada pelo menor número total de atendimentos no mês
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                A lista é atualizada diariamente pela recepção
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                A fila é resetada automaticamente no início de cada mês
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                "Passar a vez" também conta como atendimento para o ranking
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}