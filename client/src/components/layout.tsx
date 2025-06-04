import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useScreenSize } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const screenSize = useScreenSize();

  if (!user) {
    return null;
  }

  const isMobile = screenSize === 'mobile';
  const isTablet = screenSize === 'tablet';

  // Layout diferente para barbeiro
  if (!isAdmin) {
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

  // Layout responsivo para admin
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

  // Layout desktop/tablet - Estrutura fixa conforme vídeo
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header fixo no topo */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-card border-b border-border/50 shadow-sm">
        <Header 
          showMenuButton={false}
          onMenuToggle={() => {}}
        />
      </div>
      
      <div className="flex flex-1 pt-16"> {/* pt-16 para compensar header fixo */}
        {/* Sidebar fixo na lateral */}
        <div className="fixed left-0 top-16 bottom-0 z-30 bg-card border-r border-border/50 shadow-lg">
          <Sidebar collapsed={false} />
        </div>
        
        {/* Área de conteúdo central com rolagem */}
        <div className="flex-1 ml-72"> {/* ml-72 para compensar sidebar */}
          <main className="h-full overflow-y-auto bg-background">
            <div className="container-responsive py-6 px-6">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
