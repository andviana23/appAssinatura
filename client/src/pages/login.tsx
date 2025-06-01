import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Scissors } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#8B4513] via-[#A0522D] to-[#8B4513] p-6">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="mx-auto h-20 w-20 bg-gradient-to-r from-[#8B4513] to-[#A0522D] rounded-3xl flex items-center justify-center shadow-lg">
            <Scissors className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[#8B4513] mb-2">Trato de Barbados</h1>
            <p className="text-gray-600 text-lg font-medium">Sistema de Gestão</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-semibold">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                required
                className="h-12 text-lg border-2 border-gray-200 focus:border-[#8B4513] focus:ring-[#8B4513] rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-semibold">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                className="h-12 text-lg border-2 border-gray-200 focus:border-[#8B4513] focus:ring-[#8B4513] rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-bold bg-gradient-to-r from-[#8B4513] to-[#A0522D] hover:from-[#A0522D] hover:to-[#8B4513] text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Entrando..." : "ENTRAR"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 font-medium">
              TrotoTech © 2025
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
