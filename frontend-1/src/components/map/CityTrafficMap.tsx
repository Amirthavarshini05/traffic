import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { Map as MLMap, Marker, Popup, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { CITY_CENTER, DEFAULT_ZOOM } from '@/lib/constants';
import { useAppData } from '@/context/AppDataContext';
import { useTheme } from '@/context/ThemeContext';
import { useSelection } from '@/context/SelectionContext';
import type { Camera, CameraRoute, CameraHealth, RouteAnalytics } from '@/types';
import { MapPin } from 'lucide-react';

try {
  setWorkerUrl(maplibreWorker);
} catch {
  // Worker already set or fallback
}

export interface CityTrafficMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]]) => void;
  resize: () => void;
}

export interface MapLayerConfig {
  cameras?: boolean;
  cameraHealth?: boolean;
  routes?: boolean;
  congestion?: boolean;
  trafficDensity?: boolean;
  trajectory?: boolean;
  incidents?: boolean;
  odFlow?: boolean;
}

interface CityTrafficMapProps {
  layers: MapLayerConfig;
  routeAnalytics?: RouteAnalytics[];
  trajectoryEvents?: { camera_id: string; timestamp: string; lat?: number; lng?: number }[];
  odRecords?: { from_camera_id: string; to_camera_id: string; vehicle_count: number }[];
  selectedOriginCam?: string;
  selectedDestCam?: string;
  onCameraClick?: (cameraId: string) => void;
  onRouteClick?: (routeId: string) => void;
  onMapClick?: () => void;
  height?: string;
  showControls?: boolean;
}

