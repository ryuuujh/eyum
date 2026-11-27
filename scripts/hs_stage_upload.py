"""Stage validated official workbooks using a caller-supplied PostgreSQL connection."""
import sys
sys.dont_write_bytecode = True  # 실행해도 __pycache__ 폴더를 만들지 않음
from collections import Counter
from datetime import date, datetime
import hashlib
import json
import re
from zipfile import ZipFile

from openpyxl import load_workbook

WIDTHS = {2: {2}, 4: {4}, 6: {5, 6}, 8: {7, 8, 9}, 10: {10}}


def code_of(cell, widths):
    raw = cell.value
    if cell.data_type == "f" or isinstance(raw, bool):
        raise ValueError("Nonliteral HS code")
    if isinstance(raw, int):
        mask = cell.number_format
        if re.fullmatch(r"0{2,10}", mask):
            raw = str(raw).zfill(len(mask))
        elif len(widths) == 1:
            raw = str(raw).zfill(next(iter(widths)))
        else:
            raise ValueError("Ambiguous numeric HS code width")
    code = str(raw).strip().replace(".", "").replace("-", "")
    if not re.fullmatch(r"[0-9]{2,10}", code) or len(code) not in widths:
        raise ValueError("Invalid HS code")
    return code


def read_workbook(path, dataset):
    with open(path, "rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    with ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > 300 or sum(entry.file_size for entry in entries) > 100_000_000:
            raise ValueError("Oversized workbook")
    workbook = load_workbook(path, read_only=True)
    rows = []
    try:
        if dataset == "hsk":
            seen = set()
            for sheet in workbook:
                match = re.match(r"^HS(2|4|6|8|10)단위", sheet.title)
                if not match or int(match[1]) in seen:
                    raise ValueError("Unexpected HSK sheets")
                width = int(match[1])
                seen.add(width)
                header = next(sheet.values)
                if tuple(header[:3]) != (f"HS{width}단위", "한글품목명", "영문품목명"):
                    raise ValueError("Unexpected HSK headers")
                for cells in sheet.iter_rows(min_row=2, max_col=3):
                    if all(cell.value is None for cell in cells):
                        continue
                    code = code_of(cells[0], WIDTHS[width])
                    ko, en = (str(cell.value or "").strip() for cell in cells[1:])
                    if not (ko or en):
                        raise ValueError("HSK name missing")
                    rows.append((code, ko or en, en or None))
            if seen != WIDTHS.keys() or len({row[0] for row in rows}) != len(rows):
                raise ValueError("HSK sheets missing or codes duplicated")
        elif dataset == "standard_names":
            sheet = workbook.worksheets[0]
            header = [str(value).strip() for value in next(sheet.values)]
            if len(header) < 6 or (header[2], header[4], header[5]) != ("HS부호", "표준품명_한글", "표준품명_영문"):
                raise ValueError("Unexpected standard-name headers")
            for cells in sheet.iter_rows(min_row=2):
                if all(cell.value is None for cell in cells):
                    continue
                code = code_of(cells[2], set(range(2, 11)))
                ko, en = (str(cells[index].value or "").strip() or None for index in (4, 5))
                spec = {key: cell.value.isoformat() if isinstance(cell.value, (date, datetime)) else cell.value
                        for key, cell in zip(header, cells) if cell.value is not None}
                rows.append((code, ko, en, json.dumps(spec, ensure_ascii=False, sort_keys=True)))
            if any(count > 1 for count in Counter(rows).values()):
                raise ValueError("Exact standard-name row duplicated")
        else:
            raise ValueError("Invalid dataset")
        if not rows:
            raise ValueError("Empty workbook")
        return digest, rows
    finally:
        workbook.close()


def stage(connection, hsk_path=None, standard_path=None):
    if hsk_path is None and standard_path is None:
        raise ValueError("Provide at least one workbook")
    hsk = read_workbook(hsk_path, "hsk") if hsk_path else None
    standard = read_workbook(standard_path, "standard_names") if standard_path else None
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("lock table public.hs_data_versions in share row exclusive mode")
        cursor.execute("select id,hsk_sha256,standard_sha256 from public.hs_data_versions where is_active")
        active = cursor.fetchone()
        if not active:
            raise ValueError("Active version required")
        expected, hsk_hash, standard_hash = active
        hashes = (hsk[0] if hsk else hsk_hash, standard[0] if standard else standard_hash)
        if hashes == (hsk_hash, standard_hash):
            return {"status": "no_change", "expected_version": expected}
        cursor.execute("""insert into public.hs_data_versions(hsk_sha256,standard_sha256,metadata)
          values(%s,%s,%s::jsonb) on conflict(hsk_sha256,standard_sha256) do nothing returning id""",
                       (*hashes, json.dumps({"expected_version": str(expected), "format": "official_excel_v1"})))
        inserted = cursor.fetchone()
        if inserted is None:
            cursor.execute("""select id,approved_at from public.hs_data_versions where hsk_sha256=%s and standard_sha256=%s""", hashes)
            known, approved = cursor.fetchone()
            return {"status": "already_approved" if approved else "already_staged", "candidate_version": known,
                    "expected_version": expected}
        candidate = inserted[0]
        if hsk:
            with cursor.copy("copy public.hsk_codes(version_id,code,name_ko,name_en) from stdin") as copy:
                for row in hsk[1]:
                    copy.write_row((candidate, *row))
        else:
            cursor.execute("""insert into public.hsk_codes(version_id,code,name_ko,name_en)
              select %s,code,name_ko,name_en from public.hsk_codes where version_id=%s""", (candidate, expected))
        if standard:
            with cursor.copy("copy public.hs_standard_names(version_id,code,name_ko,name_en,specification) from stdin") as copy:
                for row in standard[1]:
                    copy.write_row((candidate, *row))
        else:
            cursor.execute("""insert into public.hs_standard_names(version_id,code,name_ko,name_en,specification)
              select %s,code,name_ko,name_en,specification from public.hs_standard_names where version_id=%s""", (candidate, expected))
        return {"status": "staged", "candidate_version": candidate, "expected_version": expected}
