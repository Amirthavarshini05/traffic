import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useRealtime } from '@/hooks/useRealtime';
import { useAppData } from '@/context/AppDataContext';
import { useTheme } from '@/context/ThemeContext';
import { StatusDot } from '@/components/ui/StatusDot';
import { TopBarOmnibar } from './TopBarOmnibar';
import { Bell, Clock, PanelLeftClose, PanelLeft, Sun, Moon, ShieldCheck } from 'lucide-react';
import type { PageId } from './Sidebar';

interface TopBarProps {
  activePage: PageId;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onNavigate: (page: PageId) => void;
}

export function TopBar({
  activePage,
  sidebarCollapsed,
  onToggleSidebar,
  onNavigate,
}: TopBarProps) {
  const { connectionState } = useRealtime();
  const { alerts } = useAppData();
  const { theme, toggleTheme } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeAlertCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  const rtColor =
    connectionState === 'connected' ? 'green' : connectionState === 'connecting' ? 'amber' : 'red';
  const rtLabel =
    connectionState === 'connected'
      ? 'LIVE'
      : connectionState === 'connecting'
      ? 'CONNECTING'
      : 'OFFLINE';

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center px-3 gap-2.5 shrink-0 z-20">
      {/* Sidebar toggle & City Traffic brand */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-hover"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('command')}>
          <div className="w-7 h-7 rounded bg-accent/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-accent-light" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-text-primary leading-tight tracking-wide">
              CITY TRAFFIC
            </p>
            <p className="text-[9px] text-text-muted leading-tight">
              Intelligence Command
            </p>
          </div>
        </div>
      </div>

      {/* Central Omnibar: understands camera, vehicle, route, zone, alert, natural-language query */}
      <TopBarOmnibar onNavigate={onNavigate} />

      {/* Right status area: Status, Time, Alerts, Theme, Operator */}
      <div className="flex items-center gap-2.5 shrink-0 ml-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot color={rtColor} pulse={connectionState === 'connected'} />
          <span className="text-[11px] font-mono font-medium text-text-secondary hidden sm:inline">{rtLabel}</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-text-muted">
          <Clock className="w-3 h-3" />
          <span className="font-mono">
            {now.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>

        <button
          onClick={() => onNavigate('alerts')}
          className="relative text-text-secondary hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-hover shrink-0"
          title="View Alerts"
        >
          <Bell className={cn('w-4 h-4', activeAlertCount > 0 ? 'text-critical' : 'text-text-muted')} />
          {activeAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.2 rounded-full bg-critical text-white min-w-3 text-center">
              {activeAlertCount}
            </span>
          )}
        </button>

        <button
          onClick={toggleTheme}
          className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-hover shrink-0"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-1.5 pl-2 border-l border-border shrink-0">
          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent-light">
            OP
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-[11px] font-medium text-text-primary leading-tight">Operator</p>
            <p className="text-[9px] text-text-muted leading-tight">Traffic Authority</p>
          </div>
        </div>
      </div>
    </header>
  );
}
