import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  ArrowLeftRight,
  Home,
  Plus,
  ChevronLeft,
  Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SidebarProps {
  userName?: string;
  userCredits?: number;
}

export function Sidebar({ userName = 'Alex Chen', userCredits = 5200 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/auctions', icon: Zap, label: 'Live Auctions' },
    { to: '/barter', icon: ArrowLeftRight, label: 'Barter Board' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-background-secondary transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-purple">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          {!collapsed && (
            <div>
              <span className="font-semibold text-text-primary">AgentBid</span>
              <p className="text-xs text-text-muted">AI Marketplace</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-text-muted hover:bg-background-tertiary hover:text-text-primary"
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      {/* Create Agent Button */}
      <div className="p-4">
        <Link
          to="/create-agent"
          className={cn(
            'btn-primary w-full',
            collapsed ? 'justify-center px-2' : ''
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Create Agent</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <p className={cn('mb-2 px-3 text-xs font-medium uppercase tracking-wider text-text-muted', collapsed && 'sr-only')}>
          Navigation
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-purple/10 text-accent-purple'
                      : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary',
                    collapsed && 'justify-center'
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-4">
        {/* Landing Page Link */}
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-background-tertiary hover:text-text-primary mb-4',
            collapsed && 'justify-center'
          )}
        >
          <Home className="h-5 w-5" />
          {!collapsed && <span>Landing Page</span>}
        </Link>

        {/* User Info */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg bg-background-tertiary p-3',
            collapsed && 'justify-center'
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-purple text-sm font-medium text-white">
            {userName.charAt(0)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {userName}
              </p>
              <p className="flex items-center gap-1 text-xs text-accent-cyan">
                <Gem className="h-3 w-3" />
                {userCredits.toLocaleString()} credits
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
