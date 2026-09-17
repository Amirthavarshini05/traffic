"""
Audit Logging and Security / RBAC Utilities
Provides tamper-evident operational audit logging and role-based data masking.
"""

import json
from typing import Optional, Dict, Any, List
from .database import get_connection


def log_audit_event(
    username: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: Optional[Dict[str, Any]] = None,
    source_ip: Optional[str] = None,
    result: str = "SUCCESS"
) -> bool:
    """Record an operational action to the audit_logs table."""
    conn = get_connection()
    try:
        user_str = str(username) if username and not hasattr(username, "default") else "system"
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_logs (
                    username, action, entity_type, entity_id, details, source_ip, result
                ) VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    user_str,
                    action,
                    entity_type,
                    str(entity_id),
                    json.dumps(details or {}, default=str),
                    source_ip,
                    result
                )
            )
        conn.commit()
        return True
    except Exception as e:
        print(f"[Audit Log Error] Failed to write audit event: {e}")
        return False
    finally:
        conn.close()


def mask_plate_number(plate_number: Optional[str], role: str = "Operator") -> Optional[str]:
    """
    Mask license plate numbers for unauthorized roles.
    Admins, Operators, and Investigators have full visibility.
    Viewers receive masked plates (e.g. TN01****34).
    """
    if not plate_number:
        return plate_number

    if not isinstance(role, str):
        role = "Operator"

    if role in ("Administrator", "Admin", "Operator", "Investigator"):
        return plate_number

    clean = plate_number.strip()
    if len(clean) <= 4:
        return "****"

    prefix = clean[:4]
    suffix = clean[-2:]
    return f"{prefix}****{suffix}"


def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    entity_type: Optional[str] = None,
    username: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve audit records with optional filtering."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            query = "SELECT log_id, username, action, entity_type, entity_id, details, source_ip, result, created_at FROM audit_logs WHERE 1=1"
            params: List[Any] = []

            if entity_type:
                query += " AND entity_type = %s"
                params.append(entity_type)
            if username:
                query += " AND username = %s"
                params.append(username)

            query += " ORDER BY created_at DESC LIMIT %s OFFSET %s;"
            params.extend([min(limit, 200), offset])

            cur.execute(query, tuple(params))
            rows = cur.fetchall()

            return [
                {
                    "log_id": r[0],
                    "username": r[1],
                    "action": r[2],
                    "entity_type": r[3],
                    "entity_id": r[4],
                    "details": r[5],
                    "source_ip": r[6],
                    "result": r[7],
                    "created_at": r[8].isoformat() if r[8] else None
                }
                for r in rows
            ]
    finally:
        conn.close()
