import { useState, useRef, useEffect, useMemo } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Search,
  Camera,
  Car,
  Route as RouteIcon,
  MapPin,
  Siren,
  MessageSquareText,
  X,
  ArrowRight,
} from 'lucide-react';
import type { PageId } from './Sidebar';
import type { VehicleSearchItem } from '@/types';

interface TopBarOmnibarProps {
  onNavigate: (page: PageId) => void;
}

export function TopBarOmnibar({ onNavigate }: TopBarOmnibarProps) {
  const { cameras, routeAnalytics, alerts, zoneTraffic } = useAppData();
  const { setSelection } = useSelection();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchedVehicles, setSearchedVehicles] = useState<VehicleSearchItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live vehicle search debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length >= 2) {
      const timer = setTimeout(() => {
        api.searchVehicles(q).then((items) => setSearchedVehicles(items.slice(0, 3))).catch(() => {});
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchedVehicles([]);
    }
  }, [query]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matchedCameras = cameras.filter(
      (c) =>
        c.camera_id.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.zone && c.zone.toLowerCase().includes(q))
    ).slice(0, 4);

    const routes = routeAnalytics?.routes || [];
    const matchedRoutes = routes.filter(
      (r) =>
        (r.from_camera_id && r.from_camera_id.toLowerCase().includes(q)) ||
        (r.to_camera_id && r.to_camera_id.toLowerCase().includes(q)) ||
        (r.route_name && r.route_name.toLowerCase().includes(q))
    ).slice(0, 3);

    // Extract unique zones
    const zonesSet = new Set<string>();
    cameras.forEach((c) => { if (c.zone) zonesSet.add(c.zone); });
    (zoneTraffic?.zones || []).forEach((z: any) => { if (z.zone_name) zonesSet.add(z.zone_name); });
    const matchedZones = Array.from(zonesSet)
      .filter((z) => z.toLowerCase().includes(q))
      .slice(0, 3);

    const matchedAlerts = alerts.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.vehicle_id && a.vehicle_id.toLowerCase().includes(q)) ||
        (a.camera_id && a.camera_id.toLowerCase().includes(q)) ||
        a.category.toLowerCase().includes(q)
    ).slice(0, 3);

    const isQuestion =
      q.includes('?') ||
      q.startsWith('why') ||
      q.startsWith('where') ||
      q.startsWith('how') ||
      q.startsWith('what') ||
      q.startsWith('which') ||
      q.startsWith('show');

    // Vehicle detection candidate
    const isVehicleCandidate =
      /^[a-zA-Z0-9]{2,12}$/.test(q) &&
      !matchedCameras.some((c) => c.camera_id.toLowerCase() === q);

    return {
      cameras: matchedCameras,
      routes: matchedRoutes,
      zones: matchedZones,
      alerts: matchedAlerts,
      isQuestion,
      isVehicleCandidate,
      hasAny:
        matchedCameras.length > 0 ||
        matchedRoutes.length > 0 ||
        matchedZones.length > 0 ||
        matchedAlerts.length > 0 ||
        isQuestion ||
        isVehicleCandidate,
    };
  }, [query, cameras, routeAnalytics, alerts, zoneTraffic]);

  const handleSelectCamera = (cameraId: string) => {
    setSelection({ type: 'camera', id: cameraId });
    onNavigate('command');
    setIsOpen(false);
    setQuery('');
  };

  const handleSelectRoute = (routeId: string) => {
    setSelection({ type: 'route', id: routeId });
    onNavigate('routes');
    setIsOpen(false);
    setQuery('');
  };

  const handleSelectZone = (zone: string) => {
    setSelection({ type: 'zone', id: zone });
    onNavigate('analytics');
    setIsOpen(false);
    setQuery('');
  };

  const handleSelectAlert = (alertId: string) => {
    setSelection({ type: 'alert', id: alertId });
    onNavigate('alerts');
    setIsOpen(false);
    setQuery('');
  };

  const handleSelectVehicle = (vehicleId: string) => {
    setSelection({ type: 'vehicle', id: vehicleId });
    onNavigate('vehicles');
    setIsOpen(false);
    setQuery('');
  };

  const handleAskAssistant = (questionText: string) => {
    window.dispatchEvent(new CustomEvent('open-ask-traffic', { detail: questionText }));
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl mx-2">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              if (results?.isQuestion) {
                handleAskAssistant(query.trim());
              } else if (results?.cameras[0]) {
                handleSelectCamera(results.cameras[0].camera_id);
              } else if (results?.routes[0]) {
                handleSelectRoute(results.routes[0].route_id || `${results.routes[0].from_camera_id}_${results.routes[0].to_camera_id}`);
              } else if (results?.isVehicleCandidate) {
                handleSelectVehicle(query.trim());
              } else {
                handleAskAssistant(query.trim());
              }
            }
          }}
          placeholder="Search camera, vehicle, route, zone, alert, or ask a question..."
          className="w-full h-8 pl-8 pr-7 bg-bg-elevated border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 text-text-muted hover:text-text-primary"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim().length > 0 && results && results.hasAny && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-border rounded-lg shadow-xl py-1.5 z-50 max-h-96 overflow-y-auto scrollbar-thin animate-fade-in">
          {/* Ask Assistant Query Match */}
          <button
            onClick={() => handleAskAssistant(query)}
            className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors border-b border-border-subtle"
          >
            <div className="w-5 h-5 rounded bg-accent/15 flex items-center justify-center text-accent-light shrink-0">
              <MessageSquareText className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-semibold text-accent-light tracking-wide block">
                Ask Traffic Assistant
              </span>
              <span className="text-xs text-text-primary truncate block font-medium">
                "{query}"
              </span>
            </div>
            <ArrowRight className="w-3 h-3 text-text-muted" />
          </button>

          {/* Live Matching Vehicles from Database */}
          {searchedVehicles.length > 0 ? (
            <div className="pt-1 border-t border-border-subtle">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Matching Surveillance Vehicles
              </div>
              {searchedVehicles.map((v) => (
                <button
                  key={v.vehicle_id}
                  onClick={() => handleSelectVehicle(v.plate_number)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors"
                >
                  <Car className="w-3.5 h-3.5 text-accent-light shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-text-primary font-mono font-bold">
                      {v.plate_number}
                    </span>
                    <span className="text-[10px] text-text-muted block">
                      Vehicle #{v.vehicle_id} · {v.detection_count} detections
                    </span>
                  </div>
                  <span className="text-[10px] text-accent-light font-medium">Investigate →</span>
                </button>
              ))}
            </div>
          ) : results.isVehicleCandidate ? (
            <button
              onClick={() => handleSelectVehicle(query.trim().toUpperCase())}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors"
            >
              <Car className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-text-primary font-mono font-medium">
                  Vehicle: {query.trim().toUpperCase()}
                </span>
                <span className="text-[10px] text-text-muted block">Investigate plate / ID trajectory</span>
              </div>
              <span className="text-[10px] text-accent-light font-medium">Investigate →</span>
            </button>
          ) : null}

          {/* Cameras */}
          {results.cameras.length > 0 && (
            <div className="pt-1">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Cameras
              </div>
              {results.cameras.map((cam) => (
                <button
                  key={cam.camera_id}
                  onClick={() => handleSelectCamera(cam.camera_id)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="text-xs font-mono font-medium text-text-primary">{cam.camera_id}</span>
                  <span className="text-xs text-text-secondary truncate">{cam.name || cam.zone || 'Camera'}</span>
                  <span className={cn(
                    'text-[9px] px-1.5 py-0.2 rounded ml-auto font-medium',
                    cam.status === 'HEALTHY' ? 'bg-success/15 text-success' : cam.status === 'OFFLINE' ? 'bg-critical/15 text-critical' : 'bg-warning/15 text-warning'
                  )}>
                    {cam.status || 'ACTIVE'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Routes */}
          {results.routes.length > 0 && (
            <div className="pt-1 border-t border-border-subtle">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Routes
              </div>
              {results.routes.map((r) => {
                const rid = r.route_id || `${r.from_camera_id}_${r.to_camera_id}`;
                return (
                  <button
                    key={rid}
                    onClick={() => handleSelectRoute(rid)}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors"
                  >
                    <RouteIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-xs font-mono font-medium text-text-primary">
                      {r.from_camera_id} → {r.to_camera_id}
                    </span>
                    <span className="text-xs text-text-secondary truncate">{r.route_name}</span>
                    {r.congestion_level && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded ml-auto font-medium text-warning bg-warning/10">
                        {r.congestion_level}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Zones */}
          {results.zones.length > 0 && (
            <div className="pt-1 border-t border-border-subtle">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Zones
              </div>
              {results.zones.map((zone) => (
                <button
                  key={zone}
                  onClick={() => handleSelectZone(zone)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="text-xs font-medium text-text-primary">{zone}</span>
                  <span className="text-[10px] text-text-muted ml-auto">Zone Analytics →</span>
                </button>
              ))}
            </div>
          )}

          {/* Alerts */}
          {results.alerts.length > 0 && (
            <div className="pt-1 border-t border-border-subtle">
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Alerts
              </div>
              {results.alerts.map((a) => (
                <button
                  key={a.alert_id}
                  onClick={() => handleSelectAlert(a.alert_id)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover transition-colors"
                >
                  <Siren className="w-3.5 h-3.5 text-critical shrink-0" />
                  <span className="text-xs font-medium text-text-primary truncate">{a.title}</span>
                  <span className="text-[10px] text-text-muted ml-auto">{a.severity}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
