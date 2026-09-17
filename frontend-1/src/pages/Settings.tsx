import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import {
  Sun,
  Moon,
  Laptop,
  Map as MapIcon,
  Sliders,
  Bell,
  Check,
  Shield,
  Info,
} from 'lucide-react';

export function Settings() {
  const { theme, setTheme } = useTheme();

  // Settings states
  const [defaultLandingPage, setDefaultLandingPage] = useState<string>('Command Center');
  const [defaultTimeRange, setDefaultTimeRange] = useState<string>('24 hours');
  const [defaultZoom, setDefaultZoom] = useState<string>('12 (City Overview)');
  const [trafficDensityVisible, setTrafficDensityVisible] = useState<boolean>(true);
  const [cameraHealthVisible, setCameraHealthVisible] = useState<boolean>(true);

  // Notification toggles
  const [notifyCritical, setNotifyCritical] = useState<boolean>(true);
  const [notifyCameraOffline, setNotifyCameraOffline] = useState<boolean>(true);
  const [notifyRouteAnomalies, setNotifyRouteAnomalies] = useState<boolean>(true);

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-y-auto scrollbar-thin max-w-3xl mx-auto w-full">
      {/* 1. Appearance */}
      <Panel title="APPEARANCE" subtitle="Theme preferences and contrast styling">
        <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border-subtle">
          <div>
            <p className="text-xs font-bold text-text-primary">Theme Mode</p>
            <p className="text-[11px] text-text-muted">
              Select your interface color scheme. Light mode offers clean, high-contrast operational visibility.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface border border-border">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                theme === 'light' ? 'bg-accent text-white font-semibold' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                theme === 'dark' ? 'bg-accent text-white font-semibold' : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>System</span>
            </button>
          </div>
        </div>
      </Panel>

      {/* 2. Map Defaults */}
      <Panel title="MAP DEFAULTS" subtitle="Default spatial viewport and GIS layer visibility" actions={<MapIcon className="w-4 h-4 text-accent-light" />}>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Default Map Zoom</p>
              <p className="text-[10px] text-text-muted">Initial focal distance upon dashboard launch</p>
            </div>
            <select
              value={defaultZoom}
              onChange={(e) => setDefaultZoom(e.target.value)}
              className="px-2 py-1 rounded bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent"
            >
              <option value="11 (Metropolitan)">11 (Metropolitan)</option>
              <option value="12 (City Overview)">12 (City Overview)</option>
              <option value="14 (Corridor Focus)">14 (Corridor Focus)</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Traffic Density Visibility</p>
              <p className="text-[10px] text-text-muted">Show volume-weighted color intensity on route segments</p>
            </div>
            <button
              onClick={() => setTrafficDensityVisible(!trafficDensityVisible)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative',
                trafficDensityVisible ? 'bg-accent' : 'bg-border'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5',
                  trafficDensityVisible ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Camera Health Visibility</p>
              <p className="text-[10px] text-text-muted">Display colored operational state markers for each node</p>
            </div>
            <button
              onClick={() => setCameraHealthVisible(!cameraHealthVisible)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative',
                cameraHealthVisible ? 'bg-accent' : 'bg-border'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5',
                  cameraHealthVisible ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>
      </Panel>

      {/* 3. Dashboard Preferences */}
      <Panel title="DASHBOARD PREFERENCES" subtitle="Session defaults and landing configurations" actions={<Sliders className="w-4 h-4 text-accent-light" />}>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Default Landing Page</p>
              <p className="text-[10px] text-text-muted">Default view displayed when opening the platform</p>
            </div>
            <select
              value={defaultLandingPage}
              onChange={(e) => setDefaultLandingPage(e.target.value)}
              className="px-2 py-1 rounded bg-surface border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="Command Center">Command Center</option>
              <option value="Traffic Analytics">Traffic Analytics</option>
              <option value="Vehicle Intelligence">Vehicle Intelligence</option>
              <option value="Alerts">Alerts</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Default Analysis Time Range</p>
              <p className="text-[10px] text-text-muted">Temporal aggregation window for traffic calculations</p>
            </div>
            <select
              value={defaultTimeRange}
              onChange={(e) => setDefaultTimeRange(e.target.value)}
              className="px-2 py-1 rounded bg-surface border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="1 hour">1 hour</option>
              <option value="6 hours">6 hours</option>
              <option value="24 hours">24 hours</option>
              <option value="7 days">7 days</option>
            </select>
          </div>
        </div>
      </Panel>

      {/* 4. Notifications */}
      <Panel title="INCIDENT NOTIFICATIONS" subtitle="Alert dispatch thresholds" actions={<Bell className="w-4 h-4 text-accent-light" />}>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Critical Incident Alerts</p>
              <p className="text-[10px] text-text-muted">Trigger top bar banner for high priority traffic anomalies</p>
            </div>
            <button
              onClick={() => setNotifyCritical(!notifyCritical)}
              className={cn('w-10 h-5 rounded-full transition-colors relative', notifyCritical ? 'bg-accent' : 'bg-border')}
            >
              <div className={cn('w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5', notifyCritical ? 'left-5' : 'left-1')} />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Camera Offline Warnings</p>
              <p className="text-[10px] text-text-muted">Notify immediately upon camera disconnection or stream failure</p>
            </div>
            <button
              onClick={() => setNotifyCameraOffline(!notifyCameraOffline)}
              className={cn('w-10 h-5 rounded-full transition-colors relative', notifyCameraOffline ? 'bg-accent' : 'bg-border')}
            >
              <div className={cn('w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5', notifyCameraOffline ? 'left-5' : 'left-1')} />
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-bg-elevated border border-border-subtle">
            <div>
              <p className="font-semibold text-text-primary">Route Anomalies & Deviations</p>
              <p className="text-[10px] text-text-muted">Alert when vehicle journeys deviate from designated corridors</p>
            </div>
            <button
              onClick={() => setNotifyRouteAnomalies(!notifyRouteAnomalies)}
              className={cn('w-10 h-5 rounded-full transition-colors relative', notifyRouteAnomalies ? 'bg-accent' : 'bg-border')}
            >
              <div className={cn('w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5', notifyRouteAnomalies ? 'left-5' : 'left-1')} />
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
