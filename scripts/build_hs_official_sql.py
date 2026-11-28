"""관세청 공식 엑셀 2개 → HS 코드표를 넣는 SQL 파일 만들기 (Claude, 11/27)

사용법 (로컬 점검 DB에만 적용할 것. 팀 DB 적용은 승인 뒤):
  python scripts/build_hs_official_sql.py HSK.xlsx 표준품명.xlsx --approved-by 이름 > hs_official.sql
  psql ... -f hs_official.sql

- HSK: 공공데이터포털 15130660 "관세청_HS부호 단위별 품목명" (시트 HS2 · HS4 · HS6 · HS8 · HS10단위, 열 = 부호 · 한글 · 영문)
- 표준품명: 공공데이터포털 15049721 "관세청_표준품명" (열 C = HS부호, E · F = 표준품명 한글 · 영문, 나머지 열은 규격 JSON으로 보존)
- 새 버전 한 줄(hs_data_versions)을 만들고 활성으로 바꾼다. 같은 파일(해시)이 이미 있으면 아무것도 하지 않는다.
- --stage-only: 새 버전을 넣기만 하고 켜지 않는다(승인 전 비교용). 지금 쓰는 버전은 그대로 쓴다.
  켜는 일(승인 · 재검토 전환)은 반자동 갱신의 적용 함수가 한다.
- GPT 검증 도구(import_official.py · verify_postgres.py)의 읽기 규칙을 따랐다: 앞자리 0 유지, 점 · 하이픈 제거, 빈 줄 건너뜀.
"""
import argparse
import csv
import datetime
import hashlib
import io
import json
import re
import sys
import uuid

from openpyxl import load_workbook


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def code_of(value):
    code = str(value).strip().replace('.', '').replace('-', '')
    if not re.fullmatch(r'[0-9]{2,10}', code):
        raise ValueError(f'잘못된 부호: {value!r}')
    return code


def hsk_rows(path):
    wb = load_workbook(path, read_only=True)
    seen = set()
    for ws in wb.worksheets:
        for n, r in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            if not r or all(v is None for v in r):
                continue
            code = code_of(r[0])
            ko = str(r[1] or '').strip()
            en = str(r[2] or '').strip() if len(r) > 2 else ''
            if not ko and not en:
                raise ValueError(f'{ws.title} {n}행: 품목명 없음')
            if code in seen:
                raise ValueError(f'{ws.title} {n}행: 부호 중복 {code}')
            seen.add(code)
            yield code, ko or en, en or None
    wb.close()


def std_rows(path, known):
    wb = load_workbook(path, read_only=True)
    ws = wb.worksheets[0]
    head = [str(h).strip() for h in next(ws.iter_rows(max_row=1, values_only=True))]
    for n, r in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        if not r or all(v is None for v in r):
            continue
        code = code_of(r[2])
        if code not in known:
            # 업로드 검증(hs_stage_upload.py)과 같은 규칙: HSK에 없는 부호가 있으면 전체 중단
            raise ValueError(f'표준품명 {n}행: HSK에 없는 부호 {code}')
        spec = {h: (v.isoformat() if isinstance(v, (datetime.date, datetime.datetime)) else v) for h, v in zip(head, r) if v is not None}
        yield code, (str(r[4] or '').strip() or None), (str(r[5] or '').strip() or None), json.dumps(spec, ensure_ascii=False)
    wb.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('hsk')
    ap.add_argument('standard')
    ap.add_argument('--approved-by')
    ap.add_argument('--stage-only', action='store_true')
    a = ap.parse_args()
    if not a.stage_only and not (a.approved_by or '').strip():
        ap.error('--approved-by가 필요해요 (승인 전 보관만 하려면 --stage-only)')
    h1, h2 = sha256(a.hsk), sha256(a.standard)
    hsk = list(hsk_rows(a.hsk))
    known = {c for c, _, _ in hsk}
    std = list(std_rows(a.standard, known))
    vid = str(uuid.uuid4())
    meta = json.dumps({'hsk_file': a.hsk.replace('\\', '/').split('/')[-1], 'standard_file': a.standard.replace('\\', '/').split('/')[-1],
                       'hsk_rows': len(hsk), 'standard_rows': len(std), 'built_at': datetime.date.today().isoformat()}, ensure_ascii=False)
    out = sys.stdout
    out.write('-- 관세청 공식 HS 코드표 (자동 생성 파일, 손으로 고치지 말 것)\n\\set ON_ERROR_STOP on\n')
    out.write(f"select exists(select 1 from public.hs_data_versions where hsk_sha256='{h1}' and standard_sha256='{h2}') as already \\gset\n")
    out.write('\\if :already\n  \\echo 같은 파일이 이미 들어 있어요. 건너뜀\n  \\quit\n\\endif\nbegin;\n')
    m = meta.replace(chr(39), chr(39) * 2)
    if a.stage_only:
        out.write(f"insert into public.hs_data_versions(id,hsk_sha256,standard_sha256,metadata) values ('{vid}','{h1}','{h2}','{m}');\n")
    else:
        out.write('update public.hs_data_versions set is_active=false where is_active;\n')
        by = a.approved_by.strip().replace("'", "''")
        out.write(f"insert into public.hs_data_versions(id,hsk_sha256,standard_sha256,metadata,approved_at,approved_by,is_active) "
                  f"values ('{vid}','{h1}','{h2}','{m}',now(),'{by}',true);\n")
    def copy(table, cols, rows):
        buf = io.StringIO()
        csv.writer(buf, lineterminator='\n').writerows(rows)
        out.write(f'copy public.{table}({cols}) from stdin with (format csv);\n')
        out.write(buf.getvalue())
        out.write('\\.\n')
    copy('hsk_codes', 'version_id,code,name_ko,name_en', ([vid, c, ko, en if en is not None else ''] for c, ko, en in hsk))
    copy('hs_standard_names', 'version_id,code,name_ko,name_en,specification', ([vid, c, ko or '', en or '', spec] for c, ko, en, spec in std))
    out.write(f"update public.hsk_codes set name_en=null where version_id='{vid}' and name_en='';\n")
    out.write(f"update public.hs_standard_names set name_ko=nullif(name_ko,''), name_en=nullif(name_en,'') where version_id='{vid}';\n")
    out.write(f"select count(*) as hsk_rows from public.hsk_codes where version_id='{vid}';\n")
    out.write(f"select count(*) as standard_rows, count(distinct code) as standard_codes from public.hs_standard_names where version_id='{vid}';\n")
    out.write('commit;\n')
    print(f'-- HSK {len(hsk)}줄, 표준품명 {len(std)}줄', file=sys.stderr)


if __name__ == '__main__':
    main()
