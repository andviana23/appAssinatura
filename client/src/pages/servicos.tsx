import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Clock, Scissors, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { Servico } from "@shared/schema";

interface ServicoFormData {
  nome: string;
  tempoMinutos: number;
}

export default function Servicos() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ServicoFormData>({
    nome: "",
    tempoMinutos: 30,
  });

  const { data: servicos, isLoading } = useQuery<Servico[]>({
    queryKey: ["/api/servicos"],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Apenas estrutura visual - não implementar lógica de cadastro ainda
    console.log("Formulário submetido:", formData);
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ nome: "", tempoMinutos: 30 });
  };

  const openDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-6">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Serviços</h1>
              <p className="text-lg text-muted-foreground">
                Gerencie os serviços oferecidos pela barbearia
              </p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={openDialog}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-0 shadow-2xl rounded-2xl">
                <DialogHeader className="space-y-4 pb-6">
                  <DialogTitle className="text-2xl font-bold text-center text-foreground">
                    Novo Serviço
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="nome" className="text-sm font-semibold text-foreground">
                      Nome do Serviço
                    </Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Corte Masculino"
                      className="h-12 rounded-xl border-2 border-border focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="tempo" className="text-sm font-semibold text-foreground">
                      Tempo do Serviço
                    </Label>
                    <Select 
                      value={formData.tempoMinutos.toString()} 
                      onValueChange={(value) => setFormData({ ...formData, tempoMinutos: parseInt(value) })}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-2 border-border focus:border-primary">
                        <SelectValue placeholder="Selecione o tempo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1h 30min</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <DialogFooter className="flex gap-3 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1 h-12 rounded-xl border-2 hover:bg-muted font-semibold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Cadastrar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista de Serviços */}
        <div className="space-y-6">
          {servicos && servicos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servicos.map((servico) => (
                <Card 
                  key={servico.id} 
                  className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border-0 shadow-lg rounded-2xl overflow-hidden"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                        <Scissors className="h-6 w-6 text-white" />
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="bg-primary/10 text-primary border-0 px-3 py-1 rounded-full font-semibold"
                      >
                        #{servico.id}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {servico.nome}
                      </h3>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{servico.tempoMinutos} minutos</span>
                      </div>
                    </div>
                    
                    {servico.percentualComissao && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Comissão</span>
                          <Badge className="bg-green-100 text-green-700 border-0 rounded-full">
                            {Number(servico.percentualComissao)}%
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-12 text-center space-y-4">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Scissors className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Nenhum serviço cadastrado</h3>
                  <p className="text-muted-foreground">
                    Comece cadastrando o primeiro serviço da sua barbearia
                  </p>
                </div>
                <Button 
                  onClick={openDialog}
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Cadastrar Primeiro Serviço
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}