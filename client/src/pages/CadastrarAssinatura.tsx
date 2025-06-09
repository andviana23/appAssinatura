import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AssinaturaPayload {
  nome: string;
  categoria: string;
  valor: number;
}

interface FormProps {
  onSuccess?: () => void;
}

function AssinaturaForm({ onSuccess }: FormProps) {
  const { toast } = useToast();
  const [data, setData] = useState<AssinaturaPayload>({
    nome: "",
    categoria: "",
    valor: 0,
  });
  const handleChange = (
    field: keyof AssinaturaPayload,
    value: string,
  ) => {
    setData((prev) => ({
      ...prev,
      [field]: field === "valor" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/planos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar assinatura");
      toast({
        title: "Sucesso",
        description: "Assinatura criada com sucesso",
      });
      setData({ nome: "", categoria: "", valor: 0 });
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao criar assinatura",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome da Assinatura</Label>
        <Input
          id="nome"
          value={data.nome}
          onChange={(e) => handleChange("nome", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select
          value={data.categoria}
          onValueChange={(value) => handleChange("categoria", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="One">One</SelectItem>
            <SelectItem value="Mult">Mult</SelectItem>
            <SelectItem value="Gold">Gold</SelectItem>
            <SelectItem value="Exclusiva">Exclusiva</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="valor">Valor da Assinatura</Label>
        <Input
          id="valor"
          type="number"
          step="0.01"
          value={data.valor ? data.valor : ""}
          onChange={(e) => handleChange("valor", e.target.value)}
        />
      </div>
      <Button type="submit">Salvar</Button>
    </form>
  );
}

export default function CadastrarAssinatura() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Criar assinatura</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Novo Plano de Assinatura</DialogTitle>
          </DialogHeader>
          <AssinaturaForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
