'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, FolderTree, Settings, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/studies', label: 'Studies', icon: FileText },
  { href: '/templates', label: 'Templates', icon: FolderTree },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="px-4 space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/15 text-sidebar-foreground border-l-2 border-primary'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
