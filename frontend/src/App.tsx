{/*import { useEffect, useRef } from "react";
import { Map, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(maplibreWorker);

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new Map({
      container: mapContainer.current,

      style: {
        version: 8,

        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },

        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },

      center: [80.23, 13.04],
      zoom: 11,
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}

export default App;*/}

import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(maplibreWorker);

interface Camera {
  camera_id: string;
  camera_name: string;
  status: string;
  longitude: number;
  latitude: number;
}

interface CamerasResponse {
  cameras: Camera[];
}

interface CameraHealth {
  camera_id: string;
  camera_name: string;
  configured_status: string;
  last_event_at: string | null;
  health_status: string;
  minutes_since_last_event: number | null;
}

interface CameraHealthResponse {
  cameras: CameraHealth[];
}

interface CameraRoute {
  route_id: number;
  starting_node: string;
  ending_node: string;
  total_distance_m: number;
  geometry: {
    type: "MultiLineString";
    coordinates: number[][][];
  };
}

interface CameraRoutesResponse {
  routes: CameraRoute[];
}

function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraHealth, setCameraHealth] = useState<CameraHealth[]>([]);
  const [routes, setRoutes] = useState<CameraRoute[]>([]);

  // Fetch camera data from FastAPI
  useEffect(() => {
    fetch("http://127.0.0.1:8000/cameras")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch cameras");
        }

        return response.json();
      })
      .then((data: CamerasResponse) => {
        setCameras(data.cameras);
      })
      .catch((error) => {
        console.error("Camera API error:", error);
      });
  }, []);

  useEffect(() => {
  fetch("http://127.0.0.1:8000/cameras/health")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch camera health");
      }

      return response.json();
    })
    .then((data: CameraHealthResponse) => {
      setCameraHealth(data.cameras);
    })
    .catch((error) => {
      console.error("Camera health API error:", error);
    });
}, []);

// Fetch camera routes from FastAPI
useEffect(() => {
  fetch("http://127.0.0.1:8000/camera-routes")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch camera routes");
      }

      return response.json();
    })
    .then((data: CameraRoutesResponse) => {
      setRoutes(data.routes);
    })
    .catch((error) => {
      console.error("Camera routes API error:", error);
    });
}, []);

  // Create MapLibre map
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new Map({
      container: mapContainer.current,

      style: {
        version: 8,

        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },

        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },

      center: [80.23, 13.04],
      zoom: 11,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add camera markers to the map
  // Add camera markers based on camera health
useEffect(() => {
  const map = mapRef.current;

  if (
    !map ||
    cameras.length === 0 ||
    cameraHealth.length === 0
  ) {
    return;
  }

  cameras.forEach((camera) => {
    const health = cameraHealth.find(
      (item) => item.camera_id === camera.camera_id
    );

    const healthStatus = health?.health_status ?? "OFFLINE";

    let markerColor = "#22c55e";

    if (healthStatus === "WARNING") {
      markerColor = "#f59e0b";
    } else if (healthStatus === "OFFLINE") {
      markerColor = "#ef4444";
    }

    const markerElement = document.createElement("div");

    markerElement.style.width = "18px";
    markerElement.style.height = "18px";
    markerElement.style.borderRadius = "50%";
    markerElement.style.backgroundColor = markerColor;
    markerElement.style.border = "3px solid white";
    markerElement.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
    markerElement.style.cursor = "pointer";

    new Marker({
      element: markerElement,
    })
      .setLngLat([
        camera.longitude,
        camera.latitude,
      ])
      .setPopup(
        new Popup().setHTML(`
          <strong>${camera.camera_id}</strong><br/>
          ${camera.camera_name}<br/>
          Health: ${healthStatus}<br/>
          Configured Status: ${camera.status}
        `)
      )
      .addTo(map);
  });
}, [cameras, cameraHealth]);

useEffect(() => {
  const map = mapRef.current;

  if (!map || routes.length === 0) {
    return;
  }

  const addRoutes = () => {
    const geojson = {
      type: "FeatureCollection" as const,
      features: routes.map((route) => ({
        type: "Feature" as const,
        properties: {
          route_id: route.route_id,
          starting_node: route.starting_node,
          ending_node: route.ending_node,
          total_distance_m: route.total_distance_m,
        },
        geometry: route.geometry,
      })),
    };

    if (map.getSource("camera-routes")) {
      return;
    }

    map.addSource("camera-routes", {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: "camera-routes-line",
      type: "line",
      source: "camera-routes",
      paint: {
        "line-color": "#2563eb",
        "line-width": 4,
        "line-opacity": 0.75,
      },
    });
  };

  if (map.isStyleLoaded()) {
    addRoutes();
  } else {
    map.once("load", addRoutes);
  }
}, [routes]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}

export default App;