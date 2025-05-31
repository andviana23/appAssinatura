import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import logoPath from "@assets/Logotipo Slogan.jpg";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function LoginAprimorado() {
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  
  const { login } = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: errorsForgot, isSubmitting: isSubmittingForgot },
    reset: resetForgot,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoginError("");
      await login({ email: data.email, password: data.password });
    } catch (error) {
      setLoginError("Email ou senha incorretos.");
    }
  };

  const onForgotPassword = async (data: ForgotPasswordFormData) => {
    try {
      // Simulação de envio de email de recuperação
      // Em produção, implementar integração real
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setForgotPasswordSent(true);
      toast({
        title: "Email enviado",
        description: "Instruções de recuperação foram enviadas para seu email.",
      });
      
      setTimeout(() => {
        setIsForgotPasswordOpen(false);
        setForgotPasswordSent(false);
        resetForgot();
      }, 3000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao enviar email de recuperação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#8B4513] to-[#A0522D] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo da Barbearia */}
        <div className="text-center mb-8">
          <img 
            src={logoPath} 
            alt="Trato de Barbados - Logo" 
            className="mx-auto h-20 w-auto mb-4 rounded-xl shadow-lg"
          />
          <h1 className="text-2xl font-bold text-white mb-2">Sistema Trato de Barbados</h1>
          <p className="text-[#DEB887]">Gestão Completa de Assinaturas</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center text-[#8B4513]">Entrar</CardTitle>
            <CardDescription className="text-center">
              Acesse sua conta para gerenciar a barbearia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loginError && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  {loginError}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="h-11 border-gray-300 focus:border-[#8B4513] focus:ring-[#8B4513]"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    className="h-11 pr-10 border-gray-300 focus:border-[#8B4513] focus:ring-[#8B4513]"
                    {...register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-[#8B4513] hover:text-[#A0522D]"
                  onClick={() => setIsForgotPasswordOpen(true)}
                >
                  Esqueci a senha
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#8B4513] hover:bg-[#A0522D] text-white font-semibold transition-all duration-200 hover:scale-105"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Problemas para acessar?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto text-[#8B4513] hover:text-[#A0522D]"
                  onClick={() => setIsForgotPasswordOpen(true)}
                >
                  Solicite ajuda
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Credenciais de Teste */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-gray-700 mb-3">Contas de Teste:</h3>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Admin:</strong> admin@tratodebarbados.com / password
              </div>
              <div>
                <strong>Barbeiro:</strong> barbeiro@tratodebarbados.com / password
              </div>
              <div>
                <strong>Recepcionista:</strong> recepcionista@tratodebarbados.com / password
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Esqueci a Senha */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#8B4513]">Recuperar Senha</DialogTitle>
          </DialogHeader>
          
          {forgotPasswordSent ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Enviado!</h3>
              <p className="text-gray-600">
                Instruções de recuperação foram enviadas para seu email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitForgot(onForgotPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="Digite seu email"
                  {...registerForgot("email")}
                />
                {errorsForgot.email && (
                  <p className="text-sm text-red-600">{errorsForgot.email.message}</p>
                )}
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsForgotPasswordOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#8B4513] hover:bg-[#A0522D]"
                  disabled={isSubmittingForgot}
                >
                  {isSubmittingForgot ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}