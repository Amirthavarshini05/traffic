"""
Standardized Time-Range and Historical Baseline Engine
Provides consistent, timezone-safe ISO-8601 UTC timestamp parsing,
validation, window segmentation, and baseline comparison calculations.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any


MAX_ALLOWED_QUERY_DAYS = 90


def parse_iso_utc(ts_str: Optional[str]) -> Optional[datetime]:
    """Parse an ISO format string into a UTC datetime object."""
    if not ts_str or not isinstance(ts_str, str):
        return None
    try:
        # Normalize trailing Z if present
        clean_str = ts_str.strip()
        if clean_str.endswith("Z"):
            clean_str = clean_str[:-1] + "+00:00"
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            # Assume UTC if naive
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception as e:
        raise ValueError(f"Invalid ISO-8601 timestamp '{ts_str}': {str(e)}")


def parse_time_window(
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    default_hours: int = 24
) -> Tuple[datetime, datetime]:
    """
    Parse and validate a time window.
    Defaults to past `default_hours` up to current UTC time if not specified.
    Enforces maximum range (90 days) and valid sequence (start < end).
    """
    now = datetime.now(timezone.utc)

    end_dt = parse_iso_utc(end_time) if end_time and isinstance(end_time, str) else None
    if end_dt is None:
        end_dt = now

    start_dt = parse_iso_utc(start_time) if start_time and isinstance(start_time, str) else None
    if start_dt is None:
        start_dt = end_dt - timedelta(hours=default_hours)

    if start_dt >= end_dt:
        raise ValueError(
            f"Invalid time window: start_time ({start_dt.isoformat()}) "
            f"must be strictly before end_time ({end_dt.isoformat()})"
        )

    duration = end_dt - start_dt
    if duration > timedelta(days=MAX_ALLOWED_QUERY_DAYS):
        raise ValueError(
            f"Query range of {duration.days} days exceeds maximum allowed limit of {MAX_ALLOWED_QUERY_DAYS} days"
        )

    return start_dt, end_dt


def compute_baseline_window(
    start_dt: datetime,
    end_dt: datetime,
    baseline_type: str = "same_time_yesterday"
) -> Tuple[datetime, datetime]:
    """
    Compute a historical comparison window.
    Supported types:
    - 'previous_period': Equal duration immediately preceding start_dt
    - 'same_time_yesterday': Shifted back by 1 day (24 hours)
    - 'same_time_last_week': Shifted back by 7 days
    """
    if not isinstance(baseline_type, str):
        baseline_type = "same_time_yesterday"
    duration = end_dt - start_dt

    if baseline_type == "same_time_yesterday":
        b_start = start_dt - timedelta(days=1)
        b_end = end_dt - timedelta(days=1)
    elif baseline_type == "same_time_last_week":
        b_start = start_dt - timedelta(days=7)
        b_end = end_dt - timedelta(days=7)
    elif baseline_type == "previous_period":
        b_start = start_dt - duration
        b_end = start_dt
    else:
        # Default fallback to previous period
        b_start = start_dt - duration
        b_end = start_dt

    return b_start, b_end


def compute_metric_comparison(
    current_value: Optional[float],
    baseline_value: Optional[float],
    baseline_type: str,
    period_start: datetime,
    period_end: datetime
) -> Dict[str, Any]:
    """
    Compare current metric against historical baseline value.
    Produces strict typed structure without fabricating interpretations.
    """
    if current_value is None or baseline_value is None:
        return {
            "current_value": current_value,
            "baseline_value": baseline_value,
            "difference": None,
            "percentage_change": None,
            "baseline_type": baseline_type,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "status": "unavailable"
        }

    difference = round(current_value - baseline_value, 2)
    if baseline_value != 0:
        pct_change = round((difference / baseline_value) * 100.0, 2)
    else:
        pct_change = 0.0 if difference == 0 else 100.0

    return {
        "current_value": round(current_value, 2),
        "baseline_value": round(baseline_value, 2),
        "difference": difference,
        "percentage_change": pct_change,
        "baseline_type": baseline_type,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "status": "available"
    }
