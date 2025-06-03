import { AlertCircle, Wifi, RefreshCw, Search, Users, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorIllustrationProps {
  type: 'network' | 'empty' | 'error' | 'loading' | 'notFound';
  title: string;
  description: string;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorIllustration({ type, title, description, actionButton }: ErrorIllustrationProps) {
  const getIllustration = () => {
    switch (type) {
      case 'network':
        return (
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-800/20 rounded-full flex items-center justify-center">
              <Wifi className="w-12 h-12 text-red-500 animate-pulse" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          </div>
        );
      
      case 'empty':
        return (
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 rounded-full flex items-center justify-center">
              <Search className="w-12 h-12 text-blue-500" />
            </div>
            <div className="flex justify-center space-x-1 mb-4">
              <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-orange-500 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-orange-200 dark:bg-orange-800/30 rounded-full blur-sm"></div>
          </div>
        );
      
      case 'loading':
        return (
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-12 h-12 text-green-500 animate-spin" />
            </div>
            <div className="flex justify-center space-x-1 mb-4">
              <div className="w-1 h-8 bg-green-300 rounded animate-pulse" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-6 bg-green-400 rounded animate-pulse" style={{ animationDelay: '100ms' }}></div>
              <div className="w-1 h-8 bg-green-500 rounded animate-pulse" style={{ animationDelay: '200ms' }}></div>
              <div className="w-1 h-4 bg-green-300 rounded animate-pulse" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        );
      
      case 'notFound':
        return (
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 rounded-full flex items-center justify-center">
              <Users className="w-12 h-12 text-purple-500" />
            </div>
            <div className="absolute -top-3 -left-3 w-8 h-8 bg-purple-100 dark:bg-purple-800/30 rounded-full animate-ping opacity-75"></div>
            <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-purple-200 dark:bg-purple-700/30 rounded-full animate-ping opacity-75" style={{ animationDelay: '1s' }}></div>
          </div>
        );
      
      default:
        return (
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center">
            <Database className="w-12 h-12 text-gray-500" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {getIllustration()}
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md leading-relaxed">
        {description}
      </p>
      
      {actionButton && (
        <Button 
          onClick={actionButton.onClick}
          variant="outline"
          className="flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <RefreshCw className="w-4 h-4" />
          {actionButton.label}
        </Button>
      )}
    </div>
  );
}

// Predefined error states for common scenarios
export const EmptyClientsState = ({ onRefresh }: { onRefresh: () => void }) => (
  <ErrorIllustration
    type="empty"
    title="Nenhum cliente encontrado"
    description="Não foram encontrados clientes para o período selecionado. Tente alterar o filtro de mês ou sincronizar novamente com o Asaas."
    actionButton={{
      label: "Atualizar lista",
      onClick: onRefresh
    }}
  />
);

export const NetworkErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <ErrorIllustration
    type="network"
    title="Erro de conexão"
    description="Não foi possível conectar com os servidores do Asaas. Verifique sua conexão com a internet e tente novamente."
    actionButton={{
      label: "Tentar novamente",
      onClick: onRetry
    }}
  />
);

export const LoadingClientsState = () => (
  <ErrorIllustration
    type="loading"
    title="Carregando clientes..."
    description="Sincronizando dados das contas Asaas. Isso pode levar alguns segundos."
  />
);

export const GenericErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <ErrorIllustration
    type="error"
    title="Algo deu errado"
    description="Ocorreu um erro inesperado ao carregar os dados. Nossa equipe foi notificada e está trabalhando para resolver."
    actionButton={{
      label: "Recarregar",
      onClick: onRetry
    }}
  />
);

export const NoDataForMonthState = ({ selectedMonth, onChangeMonth }: { 
  selectedMonth: string; 
  onChangeMonth: () => void;
}) => (
  <ErrorIllustration
    type="notFound"
    title="Sem dados para este mês"
    description={`Não há informações de clientes disponíveis para ${selectedMonth}. Tente selecionar outro período.`}
    actionButton={{
      label: "Alterar período",
      onClick: onChangeMonth
    }}
  />
);