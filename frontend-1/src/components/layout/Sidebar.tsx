import { cn } from '@/lib/utils';
import { useAppData } from '@/context/AppDataContext';
import { SYSTEM_STATUS_COLORS } from '@/lib/constants';
import { StatusDot } from '@/components/ui/StatusDot';
import type { SystemStatus } from '@/types';
import {
  LayoutDashboard,
  BarChart3,
  Car,
  Route,
  Siren,
  Activity,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export type PageId =
  | 'command'
  | 'analytics'
  | 'vehicles'
  | 'routes'
  | 'alerts'
  | 'health'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'command', label: 'Command Center', icon: LayoutDashboard },
  { id: 'analytics', label: 'Traffic Analytics', icon: BarChart3 },
  { id: 'vehicles', label: 'Vehicle Intelligence', icon: Car },
  { id: 'routes', label: 'Route & OD', icon: Route },
  { id: 'alerts', label: 'Alerts', icon: Siren },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ activePage, onNavigate, collapsed }: SidebarProps) {
  const { alerts, systemHealth } = useAppData();
  const activeAlertCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const offlineCameras = systemHealth.camera_network === 'DEGRADED';

  const statusItems: { label: string; status: SystemStatus }[] = [
    { label: 'API', status: systemHealth.api },
    { label: 'Database', status: systemHealth.database },
    { label: 'Redis', status: systemHealth.redis },
    { label: 'Realtime', status: systemHealth.realtime },
    { label: 'Camera Network', status: systemHealth.camera_network },
  ];

  const dotColor = (s: SystemStatus): 'green' | 'amber' | 'red' | 'gray' => {
    switch (s) {
      case 'OPERATIONAL': return 'green';
      case 'DEGRADED': return 'amber';
      case 'OFFLINE': return 'red';
      default: return 'gray';
    }
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface border-r border-border transition-all duration-200 shrink-0',
        collapsed ? 'w-14' : 'w-52'
      )}
    >
      <div className="h-12 flex items-center gap-2 px-3 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded bg-accent/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-accent-light" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-text-primary leading-tight tracking-wide" title="VISTA">
              VISTA
            </p>
            <p className="text-[9px] text-text-muted leading-tight truncate" title="Vehicle Intelligence, Surveillance & Traffic Analytics">
              Vehicle Intelligence, Surveillance & Traffic Analytics
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          const showBadge =
            (item.id === 'alerts' && activeAlertCount > 0) ||
            (item.id === 'health' && offlineCameras);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-accent/15 text-accent-light'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent-light rounded-r" />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
              {showBadge && !collapsed && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-critical/20 text-critical">
                  {item.id === 'alerts' ? activeAlertCount : '!'}
                </span>
              )}
              {showBadge && collapsed && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-critical animate-pulse-slow" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-1">
        {!collapsed && (
          <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold px-1 mb-0.5">
            System Status
          </p>
        )}
        {statusItems.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-1.5 px-1 py-0.5"
            title={collapsed ? s.label : undefined}
          >
            <StatusDot color={dotColor(s.status)} pulse={s.status === 'OFFLINE'} />
            {!collapsed && (
              <>
                <span className="text-[11px] text-text-secondary flex-1">{s.label}</span>
                <span
                  className="text-[9px] font-medium"
                  style={{ color: SYSTEM_STATUS_COLORS[s.status] }}
                >
                  {s.status}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
