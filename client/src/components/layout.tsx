import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useScreenSize } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, isAdmin, isRecepcionista } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const screenSize = useScreenSize();

  if (!user) {
    return null;
  }

  const isMobile = screenSize === 'mobile';
  const isTablet = screenSize === 'tablet';

  // Layout simples apenas para barbeiro (sem recepcionista)
  if (!isAdmin && !isRecepcionista) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header 
          showMenuButton={false}
          onMenuToggle={() => {}}
        />
        <main className="container-responsive py-4 sm:py-6 lg:py-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Layout responsivo para admin e recepcionista
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header 
          showMenuButton={true}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        
        {/* Mobile Navigation Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div 
              className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-card shadow-2xl border-r border-border"
              onClick={e => e.stopPropagation()}
            >
              <Sidebar 
                mobile={true}
                onClose={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}
        
        <main className="container-responsive py-4 pb-20">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Layout desktop/tablet - Estrutura sem sobreposições
  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar fixo na lateral esquerda */}
      <div className="w-72 flex-shrink-0 bg-card border-r border-border/50 shadow-lg overflow-y-auto">
        <Sidebar collapsed={false} />
      </div>
      
      {/* Área principal com header e conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header fixo no topo da área principal */}
        <div className="flex-shrink-0 bg-card border-b border-border/50 shadow-sm">
          <Header 
            showMenuButton={false}
            onMenuToggle={() => {}}
          />
        </div>
        
        {/* Área de conteúdo central com rolagem independente */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
