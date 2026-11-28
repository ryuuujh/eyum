# 채주현 프롬프트 기록

작업별로 요청과 반영한 변경, 후속 지시를 적는다. [작성 방법](../../recording_rules.md)

## 2026-11-26 / 제품 등록·관리 기능 명세 초안 작성

- **요청:** 저장소 연결 후 기능 명세서부터 작성.
- **반영 파일:** `src/features/products/feature_spec.md` (팀 양식 1~7장 채움). 이전 작업 폴더에서 정한 등록 흐름 · 칸 구성 · 확인 상태 규칙 · 민감정보 처리 · 다른 탭 연결 통로 · 부속물품 옵션 구조(합의 중)를 옮겨 적음.
- **판단:** 코드는 아직 이 저장소에 넣지 않아서 검증 칸은 모두 "미검증"으로 적고, 이전 작업 폴더에서 확인한 결과는 괄호로 구분함.
- **남은 질문:** 7장 미정 사항 참고.

## 2026-11-27 / 기능 명세 초안 보완

- **요청:** 기능 명세를 확정해 PR 올리기 전에 먼저 커밋 · 푸시.
- **반영 파일:** `src/features/products/feature_spec.md` — 다른 탭은 DB 대신 연결 통로를 쓴다는 결정(11/26) 반영, 영문 주소 미처리 표시, 7장 미정 사항 갱신(옵션 구조 세부 · 부속물품 기본 단가 · 혜윰 확인 항목).
- **남은 질문:** 7장 미정 사항 참고.

## 2026-11-27 / 기능 명세 합의 범위 정리

- **요청:** PR 전에 채주현이 결정할 필요 없는 부분만 정리.
- **반영 파일:** `src/features/products/feature_spec.md` — 5장에서 합의 안 된 2줄(부속물품 → 서류 탭, 나라별 제조사 표기 의무)을 7장으로 옮김 (양식: "합의한 연결만 적는다"). 3-4장 부속물품을 11/26 합의한 옵션 구조로 바꿈.
- **판단:** 시연 범위 · 단가 · 원재료 영문명은 그대로 두고, 상태는 "초안" 유지. 디자인 색은 화면 코드를 옮길 때 별도 작업으로.

## 2026-11-27 / 제품 등록·관리 코드 저장소 이전과 accessory_option 반영

