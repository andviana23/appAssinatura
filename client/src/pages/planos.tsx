import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, CreditCard, Sparkles, RefreshCw, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

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
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    nome: '',
    email: '',
    cpf: ''
  });

  const { data: planos, isLoading, refetch, isRefetching } = useQuery<PlanoAsaas[]>({
    queryKey: ["/api/asaas/planos"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (data: { nome: string; email: string; cpf?: string }) => {
      const response = await apiRequest("/api/asaas/checkout", "POST", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        setShowCheckoutModal(false);
        setCheckoutData({ nome: '', email: '', cpf: '' });
        toast({
          title: "Checkout criado com sucesso!",
          description: "Você será redirecionado para o pagamento.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar checkout",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
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

      {/* Card do Plano Teste */}
      <Card className="relative overflow-hidden border-2 border-dashed border-orange-300 bg-orange-50/50 mb-6">
        <div className="h-2 bg-gradient-to-r from-orange-500 to-red-500"></div>
        
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gradient-to-r from-orange-500 to-red-500">
                <TestTube className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg leading-tight">Clube do Trato Único</CardTitle>
              </div>
            </div>
            <Badge className="bg-orange-500 text-orange-50">Teste</Badge>
          </div>
          
          <CardDescription className="text-sm">
            Pagamento teste de funcionalidade - R$ 2,00 via PIX
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600">
              R$ 2,00
            </div>
            <div className="text-sm text-muted-foreground">pagamento único</div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm text-foreground">Para teste:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                Checkout personalizado
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                Identidade visual Trato de Barbados
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                Pagamento via PIX
              </li>
            </ul>
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white border-0"
            onClick={() => setShowCheckoutModal(true)}
            disabled={createCheckoutMutation.isPending}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {createCheckoutMutation.isPending ? 'Criando...' : 'Testar Checkout'}
          </Button>
        </CardContent>
      </Card>

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

      {/* Modal de Checkout Teste */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-orange-500" />
              Checkout Teste - Clube do Trato Único
            </DialogTitle>
          </DialogHeader>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (checkoutData.nome && checkoutData.email) {
                createCheckoutMutation.mutate(checkoutData);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={checkoutData.nome}
                onChange={(e) => setCheckoutData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Seu nome completo"
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={checkoutData.email}
                onChange={(e) => setCheckoutData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="seu@email.com"
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="cpf">CPF (opcional)</Label>
              <Input
                id="cpf"
                value={checkoutData.cpf}
                onChange={(e) => setCheckoutData(prev => ({ ...prev, cpf: e.target.value }))}
                placeholder="000.000.000-00"
                className="mt-1"
              />
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-medium text-orange-800 mb-2">Detalhes do teste:</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Valor: R$ 2,00</li>
                <li>• Pagamento: PIX</li>
                <li>• Checkout personalizado com identidade visual</li>
                <li>• Cores: Azul aço (#365e78) e Dourado (#d3b791)</li>
              </ul>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowCheckoutModal(false)}
                disabled={createCheckoutMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90"
                disabled={createCheckoutMutation.isPending || !checkoutData.nome || !checkoutData.email}
              >
                {createCheckoutMutation.isPending ? 'Criando...' : 'Criar Checkout'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}