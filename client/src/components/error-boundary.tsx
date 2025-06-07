import { Component, ReactNode, ComponentType, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<{ error: Error; retry: () => void }>;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      return <DefaultErrorFallback error={this.state.error!} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

export function DefaultErrorFallback({ error, retry }: ErrorFallbackProps) {
  const isChunkError = error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError');
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Playful Error Illustration */}
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-500 animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-3 bg-red-200 dark:bg-red-800/20 rounded-full blur-sm opacity-50"></div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {isChunkError ? 'Nova versão disponível' : 'Algo deu errado'}
              </h2>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isChunkError 
                  ? 'Uma nova versão do sistema foi implantada. Atualize a página para continuar.'
                  : 'Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente.'
                }
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button 
                onClick={() => window.location.reload()} 
                className="flex-1 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {isChunkError ? 'Atualizar página' : 'Recarregar'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/'} 
                className="flex-1 flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Ir ao início
              </Button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="w-full mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono text-left overflow-auto max-h-32">
                  <div className="text-red-600 dark:text-red-400 font-semibold mb-1">
                    {error.name}: {error.message}
                  </div>
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {error.stack}
                  </div>
                </div>
              </details>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Specialized error boundary for async operations
export function AsyncErrorBoundary({ children, onError }: { 
  children: ReactNode; 
  onError?: (error: Error) => void;
}) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          
          <h3 className="text-lg font-semibold mb-2">Falha no carregamento</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Não foi possível carregar este conteúdo. Verifique sua conexão e tente novamente.
          </p>
          
          <Button onClick={retry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}