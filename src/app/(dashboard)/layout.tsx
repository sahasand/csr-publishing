import Link from 'next/link';
import { FileText, FolderTree, Settings, LayoutDashboard } from 'lucide-react';

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
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent shadow-glow-accent" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">CSR Publishing</h1>
          </div>
        </div>
        <nav className="px-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/studies"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
          >
            <FileText className="h-4 w-4" />
            Studies
          </Link>
          <Link
            href="/templates"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
          >
            <FolderTree className="h-4 w-4" />
            Templates
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
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
