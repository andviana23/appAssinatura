import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, CreditCard, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface PlanoAsaas {
  id: string;
  nome: string;
  valor: number;
  descricao: string;
  urlCheckout: string;
  ativo: boolean;
  criadoEm: string;
}

export default function Planos() {
  const { toast } = useToast();

  const { data: planos, isLoading, refetch, isRefetching } = useQuery<PlanoAsaas[]>({
    queryKey: ["/api/asaas/planos"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const handleAssinar = (plano: PlanoAsaas) => {
    if (plano.urlCheckout) {
      window.open(plano.urlCheckout, '_blank');
      toast({
        title: "Redirecionando...",
        description: `Você será direcionado para o checkout do ${plano.nome}`,
      });
    } else {
      toast({
        title: "Erro",
        description: "Link de pagamento não disponível",
        variant: "destructive",
      });
    }
  };

  const getPlanoDescription = (nome: string) => {
    const descriptions: { [key: string]: string } = {
      'Clube do Trato One - Corte Barba': 'Corte + Barba premium mensal',
      'Clube do Trato One - Corte': 'Corte premium mensal',
      'Clube do Trato Gold - Corte + Barba': 'Corte + Barba gold com benefícios exclusivos',
      'Clube do Trato Gold - Corte': 'Corte gold com benefícios exclusivos',
      'Clube do Trato Gold - Barba': 'Barba gold com benefícios exclusivos',
      'Clube do Trato - Corte e Barba 2x': '2x Corte e Barba por mês',
      'Clube do Trato - Corte 2x Barba 4x': '2x Corte + 4x Barba por mês',
      'Clube do Trato - Corte 2x': '2x Corte por mês',
      'Clube do Trato - Barba 4x': '4x Barba por mês'
    };
    return descriptions[nome] || 'Plano de assinatura Trato de Barbados';
  };

  const getPlanoTier = (nome: string) => {
    if (nome.includes('Gold')) return 'gold';
    if (nome.includes('One')) return 'premium';
    return 'standard';
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'gold': return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
      case 'premium': return 'bg-gradient-to-r from-purple-500 to-purple-600';
      default: return 'bg-gradient-to-r from-blue-500 to-blue-600';
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'gold': return <Badge className="bg-yellow-500 text-yellow-50">Gold</Badge>;
      case 'premium': return <Badge className="bg-purple-500 text-purple-50">Premium</Badge>;
      default: return <Badge className="bg-blue-500 text-blue-50">Standard</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="relative">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-24 mb-4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Planos de Assinatura</h2>
          <p className="text-muted-foreground mt-2">
            Escolha o plano ideal para suas necessidades. Todos os planos incluem agendamento prioritário.
          </p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Planos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {planos?.map((plano) => {
          const tier = getPlanoTier(plano.nome);
          const tierColor = getTierColor(tier);
          
          return (
            <Card key={plano.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              {/* Header colorido baseado no tier */}
              <div className={`h-2 ${tierColor}`}></div>
              
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${tierColor}`}>
                      {tier === 'gold' ? (
                        <Sparkles className="h-6 w-6 text-white" />
                      ) : (
                        <CreditCard className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg leading-tight">{plano.nome}</CardTitle>
                    </div>
                  </div>
                  {getTierBadge(tier)}
                </div>
                
                <CardDescription className="text-sm">
                  {getPlanoDescription(plano.nome)}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Preço */}
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {formatCurrency(plano.valor)}
                  </div>
                  <div className="text-sm text-muted-foreground">por mês</div>
                </div>

                {/* Características do plano */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-foreground">O que está incluso:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {plano.nome.includes('Corte') && (
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                        Corte profissional
                      </li>
                    )}
                    {plano.nome.includes('Barba') && (
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                        Barba modelada
                      </li>
                    )}
                    {tier === 'gold' && (
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        Atendimento VIP
                      </li>
                    )}
                    {tier === 'premium' && (
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        Tratamentos premium
                      </li>
                    )}
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                      Agendamento prioritário
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-primary rounded-full mr-2"></span>
                      Sem taxas extras
                    </li>
                  </ul>
                </div>

                {/* Botão de assinatura */}
                <Button 
                  className={`w-full ${tierColor} hover:opacity-90 text-white border-0`}
                  onClick={() => handleAssinar(plano)}
                  disabled={!plano.ativo}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {plano.ativo ? 'Assinar Agora' : 'Indisponível'}
                </Button>

                {/* Status */}
                {!plano.ativo && (
                  <p className="text-xs text-center text-muted-foreground">
                    Este plano está temporariamente indisponível
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Estado vazio */}
      {planos?.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum plano disponível
            </h3>
            <p className="text-muted-foreground mb-4">
              Não há planos de assinatura disponíveis no momento.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer informativo */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h4 className="font-medium text-foreground">Como funciona?</h4>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Ao clicar em "Assinar Agora", você será redirecionado para o checkout seguro do Asaas. 
              Após a confirmação do pagamento, sua assinatura será ativada automaticamente e você poderá 
              agendar seus serviços com prioridade.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}