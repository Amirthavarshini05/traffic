import { useState, useCallback, useEffect } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { SelectionDrawer } from '@/components/ui/SelectionDrawer';
import { Badge } from '@/components/ui/Badge';
import {
  MessageSquareText,
  Search,
  Send,
  MapPin,
  Car,
  Route as RouteIcon,
  Brain,
  ArrowRight,
} from 'lucide-react';
import type { PageId } from '@/components/layout/Sidebar';

interface QaExchange {
  query: string;
  answer: string;
  evidence: { label: string; value: string }[];
  actions: { label: string; action: () => void; icon?: React.ReactNode }[];
}

const SUGGESTED_QUERIES = [
  'Why is traffic congested near Guindy?',
  'Show suspicious vehicle movements in the last 30 minutes',
  'Which route has the highest traffic volume?',
  'Where are most vehicles from CAM02 going?',
  'Show the trajectory of vehicle 167',
  'Which cameras are currently offline?',
  'What routes may be affected by congestion at CAM01?',
];

interface FloatingQueryAssistantProps {
  onNavigate: (page: PageId) => void;
}

export function FloatingQueryAssistant({ onNavigate }: FloatingQueryAssistantProps) {
  const { summary, alerts, routeAnalytics, cameraHealth } = useAppData();
  const { setSelection } = useSelection();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState<QaExchange[]>([]);

  const handleQuery = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      const exchange = generateAnswer(q, {
        summary,
        alerts,
        routeAnalytics,
        cameraHealth,
        onNavigate,
        setSelection,
      });
      setExchanges((prev) => [exchange, ...prev]);
      setQuery('');
    },
    [summary, alerts, routeAnalytics, cameraHealth, onNavigate, setSelection]
  );

  // Listen for open events triggered from the TopBar Omnibar or other components
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setOpen(true);
      if (customEvent.detail) {
        handleQuery(customEvent.detail);
      }
    };
    window.addEventListener('open-ask-traffic', handler);
    return () => window.removeEventListener('open-ask-traffic', handler);
  }, [handleQuery]);

  return (
    <>
      {/* Floating button: stylized badge at bottom-right */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-4 right-4 z-30 px-3.5 py-2 rounded-lg bg-surface border border-border-strong text-text-primary shadow-xl',
          'flex items-center gap-2 hover:border-accent hover:bg-bg-elevated transition-all font-medium text-xs',
          'focus:outline-none focus:ring-2 focus:ring-accent/40',
          open && 'hidden'
        )}
        id="ask-traffic-trigger"
        title="Open Traffic Intelligence Assistant"
      >
        <span className="text-sm">💬</span>
        <span className="tracking-wide">Ask Traffic</span>
      </button>

      <SelectionDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Traffic Intelligence Assistant"
        subtitle="Operational and query intelligence drawer"
      >
        <div className="flex flex-col gap-3">
          <Badge color="blue" size="sm" className="self-start">
            <Brain className="w-3 h-3" /> Realtime Traffic Assistant
          </Badge>

          {/* Query input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuery(query);
                }}
                placeholder="Ask about congestion, routes, vehicles..."
                className="w-full bg-bg-elevated border border-border rounded px-8 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={() => handleQuery(query)}
              className="px-3 py-2 rounded bg-accent text-white text-xs font-medium hover:bg-accent-dim transition-colors flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </div>

          {/* Suggested queries */}
          {exchanges.length === 0 && (
            <div className="space-y-1.5 mt-1">
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Suggested questions</p>
              {SUGGESTED_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuery(q)}
                  className="w-full text-left text-xs text-text-secondary px-2.5 py-1.5 rounded bg-bg-elevated hover:bg-bg-hover hover:text-text-primary transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{q}</span>
                  <ArrowRight className="w-3 h-3 text-text-muted shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Exchanges */}
          <div className="space-y-3 overflow-y-auto scrollbar-thin max-h-[60vh] mt-1">
            {exchanges.map((ex, i) => (
              <div key={i} className="rounded border border-border p-3 bg-bg-elevated animate-fade-in space-y-2.5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Question</p>
                  <p className="text-xs text-text-primary font-medium mt-0.5">{ex.query}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Answer</p>
                  <p className="text-xs text-text-secondary leading-relaxed mt-0.5 whitespace-pre-line">{ex.answer}</p>
                </div>

                {ex.evidence.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Evidence</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ex.evidence.map((e, j) => (
                        <div key={j} className="rounded bg-surface px-2 py-1.5 border border-border-subtle">
                          <p className="text-[10px] text-text-muted">{e.label}</p>
                          <p className="text-xs font-semibold text-text-primary mt-0.5">{e.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ex.actions.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border-subtle">
                    {ex.actions.map((act, j) => (
                      <button
                        key={j}
                        onClick={act.action}
                        className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent/15 border border-accent/30 text-accent-light hover:bg-accent/25 transition-colors font-medium"
                      >
                        {act.icon}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SelectionDrawer>
    </>
  );
}

function generateAnswer(
  query: string,
  data: {
    summary: any;
    alerts: any[];
    routeAnalytics: any;
    cameraHealth: any;
    onNavigate: (p: PageId) => void;
    setSelection: (s: any) => void;
  }
): QaExchange {
  const q = query.toLowerCase();
  const evidence: { label: string; value: string }[] = [];
  let answer = '';
  const actions: { label: string; action: () => void; icon?: React.ReactNode }[] = [];

  const nav = (p: PageId) => () => data.onNavigate(p);
  const selectZone = (zone: string) => () => {
    data.setSelection({ type: 'zone', id: zone });
    data.onNavigate('analytics');
  };
  const selectRoute = (id: string) => () => {
    data.setSelection({ type: 'route', id });
    data.onNavigate('routes');
  };
  const selectVehicle = (id: string) => () => {
    data.setSelection({ type: 'vehicle', id });
    data.onNavigate('vehicles');
  };

  if (q.includes('offline') || q.includes('camera') || q.includes('health')) {
    const total = data.cameraHealth?.total ?? 0;
    const healthy = data.cameraHealth?.healthy ?? 0;
    const offline = data.cameraHealth?.offline ?? 0;
    const warning = data.cameraHealth?.warning ?? 0;

    answer = `Surveillance Network Health:\n${healthy} camera(s) operational, ${warning} in warning status, and ${offline} offline out of ${total} total monitored nodes.`;
    evidence.push({ label: 'Total Cameras', value: String(total) });
    evidence.push({ label: 'Operational', value: String(healthy) });
    evidence.push({ label: 'Warning', value: String(warning) });
    evidence.push({ label: 'Offline', value: String(offline) });

    actions.push({
      label: 'System Health',
      action: nav('health'),
    });
    actions.push({
      label: 'Command Center',
      action: nav('command'),
    });
  } else if (q.includes('167') || q.includes('vehicle') || q.includes('suspicious') || q.includes('alert')) {
    const vehicleAlert = data.alerts.find(
      (a) => a.vehicle_id === '167' || a.category === 'Route Anomaly'
    ) || data.alerts[0];

    if (vehicleAlert) {
      answer = `Alert record found: ${vehicleAlert.title} (${vehicleAlert.severity}).\n${vehicleAlert.message}`;
      evidence.push({ label: 'Alert ID', value: vehicleAlert.alert_id });
      evidence.push({ label: 'Severity', value: vehicleAlert.severity });
      if (vehicleAlert.vehicle_id) evidence.push({ label: 'Vehicle ID', value: vehicleAlert.vehicle_id });
      if (vehicleAlert.camera_id) evidence.push({ label: 'Corridor', value: vehicleAlert.camera_id });

      if (vehicleAlert.vehicle_id) {
        actions.push({
          label: 'Investigate Vehicle',
          action: selectVehicle(vehicleAlert.vehicle_id),
          icon: <Car className="w-3 h-3" />,
        });
      }
      actions.push({
        label: 'View Alerts Console',
        action: nav('alerts'),
      });
    } else {
      answer = `No active vehicle or route alerts currently recorded in the surveillance database.`;
      actions.push({
        label: 'Vehicle Intelligence',
        action: selectVehicle('167'),
        icon: <Car className="w-3 h-3" />,
      });
    }
  } else if (q.includes('route') || q.includes('volume') || q.includes('highest') || q.includes('corridor')) {
    const routes = data.routeAnalytics?.routes ?? [];
    if (routes.length > 0) {
      const topRoute = routes[0];
      const rName =
        topRoute.route_name || `${topRoute.from_camera_id} → ${topRoute.to_camera_id}`;
      const rVehicles = topRoute.vehicle_count ?? 0;
      const rDelay = topRoute.delay_pct != null ? `+${topRoute.delay_pct.toFixed(0)}%` : 'Nominal';

      answer = `Corridor telemetry indicates ${rName} has ${formatNumber(rVehicles)} observed vehicles with ${rDelay} corridor delay.`;
      evidence.push({ label: 'Corridor', value: rName });
      evidence.push({ label: 'Vehicles', value: formatNumber(rVehicles) });
      evidence.push({ label: 'Status', value: topRoute.congestion_level || 'Active' });

      actions.push({
        label: 'Show Route',
        action: () => {
          data.setSelection({ type: 'route', id: topRoute.route_id || `${topRoute.from_camera_id}_${topRoute.to_camera_id}` });
          data.onNavigate('routes');
        },
        icon: <RouteIcon className="w-3 h-3" />,
      });
      actions.push({
        label: 'Route Analytics',
        action: nav('routes'),
        icon: <RouteIcon className="w-3 h-3" />,
      });
    } else {
      answer = `Corridor traffic analytics are currently updating.`;
      actions.push({ label: 'Route & OD', action: nav('routes') });
    }
  } else if (data.summary && data.summary.total_vehicles != null) {
    const s = data.summary;
    answer = `Current City Telemetry:\nObserving ${formatNumber(s.total_vehicles)} vehicles across ${s.active_cameras || 0} active camera nodes with ${s.congested_routes || 0} congested corridors.`;
    evidence.push({ label: 'Vehicles Observed', value: formatNumber(s.total_vehicles) });
    evidence.push({ label: 'Congested Corridors', value: String(s.congested_routes || 0) });
    evidence.push({ label: 'Active Cameras', value: String(s.active_cameras || 0) });

    actions.push({
      label: 'Command Center',
      action: nav('command'),
      icon: <MapPin className="w-3 h-3" />,
    });
    actions.push({
      label: 'Traffic Analytics',
      action: nav('analytics'),
      icon: <RouteIcon className="w-3 h-3" />,
    });
  } else {
    answer = `Query capability unavailable.\n\nNatural-language query synthesis is not available on the current backend. Please use the verified operational views to explore live city surveillance data.`;
    actions.push({
      label: 'Command Center',
      action: nav('command'),
      icon: <MapPin className="w-3 h-3" />,
    });
    actions.push({
      label: 'Traffic Analytics',
      action: nav('analytics'),
      icon: <RouteIcon className="w-3 h-3" />,
    });
  }

  return { query, answer, evidence, actions };
}
