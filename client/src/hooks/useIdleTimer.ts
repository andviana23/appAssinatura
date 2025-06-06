import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';

interface UseIdleTimerProps {
  timeout: number; // tempo em millisegundos
  onIdle: () => void;
  events?: string[];
}

export const useIdleTimer = ({ timeout, onIdle, events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'] }: UseIdleTimerProps) => {
  const timeoutId = useRef<NodeJS.Timeout>();
  const [location] = useLocation();

  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    
    timeoutId.current = setTimeout(() => {
      onIdle();
    }, timeout);
  }, [timeout, onIdle]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Iniciar o timer
    resetTimer();

    // Adicionar event listeners para atividades do usuário
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      // Limpar timeout
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      
      // Remover event listeners
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [events, handleActivity, resetTimer]);

  // Resetar timer quando a rota mudar
  useEffect(() => {
    resetTimer();
  }, [location, resetTimer]);

  return { resetTimer };
};