import { useEffect } from 'react';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface IdleLogoutManagerProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

export const IdleLogoutManager = ({ isAuthenticated, onLogout }: IdleLogoutManagerProps) => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleIdle = () => {
    if (isAuthenticated) {
      // Fazer logout
      onLogout();
      
      // Mostrar notificação
      toast({
        title: "Sessão expirada",
        description: "Você foi desconectado por inatividade.",
        variant: "destructive",
      });
      
      // Redirecionar para login
      setLocation('/login');
    }
  };

  useIdleTimer({
    timeout: 10 * 60 * 1000, // 10 minutos
    onIdle: handleIdle,
    events: [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
      'change',
      'input',
      'submit'
    ]
  });

  return null; // Componente invisível
};