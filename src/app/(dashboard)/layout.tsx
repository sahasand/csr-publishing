import Link from 'next/link';
import { FileText, FolderTree, Settings, LayoutDashboard } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-gray-50">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">CSR Publishing</h1>
        </div>
        <nav className="px-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/studies"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <FileText className="h-4 w-4" />
            Studies
          </Link>
          <Link
            href="/templates"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <FolderTree className="h-4 w-4" />
            Templates
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-white">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
