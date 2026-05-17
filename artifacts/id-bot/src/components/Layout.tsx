import { Link, useLocation } from "wouter";
import { Server, Users, Activity, Settings, Network } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/ids", label: "Generated IDs", icon: Users },
    { href: "/batches", label: "Batches", icon: Server },
    { href: "/proxies", label: "Proxies", icon: Network },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground font-mono selection:bg-primary/30">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Server className="w-6 h-6 text-primary mr-3" />
          <h1 className="font-bold tracking-tight text-lg">ID_BOT<span className="text-primary animate-pulse">_</span></h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center px-3 py-2.5 rounded-md text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                <item.icon className={`w-4 h-4 mr-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex items-center text-xs">
            <div className={`w-2 h-2 rounded-full mr-2 ${health?.status === 'ok' ? 'bg-primary shadow-[0_0_8px_rgba(20,184,102,0.8)]' : 'bg-destructive shadow-[0_0_8px_rgba(200,20,20,0.8)]'}`} />
            <span className="text-muted-foreground uppercase tracking-wider">
              {health?.status === 'ok' ? 'System Online' : 'System Offline'}
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm z-10 sticky top-0 shrink-0">
          <div className="text-sm text-muted-foreground">
            {location === '/' ? '~/dashboard' : `~${location}`}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-4">
            <span>UPTIME: 99.9%</span>
            <span>V 0.1.0</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
