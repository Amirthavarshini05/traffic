import unittest
from datetime import datetime, timezone, timedelta
from app.time_utils import (
    parse_iso_utc,
    parse_time_window,
    compute_baseline_window,
    compute_metric_comparison,
    MAX_ALLOWED_QUERY_DAYS
)

class TestTimeUtils(unittest.TestCase):
    def test_parse_iso_utc_valid(self):
        dt = parse_iso_utc("2026-09-12T10:00:00Z")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.tzinfo, timezone.utc)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 9)
        self.assertEqual(dt.day, 12)
        self.assertEqual(dt.hour, 10)

    def test_parse_iso_utc_offset(self):
        dt = parse_iso_utc("2026-09-12T15:30:00+05:30")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.tzinfo, timezone.utc)
        self.assertEqual(dt.hour, 10)

    def test_parse_iso_utc_invalid(self):
        with self.assertRaises(ValueError):
            parse_iso_utc("invalid-timestamp")

    def test_parse_time_window_defaults(self):
        s_dt, e_dt = parse_time_window(default_hours=12)
        self.assertTrue(s_dt < e_dt)
        diff_hours = (e_dt - s_dt).total_seconds() / 3600
        self.assertAlmostEqual(diff_hours, 12, places=1)

    def test_parse_time_window_custom(self):
        s_str = "2026-09-10T00:00:00Z"
        e_str = "2026-09-12T00:00:00Z"
        s_dt, e_dt = parse_time_window(start_time=s_str, end_time=e_str)
        self.assertEqual(s_dt, datetime(2026, 9, 10, 0, 0, tzinfo=timezone.utc))
        self.assertEqual(e_dt, datetime(2026, 9, 12, 0, 0, tzinfo=timezone.utc))

    def test_parse_time_window_start_after_end(self):
        with self.assertRaises(ValueError):
            parse_time_window(start_time="2026-09-12T00:00:00Z", end_time="2026-09-10T00:00:00Z")

    def test_parse_time_window_exceeds_max_days(self):
        s_str = "2026-01-01T00:00:00Z"
        e_str = "2026-05-01T00:00:00Z" # > 90 days
        with self.assertRaises(ValueError) as ctx:
            parse_time_window(start_time=s_str, end_time=e_str)
        self.assertIn("exceeds maximum allowed limit", str(ctx.exception))

    def test_compute_baseline_window_yesterday(self):
        start_dt = datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc)
        end_dt = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
        b_s, b_e = compute_baseline_window(start_dt, end_dt, baseline_type="same_time_yesterday")
        self.assertEqual(b_s, datetime(2026, 9, 11, 10, 0, tzinfo=timezone.utc))
        self.assertEqual(b_e, datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc))

    def test_compute_baseline_window_last_week(self):
        start_dt = datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc)
        end_dt = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
        b_s, b_e = compute_baseline_window(start_dt, end_dt, baseline_type="same_time_last_week")
        self.assertEqual(b_s, datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc))
        self.assertEqual(b_e, datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc))

    def test_compute_baseline_window_previous_period(self):
        start_dt = datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc)
        end_dt = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
        b_s, b_e = compute_baseline_window(start_dt, end_dt, baseline_type="previous_period")
        self.assertEqual(b_s, datetime(2026, 9, 12, 8, 0, tzinfo=timezone.utc))
        self.assertEqual(b_e, datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc))

    def test_compute_metric_comparison_available(self):
        start_dt = datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc)
        end_dt = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
        res = compute_metric_comparison(120.0, 100.0, "same_time_yesterday", start_dt, end_dt)
        self.assertEqual(res["status"], "available")
        self.assertEqual(res["current_value"], 120.0)
        self.assertEqual(res["baseline_value"], 100.0)
        self.assertEqual(res["difference"], 20.0)
        self.assertEqual(res["percentage_change"], 20.0)

    def test_compute_metric_comparison_unavailable(self):
        start_dt = datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc)
        end_dt = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
        res = compute_metric_comparison(None, 100.0, "same_time_yesterday", start_dt, end_dt)
        self.assertEqual(res["status"], "unavailable")
        self.assertIsNone(res["difference"])
        self.assertIsNone(res["percentage_change"])

if __name__ == "__main__":
    unittest.main()
