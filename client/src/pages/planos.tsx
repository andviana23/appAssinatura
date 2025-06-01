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
  categoria?: string;
  detalhes?: string[];
  popular?: boolean;
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
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
        ativo: true,
        criadoEm: ""
      }
    ]
  };

  // Flatten all plans for filtering
  const allPlanos = Object.values(planosData).flat();
  
  const getFilteredPlanos = () => {
    if (selectedCategory === 'todos') return allPlanos;
    return planosData[selectedCategory as keyof typeof planosData] || [];
  };

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
      // Buscar o valor correto do plano selecionado
      const planoSelecionado = getFilteredPlanos().find(p => p.nome === checkoutData.planoSelecionado);
      const valorPlano = planoSelecionado?.valor;
      
      // Validação crítica: nunca permitir valor zero
      if (!valorPlano || valorPlano <= 0) {
        throw new Error(`Erro: Valor do plano "${checkoutData.planoSelecionado}" não encontrado ou inválido`);
      }
      
      console.log(`Criando cliente externo: ${checkoutData.nome}, plano: ${checkoutData.planoSelecionado}, valor: ${valorPlano}`);
      
      const response = await apiRequest("/api/clientes/external", "POST", {
        nome: checkoutData.nome,
        email: checkoutData.email,
        telefone: checkoutData.telefone,
        cpf: checkoutData.cpf,
        planoNome: checkoutData.planoSelecionado,
        formaPagamento: paymentMethod,
        valorMensal: valorPlano
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
    setCheckoutData(prev => ({ ...prev, planoSelecionado: plano.nome }));
    setShowCheckoutModal(true);
    toast({
      title: "Checkout iniciado",
      description: `Iniciando checkout para ${plano.nome}`,
    });
  };

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
                  {plano.detalhes?.map((detalhe, index) => (
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

        {/* Modais de checkout */}
        <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-center">Dados para Assinatura</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={checkoutData.nome}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, nome: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={checkoutData.email}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, email: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={checkoutData.telefone}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, telefone: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={checkoutData.cpf}
                  onChange={(e) => setCheckoutData(prev => ({ ...prev, cpf: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              
              <RadioGroup 
                value={checkoutData.billingType} 
                onValueChange={(value) => setCheckoutData(prev => ({ ...prev, billingType: value }))}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CREDIT_CARD" id="credit" />
                  <Label htmlFor="credit" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Cartão de Crédito
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="BOLETO" id="boleto" />
                  <Label htmlFor="boleto" className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Boleto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PIX" id="pix" />
                  <Label htmlFor="pix" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    PIX
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EXTERNAL" id="external" />
                  <Label htmlFor="external" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Pagamento Externo
                  </Label>
                </div>
              </RadioGroup>

              <Button
                onClick={() => createCheckoutMutation.mutate(checkoutData)}
                disabled={createCheckoutMutation.isPending || !checkoutData.nome || !checkoutData.email}
                className="w-full bg-primary hover:bg-primary/90 rounded-xl"
              >
                {createCheckoutMutation.isPending ? 'Processando...' : 'Continuar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showExternalPaymentModal} onOpenChange={setShowExternalPaymentModal}>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-center">Forma de Pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup value={externalPaymentMethod} onValueChange={setExternalPaymentMethod}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Dinheiro" id="dinheiro" />
                  <Label htmlFor="dinheiro">Dinheiro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Cartão Débito" id="debito" />
                  <Label htmlFor="debito">Cartão de Débito</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Cartão Crédito" id="credito-local" />
                  <Label htmlFor="credito-local">Cartão de Crédito</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PIX Local" id="pix-local" />
                  <Label htmlFor="pix-local">PIX</Label>
                </div>
              </RadioGroup>

              <Button
                onClick={() => createExternalClientMutation.mutate(externalPaymentMethod)}
                disabled={createExternalClientMutation.isPending || !externalPaymentMethod}
                className="w-full bg-primary hover:bg-primary/90 rounded-xl"
              >
                {createExternalClientMutation.isPending ? 'Cadastrando...' : 'Cadastrar Cliente'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}