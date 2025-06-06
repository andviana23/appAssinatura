import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './use-auth';
import { useLocation } from 'wouter';

interface UseIdleTimerOptions {
  timeout: number; // em milissegundos
  warningTime?: number; // tempo antes do logout para mostrar aviso
  onIdle?: () => void;
  onActive?: () => void;
  onWarning?: () => void;
}

export function useIdleTimer({
  timeout = 10 * 60 * 1000, // 10 minutos padrão
  warningTime = 1 * 60 * 1000, // 1 minuto antes do logout
  onIdle,
  onActive,
  onWarning
}: UseIdleTimerOptions) {
  const [isIdle, setIsIdle] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();
  const { logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Eventos que resetam o timer de inatividade
  const events = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ];

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;

    // Limpa todos os timers existentes
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Reset states
    setIsIdle(false);
    setShowWarning(false);
    setTimeLeft(0);

    if (onActive) onActive();

    // Timer para mostrar aviso
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeLeft(warningTime);
      if (onWarning) onWarning();

      // Countdown para o warning
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1000) {
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }, timeout - warningTime);

    // Timer para logout automático
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true);
      setShowWarning(false);
      if (onIdle) onIdle();
      
      // Faz logout e redireciona
      logout();
      setLocation('/');
    }, timeout);
  }, [isAuthenticated, timeout, warningTime, onIdle, onActive, onWarning, logout, setLocation]);

  const dismissWarning = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Limpa timers se não estiver autenticado
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setIsIdle(false);
      setShowWarning(false);
      return;
    }

    // Adiciona event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // Inicia o timer
    resetTimer();

    return () => {
      // Remove event listeners
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      
      // Limpa timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAuthenticated, resetTimer]);

  const formatTime = useCallback((milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  }, []);

  return {
    isIdle,
    showWarning,
    timeLeft: formatTime(timeLeft),
    timeLeftMs: timeLeft,
    dismissWarning,
    resetTimer
  };
}