export const CityTrafficMap = forwardRef<CityTrafficMapHandle, CityTrafficMapProps>(
  function CityTrafficMap(
    {
      layers,
      routeAnalytics,
      trajectoryEvents,
      odRecords,
      selectedOriginCam,
      selectedDestCam,
      onCameraClick,
      onRouteClick,
      onMapClick,
      height = '100%',
      showControls = true,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MLMap | null>(null);
    const markersRef = useRef<Record<string, Marker>>({});
    const incidentMarkersRef = useRef<Marker[]>([]);
    const routeHoverPopupRef = useRef<Popup | null>(null);
    const cameraHoverPopupRef = useRef<Popup | null>(null);
    const lastFocusedKeyRef = useRef<string | null>(null);

    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState(false);

    const { cameras, cameraRoutes, cameraHealth, alerts } = useAppData();
    const { theme } = useTheme();
    const { selection } = useSelection();

    // Cache latest arrays in refs to prevent unnecessary re-centering on poll
    const camerasRef = useRef(cameras);
    camerasRef.current = cameras;
    const routesRef = useRef(cameraRoutes);
    routesRef.current = cameraRoutes;
    const alertsRef = useRef(alerts);
    alertsRef.current = alerts;

    const isDark = theme === 'dark';

    const flyTo = useCallback((lng: number, lat: number, zoom = 14) => {
      try {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 800 });
      } catch (e) {
        console.warn('Map flyTo failed:', e);
      }
    }, []);

    const fitBounds = useCallback((bounds: [[number, number], [number, number]]) => {
      try {
        mapRef.current?.fitBounds(bounds, { padding: 60, duration: 800 });
      } catch (e) {
        console.warn('Map fitBounds failed:', e);
      }
    }, []);

    const resize = useCallback(() => {
      try {
        mapRef.current?.resize();
      } catch {
        // ignore
      }
    }, []);

    useImperativeHandle(ref, () => ({ flyTo, fitBounds, resize }));

    // 1. Initialize Map with clean, unmetered, watermark-free raster tiles
    useEffect(() => {
      if (mapRef.current || !containerRef.current) return;

      let map: MLMap;
      try {
        map = new MLMap({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'osm-layer',
                type: 'raster',
                source: 'osm',
                paint: isDark
                  ? {
                      'raster-brightness-max': 0.70,
                      'raster-saturation': -0.45,
                      'raster-contrast': 0.15,
                    }
                  : {
                      'raster-brightness-max': 1.0,
                      'raster-saturation': 0.0,
                      'raster-contrast': 0.0,
                    },
              },
            ],
          },
          center: CITY_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
        });
      } catch (err) {
        console.error('Failed to create MapLibre map instance:', err);
        setMapError(true);
        return;
      }

      map.on('load', () => {
        setMapReady(true);
        map.resize();
      });

      map.on('error', (e) => {
        console.warn('MapLibre notice:', e.error?.message || e);
      });

      if (showControls) {
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      }

      map.on('click', (e) => {
        if (e.originalEvent.target === map.getCanvas()) {
          onMapClick?.();
        }
      });

      mapRef.current = map;

      // Handle container resizing (e.g. flex layout, drawer toggle)
      const ro = new ResizeObserver(() => {
        map.resize();
      });
      ro.observe(containerRef.current);

      const tId = setTimeout(() => map.resize(), 250);

      return () => {
        clearTimeout(tId);
        ro.disconnect();
        setMapReady(false);
        try {
          map.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      };
    }, []);

    // 2. Update Raster Filter on Theme Change
    useEffect(() => {
      if (!mapRef.current || !mapReady) return;
      const map = mapRef.current;
      try {
        if (map.getLayer('osm-layer')) {
          map.setPaintProperty('osm-layer', 'raster-brightness-max', isDark ? 0.70 : 1.0);
          map.setPaintProperty('osm-layer', 'raster-saturation', isDark ? -0.45 : 0.0);
          map.setPaintProperty('osm-layer', 'raster-contrast', isDark ? 0.15 : 0.0);
        }
      } catch (err) {
        console.warn('Could not update map theme paint:', err);
      }
    }, [isDark, mapReady]);

    // 3. Camera Nodes: Native WebGL GeoJSON Layer (100% Hardware-Locked, Zero Drift on Zoom)
    useEffect(() => {
      if (!mapRef.current || !mapReady) return;
      const map = mapRef.current;

      // Clean up any legacy DOM markers if present
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const shouldShow = layers.cameras || layers.cameraHealth;
      if (!shouldShow) {
        if (map.getLayer('camera-nodes-badge')) map.removeLayer('camera-nodes-badge');
        if (map.getLayer('camera-nodes-core')) map.removeLayer('camera-nodes-core');
        if (map.getLayer('camera-nodes-glow')) map.removeLayer('camera-nodes-glow');
        if (map.getSource('camera-nodes')) map.removeSource('camera-nodes');
        return;
      }

      const healthMap: Record<string, CameraHealth> = {};
      cameraHealth?.cameras?.forEach((c) => {
        healthMap[c.camera_id] = c.status;
      });

      const selectedCamId = selection?.type === 'camera' ? selection.id : null;
      const selectedRouteId = selection?.type === 'route' ? selection.id : null;

      let originCamId = selectedOriginCam || null;
      let destCamId = selectedDestCam || null;
      if (selectedRouteId && selectedRouteId.includes('_')) {
        const parts = selectedRouteId.split('_');
        originCamId = parts[0];
        destCamId = parts[1];
      }

      const hasActiveOD = Boolean(originCamId || destCamId);

      const features: GeoJSON.Feature[] = [];

      cameras.forEach((cam: Camera) => {
        if (!cam.lat || !cam.lng) return;
        const status = healthMap[cam.camera_id] || cam.status || 'HEALTHY';
        const color =
          status === 'HEALTHY'
            ? '#10b981'
            : status === 'WARNING'
            ? '#f59e0b'
            : status === 'OFFLINE'
            ? '#ef4444'
            : '#94a3b8';

        const isSelected = selectedCamId === cam.camera_id;
        const isOrigin = originCamId === cam.camera_id;
        const isDest = destCamId === cam.camera_id;

        const activeAlert = (alerts || []).find(
          (a) => a.camera_id === cam.camera_id && a.status === 'ACTIVE'
        );
        const hasIncident = Boolean(activeAlert) && Boolean(layers.incidents);

        const connectedRoutes = cameraRoutes.filter(
          (r) => r.from_camera_id === cam.camera_id || r.to_camera_id === cam.camera_id
        );

        let cameraVolume = 0;
        routeAnalytics?.forEach((r) => {
          if (r.from_camera_id === cam.camera_id || r.to_camera_id === cam.camera_id) {
            cameraVolume += r.vehicle_count ?? 0;
          }
        });

        const isDimmed = (selectedCamId && !isSelected) || (hasActiveOD && !isOrigin && !isDest);
        const opacity = isDimmed ? 0.35 : 1.0;
        const radius = isSelected ? 10 : isOrigin || isDest ? 10 : 7.5;
        const strokeWidth = isSelected ? 3 : 2;
        const glowRadius = isSelected ? 22 : isOrigin || isDest ? 20 : hasIncident ? 20 : 12;
        const glowOpacity = isDimmed ? 0.15 : isSelected ? 0.85 : isOrigin || isDest ? 0.8 : hasIncident ? 0.85 : 0.35;
        const glowColor = hasIncident ? '#ef4444' : isOrigin ? '#10b981' : isDest ? '#f59e0b' : color;
        const badge = isOrigin ? 'O' : isDest ? 'D' : '';

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [cam.lng, cam.lat],
          },
          properties: {
            camera_id: cam.camera_id,
            name: cam.name || 'Surveillance Node',
            zone: cam.zone || 'Metropolitan',
            status,
            color,
            radius,
            stroke_width: strokeWidth,
            glow_radius: glowRadius,
            glow_opacity: glowOpacity,
            glow_color: glowColor,
            opacity,
            badge,
            has_incident: hasIncident ? 1 : 0,
            alert_title: activeAlert?.title || '',
            camera_volume: cameraVolume,
            connected_routes_count: connectedRoutes.length,
          },
        });
      });

      const geojsonData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      try {
        const source = map.getSource('camera-nodes') as any;
        if (source) {
          source.setData(geojsonData);
        } else {
          map.addSource('camera-nodes', {
            type: 'geojson',
            data: geojsonData,
          });

          // 1. Halo / Glow layer (hardware-rendered WebGL)
          map.addLayer({
            id: 'camera-nodes-glow',
            type: 'circle',
            source: 'camera-nodes',
            paint: {
              'circle-radius': ['get', 'glow_radius'],
              'circle-color': ['get', 'glow_color'],
              'circle-opacity': ['get', 'glow_opacity'],
              'circle-blur': 0.75,
            },
          });

          // 2. Crisp Node Core layer (hardware-rendered WebGL, 100% locked to coordinate)
          map.addLayer({
            id: 'camera-nodes-core',
            type: 'circle',
            source: 'camera-nodes',
            paint: {
              'circle-radius': ['get', 'radius'],
              'circle-color': ['get', 'color'],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': ['get', 'stroke_width'],
              'circle-opacity': ['get', 'opacity'],
              'circle-stroke-opacity': ['get', 'opacity'],
            },
          });

          // 3. Origin / Destination Badge Text (O / D)
          map.addLayer({
            id: 'camera-nodes-badge',
            type: 'symbol',
            source: 'camera-nodes',
            layout: {
              'text-field': ['get', 'badge'],
              'text-size': 10,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#ffffff',
            },
          });

          // Tooltip on Hover
          map.on('mouseenter', 'camera-nodes-core', () => {
            map.getCanvas().style.cursor = 'pointer';
          });

          map.on('mousemove', 'camera-nodes-core', (e) => {
            if (!e.features || !e.features[0]) return;
            const props = e.features[0].properties as any;
            if (!props) return;

            const color = props.color;
            const status = props.status;
            const isOrigin = props.badge === 'O';
            const isDest = props.badge === 'D';
            const hasIncident = props.has_incident === 1;

            if (!cameraHoverPopupRef.current) {
              cameraHoverPopupRef.current = new Popup({
                offset: 14,
                closeButton: false,
                closeOnClick: false,
                className: 'map-hover-tooltip',
              });
            }

            const nodeCoordinates = (e.features[0].geometry as any)?.coordinates;
            cameraHoverPopupRef.current
              .setLngLat(nodeCoordinates || e.lngLat)
              .setHTML(`
                <div style="padding: 7px 11px; font-family: system-ui, -apple-system, sans-serif; min-width: 170px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-weight: 800; font-family: monospace; font-size: 12px; color: ${color};">${props.camera_id}</span>
                    <span style="font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: ${color}22; color: ${color};">${status}</span>
                  </div>
                  <div style="font-size: 11px; font-weight: 600; margin-top: 3px; color: #f1f5f9;">${props.name}</div>
                  <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Zone: ${props.zone}</div>

                  <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 10px; font-family: monospace; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 4px;">
                    ${Number(props.camera_volume) > 0 ? `<span style="color: #38bdf8;"><strong>${Number(props.camera_volume).toLocaleString()}</strong> veh</span>` : ''}
                    <span style="color: #94a3b8;">${props.connected_routes_count} corridors</span>
                  </div>

                  ${hasIncident && props.alert_title ? `
                    <div style="margin-top: 5px; padding: 3px 6px; border-radius: 3px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); font-size: 10px; font-weight: 600; color: #ef4444; display: flex; align-items: center; gap: 4px;">
                      <span>🚨</span>
                      <span>${props.alert_title}</span>
                    </div>
                  ` : ''}

                  ${isOrigin ? '<div style="font-size: 10px; font-weight: 800; color: #10b981; margin-top: 3px;">[ACTIVE ORIGIN NODE]</div>' : ''}
                  ${isDest ? '<div style="font-size: 10px; font-weight: 800; color: #f59e0b; margin-top: 3px;">[ACTIVE DESTINATION NODE]</div>' : ''}

                  <div style="font-size: 9px; color: #64748b; margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 3px;">
                    Click to inspect node · Open analytics & OD
                  </div>
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseleave', 'camera-nodes-core', () => {
            map.getCanvas().style.cursor = '';
            cameraHoverPopupRef.current?.remove();
          });

          map.on('click', 'camera-nodes-core', (e) => {
            if (!e.features || !e.features[0]) return;
            const props = e.features[0].properties as any;
            if (props?.camera_id) {
              onCameraClick?.(props.camera_id);
            }
          });
        }
      } catch (err) {
        console.warn('Could not update camera-nodes layer:', err);
      }
    }, [cameras, cameraRoutes, routeAnalytics, cameraHealth, alerts, layers.cameras, layers.cameraHealth, layers.incidents, selection, selectedOriginCam, selectedDestCam, onCameraClick, mapReady]);

    // 4. Route Network Lines Layer with OD Highlighting & Hover Popups
    useEffect(() => {
      if (!mapRef.current || !mapReady) return;
      const map = mapRef.current;

      const shouldShowRoutes = layers.routes || layers.congestion || layers.trafficDensity || layers.odFlow;
      if (!shouldShowRoutes) {
        if (map.getLayer('camera-routes-glow')) map.removeLayer('camera-routes-glow');
        if (map.getLayer('camera-routes-line')) map.removeLayer('camera-routes-line');
        if (map.getSource('camera-routes')) map.removeSource('camera-routes');
        return;
      }

      const analyticsMap: Record<string, RouteAnalytics> = {};
      routeAnalytics?.forEach((r) => {
        analyticsMap[`${r.from_camera_id}_${r.to_camera_id}`] = r;
      });

      const odMap: Record<string, number> = {};
      odRecords?.forEach((r) => {
        odMap[`${r.from_camera_id}_${r.to_camera_id}`] = r.vehicle_count;
      });

      const selectedRouteId = selection?.type === 'route' ? selection.id : null;
      const selectedCamId = selection?.type === 'camera' ? selection.id : null;

      let effectiveOrigin = selectedOriginCam;
      let effectiveDest = selectedDestCam;
      if (selectedRouteId && selectedRouteId.includes('_')) {
        const parts = selectedRouteId.split('_');
        effectiveOrigin = parts[0];
        effectiveDest = parts[1];
      }

      const features: any[] = [];

      cameraRoutes.forEach((r: CameraRoute) => {
        const key = `${r.from_camera_id}_${r.to_camera_id}`;
        const analytics = analyticsMap[key];
        const congestionLevel = analytics?.congestion_level || 'LOW';
        const odVolume = odMap[key] ?? analytics?.vehicle_count;

        const isSelected =
          selectedRouteId === r.route_id ||
          selectedRouteId === key ||
          (effectiveOrigin && effectiveDest && r.from_camera_id === effectiveOrigin && r.to_camera_id === effectiveDest) ||
          (selectedRouteId && selectedRouteId.includes('_') && selectedRouteId === `${r.from_camera_id}_${r.to_camera_id}`);

        const isConnected =
          selectedCamId &&
          (r.from_camera_id === selectedCamId || r.to_camera_id === selectedCamId);

        let color = isDark ? '#38BDF8' : '#2563EB';
        if (layers.congestion) {
          if (congestionLevel === 'HIGH' || (analytics?.delay_pct && analytics.delay_pct > 35)) {
            color = '#EF4444';
          } else if (congestionLevel === 'MODERATE' || (analytics?.delay_pct && analytics.delay_pct > 15)) {
            color = '#F59E0B';
          } else {
            color = '#10B981';
          }
        }

        // Highlight selected OD corridor with brilliant cyan/amber glow
        if (isSelected) {
          color = '#38BDF8';
        }

        const width = isSelected ? 6.5 : isConnected ? 4.5 : 2.5;
        const glowWidth = isSelected ? 14 : 0;
        const glowOpacity = isSelected ? 0.75 : 0;
        const hasAnySelection = Boolean(selectedRouteId || selectedCamId || (effectiveOrigin && effectiveDest));
        const opacity = hasAnySelection ? (isSelected || isConnected ? 1.0 : 0.18) : 0.8;

        const props = {
          route_id: r.route_id || key,
          from: r.from_camera_id,
          to: r.to_camera_id,
          route_name: r.route_name || `${r.from_camera_id} → ${r.to_camera_id}`,
          congestion_level: congestionLevel,
          vehicle_count: odVolume ?? analytics?.vehicle_count,
          delay_pct: analytics?.delay_pct,
          color,
          width,
          opacity,
          glow_width: glowWidth,
          glow_opacity: glowOpacity,
        };

        if (r.geometry && r.geometry.coordinates) {
          features.push({
            type: 'Feature',
            properties: props,
            geometry: r.geometry,
          });
        } else if (r.from_lng && r.from_lat && r.to_lng && r.to_lat) {
          features.push({
            type: 'Feature',
            properties: props,
            geometry: {
              type: 'LineString',
              coordinates: [
                [r.from_lng, r.from_lat],
                [r.to_lng, r.to_lat],
              ],
            },
          });
        }
      });

      const geojsonData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      try {
        const source = map.getSource('camera-routes') as any;
        if (source) {
          source.setData(geojsonData);
        } else {
          map.addSource('camera-routes', {
            type: 'geojson',
            data: geojsonData,
          });

          // Glow halo layer for selected route
          map.addLayer({
            id: 'camera-routes-glow',
            type: 'line',
            source: 'camera-routes',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': ['get', 'glow_width'],
              'line-opacity': ['get', 'glow_opacity'],
              'line-blur': 3,
            },
          });

          // Main crisp route line
          map.addLayer({
            id: 'camera-routes-line',
            type: 'line',
            source: 'camera-routes',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': ['get', 'width'],
              'line-opacity': ['get', 'opacity'],
            },
          });

          // Route click handler
          map.on('click', 'camera-routes-line', (e) => {
            if (e.features && e.features[0]) {
              const props = e.features[0].properties;
              if (props) {
                onRouteClick?.(props.route_id || `${props.from}_${props.to}`);
              }
            }
          });

          // Route Hover Popup
          const routeHoverPopup = new Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
            className: 'map-hover-tooltip',
          });
          routeHoverPopupRef.current = routeHoverPopup;

          map.on('mousemove', 'camera-routes-line', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            if (!e.features || !e.features[0]) return;
            const props = e.features[0].properties as any;
            if (!props) return;

            const statusColor =
              props.congestion_level === 'HIGH'
                ? '#ef4444'
                : props.congestion_level === 'MODERATE'
                ? '#f59e0b'
                : '#10b981';

            routeHoverPopup
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="padding: 6px 10px; font-family: system-ui, -apple-system, sans-serif; min-width: 160px;">
                  <div style="font-weight: 700; font-size: 11px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span>${props.from} ➔ ${props.to}</span>
                    <span style="font-size: 9px; padding: 1px 5px; border-radius: 3px; background: ${statusColor}22; color: ${statusColor}; font-weight: 700;">${props.congestion_level || 'CLEAR'}</span>
                  </div>
                  <div style="font-size: 10px; color: #cbd5e1; margin-top: 3px;">${props.route_name || 'Corridor Route'}</div>
                  <div style="display: flex; gap: 8px; margin-top: 5px; font-size: 10px; font-family: monospace;">
                    ${props.vehicle_count != null ? `<span style="color: #f1f5f9;"><strong>${props.vehicle_count}</strong> veh</span>` : ''}
                    ${props.delay_pct != null ? `<span style="color: #f87171;">+${Number(props.delay_pct).toFixed(0)}% delay</span>` : ''}
                  </div>
                </div>
              `)
              .addTo(map);
          });

          map.on('mouseleave', 'camera-routes-line', () => {
            map.getCanvas().style.cursor = '';
            routeHoverPopup.remove();
          });
        }
      } catch (err) {
        console.warn('Could not update camera-routes layer:', err);
      }
    }, [cameraRoutes, routeAnalytics, odRecords, layers.routes, layers.congestion, layers.trafficDensity, layers.odFlow, selection, selectedOriginCam, selectedDestCam, onRouteClick, mapReady, isDark]);

    // 5. Vehicle Trajectory Layer (for Vehicle Intelligence page)
    useEffect(() => {
      if (!mapRef.current || !mapReady) return;
      const map = mapRef.current;

      const validEvents = (trajectoryEvents || []).filter((e) => e.lng && e.lat);

      if (!layers.trajectory || validEvents.length < 2) {
        if (map.getLayer('trajectory-line')) map.removeLayer('trajectory-line');
        if (map.getSource('trajectory-source')) map.removeSource('trajectory-source');
        return;
      }

      const coordinates = validEvents.map((e) => [e.lng!, e.lat!] as [number, number]);

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        ],
      };

      try {
        const source = map.getSource('trajectory-source') as any;
        if (source) {
          source.setData(geojson);
        } else {
          map.addSource('trajectory-source', {
            type: 'geojson',
            data: geojson,
          });

          map.addLayer({
            id: 'trajectory-line',
            type: 'line',
            source: 'trajectory-source',
            paint: {
              'line-color': '#A855F7',
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });
        }
      } catch (err) {
        console.warn('Could not update trajectory layer:', err);
      }
    }, [trajectoryEvents, layers.trajectory, mapReady]);

    // 6. Active Alert Incidents are seamlessly integrated into Camera Markers (Section 3)
    // with pulsing beacons to avoid duplicate floating points.
    useEffect(() => {
      incidentMarkersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current = [];
    }, []);

    // 7. Pan / Zoom ONLY when selection changes to a new target (prevents unwanted reset on poll)
    useEffect(() => {
      if (!mapRef.current || !mapReady) return;

      if (!selection) {
        lastFocusedKeyRef.current = null;
        return;
      }

      const currentKey = `${selection.type}:${selection.id}`;
      // Do not re-fly if user is already focused on this element
      if (currentKey === lastFocusedKeyRef.current) return;
      lastFocusedKeyRef.current = currentKey;

      try {
        if (selection.type === 'camera') {
          const cam = camerasRef.current.find((c) => c.camera_id === selection.id);
          if (cam?.lat && cam?.lng) flyTo(cam.lng, cam.lat, 15);
        } else if (selection.type === 'route') {
          const route = routesRef.current.find(
            (r) => r.route_id === selection.id || `${r.from_camera_id}_${r.to_camera_id}` === selection.id
          );
          if (route?.from_lat && route?.from_lng && route?.to_lat && route?.to_lng) {
            const midLng = (route.from_lng + route.to_lng) / 2;
            const midLat = (route.from_lat + route.to_lat) / 2;
            flyTo(midLng, midLat, 13.5);
          }
        } else if (selection.type === 'zone') {
          const zoneCams = camerasRef.current.filter(
            (c) => c.zone?.toLowerCase() === selection.id.toLowerCase()
          );
          const valid = zoneCams.filter((c) => c.lat && c.lng);
          if (valid.length > 0) {
            const avgLng = valid.reduce((s, c) => s + c.lng!, 0) / valid.length;
            const avgLat = valid.reduce((s, c) => s + c.lat!, 0) / valid.length;
            flyTo(avgLng, avgLat, 14);
          }
        } else if (selection.type === 'alert') {
          const alert = alertsRef.current.find((a) => a.alert_id === selection.id);
          if (alert?.camera_id) {
            const cam = camerasRef.current.find((c) => c.camera_id === alert.camera_id);
            if (cam?.lat && cam?.lng) flyTo(cam.lng, cam.lat, 15);
          }
        }
      } catch (err) {
        console.warn('Could not focus on selection:', err);
      }
    }, [selection, flyTo, mapReady]);

    return (
      <div className="relative w-full h-full min-h-[300px]" style={{ height }}>
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: '6px' }}
        />
        {mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-surface text-center p-4">
            <MapPin className="w-6 h-6 text-text-muted" />
            <p className="text-sm font-medium text-text-secondary">Map unavailable</p>
            <p className="text-xs text-text-muted max-w-xs">
              MapLibre canvas initialization failed.
            </p>
          </div>
        )}
        {!showControls && (
          <style>{`.maplibregl-ctrl-top-right { display: none !important; }`}</style>
        )}
      </div>
    );
  }
);
