import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

// Pages
import Login from "@/pages/login-aprimorado";
import AdminDashboard from "@/pages/admin-dashboard-clean";
import Barbeiros from "@/pages/barbeiros";
import Profissionais from "@/pages/profissionais";
import Clientes from "@/pages/clientes";
import Servicos from "@/pages/servicos";
import Planos from "@/pages/planos";
import Distribuicao from "@/pages/distribuicao";
import TotalServicos from "@/pages/total-servicos";
import BarbeiroDashboard from "@/pages/barbeiro-dashboard";
import RecepcionistaDashboard from "@/pages/recepcionista-dashboard";
import Agendamento from "@/pages/agendamento";
import Configuracoes from "@/pages/configuracoes";
import ListaDaVezRecepcionista from "@/pages/lista-da-vez-recepcionista";
import ListaDaVezBarbeiro from "@/pages/lista-da-vez-barbeiro";
import ListaDaVezMensal from "@/pages/lista-da-vez-mensal";
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
          <Route path="/distribuicao" component={Distribuicao} />
          <Route path="/relatorios" component={TotalServicos} />
          <Route path="/total-servicos" component={TotalServicos} />
          <Route path="/lista-da-vez" component={ListaDaVezRecepcionista} />
          <Route path="/lista-da-vez-mensal" component={ListaDaVezMensal} />
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
          <Route path="/lista-da-vez" component={ListaDaVezBarbeiro} />
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
      <Layout>
        <Switch>
          <Route path="/" component={RecepcionistaDashboard} />
          <Route path="/recepcionista" component={RecepcionistaDashboard} />
          <Route path="/agendamento" component={Agendamento} />
          <Route path="/clientes" component={Clientes} />
          <Route path="/planos" component={Planos} />
          <Route path="/lista-da-vez" component={ListaDaVezRecepcionista} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Layout>
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

  return <AuthenticatedRoutes />;
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
