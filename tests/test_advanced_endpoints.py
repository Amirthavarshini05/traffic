import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import json

from app.advanced_routes import (
    get_system_health,
    get_camera_detail,
    search_vehicles,
    get_enhanced_vehicle_trajectory,
    get_route_historical_comparison,
    get_watchlist,
    add_to_watchlist,
    remove_from_watchlist,
    export_dataset,
)
from app.audit_service import mask_plate_number


class TestAdvancedEndpoints(unittest.TestCase):
    def test_plate_masking_viewer(self):
        masked = mask_plate_number("TN01AB1234", role="Viewer")
        self.assertEqual(masked, "TN01****34")

    def test_plate_masking_operator(self):
        unmasked = mask_plate_number("TN01AB1234", role="Operator")
        self.assertEqual(unmasked, "TN01AB1234")

    def test_plate_masking_admin(self):
        unmasked = mask_plate_number("TN01AB1234", role="Admin")
        self.assertEqual(unmasked, "TN01AB1234")

    def test_plate_masking_none(self):
        self.assertIsNone(mask_plate_number(None))

    def test_system_health_structure(self):
        # Calls get_system_health against live/mock system
        res = get_system_health()
        self.assertIn(res.overall_status, ["operational", "degraded", "offline"])
        self.assertTrue(len(res.services) >= 2)
        service_names = [s.name for s in res.services]
        self.assertIn("PostgreSQL Database", service_names)
        self.assertIn("Redis Event Streams", service_names)
        self.assertIn("healthy", res.cameras)
        self.assertIn("freshness_status", res.data_freshness)

    def test_camera_detail_valid(self):
        # CAM02 is guaranteed in database
        try:
            cam = get_camera_detail("CAM02")
            self.assertEqual(cam.camera_id, "CAM02")
            self.assertIsNotNone(cam.status)
            self.assertIn(cam.freshness_status, ["Fresh", "Delayed", "Stale", "No recent data"])
        except Exception as e:
            # If camera not in db, verify 404
            self.assertIn("not found", str(e).lower())

    def test_vehicle_search(self):
        res = search_vehicles(q="TN", user_role="Operator")
        self.assertEqual(res.query, "TN")
        self.assertIsInstance(res.results, list)

    def test_route_comparison(self):
        res = get_route_historical_comparison(
            route_id="CAM01_CAM02",
            baseline_type="same_time_yesterday"
        )
        self.assertEqual(res.route_id, "CAM01_CAM02")
        self.assertIn(res.congestion_level, ["LOW", "MODERATE", "HIGH", "SEVERE", "UNKNOWN"])
        self.assertIn(res.speed_status, ["available", "unavailable"])

    def test_watchlist_workflow(self):
        test_plate = "TN99TEST01"
        # Add to watchlist
        add_res = add_to_watchlist(
            entry={"plate_number": test_plate, "reason": "Test unit verification", "priority": "HIGH"},
            username="test_admin",
            user_role="Admin"
        )
        self.assertIn("added", add_res["message"].lower())

        # Check in watchlist
        wl = get_watchlist(user_role="Admin")
        plates = [item.plate_number for item in wl.watchlist]
        self.assertIn(test_plate, plates)

        # Deactivate
        del_res = remove_from_watchlist(plate_number=test_plate, username="test_admin", user_role="Admin")
        self.assertIn("deactivated", del_res["message"].lower())

    def test_export_alerts_json(self):
        resp = export_dataset(dataset="alerts", format="json", username="test_user")
        data = json.loads(resp.body.decode("utf-8"))
        self.assertIsInstance(data, list)

    def test_export_od_matrix_csv(self):
        import asyncio
        resp = export_dataset(dataset="od-matrix", format="csv", username="test_user")

        async def get_body():
            chunks = []
            async for chunk in resp.body_iterator:
                chunks.append(chunk if isinstance(chunk, str) else chunk.decode("utf-8"))
            return "".join(chunks)

        content = asyncio.run(get_body())
        self.assertIn("Origin Camera", content)
        self.assertIn("Destination Camera", content)


if __name__ == "__main__":
    unittest.main()
