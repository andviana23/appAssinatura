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
import Clientes from "@/pages/clientes";
import Servicos from "@/pages/servicos";
import Planos from "@/pages/planos";
import Distribuicao from "@/pages/distribuicao";
import TotalServicos from "@/pages/total-servicos";
import BarbeiroDashboard from "@/pages/barbeiro-dashboard";
import RecepcionistaDashboard from "@/pages/recepcionista-dashboard";
import Agendamento from "@/pages/agendamento";
import NotFound from "@/pages/not-found";

function AuthenticatedRoutes() {
  const { user, isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={AdminDashboard} />
          <Route path="/dashboard" component={AdminDashboard} />
          <Route path="/barbeiros" component={Barbeiros} />
          <Route path="/clientes" component={Clientes} />
          <Route path="/servicos" component={Servicos} />
          <Route path="/planos" component={Planos} />
          <Route path="/agendamento" component={Agendamento} />
          <Route path="/distribuicao" component={Distribuicao} />
          <Route path="/relatorios" component={TotalServicos} />
          <Route path="/total-servicos" component={TotalServicos} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // Verificar se é barbeiro
  if (user?.role === "barbeiro") {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={BarbeiroDashboard} />
          <Route path="/barbeiro" component={BarbeiroDashboard} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Layout>
    );
  }

  // Verificar se é recepcionista
  if (user?.role === "recepcionista") {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={RecepcionistaDashboard} />
          <Route path="/recepcionista" component={RecepcionistaDashboard} />
          <Route path="/agendamento" component={Agendamento} />
          <Route path="/clientes" component={Clientes} />
          <Route path="/planos" component={Planos} />
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
