-- ====================================================================
-- City Traffic Database Schema (PostgreSQL + PostGIS)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. CAMERAS
CREATE TABLE IF NOT EXISTS cameras (
    camera_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(64) DEFAULT 'ACTIVE',
    location GEOMETRY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed cameras
INSERT INTO cameras (camera_id, name, status, location) VALUES
('CAM01', 'Kathipara Junction ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2045, 13.0068), 4326)),
('CAM02', 'Gemini Flyover ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2505, 13.0528), 4326)),
('CAM03', 'Madhya Kailash Junction ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2462, 13.0066), 4326)),
('CAM04', 'Taramani Tech Park ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2510, 12.9759), 4326)),
('CAM05', 'Koyambedu CMBT Junction ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.1980, 13.0694), 4326)),
('CAM06', 'Velachery Checkpost ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2220, 12.9750), 4326)),
('CAM07', 'Sholinganallur Junction ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2495, 12.9400), 4326)),
('CAM08', 'Chennai Airport Terminal ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.1700, 12.9800), 4326)),
('CAM09', 'Chennai Central Station ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2750, 13.0820), 4326)),
('CAM10', 'T. Nagar Panagal Park ANPR', 'ACTIVE', ST_SetSRID(ST_MakePoint(80.2300, 13.0400), 4326))
ON CONFLICT (camera_id) DO UPDATE 
SET name = EXCLUDED.name, location = EXCLUDED.location;

-- 2. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    plate_number VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles (plate_number);

-- 3. EVENTS (ANPR observations)
CREATE TABLE IF NOT EXISTS events (
    event_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    camera_id VARCHAR(64) REFERENCES cameras(camera_id),
    plate_number VARCHAR(64) NOT NULL,
    vehicle_type VARCHAR(64),
    make VARCHAR(64),
    model VARCHAR(64),
    color VARCHAR(64),
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    confidence NUMERIC,
    heading NUMERIC DEFAULT 0.0,
    location GEOMETRY(Point, 4326),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_vehicle_obs ON events (vehicle_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_camera_obs ON events (camera_id, observed_at DESC);

-- 4. CAMERA ROUTES (Predefined OpenStreetMap paths between cameras)
CREATE TABLE IF NOT EXISTS camera_routes (
    route_id SERIAL PRIMARY KEY,
    starting_node VARCHAR(64) NOT NULL,
    ending_node VARCHAR(64) NOT NULL,
    road_list JSONB,
    total_distance_m DOUBLE PRECISION,
    geometry GEOMETRY(Geometry, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_camera_routes_nodes ON camera_routes (starting_node, ending_node);

-- 5. ROUTE TRAVEL STATS
CREATE TABLE IF NOT EXISTS route_travel_stats (
    stat_id SERIAL PRIMARY KEY,
    starting_camera_id VARCHAR(64) NOT NULL,
    ending_camera_id VARCHAR(64) NOT NULL,
    average_travel_seconds DOUBLE PRECISION,
    stddev_travel_seconds DOUBLE PRECISION,
    sample_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TRAJECTORIES (Calculated multi-camera journeys)
CREATE TABLE IF NOT EXISTS trajectories (
    trajectory_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    start_event_id INTEGER REFERENCES events(event_id),
    end_event_id INTEGER REFERENCES events(event_id),
    from_camera_id VARCHAR(64) REFERENCES cameras(camera_id),
    to_camera_id VARCHAR(64) REFERENCES cameras(camera_id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
    travel_time_seconds DOUBLE PRECISION,
    distance_m DOUBLE PRECISION,
    road_sequence JSONB,
    geometry GEOMETRY(Geometry, 4326),
    inference_method VARCHAR(64),
    confidence DOUBLE PRECISION,
    prev_trajectory_id INTEGER,
    next_trajectory_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trajectories_vehicle ON trajectories (vehicle_id, started_at);
CREATE INDEX IF NOT EXISTS idx_trajectories_window ON trajectories (started_at, ended_at);

-- 7. NOTIFICATION TRIGGER FOR REALTIME TRAJECTORY PUBLISHING
CREATE OR REPLACE FUNCTION notify_trajectory_created()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('trajectory_created', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trajectory_created ON trajectories;
CREATE TRIGGER trigger_trajectory_created
AFTER INSERT ON trajectories
FOR EACH ROW EXECUTE FUNCTION notify_trajectory_created();

-- 8. TRIPS (Origin-Destination aggregations)
CREATE TABLE IF NOT EXISTS trips (
    trip_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    origin_camera_id VARCHAR(64),
    destination_camera_id VARCHAR(64),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_travel_time_seconds DOUBLE PRECISION,
    total_distance_m DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. HISTORICAL CONGESTION
CREATE TABLE IF NOT EXISTS historical_congestion (
    congestion_id SERIAL PRIMARY KEY,
    from_camera_id VARCHAR(64),
    to_camera_id VARCHAR(64),
    time_window_start TIMESTAMP WITH TIME ZONE,
    time_window_end TIMESTAMP WITH TIME ZONE,
    vehicle_count INTEGER,
    baseline_travel_time_seconds DOUBLE PRECISION,
    average_travel_time_seconds DOUBLE PRECISION,
    average_delay_seconds DOUBLE PRECISION,
    average_delay_percent DOUBLE PRECISION,
    congestion_level VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. ZONES
CREATE TABLE IF NOT EXISTS zones (
    zone_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    boundary GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. ALERTS
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    camera_id VARCHAR(64),
    alert_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) DEFAULT 'MEDIUM',
    description TEXT,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. CONGESTION PROPAGATION
CREATE TABLE IF NOT EXISTS congestion_propagation (
    propagation_id SERIAL PRIMARY KEY,
    route_id INTEGER,
    from_camera_id VARCHAR(64),
    to_camera_id VARCHAR(64),
    propagation_level VARCHAR(32),
    estimated_impact_minutes DOUBLE PRECISION,
    detected_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
