import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ExternalLink, CreditCard, Sparkles, RefreshCw, TestTube, Banknote, QrCode, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState } from "react";

// Função para máscara de telefone
const formatPhone = (value: string) => {
  if (!value) return '';
  const numericValue = value.replace(/\D/g, '');
  if (numericValue.length <= 11) {
    return numericValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
  return value;
};

interface PlanoAsaas {
  id: string;
  nome: string;
  valor: number;
  valorMensal?: string;
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
    planoSelecionado: null as any,
    formaPagamento: 'CREDIT_CARD'
  });
  const [externalPaymentMethod, setExternalPaymentMethod] = useState('');

  // Buscar planos personalizados do banco de dados
  const { data: planosPersonalizados = [], isLoading: loadingPersonalizados } = useQuery({
    queryKey: ['/api/planos-assinatura'],
    queryFn: async () => {
      const response = await apiRequest('/api/planos-assinatura');
      return response.json();
    }
  });

  // Buscar planos do Asaas
  const { data: planosAsaas = [], isLoading: loadingAsaas } = useQuery({
    queryKey: ['/api/asaas/planos'],
    queryFn: async () => {
      const response = await apiRequest('/api/asaas/planos');
      return response.json();
    }
  });

  // Organizar todos os planos reais por categoria
  const organizarPlanosPorCategoria = () => {
    const categorias = {
      one: [] as any[],
      gold: [] as any[],
      multi: [] as any[],
      exclusivo: [] as any[],
      outros: [] as any[]
    };

    // Adicionar planos personalizados
    planosPersonalizados.forEach((plano: any) => {
      const planoFormatado = {
        ...plano,
        valor: parseFloat(plano.valorMensal),
        categoria: plano.categoria || 'Geral',
        detalhes: [plano.descricao || 'Assinatura mensal'],
        popular: false
      };

      if (plano.categoria?.toLowerCase().includes('one')) {
        categorias.one.push(planoFormatado);
      } else if (plano.categoria?.toLowerCase().includes('gold')) {
        categorias.gold.push(planoFormatado);
      } else if (plano.categoria?.toLowerCase().includes('multi')) {
        categorias.multi.push(planoFormatado);
      } else if (plano.categoria?.toLowerCase().includes('exclusiv')) {
        categorias.exclusivo.push(planoFormatado);
      } else {
        categorias.outros.push(planoFormatado);
      }
    });

    // Adicionar planos do Asaas
    planosAsaas.forEach((plano: PlanoAsaas) => {
      const planoFormatado = {
        ...plano,
        categoria: plano.nome.includes('Gold') ? 'Gold' : 
                   plano.nome.includes('Multi') || plano.nome.includes('2x') || plano.nome.includes('4x') ? 'Multi' : 
                   plano.nome.includes('One') ? 'One' :
                   plano.nome.includes('clientes antigo') ? 'Exclusivo' : 'Geral',
        detalhes: plano.descricao ? [plano.descricao] : ['Assinatura mensal', 'Serviços inclusos'],
        popular: plano.nome.includes('Gold')
      };

      if (planoFormatado.categoria === 'One') {
        categorias.one.push(planoFormatado);
      } else if (planoFormatado.categoria === 'Gold') {
        categorias.gold.push(planoFormatado);
      } else if (planoFormatado.categoria === 'Multi') {
        categorias.multi.push(planoFormatado);
      } else if (planoFormatado.categoria === 'Exclusivo') {
        categorias.exclusivo.push(planoFormatado);
      } else {
        categorias.outros.push(planoFormatado);
      }
    });

    return categorias;
  };

  const planosData = organizarPlanosPorCategoria();
  const isLoading = loadingPersonalizados || loadingAsaas;

  // Flatten all plans for filtering
  const allPlanos = Object.values(planosData).flat();
  
  const getFilteredPlanos = () => {
    if (selectedCategory === 'todos') return allPlanos;
    return planosData[selectedCategory as keyof typeof planosData] || [];
  };

  const createCheckoutMutation = useMutation({
    mutationFn: async (formData: typeof checkoutData) => {
      if (formData.formaPagamento === 'EXTERNAL') {
        // Para pagamento externo, apenas cadastrar cliente no sistema
        const response = await apiRequest("/api/clientes-externos", "POST", {
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone,
          planoNome: formData.planoSelecionado?.nome || '',
          planoValor: formData.planoSelecionado?.valorMensal || formData.planoSelecionado?.valor || '0',
          formaPagamento: 'EXTERNAL',
          origem: 'checkout_externo'
        });
        
        const result = await response.json();
        return { external: true, cliente: result };
      }
      
      // Para cartão de crédito, primeiro criar cliente e depois assinatura
      const planoSelecionado = formData.planoSelecionado;
      if (!planoSelecionado) {
        throw new Error('Plano não selecionado');
      }
      
      // 1. Criar cliente no Asaas
      const clienteResponse = await apiRequest("/api/asaas/criar-cliente", "POST", {
        name: formData.nome,
        email: formData.email,
        mobilePhone: formData.telefone
      });
      
      const clienteData = await clienteResponse.json();
      if (!clienteData.success) {
        throw new Error(clienteData.error || 'Erro ao criar cliente');
      }
      
      // 2. Criar assinatura
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);
      
      const response = await apiRequest("/api/asaas/criar-assinatura", "POST", {
        customer: clienteData.customer.id,
        billingType: 'CREDIT_CARD',
        value: planoSelecionado.valorMensal || planoSelecionado.valor,
        nextDueDate: dataVencimento.toISOString().split('T')[0],
        description: `Assinatura ${planoSelecionado.nome}`,
        cycle: 'MONTHLY'
      });
      
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      if (data.external) {
        setShowExternalPaymentModal(true);
        setShowCheckoutModal(false);
        toast({
          title: "Cliente cadastrado!",
          description: "Agora escolha o método de pagamento externo.",
        });
      } else if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        toast({
          title: "Checkout criado!",
          description: "Redirecionando para pagamento...",
        });
        setShowCheckoutModal(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar checkout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const externalPaymentMutation = useMutation({
    mutationFn: async ({ method }: { method: string }) => {
      const response = await apiRequest("/api/clientes-externos/finalizar-pagamento", "POST", {
        nome: checkoutData.nome,
        email: checkoutData.email,
        telefone: checkoutData.telefone,
        planoNome: checkoutData.planoSelecionado?.nome || '',
        planoValor: checkoutData.planoSelecionado?.valorMensal || checkoutData.planoSelecionado?.valor || '0',
        formaPagamento: method,
        origem: 'checkout_externo'
      });
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pagamento registrado!",
        description: "Cliente cadastrado com sucesso no sistema.",
      });
      setShowExternalPaymentModal(false);
      setLocation('/clientes');
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssinar = (plano: PlanoAsaas) => {
    setCheckoutData(prev => ({ ...prev, planoSelecionado: plano }));
    setShowCheckoutModal(true);
  };

  const handleSubmitCheckout = () => {
    if (!checkoutData.nome || !checkoutData.email || !checkoutData.telefone) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, email e telefone",
        variant: "destructive"
      });
      return;
    }

    createCheckoutMutation.mutate(checkoutData);
  };

  const handleExternalPayment = () => {
    if (!externalPaymentMethod) {
      toast({
        title: "Selecione um método",
        description: "Escolha o método de pagamento",
        variant: "destructive"
      });
      return;
    }

    externalPaymentMutation.mutate({ method: externalPaymentMethod });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
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
        </div>

        {/* Planos Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-96">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-1/3 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFilteredPlanos().map((plano, index) => (
              <Card key={`${plano.id || plano.nome}-${index}`} className="relative hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20">
                {plano.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl font-bold text-primary">
                    {plano.nome}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {plano.categoria}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center space-y-4">
                  <div className="space-y-1">
                    <div className="text-4xl font-bold text-foreground">
                      {formatCurrency(plano.valor || parseFloat(plano.valorMensal || '0'))}
                    </div>
                    <div className="text-sm text-muted-foreground">por mês</div>
                  </div>
                  
                  <div className="space-y-2 text-left">
                    {plano.detalhes?.map((detalhe, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        {detalhe}
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    className="w-full mt-6" 
                    onClick={() => handleAssinar(plano)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Assinar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Checkout */}
        <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Finalizar Assinatura</DialogTitle>
              <DialogDescription>
                Plano: {checkoutData.planoSelecionado?.nome}
                <br />
                Valor: {formatCurrency(checkoutData.planoSelecionado?.valor || parseFloat(checkoutData.planoSelecionado?.valorMensal || '0'))} / mês
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  value={checkoutData.nome}
                  onChange={(e) => setCheckoutData({...checkoutData, nome: e.target.value})}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={checkoutData.email}
                  onChange={(e) => setCheckoutData({...checkoutData, email: e.target.value})}
                  placeholder="seu@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={checkoutData.telefone}
                  onChange={(e) => setCheckoutData({...checkoutData, telefone: formatPhone(e.target.value)})}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <RadioGroup
                  value={checkoutData.formaPagamento}
                  onValueChange={(value) => setCheckoutData({...checkoutData, formaPagamento: value})}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CREDIT_CARD" id="credit" />
                    <Label htmlFor="credit" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Cartão de Crédito (Checkout Asaas)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="EXTERNAL" id="external" />
                    <Label htmlFor="external" className="flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      Pagamento Externo
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowCheckoutModal(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleSubmitCheckout}
                  disabled={createCheckoutMutation.isPending}
                >
                  {createCheckoutMutation.isPending ? 'Processando...' : 'Continuar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Pagamento Externo */}
        <Dialog open={showExternalPaymentModal} onOpenChange={setShowExternalPaymentModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Método de Pagamento</DialogTitle>
              <DialogDescription>
                Como o pagamento foi realizado?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <RadioGroup
                value={externalPaymentMethod}
                onValueChange={setExternalPaymentMethod}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DEBIT" id="debit" />
                  <Label htmlFor="debit" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Cartão de Débito
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PIX" id="pix" />
                  <Label htmlFor="pix" className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    PIX
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CASH" id="cash" />
                  <Label htmlFor="cash" className="flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Dinheiro
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowExternalPaymentModal(false)}
                >
                  Voltar
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleExternalPayment}
                  disabled={externalPaymentMutation.isPending}
                >
                  {externalPaymentMutation.isPending ? 'Finalizando...' : 'Finalizar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}