import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IdleWarningModalProps {
  isOpen: boolean;
  timeLeft: string;
  onStayActive: () => void;
}

export function IdleWarningModal({ isOpen, timeLeft, onStayActive }: IdleWarningModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Sessão Expirando
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Sua sessão será encerrada por inatividade
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Tempo restante: {timeLeft}
          </h3>
          
          <p className="text-gray-600 mb-6">
            Você será desconectado automaticamente por inatividade. 
            Clique em "Continuar Ativo" para manter sua sessão.
          </p>
          
          <Button
            onClick={onStayActive}
            className="w-full bg-[#365e78] hover:bg-[#2d4a5f] text-white font-semibold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Continuar Ativo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}