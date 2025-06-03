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

  // Layout desktop/tablet
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar collapsed={isTablet} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          showMenuButton={false}
          onMenuToggle={() => {}}
        />
        <main className={`flex-1 overflow-y-auto container-responsive ${isTablet ? 'py-4' : 'py-6'}`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
