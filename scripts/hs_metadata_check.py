"""Scheduled or on-demand checks for the two official HS datasets."""
import sys
sys.dont_write_bytecode = True  # 실행해도 __pycache__ 폴더를 만들지 않음
import argparse
import calendar
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
import urllib.request

DATASETS = {"hsk": "15130660", "standard_names": "15049721"}
FIELDS = ("identifier", "alternateName", "dateModified", "temporalCoverage")


def fingerprint(dataset, document):
    if not isinstance(document, dict):
        raise ValueError("invalid_metadata")
    values = {field: document.get(field) for field in FIELDS}
    if not all(value is None or isinstance(value, str) for value in values.values()):
        raise ValueError("invalid_metadata")
    values = {key: value.strip() if value else None for key, value in values.items()}
    if values["identifier"] and values["identifier"] != DATASETS[dataset]:
        raise ValueError("unexpected_dataset")
    if not values["dateModified"] and not values["alternateName"]:
        raise ValueError("invalid_metadata")
    stable = json.dumps([dataset, values], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return values, hashlib.sha256(stable.encode()).hexdigest()


def next_check(dataset, when):
    if dataset == "hsk":
        return when + timedelta(days=7)
    month = when.month % 12 + 1
    year = when.year + (month == 1)
    return when.replace(year=year, month=month, day=min(when.day, calendar.monthrange(year, month)[1]))


def fetch(dataset):
    url = f"https://www.data.go.kr/catalog/{DATASETS[dataset]}/fileData.json"
    with urllib.request.urlopen(url, timeout=15) as response:
        data = response.read(1_048_577)
    if len(data) > 1_048_576:
        raise ValueError("oversized_metadata")
    return json.loads(data)


def check(connection, dataset, force=False, read=fetch, now=None):
    now = now or datetime.now(timezone.utc)
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("select pg_advisory_xact_lock(hashtext(%s))", (f"heyum:metadata:{dataset}",))
        cursor.execute("select next_check_at from public.hs_data_checks where dataset=%s order by id desc limit 1", (dataset,))
        latest = cursor.fetchone()
        if not force and latest and latest[0] > now:
            return {"dataset": dataset, "status": "not_due"}
        cursor.execute("select change_key from public.hs_data_checks where dataset=%s and ok order by id desc limit 1", (dataset,))
        previous = cursor.fetchone()
        try:
            values, key = fingerprint(dataset, read(dataset))
        except (OSError, ValueError, TimeoutError) as error:
            code = type(error).__name__
            # Retry tomorrow. At most one identical alert per UTC day.
            retry = now + timedelta(days=1)
            failure_key = f"{now.date()}:{code}"
            cursor.execute("""insert into public.hs_data_checks(dataset,checked_at,next_check_at,ok,error_code)
                values(%s,%s,%s,false,%s)""", (dataset, now, retry, code))
            cursor.execute("select * from public.record_hs_data_notice(%s,'check_failed',%s,%s,%s::jsonb)",
                           (dataset, failure_key, "관세청 공식 HS 데이터 자동 확인에 실패했습니다. 공공데이터포털에서 직접 확인해 주세요. 지금 데이터는 그대로 씁니다.", json.dumps({"error_code": code})))
            return {"dataset": dataset, "status": "failed", "notice": cursor.fetchone()}
        cursor.execute("""insert into public.hs_data_checks(dataset,checked_at,next_check_at,ok,metadata,change_key)
            values(%s,%s,%s,true,%s::jsonb,%s)""", (dataset, now, next_check(dataset, now), json.dumps(values), key))
        if previous and previous[0] != key:
            cursor.execute("select * from public.record_hs_data_notice(%s,'metadata_changed',%s,%s,%s::jsonb)",
                           (dataset, key, "관세청 공식 HS 데이터의 수정 정보가 변경되었습니다. 최신 공식 파일을 확인하고 데이터 갱신을 진행해 주세요. 아직 신규 데이터는 적용되지 않았습니다.", json.dumps(values)))
            return {"dataset": dataset, "status": "changed", "notice": cursor.fetchone()}
        return {"dataset": dataset, "status": "unchanged" if previous else "baseline"}


def main():
    import psycopg
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", choices=DATASETS)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    with psycopg.connect(os.environ["HS_REFRESH_DATABASE_URL"]) as db:
        results = [check(db, source, args.force) for source in ([args.dataset] if args.dataset else DATASETS)]
    print(json.dumps(results, default=str))
    return int(any(result["status"] == "failed" for result in results))


if __name__ == "__main__":
    raise SystemExit(main())
