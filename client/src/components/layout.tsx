import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return null;
  }

  // Layout diferente para barbeiro
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto p-24 max-w-7xl">
          {children}
        </main>
      </div>
    );
  }

  // Layout admin com sidebar
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-24">
          {children}
        </main>
      </div>
    </div>
  );
}
