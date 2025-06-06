import { useState, useEffect } from "react";
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
  const isDesktop = screenSize === 'desktop';

  // Fechar menu mobile quando mudar para desktop
  useEffect(() => {
    if (isDesktop) {
      setMobileMenuOpen(false);
    }
  }, [isDesktop]);

  // Layout simples apenas para barbeiro (sem recepcionista)
  if (!isAdmin && !isRecepcionista) {
    return (
      <div className="min-h-screen bg-background text-foreground safe-area-inset">
        <Header 
          showMenuButton={false}
          onMenuToggle={() => {}}
        />
        <main className="mobile-container py-4 sm:py-6 lg:py-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Layout mobile com menu hambúrguer
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground safe-area-inset">
        <Header 
          showMenuButton={true}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        
        {/* Mobile Navigation Overlay */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed top-0 left-0 h-full w-80 bg-background z-50 shadow-xl">
              <Sidebar onClose={() => setMobileMenuOpen(false)} />
            </div>
          </>
        )}
        
        <main className="mobile-container py-4">
          {children}
        </main>
      </div>
    );
  }

  // Layout tablet com sidebar colapsável
  if (isTablet) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        <div className="hidden md:flex md:w-64 md:flex-col">
          <Sidebar />
        </div>
        
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            showMenuButton={true}
            onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
          
          {/* Tablet Navigation Overlay */}
          {mobileMenuOpen && (
            <>
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="fixed top-0 left-0 h-full w-80 bg-background z-50 shadow-xl md:hidden">
                <Sidebar onClose={() => setMobileMenuOpen(false)} />
              </div>
            </>
          )}
          
          <main className="flex-1 overflow-x-hidden px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Layout desktop com sidebar fixa
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <div className="hidden lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          showMenuButton={false}
          onMenuToggle={() => {}}
        />
        
        <main className="flex-1 overflow-x-hidden px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}