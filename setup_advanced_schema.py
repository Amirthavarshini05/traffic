import os
from app.database import get_connection

def setup_schema():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. VEHICLE WATCHLIST
            cur.execute("""
            CREATE TABLE IF NOT EXISTS vehicle_watchlist (
                watchlist_id SERIAL PRIMARY KEY,
                plate_number VARCHAR(64) UNIQUE NOT NULL,
                status VARCHAR(32) DEFAULT 'active',
                reason TEXT,
                case_reference VARCHAR(128),
                priority VARCHAR(32) DEFAULT 'HIGH',
                created_by VARCHAR(64) DEFAULT 'system',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 2. AUDIT LOGGING
            cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                log_id SERIAL PRIMARY KEY,
                username VARCHAR(64) NOT NULL,
                action VARCHAR(64) NOT NULL,
                entity_type VARCHAR(64) NOT NULL,
                entity_id VARCHAR(128) NOT NULL,
                details JSONB,
                source_ip VARCHAR(64),
                result VARCHAR(32) DEFAULT 'SUCCESS',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs (username, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
            """)

            # 3. DATA QUALITY LOGS
            cur.execute("""
            CREATE TABLE IF NOT EXISTS data_quality_logs (
                log_id SERIAL PRIMARY KEY,
                event_payload JSONB,
                failure_reason VARCHAR(255) NOT NULL,
                classification VARCHAR(32) NOT NULL,
                camera_id VARCHAR(64),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 4. PERFORMANCE INDEXES
            cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_trajectories_from_to ON trajectories (from_camera_id, to_camera_id, started_at);
            CREATE INDEX IF NOT EXISTS idx_events_plate ON events (plate_number, observed_at DESC);
            CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts (status, severity, detected_at DESC);
            CREATE INDEX IF NOT EXISTS idx_alerts_cam_time ON alerts (camera_id, detected_at DESC);
            """)
        conn.commit()
        print("Schema setup completed successfully!")
    finally:
        conn.close()

if __name__ == "__main__":
    setup_schema()
