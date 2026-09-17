import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { CityTrafficMap, type CityTrafficMapHandle, type MapLayerConfig } from '@/components/map/CityTrafficMap';
import { MapLegend } from '@/components/map/MapLegend';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeRangeSelector } from '@/components/ui/TimeRangeSelector';
import { useAppData } from '@/context/AppDataContext';
import { useSelection } from '@/context/SelectionContext';
import { useTimeRange } from '@/context/TimeRangeContext';
import { api } from '@/lib/api';
import { formatTimeShort, formatTime, cn } from '@/lib/utils';
import {
  Search,
  Car,
  Clock,
  Navigation,
  FileText,
  Lightbulb,
  HelpCircle,
  ArrowRight,
  Download,
  Printer,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';
import type {
  VehicleTrajectory,
  VehicleSearchItem,
  EnhancedVehicleTrajectory,
  ObservationGap,
  WatchlistEntry,
} from '@/types';

const MAP_LAYERS: MapLayerConfig = {
  cameras: true,
  trajectory: true,
};

export function VehicleInvestigation() {
  const { cameras, alerts, watchlist, refresh: refreshAppData } = useAppData();
  const { selection, setSelection } = useSelection();
  const { apiParam, startTime, endTime } = useTimeRange();
  const mapRef = useRef<CityTrafficMapHandle>(null);

  const [searchValue, setSearchValue] = useState('167');
  const [searchResults, setSearchResults] = useState<VehicleSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [trajectory, setTrajectory] = useState<VehicleTrajectory | null>(null);
  const [enhancedTrajectory, setEnhancedTrajectory] = useState<EnhancedVehicleTrajectory | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [timeWindowMode, setTimeWindowMode] = useState<'standard' | 'exact'>('standard');
  const [exactFrom, setExactFrom] = useState('14:00');
  const [exactTo, setExactTo] = useState('16:00');
  const [isUnknownWindow, setIsUnknownWindow] = useState(false);

  // Watchlist Modal state
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [newWatchlistPlate, setNewWatchlistPlate] = useState('');
  const [newWatchlistReason, setNewWatchlistReason] = useState('');
  const [newWatchlistCaseRef, setNewWatchlistCaseRef] = useState('');
  const [newWatchlistPriority, setNewWatchlistPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('HIGH');
  const [watchlistActionMsg, setWatchlistActionMsg] = useState<string | null>(null);

  // Autocomplete debounce
  useEffect(() => {
    if (!searchValue || searchValue.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchVehicles(searchValue.trim());
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search vehicles:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleSearch = useCallback(
    async (idOrPlate: string) => {
      const q = idOrPlate.trim();
      if (!q) return;
      setShowSearchDropdown(false);
      setLoading(true);
      setSearched(true);
      setErrorMessage(null);

      if (timeWindowMode === 'exact' && exactFrom && exactTo) {
        setIsUnknownWindow(true);
      } else {
        setIsUnknownWindow(false);
      }

      try {
        // Fetch legacy trajectory for map layer coordinates
        const result = await api.getVehicleTrajectory(q, apiParam || undefined);
        setTrajectory(result && result.events && result.events.length > 0 ? result : null);

        // Fetch enhanced trajectory for gaps and speed validation
        const numericId = parseInt(q.replace(/\D/g, ''), 10);
        if (!isNaN(numericId)) {
          const enhanced = await api.getEnhancedVehicleTrajectory(numericId, startTime, endTime);
          setEnhancedTrajectory(enhanced);
        } else {
          setEnhancedTrajectory(null);
        }
      } catch (err) {
        console.error('Error fetching trajectory:', err);
        setErrorMessage('Failed to query vehicle trajectory from surveillance backend.');
        setTrajectory(null);
        setEnhancedTrajectory(null);
      } finally {
        setLoading(false);
      }
    },
    [apiParam, startTime, endTime, timeWindowMode, exactFrom, exactTo]
  );

  // Auto-investigate when selection changes or initial load
  useEffect(() => {
    if (selection?.type === 'vehicle' && selection.id) {
      setSearchValue(selection.id);
      handleSearch(selection.id);
    } else if (!searched) {
      handleSearch('167');
    }
  }, [selection, handleSearch, searched]);

  const vehicleAlerts = trajectory
    ? alerts.filter((a) => a.vehicle_id === trajectory.vehicle_id)
    : [];

  const camName = useCallback(
    (id: string) => cameras.find((c) => c.camera_id === id)?.name || id,
    [cameras]
  );

  const trajectoryEvents = trajectory?.events || [];

  // Journey corridor string
  const journeyString = useMemo(() => {
    if (!trajectoryEvents.length) return 'N/A';
    return trajectoryEvents.map((e) => e.camera_id).join(' → ');
  }, [trajectoryEvents]);

  // Total travel time display
  const travelTimeDisplay = useMemo(() => {
    if (trajectoryEvents.length < 2) return 'Unavailable (single sighting)';
    const t0 = new Date(trajectoryEvents[0].timestamp).getTime();
    const t1 = new Date(trajectoryEvents[trajectoryEvents.length - 1].timestamp).getTime();
    if (isNaN(t0) || isNaN(t1)) return 'Unavailable';
    const diffSec = Math.max(0, (t1 - t0) / 1000);
    return formatTime(diffSec);
  }, [trajectoryEvents]);

  // Observation Gaps
  const observationGaps: ObservationGap[] = useMemo(() => {
    if (enhancedTrajectory?.observation_gaps && enhancedTrajectory.observation_gaps.length > 0) {
      return enhancedTrajectory.observation_gaps;
    }
    // Fallback gap detection from raw events (> 180s interval)
    const fallback: ObservationGap[] = [];
    for (let i = 0; i < trajectoryEvents.length - 1; i++) {
      const tA = new Date(trajectoryEvents[i].timestamp).getTime();
      const tB = new Date(trajectoryEvents[i + 1].timestamp).getTime();
      if (!isNaN(tA) && !isNaN(tB)) {
        const gapSec = Math.round((tB - tA) / 1000);
        if (gapSec >= 180) {
          fallback.push({
            previous_camera: trajectoryEvents[i].camera_id,
            previous_timestamp: trajectoryEvents[i].timestamp,
            next_camera: trajectoryEvents[i + 1].camera_id,
            next_timestamp: trajectoryEvents[i + 1].timestamp,
            gap_duration_seconds: gapSec,
            status: 'unmonitored',
          });
        }
      }
    }
    return fallback;
  }, [enhancedTrajectory, trajectoryEvents]);

  // Speed telemetry calculation
  const speedDisplay = useMemo(() => {
    if (!enhancedTrajectory || !enhancedTrajectory.trajectory.length) {
      return { value: null, status: 'unavailable', text: 'Unavailable (No corridor calibration)' };
    }
    const validSegments = enhancedTrajectory.trajectory.filter(
      (s) => s.speed_status === 'available' && s.speed_kmh != null
    );
    if (!validSegments.length) {
      return { value: null, status: 'unavailable', text: 'Unavailable (Missing corridor geometry)' };
    }
    const avg = validSegments.reduce((sum, s) => sum + s.speed_kmh!, 0) / validSegments.length;
    return { value: avg.toFixed(1), status: 'available', text: `${avg.toFixed(1)} km/h` };
  }, [enhancedTrajectory]);

  // Is this vehicle currently in active watchlist?
  const isWatchlisted = useMemo(() => {
    if (!trajectory) return false;
    const plate = enhancedTrajectory?.plate_number || trajectory.vehicle_id;
    return watchlist.some(
      (w) => w.plate_number.toUpperCase() === plate.toUpperCase() && w.status === 'active'
    );
  }, [trajectory, enhancedTrajectory, watchlist]);

  // Export Dossier Functions
  const handleExportCSV = () => {
    if (!trajectory) return;
    const rows = [
      ['SURVEILLANCE INVESTIGATION DOSSIER'],
      ['Vehicle ID', trajectory.vehicle_id],
      ['Plate', enhancedTrajectory?.plate_number || 'UNKNOWN'],
      ['Generated At', new Date().toISOString()],
      ['Total Observations', String(trajectoryEvents.length)],
      ['Travel Time', travelTimeDisplay],
      ['Corridor', journeyString],
      [''],
      ['CHRONOLOGICAL DETECTIONS'],
      ['Event ID', 'Camera ID', 'Camera Name', 'Timestamp', 'Confidence'],
      ...trajectoryEvents.map((e) => [
        String(e.event_id),
        e.camera_id,
        camName(e.camera_id),
        e.timestamp,
        e.confidence ? `${(e.confidence * 100).toFixed(1)}%` : '',
      ]),
      [''],
      ['UNMONITORED OBSERVATION GAPS'],
      ['From Camera', 'From Time', 'To Camera', 'To Time', 'Gap Duration (Seconds)'],
      ...observationGaps.map((g) => [
        g.previous_camera,
        g.previous_timestamp,
        g.next_camera,
        g.next_timestamp,
        String(g.gap_duration_seconds),
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vehicle_${trajectory.vehicle_id}_Dossier.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!trajectory) return;
    const payload = {
      vehicle_id: trajectory.vehicle_id,
      plate_number: enhancedTrajectory?.plate_number || 'UNKNOWN',
      generated_at: new Date().toISOString(),
      corridor: journeyString,
      travel_time: travelTimeDisplay,
      speed_telemetry: speedDisplay,
      observations: trajectoryEvents,
      observation_gaps: observationGaps,
      alerts: vehicleAlerts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vehicle_${trajectory.vehicle_id}_Dossier.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintDossier = () => {
    window.print();
  };

  // Watchlist Actions
  const handleAddWatchlist = async () => {
    if (!newWatchlistPlate.trim()) return;
    try {
      const res = await api.addToWatchlist({
        plate_number: newWatchlistPlate.trim().toUpperCase(),
        reason: newWatchlistReason.trim() || 'Command center operational notice',
        case_reference: newWatchlistCaseRef.trim() || 'CASE-' + Date.now().toString().slice(-6),
        priority: newWatchlistPriority,
      });
      setWatchlistActionMsg(res.message || 'Added to watchlist');
      setNewWatchlistPlate('');
      setNewWatchlistReason('');
      setNewWatchlistCaseRef('');
      refreshAppData();
      setTimeout(() => setWatchlistActionMsg(null), 4000);
    } catch (err: any) {
      setWatchlistActionMsg(err.message || 'Failed to add plate to watchlist');
    }
  };

  const handleRemoveWatchlist = async (plate: string) => {
    try {
      const res = await api.removeFromWatchlist(plate);
      setWatchlistActionMsg(res.message || 'Removed from watchlist');
      refreshAppData();
      setTimeout(() => setWatchlistActionMsg(null), 4000);
    } catch (err: any) {
      setWatchlistActionMsg(err.message || 'Failed to remove from watchlist');
    }
  };

  // Zoom map to trajectory bounds
  const lastFocusedVehIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (trajectory?.vehicle_id && trajectory.vehicle_id !== lastFocusedVehIdRef.current && mapRef.current) {
      lastFocusedVehIdRef.current = trajectory.vehicle_id;
      const coords = (trajectory.events || [])
        .filter((e) => e.lng && e.lat)
        .map((e) => [e.lng!, e.lat!] as [number, number]);
      if (coords.length > 0) {
        const mid = coords[Math.floor(coords.length / 2)];
        mapRef.current.flyTo(mid[0], mid[1], 13);
      }
    }
  }, [trajectory]);

  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-hidden">
      {/* Search, Time Horizon & Watchlist Toolbar */}
      <div className="flex items-center gap-2 p-1.5 rounded bg-surface border border-border shrink-0 flex-wrap">
        {/* Autocomplete Search Input */}
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(searchValue);
            }}
            placeholder="Search plate or vehicle ID (e.g. 167, TN01AB1234)..."
            className="w-full bg-bg-elevated border border-border rounded px-8 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded shadow-xl z-50 max-h-60 overflow-y-auto scrollbar-thin">
              {searchResults.map((item) => (
                <div
                  key={item.vehicle_id}
                  onClick={() => {
                    setSearchValue(item.plate_number);
                    handleSearch(String(item.vehicle_id));
                  }}
                  className="p-2 border-b border-border-subtle hover:bg-bg-elevated cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-text-primary">{item.plate_number}</span>
                    <span className="text-[10px] text-text-muted">Vehicle #{item.vehicle_id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-[10px] text-text-secondary">{item.detection_count} hits</span>
                    <Badge color="blue" size="sm">
                      Inspect
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => handleSearch(searchValue)}
          className="px-3 py-1.5 rounded bg-accent text-white text-xs font-semibold hover:bg-accent-dim transition-colors"
        >
          {loading ? 'Querying...' : 'Investigate'}
        </button>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {/* Time Selection Mode Toggle */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => {
              setTimeWindowMode('standard');
              setIsUnknownWindow(false);
            }}
            className={cn(
              'px-2 py-1 rounded text-xs transition-colors',
              timeWindowMode === 'standard'
                ? 'bg-bg-elevated font-semibold text-text-primary border border-border'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            Standard Period
          </button>
          <button
            onClick={() => setTimeWindowMode('exact')}
            className={cn(
              'px-2 py-1 rounded text-xs transition-colors',
              timeWindowMode === 'exact'
                ? 'bg-bg-elevated font-semibold text-text-primary border border-border'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            Exact Window
          </button>
        </div>

        {timeWindowMode === 'standard' ? (
          <TimeRangeSelector variant="full" />
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span>From:</span>
            <input
              type="text"
              value={exactFrom}
              onChange={(e) => setExactFrom(e.target.value)}
              className="w-16 px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-center font-mono text-xs"
            />
            <span>To:</span>
            <input
              type="text"
              value={exactTo}
              onChange={(e) => setExactTo(e.target.value)}
              className="w-16 px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-center font-mono text-xs"
            />
            <button onClick={() => handleSearch(searchValue)} className="text-[10px] text-accent-light hover:underline ml-1">
              Apply
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Watchlist Manager Button */}
          <button
            onClick={() => setShowWatchlistModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-bg-elevated border border-border text-xs text-text-primary hover:border-accent transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-danger" />
            <span className="font-semibold">Watchlist</span>
            <span className="px-1.5 py-0.2 rounded-full bg-danger/20 text-danger text-[10px] font-bold">
              {watchlist.filter((w) => w.status === 'active').length}
            </span>
          </button>

          {/* Export Dossier Dropdown */}
          {trajectory && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleExportCSV}
                title="Export CSV Dossier"
                className="p-1.5 rounded bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleExportJSON}
                title="Export JSON Dossier"
                className="px-2 py-1.5 rounded bg-bg-elevated border border-border text-xs font-mono text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
              >
                JSON
              </button>
              <button
                onClick={handlePrintDossier}
                title="Print Official Dossier"
                className="p-1.5 rounded bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Investigation Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-2 min-h-0">
        {/* Left: Trajectory Map */}
        <div className="panel relative overflow-hidden min-h-0 flex flex-col">
          <div className="flex-1 relative">
            <CityTrafficMap
              ref={mapRef}
              layers={MAP_LAYERS}
              trajectoryEvents={isUnknownWindow ? [] : trajectoryEvents}
            />
            <MapLegend layers={MAP_LAYERS} />
          </div>

          {/* Unknown period callout overlay on map if applicable */}
          {isUnknownWindow && (
            <div className="absolute top-3 left-3 right-3 z-10 p-3 rounded-lg bg-surface/95 border border-warning/40 shadow-lg text-xs space-y-1 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-warning font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>No direct observation between {exactFrom} and {exactTo}</span>
              </div>
              <p className="text-text-secondary">
                The vehicle was not captured by any surveillance node during this queried time window.
              </p>
              <div className="flex items-center gap-4 text-text-muted pt-1 text-[11px] font-mono">
                <span>
                  Prior known:{' '}
                  <strong>
                    {trajectoryEvents[0]
                      ? `${trajectoryEvents[0].camera_id} — ${formatTimeShort(trajectoryEvents[0].timestamp)}`
                      : 'None in horizon'}
                  </strong>
                </span>
                <span>
                  Last known:{' '}
                  <strong>
                    {trajectoryEvents[trajectoryEvents.length - 1]
                      ? `${trajectoryEvents[trajectoryEvents.length - 1].camera_id} — ${formatTimeShort(trajectoryEvents[trajectoryEvents.length - 1].timestamp)}`
                      : 'None in horizon'}
                  </strong>
                </span>
              </div>
              <p className="text-[10px] text-text-muted italic pt-0.5">
                Note: The system preserves unmonitored intervals and never interpolates hypothetical movement paths.
              </p>
            </div>
          )}

          {/* Bottom trajectory breadcrumb */}
          {trajectoryEvents.length > 0 && !isUnknownWindow && (
            <div className="h-8 px-3 bg-surface/90 border-t border-border flex items-center justify-between text-xs font-mono text-text-primary z-10 shrink-0">
              <span className="text-[11px] text-text-muted uppercase font-sans">Observed Trajectory:</span>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                {trajectoryEvents.map((evt, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    <span className="font-bold text-accent-light">{evt.camera_id}</span>
                    <span className="text-[10px] text-text-muted font-normal">
                      ({formatTimeShort(evt.timestamp)})
                    </span>
                    {i < trajectoryEvents.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-text-muted" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Evidence, Observation Gaps, and Telemetry Panes */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto scrollbar-thin">
          {!trajectory || trajectoryEvents.length === 0 ? (
            <Panel title="Vehicle Intelligence">
              <EmptyState
                title="No vehicle selected"
                message="Search for a vehicle plate or ID to inspect spatial evidence, telemetry, and unmonitored interval gaps."
                icon={<Car className="w-5 h-5" />}
              />
            </Panel>
          ) : (
            <>
              {/* 1. VEHICLE EVIDENCE PANE */}
              <Panel
                title={`VEHICLE #${trajectory.vehicle_id}`}
                subtitle={enhancedTrajectory?.plate_number ? `Plate: ${enhancedTrajectory.plate_number}` : 'Surveillance record'}
                actions={
                  isWatchlisted ? (
                    <Badge color="red" size="sm">
                      WATCHLISTED
                    </Badge>
                  ) : (
                    <Badge color="blue" size="sm">
                      ACTIVE
                    </Badge>
                  )
                }
              >
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">First Seen</span>
                      <span className="font-mono font-bold text-text-primary mt-0.5 block">
                        {trajectory.events[0]?.timestamp ? formatTimeShort(trajectory.events[0].timestamp) : 'Unavailable'}
                      </span>
                      <span className="text-[9px] text-text-muted truncate block">{trajectory.events[0]?.camera_id || '—'}</span>
                    </div>

                    <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">Last Seen</span>
                      <span className="font-mono font-bold text-text-primary mt-0.5 block">
                        {trajectory.events[trajectory.events.length - 1]?.timestamp
                          ? formatTimeShort(trajectory.events[trajectory.events.length - 1].timestamp)
                          : 'Unavailable'}
                      </span>
                      <span className="text-[9px] text-text-muted truncate block">
                        {trajectory.events[trajectory.events.length - 1]?.camera_id || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                    <span className="text-[10px] uppercase font-semibold text-text-muted block mb-0.5">
                      Cameras Traversed ({trajectoryEvents.length} observations)
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {trajectoryEvents.map((e, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-surface border border-border text-accent-light"
                        >
                          {e.camera_id}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                    <span className="text-[10px] uppercase font-semibold text-text-muted block mb-0.5">
                      Observed Journey Corridor
                    </span>
                    <span className="font-mono font-bold text-text-primary text-xs">
                      {journeyString}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">Travel Time</span>
                      <span className="font-mono font-bold text-text-primary text-sm mt-0.5 block">
                        {travelTimeDisplay}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-bg-elevated border border-border-subtle">
                      <span className="text-[10px] uppercase font-semibold text-text-muted block">Speed Metric</span>
                      {speedDisplay.status === 'available' ? (
                        <span className="font-mono font-bold text-sm mt-0.5 block text-success">
                          {speedDisplay.text}
                        </span>
                      ) : (
                        <span className="font-mono text-xs mt-0.5 block text-text-muted">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Watchlist toggle action */}
                  <div className="pt-1 flex items-center justify-between">
                    {!isWatchlisted ? (
                      <button
                        onClick={() => {
                          setNewWatchlistPlate(enhancedTrajectory?.plate_number || trajectory.vehicle_id);
                          setShowWatchlistModal(true);
                        }}
                        className="text-xs text-danger font-semibold hover:underline flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Flag / Add to Watchlist
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveWatchlist(enhancedTrajectory?.plate_number || trajectory.vehicle_id)}
                        className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        Deactivate Watchlist Entry
                      </button>
                    )}
                  </div>
                </div>
              </Panel>

              {/* 2. OBSERVATION GAPS CARD */}
              <Panel
                title="OBSERVATION GAPS & COVERAGE AUDIT"
                subtitle="Identified unmonitored temporal windows"
                actions={<Clock className="w-4 h-4 text-warning" />}
              >
                <div className="space-y-2 text-xs">
                  {observationGaps.length > 0 ? (
                    <div className="space-y-2">
                      {observationGaps.map((gap, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-warning/10 border border-warning/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-warning font-mono">
                              {gap.previous_camera} → {gap.next_camera}
                            </span>
                            <Badge color="amber" size="sm">
                              {gap.gap_duration_seconds}s gap
                            </Badge>
                          </div>
                          <p className="text-text-secondary text-[11px] leading-relaxed">
                            No camera detections recorded between{' '}
                            <span className="font-mono font-semibold text-text-primary">
                              {formatTimeShort(gap.previous_timestamp)}
                            </span>{' '}
                            and{' '}
                            <span className="font-mono font-semibold text-text-primary">
                              {formatTimeShort(gap.next_timestamp)}
                            </span>
                            . Movement during this window remains unmonitored.
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded bg-bg-elevated border border-border-subtle text-text-secondary">
                      No critical observation gaps identified between consecutive detections in this horizon.
                    </div>
                  )}
                  <p className="text-[10px] text-text-muted italic pt-1">
                    Rule: Missing camera segments preserve empirical gaps without synthetic trajectory interpolation.
                  </p>
                </div>
              </Panel>

              {/* 3. Detections Timeline */}
              <Panel title="SURVEILLANCE TIMELINE" subtitle={`${trajectoryEvents.length} detections`}>
                <div className="space-y-1">
                  {trajectoryEvents.map((evt, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-bg-elevated text-xs font-mono">
                      <span className="text-text-muted w-12">{formatTimeShort(evt.timestamp)}</span>
                      <span className="font-bold text-text-primary">{evt.camera_id}</span>
                      <span className="text-[10px] text-text-muted font-sans truncate flex-1">
                        {camName(evt.camera_id)}
                      </span>
                      {evt.confidence && (
                        <span className="text-[9px] text-text-muted font-sans ml-auto">
                          {(evt.confidence * 100).toFixed(0)}% ANPR
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>

      {/* Watchlist / Hotlist Management Modal */}
      {showWatchlistModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-lg w-full p-4 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-danger" />
                <h3 className="text-sm font-bold text-text-primary">Surveillance Watchlist & Hotlist</h3>
              </div>
              <button
                onClick={() => setShowWatchlistModal(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {watchlistActionMsg && (
              <div className="p-2 rounded bg-accent/10 border border-accent/30 text-xs text-accent-light font-medium">
                {watchlistActionMsg}
              </div>
            )}

            {/* Add New Watchlist Form */}
            <div className="p-3 rounded-lg bg-bg-elevated border border-border-subtle space-y-2 text-xs">
              <span className="font-bold text-text-primary uppercase text-[11px] block">
                Register Target Plate
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Plate (e.g. TN01AB1234)"
                  value={newWatchlistPlate}
                  onChange={(e) => setNewWatchlistPlate(e.target.value.toUpperCase())}
                  className="px-2.5 py-1.5 rounded bg-surface border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-accent"
                />
                <select
                  value={newWatchlistPriority}
                  onChange={(e) => setNewWatchlistPriority(e.target.value as any)}
                  className="px-2 py-1.5 rounded bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-accent"
                >
                  <option value="CRITICAL">CRITICAL Priority</option>
                  <option value="HIGH">HIGH Priority</option>
                  <option value="MEDIUM">MEDIUM Priority</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Case Ref (e.g. CASE-2026-904)"
                  value={newWatchlistCaseRef}
                  onChange={(e) => setNewWatchlistCaseRef(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Reason / Surveillance Note"
                  value={newWatchlistReason}
                  onChange={(e) => setNewWatchlistReason(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-surface border border-border text-text-primary text-xs focus:outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={handleAddWatchlist}
                className="w-full mt-1 py-1.5 rounded bg-danger text-white font-semibold hover:bg-danger-dim transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Active Watchlist
              </button>
            </div>

            {/* Active Watchlist Table */}
            <div className="flex-1 overflow-y-auto scrollbar-thin border border-border-subtle rounded divide-y divide-border-subtle">
              {watchlist.filter((w) => w.status === 'active').length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  No active watchlist records found.
                </div>
              ) : (
                watchlist
                  .filter((w) => w.status === 'active')
                  .map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-bg-elevated transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-text-primary">{item.plate_number}</span>
                          <Badge
                            color={item.priority === 'CRITICAL' ? 'red' : item.priority === 'HIGH' ? 'amber' : 'blue'}
                            size="sm"
                          >
                            {item.priority}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-text-secondary">{item.reason || 'No reason specified'}</span>
                        {item.case_reference && (
                          <span className="text-[10px] text-text-muted font-mono">{item.case_reference}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveWatchlist(item.plate_number)}
                        title="Deactivate from watchlist"
                        className="p-1.5 rounded hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
