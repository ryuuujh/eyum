"""Server-only adapters. The caller must authenticate the administrator first."""
import sys
sys.dont_write_bytecode = True  # 실행해도 __pycache__ 폴더를 만들지 않음
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from hs_metadata_check import check
from hs_stage_upload import stage


@contextmanager
def temporary_workbooks(files):
    with TemporaryDirectory(prefix="heyum-hs-") as directory:
        paths = {}
        for key, stream in files.items():
            if key not in ("hsk", "standard"):
                raise ValueError("Unknown upload field")
            path = Path(directory) / f"{key}.xlsx"
            data = stream.read(20_000_001)
            if len(data) > 20_000_000:
                raise ValueError("Excel file exceeds 20 MB")
            path.write_bytes(data)
            paths[f"{key}_path"] = path
        yield paths


def upload(connection, files):
    with temporary_workbooks(files) as paths:
        result = stage(connection, **paths)
    if result["status"] in ("staged", "already_staged"):
        result.update(compare(connection, result["expected_version"], result["candidate_version"]))
    return result


def compare(connection, expected, candidate):
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("""select public.compare_hs_data_versions(o.id,n.id)
          from public.hs_data_versions o cross join public.hs_data_versions n
          where o.id=%s and o.is_active and n.id=%s and not n.is_active and n.approved_at is null""",
                       (expected, candidate))
        row = cursor.fetchone()
        if row is None:
            raise ValueError("Active or staged version changed")
        diff = row[0]
        items = {}
        for key in ("review_codes", "standard_link_audit_codes"):
            if not diff[key]:
                items[key] = []
                continue
            cursor.execute("select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.hs_items_affected(%s::text[]) i",
                           (diff[key],))
            items[key] = cursor.fetchone()[0]
        return {"differences": diff, "impacts": items}


def approve(connection, expected, candidate, notice, actor, reason, differences):
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("select public.approve_hs_data_update(%s,%s,%s,%s,%s,%s::jsonb)",
                       (expected, candidate, notice, actor, reason, json.dumps(differences)))
        return cursor.fetchone()[0]


def resolve_no_change(connection, notice, actor, expected, dataset, files):
    required = {"hsk": "hsk_path", "standard_names": "standard_path"}.get(dataset)
    with temporary_workbooks(files) as paths, connection.transaction(), connection.cursor() as cursor:
        if required not in paths or not isinstance(actor, str) or not actor.strip():
            raise ValueError("Matching dataset file and resolver required")
        cursor.execute("lock table public.hs_data_versions in share row exclusive mode")
        cursor.execute("select hsk_sha256,standard_sha256 from public.hs_data_versions where id=%s and is_active", (expected,))
        recorded = cursor.fetchone()
        if recorded is None:
            raise ValueError("Active version changed")
        for name, active_hash in zip(("hsk_path", "standard_path"), recorded):
            if name in paths:
                with paths[name].open("rb") as file:
                    if hashlib.file_digest(file, "sha256").hexdigest() != active_hash:
                        raise ValueError("Uploaded file differs from active version")
        cursor.execute("select public.resolve_hs_data_notice(%s,'no_change',%s,null)", (notice, actor.strip()))


def history(connection):
    with connection.transaction(), connection.cursor() as cursor:
        results = {}
        for name, sql in (
            ("checks", "select * from public.hs_data_checks order by id desc limit 100"),
            ("approvals", "select * from public.hs_data_approvals order by approved_at desc limit 100"),
        ):
            cursor.execute(f"select coalesce(jsonb_agg(to_jsonb(row)), '[]') from ({sql}) row")
            results[name] = cursor.fetchone()[0]
        return results


def check_now(connection, dataset):
    return check(connection, dataset, force=True)
