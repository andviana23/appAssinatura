import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useIdleTimer } from "@/hooks/use-idle-timer";
import { IdleWarningModal } from "@/components/idle-warning-modal";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

// Pages
import Login from "@/pages/login-aprimorado";
import AdminDashboard from "@/pages/dashboard-melhorado";
import Barbeiros from "@/pages/barbeiros";
import Profissionais from "@/pages/profissionais";
import Clientes from "@/pages/clientes";
import Servicos from "@/pages/servicos";
import Planos from "@/pages/planos";
import DistribuicaoNova from "@/pages/distribuicao-nova";
import TotalServicos from "@/pages/total-servicos";
import BarbeiroDashboard from "@/pages/barbeiro-dashboard-final";
import RecepcionistaDashboard from "@/pages/recepcionista-dashboard";
import Agendamento from "@/pages/agendamento";
import Configuracoes from "@/pages/configuracoes";
import ListaDaVez from "@/pages/lista-da-vez";
import GerenciarFila from "@/pages/gerenciar-fila";
import NotFound from "@/pages/not-found";

function AuthenticatedRoutes() {
  const { user, isAdmin, isBarbeiro, isRecepcionista } = useAuth();

  if (isAdmin) {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={AdminDashboard} />
          <Route path="/dashboard" component={AdminDashboard} />
          <Route path="/barbeiros" component={Barbeiros} />
          <Route path="/profissionais" component={Profissionais} />
          <Route path="/profissionais/novo" component={Profissionais} />
          <Route path="/profissionais/editar/:id" component={Profissionais} />
          <Route path="/clientes" component={Clientes} />
          <Route path="/servicos" component={Servicos} />
          <Route path="/planos" component={Planos} />
          <Route path="/agendamento" component={Agendamento} />
          <Route path="/distribuicao" component={DistribuicaoNova} />
          <Route path="/relatorio" component={TotalServicos} />
          <Route path="/relatorios" component={TotalServicos} />
          <Route path="/total-servicos" component={TotalServicos} />
          <Route path="/lista-da-vez" component={ListaDaVez} />
          <Route path="/gerenciar-fila" component={GerenciarFila} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // Verificar se é barbeiro
  if (isBarbeiro) {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={BarbeiroDashboard} />
          <Route path="/barbeiro" component={BarbeiroDashboard} />
          <Route path="/lista-da-vez" component={ListaDaVez} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Layout>
    );
  }

  // Verificar se é recepcionista
  if (isRecepcionista) {
    return (
      <Switch>
        <Route path="/" component={RecepcionistaDashboard} />
        <Route path="/recepcionista-dashboard" component={RecepcionistaDashboard} />
        <Route path="/agendamento" component={Agendamento} />
        <Route path="/clientes" component={Clientes} />
        <Route path="/planos" component={Planos} />
        <Route path="/lista-da-vez" component={ListaDaVez} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  // Fallback para outros usuários
  return (
    <Layout>
      <Switch>
        <Route path="/" component={AdminDashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  // Timer de inatividade - 10 minutos com aviso 1 minuto antes
  const { showWarning, timeLeft, dismissWarning } = useIdleTimer({
    timeout: 10 * 60 * 1000, // 10 minutos
    warningTime: 1 * 60 * 1000, // 1 minuto de aviso
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-16 w-16 rounded-2xl mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <AuthenticatedRoutes />
      
      {/* Modal de aviso de inatividade */}
      <IdleWarningModal
        isOpen={showWarning}
        timeLeft={timeLeft}
        onStayActive={dismissWarning}
      />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <AppContent />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
