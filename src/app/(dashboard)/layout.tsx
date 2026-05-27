import { FileText } from 'lucide-react';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-foreground/10 bg-sidebar-bg text-sidebar-foreground">
        <div className="flex items-center gap-3 p-6 border-b border-sidebar-foreground/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-glow-accent">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">CSR Publishing</h1>
            <p className="text-xs text-sidebar-foreground/50">by TraceScribe</p>
          </div>
        </div>
        <SidebarNav />
      </aside>

      {/* Main content */}
      <main className="relative flex-1 overflow-auto bg-background">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="pointer-events-none absolute -top-32 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative p-8">{children}</div>
      </main>
    </div>
  );
}