- **요청:** 11/29 부속물품 · HS 기능과 통합하기 전에 제품 등록 · 관리 기능을 팀 저장소에서 동작하게 만들기. 지금 UI는 임시 UI로 두고 디자인 세부 수정은 통합 뒤로 미룸. field_status에 accessory_option 유형 반영.
- **반영 파일**
  - 이전 작업 폴더의 제품 코드를 팀 규칙에 맞춰 옮김: 업무 로직 `src/features/products/` (파일 · 함수 · 변수 이름 snake_case), 화면 `src/app/products/`, 다른 탭 통로 `src/app/api/products/`, 공통 화면 부품 `src/components/ui/`, 공통 민감정보 처리 `src/lib/sanitize.ts`, DB `supabase/migrations/` · `supabase/seed.sql`, 시험 `tests/sanitize_test.mts`.
  - 제품 목록은 팀 공통 틀(`FeatureScreen`) 안에 넣고, 부속물품 자리(`accessory_hs_lookup.tsx`, GPT 담당)는 그대로 둠.
  - Supabase 환경변수를 팀 이름(`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)으로 바꿈.
  - 패키지 추가: exceljs(엑셀 내려받기 · 다시 올리기) · openai(AI 자료 읽기) · unpdf(글자 PDF 읽기) · zod(AI 답 형식 검사) · server-only(서버 코드가 브라우저로 가지 않게).
  - `supabase/migrations/20261126000200_field_status.sql`, `types.ts`: entity_type에 `accessory_option` 추가 (GPT와 11/26 합의).
  - 작은 수정: 보관 조건 안내 문구에서 "상온"이 빠지던 문제, HS 코드 화면 · 엑셀 표기를 점 · 하이픈 형식으로(`hs_format.ts`), 예시 데이터의 중복 상태 줄 삭제, 영문 · 베트남 주소 지우기 규칙(`sanitize.ts`).
- **판단:** `sanitize.ts`의 공개 함수 이름(prepareForAI · findLeftovers · assertSafeForAI · isKnownCode)은 GPT 코드가 이미 쓰고 있어 이번에 바꾸지 않음. 이름 변경은 통합 때 GPT와 맞춤. Tailwind는 팀 저장소에 넣지 않아 화면이 꾸밈 없이 보이며, 11/29 UI 수정 때 팀 CSS 방식으로 바꿈.
- **남은 질문:** 패키지 추가를 유정현에게 공유, 예시 데이터의 혜윰 실제 값 처리, 기밀 업로드 방지 1~4, 원재료 영문명 칸.

## 2026-11-27 / 다른 탭 연결 보강 (수출할 제품 체크 · 빠진 칸 · 원값 · 기존 라벨 문구)

- **요청:** 다른 탭 명세(라벨 · CI·PL · 수출신고)를 점검한 뒤 ① 제품 등록 후 다른 탭으로 넘길 제품을 체크하는 기능 ② 통로에 빠진 칸 모두 추가 ③ 숫자 원값 · 기존 라벨 문구 · 개별포장/외박스 정보도 추가.
- **반영 파일**
  - DB: `20261126000100_product_core.sql`에 `products.export_selected`(기본 false)와 `product_label_texts` 표 추가, `20261126000900_save_product_rpc.sql`에 라벨 문구 저장 추가(수출 체크는 등록 · 수정 저장으로 바뀌지 않음), `seed.sql`에 당시 예시 제품의 수출 체크 · 영어 라벨 문구 5줄(주소 항목 제외).
  - 칸: `fields.ts`에 기한 종류 · 포장 크기 · 라벨 부착 면적(라벨), 교차접촉 알레르기(구성품, 라벨), HSK 10자리(서류, HS 찾기로만 채워져 할 일 제외) · 통화 · CTN 순중량 · 총중량 · 크기(서류) 추가. 여러 DB 칸을 묶은 칸(포장 크기 등)은 `COMPOSITE_FIELDS`.
  - 통로: `share.ts` — 칸마다 `raw`(계산용 원값), `packs`(개별포장 · 외박스 · 팔레트 숫자), `label_texts`; `GET /api/products?selected=1`.
  - 화면(임시 UI): 목록 "수출" 체크 열, 상세 "수출할 제품" 체크 · 기존 라벨 문구 표, 등록 · 수정 "표시 정보" 탭에 기존 라벨 문구 입력, 새 칸 아래 상태 안내.
  - 그 밖에: `form.ts` · `view.ts` · `apply_changes.ts`(묶은 칸 다시 올리기) · `data.ts` · `sample.ts` · `persist.ts` · `save.ts` · `types.ts`, 새 파일 `src/app/products/export_toggle.tsx`.
- **판단:** 수출 체크는 나라와 상관없이 제품마다 하나(제품 화면은 국가 선택 없음, 11/25 결정). 라벨 문구는 원문 보관용이라 확인 상태를 두지 않음. 새 칸이 할 일에 들어가서 제품마다 할 일 개수가 늘어남.
- **남은 질문:** 나라별로 다른 제품을 고를 필요가 있는지(서류 담당), 유니패스 HS 표기 형식(서류 담당), 라벨 문구 항목 구분이 라벨 명세와 맞는지(라벨 담당).

## 2026-11-27 / 라벨 담당 요청 반영 (영문 원재료명 · 제조일/기한 · 외박스 라벨 면적 · 영양 원본)

- **요청:** 라벨 담당(박진혁) 회신 — ① 영문 원재료명(선택, 하위 원료 포함) ② 제조사 표기 의무는 규제 담당과 확인 후 라벨 탭이 경고 ③ 라벨 문구 date를 제조일 · 기한으로 구분 ④ 구성품 봉 수 전달 여부, 외박스 라벨 부착 면적 ⑤ 영양 항목명 · 단위 · 원본 기준량과 계산값 구분. 라벨 탭 응답 예시(가상 데이터) 요청.
- **반영 파일:** `20261126000100_product_core.sql`(component_ingredients.name_en, products.outer_label_w_mm · outer_label_h_mm, 라벨 문구 item_key production_date · expiry_date), `20261126000900_save_product_rpc.sql`, `types.ts`, `fields.ts`(outer_label_size 선택 칸), `form.ts`(원재료 줄 " / 영문명" 읽기 · 쓰기, 영문명만 바뀌면 상태 유지), `share.ts`(ingredients[].name_en, components[].nutrition 원본, nutrition_items, packs.outer.label_area_mm), `sample.ts`, `product_form.tsx`.
- **판단:** 봉 수는 이미 `components[].quantity`로 넘어감. 제조사 표기 의무는 제품 탭에서 바꿀 것 없음. 영양 반올림 · 표시 단위는 라벨 탭 몫.
- **남은 질문:** 없음. 가상 예시 JSON은 프로젝트 파일 `label-sample/`에 둠(저장소에는 넣지 않음).

## 2026-11-27 / 화면 흐름 눌러 보기 · HS 찾기 연결 준비 (11/28 일 당겨서)

- **요청:** 남은 우리 할 일 진행.
- **반영 파일:** `src/features/products/hs_picker_input.ts`(새 파일: 제품 → HsCodePicker 입력 만들기, 기존 HS는 existing_classification으로), `share.ts` 주석(영양 계산값은 소수 둘째 자리까지만 정리, 국가별 반올림 전).
- **판단:** HsCodePicker는 GPT 파일이라 아직 화면에 붙이지 않음(11/29). 직접 적은 HS는 검토 이력이 없어 existing_classification의 확정일 · 확정자 · 검토 ID가 비어 있을 수 있음 → GPT 계약(필수 문자열)과 맞지 않아 GPT에게 확인 요청.
- **UI 의견(11/29 일괄 수정 때):** 등록 · 수정 · 상세 화면이 팀 공통 틀 밖(사이드바 없음), AI 키가 없을 때 "저장 전 확인할 내용 0개"가 같이 보여 헷갈림, 요청 목록 미리보기에 정리 전 값(usd)이 보임(저장은 USD), 할 일 요약 문장에 "0개"가 그대로 나옴, 기존 라벨 문구가 많아지면 언어별로 묶어 보기.

## 2026-11-27 / 부속물품 · HS 찾기를 한 브랜치로 합치고 화면 연결

- **요청:** GPT가 하던 부속물품 · HS 찾기도 모두 Claude가 가져와 `feature/products` 하나에서 작업. 이어서 ① PC 로컬 DB 다시 점검 ② 부속물품 화면 연결 ③ 공식 HS 코드표 ④ 통로 칸 이름 맞추기.
- **반영 파일**
  - GPT v4 통합본 그대로: `src/app/api/accessories/*`, `src/components/hs/*`, `src/features/accessories/`(document_fields · document_routes · export_selection_checkbox · option_hs_panel), `src/lib/hs/*`, 마이그레이션 0300 · 0400 · 0600 · 0700 · 0800 · 1000 · 1100, `supabase/local_only/accessory_document_permissions.sql`, `tests/verify_team_options.sql`. 설명 `src/features/accessories/feature_notes.md`.
  - 새로 만든 것: 마이그레이션 `20261127000100_accessory_action.sql`(DB 함수 `accessory_action` — GPT 로컬 시안 어댑터를 옮기고 영문명 · 설명 · 서류용 칸 · 띄어쓰기 단위 검색을 더함, `food_hs_action` — 식품 HS 검색 · 확정), `supabase/local_only/accessory_screen_permissions.sql`, `src/features/accessories/data.ts` · `actions.ts` · `components/accessory_list.tsx` · `components/hs_picker_client.tsx`, 화면 `/products/accessories/new` · `/products/accessories/[id]`, 제품 목록 아래 부속물품 목록(자리 표시 `accessory_hs_lookup` 대신), 제품 상세 "HS 코드 찾기"(`src/features/products/hs_actions.ts`), `hs_picker_input.ts`는 공용 계약 타입 사용.
- **판단:** 부속물품 화면과 통로는 로그인 전까지 로컬 Supabase + 비운영 모드에서만 켜짐(GPT 안전장치 유지). 팀 DB에서는 새 DB 함수 권한을 열지 않음. 부속물품 검색에 검색어 칸을 넣고, 이름 전체가 안 맞으면 띄어쓰기 단위 낱말로도 찾음.
- **남은 질문:** 공식 HS 코드표 원본 파일 위치(채주현 확인 중), 예시 데이터는 유정현이 가상 제품으로 교체 예정(A안, 11/27 결정).

## 2026-11-27 / 공식 HS 코드표 넣기 · 서류 통로 맞추기

- **요청:** 남은 3번(공식 HS 코드표) · 4번(제품 · 부속물품 통로 칸 맞추기).
- **반영 파일:** `scripts/build_hs_official_sql.py`(관세청 엑셀 2개 → HS 코드표 SQL, 같은 파일이면 건너뜀. 만든 SQL은 약 20MB라 Git 제외), `src/features/products/share.ts`(상세 · 목록에 item_type 'food' · item_id), `src/features/accessories/document_fields.ts`(item_type 'accessory' · item_id · name_ko · option_name · for · external · summary · packs — 제품과 같은 모양), `src/features/accessories/feature_notes.md`(칸 이름 대응표).
- **판단:** 칸 이름 자체는 바꾸지 않고(이미 쓰는 곳 보호) 공통 머리 · packs로 맞춤. 식품 HS 검색은 글자 일치만이라 "떡" → 떡갈잎 · 떡밥만 나옴 → 별칭 사전 또는 AI 검색어(GPT 설계, OpenAI 승인 필요) 결정 대기.

## 2026-11-27 / 공식 HS 데이터 반자동 갱신 연결 준비

- **요청:** GPT가 설계 중인 공식 HS 데이터 반자동 갱신(관세청 HSK 주 1회 · 표준품명 월 1회 메타데이터 확인 → 알림 → 담당자가 새 파일 올림 → 검증 · 비교 → 승인 → 영향 품목만 재검토)을 지금 코드에 잇기. GPT가 줄 핵심 기능(변경 확인 · 파일 검증 · 비교 · 버전 적용)은 중복 개발하지 말고 연결 구조만 준비.
- **반영 파일:** 마이그레이션 `20261127000200_hs_data_update_links.sql`(알림 표 `hs_data_notices` + `record_hs_data_notice` · `resolve_hs_data_notice`, HS를 쓰는 품목 `hs_items_in_use`, 바뀐 부호 → 영향 품목 `hs_items_affected`, 재검토 전환 `mark_hs_item_for_review` · `mark_hs_items_for_review`, 화면용 `hs_data_action`), `supabase/local_only/hs_data_screen_permissions.sql`, `scripts/build_hs_official_sql.py`(`--stage-only`: 새 버전을 켜지 않고 넣기만, 빈 영문명 정리를 새 버전에만), `src/features/products/hs_data.ts` · `hs_data_actions.ts` · `hs_data_banner.tsx`, 화면 `/products/hs_data`(임시), 제품 목록 위 알림 줄.
- **판단:** 서비스 공통 알림 기능은 아직 없음(검색 결과 없음) → 공통 알림을 새로 만들지 않고 HS 전용 알림 표만 둠. 나중에 공통 알림이 생기면 옮기기 쉽게 종류 · 메시지 · 상세 · 읽음 · 처리 칸을 나눔. 검토 이력이 없는 직접 입력 HS도 영향 품목에 넣고, 이 경우 field_status만 재검토 필요로 바꿈. 확정 HS 값 · 확정자 · 확정일 · 이력은 바꾸지 않음. 식품은 제품 단위, 부속물품은 옵션 단위, 보관한 것은 제외.
- **남은 질문:** GPT에 요청할 인터페이스는 프로젝트 파일 `hs-update/GPT요청_반자동갱신_연결.md`.
- **추가(채주현):** 알림을 홈 탭에서도 보이게 → 홈이 DB를 직접 읽지 않고 받아 가는 통로 `GET /api/products/notices(?all=1)`(`src/features/products/notice_passage.ts`). 응답 모양 `{ available, unresolved, notices: [{ id, source_tab, kind, title, message, detected_at, state: unread|read|resolved, link }] }` — 다른 탭 알림도 같은 모양이면 홈이 한 번에 모음. 공통 알림 기능은 만들지 않음, 홈 화면 연결은 홈 담당.

## 2026-11-27 / GPT 반자동 갱신 코드 합치기

- **요청:** GPT가 보낸 반자동 갱신 코드(확인 기록 · 업로드 검증 · 비교 · 승인)를 넣고, GPT가 요청한 최신 파일(0200 연결부 · `--stage-only` 스크립트 · `/products/hs_data` 화면과 안전장치 모듈) 보내기.
- **반영 파일(GPT):** 마이그레이션 `20261127000300_hs_data_refresh.sql`(`hs_data_checks` · `hs_data_approvals` · `compare_hs_data_versions` · `approve_hs_data_update`), `scripts/hs_metadata_check.py` · `hs_stage_upload.py` · `hs_refresh_service.py`(서버 작업자, psycopg 3 · openpyxl, 환경 변수 `HS_REFRESH_DATABASE_URL`), `tests/test_hs_metadata_check.py`.
- **Claude가 고친 것:** ① 알림 문구를 한국어로(화면에 그대로 나옴) ② `hs_data_approvals.notice_id`에 알림 표 외래키 ③ 추가된 부호도 재검토 후보에 넣음 — 6자리만 확정한 품목은 그 아래 새 10자리가 생기면 다시 골라야 할 수 있어서(실제 판단은 `hs_items_affected`가 함, 10자리 확정 품목은 영향 없음) ④ `build_hs_official_sql.py`도 HSK에 없는 표준품명 부호가 있으면 건너뛰지 않고 전체 중단(업로드 검증과 같은 규칙).
- **판단:** 화면의 업로드 · 비교 · 승인 버튼은 아직 안 붙임. 작업자가 Python이라 Next 서버에서 어떻게 부를지(로컬 프로세스 / 별도 작업 서비스)와 로그인 뒤 승인 권한이 정해져야 함. 정기 실행은 하루 한 번 `python scripts/hs_metadata_check.py`(배포 서버 미정).
- **추가(채주현):** 파이썬 실행 때 생기는 `scripts/__pycache__` 때문에 pull이 막힘 → 스크립트 4개 맨 위에 `sys.dont_write_bytecode = True`(폴더를 만들지 않음) + `.gitignore`에 `__pycache__/` · `*.pyc` 3줄 추가(공통 파일이라 PR에 적음).

## 2026-11-27 / HS 데이터 갱신 화면 연결

- **요청:** `/products/hs_data`에 수동 확인 → 공식 엑셀 올리기 → 바뀐 내용 · 영향 품목 → 승인 연결, 독립 DB로 화면 전체 흐름 시험(같은 파일 = 변경 없음, 승인 실패 시 기존 버전 유지, 표준품명만 · HSK만 변경). 그다음 정기 실행. 팀 DB와 승인 공개는 권한 확정 뒤.
- **반영 파일:** `scripts/hs_refresh_cli.py`(Next 서버가 부르는 입구, JSON 입출력, 올린 파일 이름을 버전 정보에 기록), `src/features/products/hs_refresh.ts`(작업자 실행 · 안전장치 · 비교 결과 해시 · 오류 한국어), `src/app/products/hs_data/upload/route.ts`(엑셀 받기 — 서버 액션 1MB 제한 때문에 일반 요청 처리기, 임시 폴더 처리 후 삭제), `hs_data_actions.ts`(지금 확인 · 승인), `page.tsx`(확인 · 갱신 칸, 비교 상자, 승인 기록), `scripts/run_hs_check.ps1` · `register_hs_check_task.ps1`(정기 확인 스크립트).
- **판단:** 승인 직전에 다시 비교해 화면에서 본 결과와 다르면 막음. 갱신 기능은 로컬 Supabase + 비운영 + `HS_REFRESH_DATABASE_URL`일 때만 켜짐(권한 정해지면 권한 검사로 교체). 작업자에게는 필요한 환경 변수만 넘김(AI 키 안 넘김). 정기 확인은 하루 한 번 실행하고 간격(HSK 7일 · 표준품명 한 달)은 DB가 판단.
- **채주현 결정:** PC 작업 스케줄러에는 등록하지 않음. 스크립트만 두고 배포 서버가 정해지면 그쪽 정기 실행으로.

## 2026-11-27 / 기밀 업로드 방지 · 탭 마무리 1차

- **요청:** 기밀 업로드 방지는 "금지 자료 목록(이런 내용은 올리지 마세요, 마스킹 테이프로 가리세요)" + 강사님 제안 "기밀값은 AI 전송 전에 가린 뒤 결과를 받으면 원래 값으로 복원". 그다음 남은 일 1번(우리 쪽 마무리)부터.
- **반영 파일:** `src/lib/sanitize.ts`(`maskForAI` · `restoreMasks` · `checkMasks`, 가린 표시는 남은 흔적 검사에서 제외), `src/features/products/extract.ts`(AI 지시문, 내부 칸도 칸 목록에 넣되 지금 값은 안 보여 줌, 답을 되돌리기), `save.ts`(1단계에서 가리기, 2단계에 표시표 전달), `import_request.ts`(`restored` 표시, 통화 대문자), `src/app/products/[code]/import/import_request_form.tsx`(금지 자료 안내, 되돌린 값 표시, AI를 못 불렀을 때 0개 표 대신 안내만), `src/features/products/doc_keys.ts`(신규) · `share.ts` · `src/features/accessories/document_fields.ts`(서류 탭 공통 칸 이름 `doc_key`, 부속물품 CTN 크기 한 칸), `detail_tabs.tsx`(할 일 요약에 0개 문장 빼기), `fields.ts`(보관 조건 힌트), `[code]/page.tsx`(라벨 문구 언어별), `tests/sanitize_test.mts`, 명세 · `feature_notes.md`.
- **판단:** 가리기 대상은 "내부만" 정보(주소 · 연락처 · 단가 · 사업자번호)만. 배합비는 "받지 않음"이라 되돌리지 않고 지움. 원래 값 표(masks)는 사용자 화면 ↔ 우리 서버 사이에서만 오가고 AI로 안 감. 단가 같은 내부 칸은 가린 표시에서 되돌린 값만 받아 AI가 값을 지어내지 못하게 함. 근거 문장은 확인 메모로 저장되므로 가린 표시 그대로 둠. 부속물품 HS 찾기(`prepareForAI`)는 주소 · 단가가 필요 없어 지금처럼 지우기만.
- **남은 점:** 실제 AI 호출은 OpenAI 결제 뒤(채주현이 먼저 결제 예정). 스캔본 · 사진은 계속 받지 않음.
