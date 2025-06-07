import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { IdleLogoutManager } from "@/components/IdleLogoutManager";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";

// Pages
import Login from "@/pages/login-basico";
import AdminDashboard from "@/pages/dashboard-melhorado";
import Barbeiros from "@/pages/barbeiros";
import Profissionais from "@/pages/profissionais";
import ClientesNovo from "@/pages/clientes";
import ClientesDebug from "@/pages/clientes-debug";
import ClientesStatus from "@/pages/clientes-status";
import CadastroCliente from "@/pages/cadastro-cliente";
import SistemaModerno from "@/pages/sistema-moderno";
import Servicos from "@/pages/servicos";
import Planos from "@/pages/planos";
import Comissao from "@/pages/comissao";
import DistribuicaoNova from "@/pages/distribuicao-nova";
import TotalServicos from "@/pages/total-servicos";
import BarbeiroDashboard from "@/pages/barbeiro-dashboard-mobile";
import DashboardRecepcionista from "@/pages/dashboard-recepcionista";
import Agendamento from "@/pages/agendamento";
import Configuracoes from "@/pages/configuracoes";
import ListaDaVez from "@/pages/lista-da-vez";
import GerenciarFila from "@/pages/gerenciar-fila";
import GerenciarAssinaturas from "@/pages/gerenciar-assinaturas";
import PlanosAssinatura from "@/pages/planos-assinatura";
import TestAsaas from "@/pages/test-asaas";
import LoginNovo from "@/pages/login";
import LoginComRemember from "@/pages/login-com-remember";
import NotFound from "@/pages/not-found";
import BarbeiroAgenda from "@/pages/barbeiro-agenda-mobile-fixed";

function AuthenticatedRoutes() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  if (user.role === 'barbeiro') {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={BarbeiroDashboard} />
          <Route path="/barbeiro" component={BarbeiroDashboard} />
          <Route path="/barbeiro/agenda" component={BarbeiroAgenda} />
          <Route>
            <Redirect to="/barbeiro" />
          </Route>
        </Switch>
      </Layout>
    );
  }

  if (user.role === 'recepcionista') {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={DashboardRecepcionista} />
          <Route path="/agendamento" component={Agendamento} />
          <Route path="/clientes" component={ClientesNovo} />
          <Route path="/cadastro-cliente" component={CadastroCliente} />
          <Route path="/lista-da-vez" component={ListaDaVez} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Layout>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={AdminDashboard} />
        <Route path="/dashboard" component={AdminDashboard} />
        <Route path="/barbeiros" component={Barbeiros} />
        <Route path="/profissionais" component={Profissionais} />
        <Route path="/clientes" component={ClientesNovo} />
        <Route path="/clientes-debug" component={ClientesDebug} />
        <Route path="/clientes-status" component={ClientesStatus} />
        <Route path="/cadastro-cliente" component={CadastroCliente} />
        <Route path="/sistema-moderno" component={SistemaModerno} />
        <Route path="/servicos" component={Servicos} />
        <Route path="/planos" component={Planos} />
        <Route path="/comissao" component={Comissao} />
        <Route path="/distribuicao" component={DistribuicaoNova} />
        <Route path="/total-servicos" component={TotalServicos} />
        <Route path="/agendamento" component={Agendamento} />
        <Route path="/lista-da-vez" component={ListaDaVez} />
        <Route path="/gerenciar-fila" component={GerenciarFila} />
        <Route path="/gerenciar-assinaturas" component={GerenciarAssinaturas} />
        <Route path="/planos-assinatura" component={PlanosAssinatura} />
        <Route path="/test-asaas" component={TestAsaas} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route path="/barbeiro" component={BarbeiroDashboard} />
        <Route path="/barbeiro/agenda" component={BarbeiroAgenda} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </Layout>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

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

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginComRemember />}
      </Route>
      
      <Route path="*">
        {isAuthenticated ? (
          <>
            <AuthenticatedRoutes />
            <IdleLogoutManager 
              isAuthenticated={isAuthenticated}
              onLogout={logout}
            />
          </>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground dark">
            <AppContent />
            <Toaster />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;