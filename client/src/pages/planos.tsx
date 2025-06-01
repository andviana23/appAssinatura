import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ExternalLink, CreditCard, Sparkles, RefreshCw, TestTube, Banknote, QrCode, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
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
  const [, setLocation] = useLocation();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showExternalPaymentModal, setShowExternalPaymentModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [checkoutData, setCheckoutData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    planoSelecionado: '',
    billingType: 'CREDIT_CARD'
  });
  const [externalPaymentMethod, setExternalPaymentMethod] = useState('');

  // Planos organizados por categoria com nova estrutura
  const planosData = {
    one: [
      { 
        id: "1", 
        nome: "Clube do Trato One", 
        categoria: "Corte + Barba",
        valor: 120.00, 
        descricao: "Corte + Barba mensal", 
        detalhes: ["1x Corte por mês", "1x Barba por mês", "Atendimento personalizado"],
        popular: false,
        urlCheckout: "", 
        ativo: true 
      },
      { 
        id: "2", 
        nome: "Clube do Trato One", 
        categoria: "Corte",
        valor: 67.50, 
        descricao: "Corte mensal", 
        detalhes: ["1x Corte por mês", "Produtos premium", "Ambiente exclusivo"],
        popular: true,
        urlCheckout: "", 
        ativo: true 
      }
    ],
    gold: [
      { 
        id: "3", 
        nome: "Clube do Trato Gold", 
        categoria: "Corte + Barba",
        valor: 349.90, 
        descricao: "Experiência premium completa", 
        detalhes: ["Corte + Barba premium", "Produtos importados", "Atendimento VIP", "Horário exclusivo"],
        popular: false,
        urlCheckout: "", 
        ativo: true 
      },
      { 
        id: "4", 
        nome: "Clube do Trato Gold", 
        categoria: "Corte",
        valor: 210.00, 
        descricao: "Corte premium exclusivo", 
        detalhes: ["Corte premium", "Produtos importados", "Atendimento VIP"],
        popular: false,
        urlCheckout: "", 
        ativo: true 
      },
      { 
        id: "5", 
        nome: "Clube do Trato Gold", 
        categoria: "Barba",
        valor: 249.90, 
        descricao: "Barba premium especializada", 
        detalhes: ["Barba premium", "Produtos importados", "Técnicas exclusivas"],
        popular: false,
        urlCheckout: "", 
        ativo: true 
      }
    ],
    multi: [
      { 
        id: "6", 
        nome: "Clube do Trato Multi", 
        categoria: "Corte e Barba 2x",
        valor: 199.90, 
        descricao: "Flexibilidade máxima", 
        detalhes: ["2x Corte por mês", "2x Barba por mês", "Agendamento flexível"],
        popular: true,
        urlCheckout: "", 
        ativo: true 
      },
      { 
        id: "7", 
        nome: "Clube do Trato Multi", 
        categoria: "Corte 2x + Barba 4x",
        valor: 299.90, 
        descricao: "Para quem cuida da barba", 
        detalhes: ["2x Corte por mês", "4x Barba por mês", "Cuidado especializado"],
        popular: false,
        urlCheckout: "", 
        ativo: true 
      },
      { 
        id: "8", 
        nome: "Clube do Trato Multi", 
        categoria: "Corte 2x",
        valor: 214.90, 
        descricao: "Sempre com corte em dia", 
        detalhes: ["2x Corte por mês", "Agendamento prioritário", "Flexibilidade total"],
        popular: false,
        urlCheckout: "", 
        ativo: true 
      }
    ]
  };

  // Flatten all plans for filtering
  const allPlanos = Object.values(planosData).flat();
  
  const getFilteredPlanos = () => {
    if (selectedCategory === 'todos') return allPlanos;
    return planosData[selectedCategory as keyof typeof planosData] || [];
  };
  
  const isLoading = false;
  const isRefetching = false;

  const createCheckoutMutation = useMutation({
    mutationFn: async (data: typeof checkoutData) => {
      if (data.billingType === 'EXTERNAL') {
        // Para pagamento externo, não criar checkout Asaas
        return { external: true };
      }
      
      const response = await apiRequest("/api/asaas/checkout", "POST", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.external) {
        // Mostrar modal de pagamento externo
        setShowCheckoutModal(false);
        setShowExternalPaymentModal(true);
        return;
      }
      
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        setShowCheckoutModal(false);
        setCheckoutData({ nome: '', email: '', telefone: '', cpf: '', planoSelecionado: '', billingType: 'CREDIT_CARD' });
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

  const createExternalClientMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      const response = await apiRequest("/api/clientes/external", "POST", {
        nome: checkoutData.nome,
        email: checkoutData.email,
        telefone: checkoutData.telefone,
        cpf: checkoutData.cpf,
        paymentMethod: paymentMethod,
        planoNome: checkoutData.planoSelecionado,
        planoValor: 0 // Valor será definido posteriormente
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente cadastrado com sucesso!",
        description: `Assinatura ativa por 30 dias com pagamento via ${externalPaymentMethod}`,
      });
      
      setShowExternalPaymentModal(false);
      setExternalPaymentMethod('');
      // Reset form
      setCheckoutData({
        nome: '',
        email: '',
        telefone: '',
        cpf: '',
        planoSelecionado: '',
        billingType: 'CREDIT_CARD'
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar cliente",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const handleAssinar = (plano: PlanoAsaas) => {
    // Abrir modal de checkout com plano selecionado
    setCheckoutData(prev => ({ ...prev, planoSelecionado: plano.nome }));
    setShowCheckoutModal(true);
    toast({
      title: "Checkout iniciado",
      description: `Iniciando checkout para ${plano.nome}`,
    });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header com design moderno */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors bg-primary/10 rounded-xl px-4 py-2 hover:bg-primary/20"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Voltar</span>
            </button>
          </div>
          
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
              Clube do Trato de Barbados
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Escolha seu plano de assinatura e tenha acesso completo aos nossos serviços premium
            </p>
          </div>

          {/* Filtros de categoria */}
          <div className="flex justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-border/50">
              <div className="flex gap-2">
                {[
                  { key: 'todos', label: 'Todos os Planos', icon: '🎯' },
                  { key: 'one', label: 'One', icon: '⭐' },
                  { key: 'gold', label: 'Gold', icon: '👑' },
                  { key: 'multi', label: 'Multi', icon: '🚀' }
                ].map((category) => (
                  <button
                    key={category.key}
                    onClick={() => setSelectedCategory(category.key)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                      selectedCategory === category.key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="mr-2">{category.icon}</span>
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid de planos redesenhado */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredPlanos().map((plano) => (
            <Card 
              key={plano.id} 
              className={`relative overflow-hidden bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${
                plano.popular ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
            >
              {/* Badge popular */}
              {plano.popular && (
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-primary text-primary-foreground border-0 shadow-lg">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}

              {/* Header gradiente */}
              <div className="bg-gradient-to-r from-primary via-primary/90 to-info p-6 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                <div className="relative">
                  <h3 className="text-xl font-bold">{plano.nome}</h3>
                  <p className="text-sm opacity-90 mt-1">{plano.categoria}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">{formatCurrency(plano.valor)}</span>
                    <span className="text-sm opacity-80 ml-1">/mês</span>
                  </div>
                </div>
              </div>

              <CardContent className="p-6 space-y-6">
                {/* Descrição */}
                <p className="text-muted-foreground text-sm">{plano.descricao}</p>

                {/* Lista de benefícios */}
                <div className="space-y-3">
                  {plano.detalhes.map((detalhe, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                      </div>
                      <span className="text-sm text-foreground">{detalhe}</span>
                    </div>
                  ))}
                </div>

                {/* Botão de ação */}
                <Button 
                  onClick={() => handleAssinar(plano)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold py-3 transition-all duration-200 shadow-md hover:shadow-lg"
                  size="lg"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Assinar Agora
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
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

      {/* Modal de Checkout */}
      <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              Checkout - {checkoutData.planoSelecionado}
            </DialogTitle>
          </DialogHeader>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (checkoutData.nome && checkoutData.email && checkoutData.telefone && checkoutData.cpf && checkoutData.planoSelecionado) {
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
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                type="tel"
                value={checkoutData.telefone}
                onChange={(e) => setCheckoutData(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="cpf">CPF/CNPJ *</Label>
              <Input
                id="cpf"
                value={checkoutData.cpf}
                onChange={(e) => setCheckoutData(prev => ({ ...prev, cpf: e.target.value }))}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label>Forma de pagamento *</Label>
              <RadioGroup 
                value={checkoutData.billingType} 
                onValueChange={(value) => setCheckoutData(prev => ({ ...prev, billingType: value }))}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CREDIT_CARD" id="credit_card" />
                  <Label htmlFor="credit_card" className="cursor-pointer flex items-center space-x-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Cartão de Crédito</span>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      Automático via Asaas
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EXTERNAL" id="external" />
                  <Label htmlFor="external" className="cursor-pointer flex items-center space-x-2">
                    <Banknote className="h-4 w-4" />
                    <span>Pago Externamente</span>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      PIX ou Débito
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-medium text-orange-800 mb-2">Detalhes do teste:</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Valor: R$ 5,00 (mínimo para cartão)</li>
                <li>• Pagamento: {
                  checkoutData.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito (Automático)' :
                  checkoutData.billingType === 'EXTERNAL' ? 'Pago Externamente (PIX ou Débito)' : 'Não selecionado'
                }</li>
                <li>• Checkout personalizado com identidade visual</li>
                <li>• Cores: Azul aço (#365e78) e Dourado (#d3b791)</li>
              </ul>
              {checkoutData.billingType === 'PIX' && (
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                  ⚠️ Para pagamento via PIX, é necessário ter uma chave PIX cadastrada na conta Asaas
                </div>
              )}
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
                disabled={createCheckoutMutation.isPending || !checkoutData.nome || !checkoutData.email || !checkoutData.cpf}
              >
                {createCheckoutMutation.isPending ? 'Criando...' : 'Criar Checkout'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento Externo */}
      <Dialog open={showExternalPaymentModal} onOpenChange={setShowExternalPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-500" />
              Como foi feito o pagamento?
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione como o cliente realizou o pagamento externo:
            </p>
            
            <RadioGroup 
              value={externalPaymentMethod} 
              onValueChange={setExternalPaymentMethod}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="PIX" id="external_pix" />
                <Label htmlFor="external_pix" className="cursor-pointer flex items-center space-x-2 flex-1">
                  <QrCode className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">PIX</div>
                    <div className="text-xs text-muted-foreground">Pagamento instantâneo</div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <RadioGroupItem value="Débito" id="external_debit" />
                <Label htmlFor="external_debit" className="cursor-pointer flex items-center space-x-2 flex-1">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">Cartão de Débito</div>
                    <div className="text-xs text-muted-foreground">Débito em conta</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Cliente:</strong> {checkoutData.nome}<br/>
                <strong>Plano:</strong> Clube do Trato Único<br/>
                <strong>Validade:</strong> 30 dias a partir de hoje
              </p>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowExternalPaymentModal(false)}
                disabled={createExternalClientMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (externalPaymentMethod) {
                    createExternalClientMutation.mutate(externalPaymentMethod);
                  }
                }}
                disabled={createExternalClientMutation.isPending || !externalPaymentMethod}
              >
                {createExternalClientMutation.isPending ? 'Cadastrando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}