import { Search, Filter, Calendar, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
        {icon || <Search className="w-8 h-8 text-muted-foreground" />}
      </div>
      
      <h3 className="text-lg font-semibold mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">
        {description}
      </p>
      
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Predefined empty states for common scenarios
export const NoSearchResults = ({ searchTerm, onClear }: { searchTerm: string; onClear: () => void }) => (
  <EmptyState
    icon={<Search className="w-8 h-8 text-blue-500" />}
    title="Nenhum resultado encontrado"
    description={`Não encontramos resultados para "${searchTerm}". Tente usar termos diferentes ou verifique a ortografia.`}
    action={{
      label: "Limpar busca",
      onClick: onClear
    }}
  />
);

export const NoFilterResults = ({ onReset }: { onReset: () => void }) => (
  <EmptyState
    icon={<Filter className="w-8 h-8 text-purple-500" />}
    title="Nenhum item com estes filtros"
    description="Não há dados que correspondam aos filtros aplicados. Tente ajustar os critérios de filtragem."
    action={{
      label: "Limpar filtros",
      onClick: onReset
    }}
  />
);

export const NoDataForPeriod = ({ period, onChangePeriod }: { period: string; onChangePeriod: () => void }) => (
  <EmptyState
    icon={<Calendar className="w-8 h-8 text-orange-500" />}
    title="Sem dados neste período"
    description={`Não há informações disponíveis para ${period}. Selecione um período diferente para visualizar os dados.`}
    action={{
      label: "Alterar período",
      onClick: onChangePeriod
    }}
  />
);

export const FirstTimeSetup = ({ onGetStarted }: { onGetStarted: () => void }) => (
  <EmptyState
    icon={<Zap className="w-8 h-8 text-yellow-500" />}
    title="Vamos começar!"
    description="Parece que você é novo por aqui. Configure sua conta para começar a usar todas as funcionalidades."
    action={{
      label: "Configurar agora",
      onClick: onGetStarted
    }}
  />
);

export const NoClientsYet = ({ onAddClient }: { onAddClient: () => void }) => (
  <EmptyState
    icon={<Users className="w-8 h-8 text-green-500" />}
    title="Nenhum cliente cadastrado"
    description="Adicione seu primeiro cliente para começar a gerenciar agendamentos e pagamentos."
    action={{
      label: "Adicionar cliente",
      onClick: onAddClient
    }}
  />
);