# 부속물품 · HS 찾기 — 작업 메모

11/27부터 제품 관리 탭 전체(제품 + 부속물품 + HS 찾기)를 Claude 한 곳에서 이어서 작업한다. 이 폴더와 아래 파일은 GPT가 만든 v4 통합본(heyum-ci-pl-accessories-v4)을 그대로 옮긴 것이다. 원본 ZIP은 프로젝트 파일 `product-tab/gpt-archive/`에 보관.

## 파일

| 역할 | 경로 |
|---|---|
| 서류용 부속물품 통로 | `src/app/api/accessories/route.ts` (`?selected=1`), `src/app/api/accessories/[option_id]/route.ts` (GET 상세 · PATCH 서류 포함 체크) |
| 통로 응답 만들기 | `src/features/accessories/document_routes.ts`, `document_fields.ts` |
| 화면 부품 | `export_selection_checkbox.tsx`(옵션별 서류 포함), `option_hs_panel.tsx`(옵션 → HsCodePicker) |
| HS 찾기 공통 | `src/components/hs/hs_code_picker.tsx`, `hs_ai_preview.tsx`, `src/lib/hs/*` (계약 `contracts.ts`) |
| DB | `supabase/migrations/…0300`(공식 HS 코드표) `…0400`(검토 이력) `…0600`(부속물품 · 옵션) `…0700`(확정 · 재검토 RPC) `…0800`(검색) `…1000`(옵션 서류 포함) `…1100`(옵션 가액 · 통화) |
| 로컬 전용 권한 | `supabase/local_only/accessory_document_permissions.sql` — 가상 데이터만 있는 독립 로컬 DB에서만. 기본 DB 이름이 postgres면 같은 세션에서 먼저 `SET heyum.local_accessory_permissions = 'on';` |
| DB 검증 | `tests/verify_team_options.sql` |

## 규칙 (합의된 것)

- 옵션별 `export_selected` 기본 false, 옵션이나 물품을 보관하면 해제, 복원해도 다시 체크해야 함.
- 통로 `fields`는 제품 통로와 같은 배열 모양, usable = confirmed 또는 not_applicable.
- 가액 · 통화는 옵션마다 저장, 내부 조회에만. `external=1`과 AI 전송에서는 뺀다.
- 부속물품 통로는 지금 localhost · 비운영 환경에서만 켜진다(로그인 전 안전장치).
- 사람이 직접 입력한 식품 HS는 `existing_classification`의 확인일 · 확인자 · 검토 ID가 null일 수 있다.

## 남은 일

- 화면 연결: 팀 부속물품 목록에 `ExportSelectionCheckbox`, 옵션 편집에 가액 · 통화 칸, 제품 수출 · 물류 탭에 HsCodePicker(`build_hs_picker_input`).
- 통로 맞추기: 목록 가볍게, 최상위 `summary` · `packs`, 칸 이름 차이(제품 `unit_gross_g` · `finished_country` · `ctn_size` ↔ 부속물품 `unit_weight_g` · `origin` · `ctn_l/w/h_cm`).
- 공식 HS 코드표 넣기(0300 표는 비어 있음. 원본 ZIP의 `import_official.py`).
- 팀 공통 DB 적용 · 실제 AI 호출 · 운영 권한(로그인)은 승인 뒤.
