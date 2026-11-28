import sys
sys.dont_write_bytecode = True  # 실행해도 __pycache__ 폴더를 만들지 않음
from contextlib import nullcontext
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from hs_metadata_check import check, next_check


class MetadataFixture:
    def __init__(self):
        self.records = []
        self.notices = set()

    def transaction(self):
        return nullcontext()

    def cursor(self):
        return nullcontext(self)

    def fetchone(self):
        return self.result

    def execute(self, sql, params):
        self.result = None
        if "select next_check_at" in sql:
            self.result = next(((row[2],) for row in reversed(self.records) if row[0] == params[0]), None)
        elif "select change_key" in sql:
            self.result = next(((row[4],) for row in reversed(self.records)
                               if row[0] == params[0] and len(row) == 5), None)
        elif "insert into public.hs_data_checks" in sql:
            self.records.append(params)
        elif "record_hs_data_notice" in sql:
            key = (params[0], params[1])
            self.result = ("fixture", key not in self.notices)
            self.notices.add(key)
        elif "pg_advisory_xact_lock" not in sql:
            raise AssertionError(sql)


class MetadataTests(unittest.TestCase):
    def test_change_and_failure(self):
        fixture = MetadataFixture()
        now = datetime(2026, 11, 27, tzinfo=timezone.utc)

        def observe(day, force=True):
            return check(fixture, "hsk", force, lambda _: {"dateModified": day}, now)

        self.assertEqual(observe("a")["status"], "baseline")
        self.assertEqual(observe("a", False)["status"], "not_due")
        self.assertEqual(observe("a")["status"], "unchanged")
        self.assertTrue(observe("b")["notice"][1])
        observe("a")
        self.assertFalse(observe("b")["notice"][1])

        def unavailable(_):
            raise TimeoutError()

        self.assertTrue(check(fixture, "hsk", True, unavailable, now)["notice"][1])
        self.assertFalse(check(fixture, "hsk", True, unavailable, now)["notice"][1])
        self.assertEqual(observe("b")["status"], "unchanged")

    def test_calendar_month(self):
        today = datetime(2026, 1, 31, tzinfo=timezone.utc)
        self.assertEqual(next_check("standard_names", today).day, 28)
        self.assertEqual(next_check("hsk", today).day, 7)


if __name__ == "__main__":
    unittest.main()
