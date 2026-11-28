"""Next 서버가 부르는 HS 데이터 갱신 입구 (Claude, 11/27)

표준 입력으로 JSON 하나를 받아 hs_refresh_service의 함수를 부르고, 결과 JSON 한 줄을 표준 출력에 쓴다.
  {"action": "check", "dataset": "hsk"}
  {"action": "history"}
  {"action": "upload", "files": {"hsk": "경로", "standard": "경로"}, "notice": null, "by": "이름"}
      → 지금 쓰는 파일과 같고(no_change) notice가 있으면 그 알림을 '변경 없음'으로 처리
  {"action": "compare", "expected": "활성 버전", "candidate": "대기 버전"}
  {"action": "approve", "expected": ..., "candidate": ..., "notice": null, "by": "이름", "reason": "사유", "differences": {...}}
DB 접속은 환경 변수 HS_REFRESH_DATABASE_URL (서버 전용). AI 호출 없음.
"""
import sys
sys.dont_write_bytecode = True  # 실행해도 __pycache__ 폴더를 만들지 않음
import json
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def run(request):
    import psycopg
    from hs_refresh_service import approve, check_now, compare, history, resolve_no_change, upload

    action = request.get("action")
    with psycopg.connect(os.environ["HS_REFRESH_DATABASE_URL"], autocommit=True) as db:
        if action == "check":
            return check_now(db, request["dataset"])
        if action == "history":
            return history(db)
        if action == "compare":
            return compare(db, request["expected"], request["candidate"])
        if action == "approve":
            return approve(db, request["expected"], request["candidate"], request.get("notice"),
                           request["by"], request["reason"], request["differences"])
        if action == "upload":
            paths = request["files"]

            def opened():
                return {key: open(path, "rb") for key, path in paths.items()}

            files = opened()
            try:
                result = upload(db, files)
            finally:
                for f in files.values():
                    f.close()
            if result["status"] == "staged":
                # 화면 "지금 쓰는 데이터"에 보일 파일 이름. 안 올린 쪽은 지금 버전의 이름을 그대로 쓴다.
                names = request.get("names") or {}
                db.execute("""update public.hs_data_versions n set metadata = n.metadata || jsonb_build_object(
                    'hsk_file', coalesce(%s, o.metadata->>'hsk_file'), 'standard_file', coalesce(%s, o.metadata->>'standard_file'))
                  from public.hs_data_versions o where n.id=%s and o.id=%s and n.approved_at is null""",
                           (names.get("hsk"), names.get("standard"), result["candidate_version"], result["expected_version"]))
            notice = request.get("notice")
            if result["status"] == "no_change" and notice:
                row = db.execute("select dataset from public.hs_data_notices where id=%s and resolution is null",
                                 (notice,)).fetchone()
                if row is None:
                    raise ValueError("Notice missing or already resolved")
                files = opened()
                try:
                    resolve_no_change(db, notice, request.get("by"), result["expected_version"], row[0], files)
                finally:
                    for f in files.values():
                        f.close()
                result["notice_resolved"] = True
            return result
    raise ValueError("Unknown action")


def main():
    try:
        result = run(json.load(sys.stdin))
        print(json.dumps({"ok": True, "result": result}, default=str))
    except Exception as error:  # 화면에 보여 줄 오류 한 줄 (내용에 파일 원문은 없음)
        print(json.dumps({"ok": False, "error": f"{type(error).__name__}: {str(error).splitlines()[0] if str(error) else ''}"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
