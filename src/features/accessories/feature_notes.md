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

## 화면 (11/27 Claude 추가)

| 화면 | 경로 |
|---|---|
| 부속물품 목록 (옵션마다 한 줄, 서류 포함 체크) | `/products` 아래 `#accessories` — `components/accessory_list.tsx` |
| 새 부속물품 | `/products/accessories/new` |
| 부속물품 상세 (물품 정보 · 옵션 · 가액 · 서류용 칸 · HS 찾기 · 재검토 · 보관/되살리기 · 옵션 추가) | `/products/accessories/[id]?option=<옵션 ID>` |
| 제품 HS 찾기 | 제품 상세 `/products/[code]#hs` |

- 저장은 모두 DB 함수 `accessory_action(p jsonb)` (GPT 로컬 시안 `local_accessory_action`을 옮김), 식품 HS는 `food_hs_action(p jsonb)` — `supabase/migrations/20261127000100_accessory_action.sql`.
- 팀 DB에서는 두 함수 권한을 열지 않는다. 로컬 확인은 `supabase/local_only/accessory_screen_permissions.sql` (document_permissions 다음에).
- 서버 동작: `actions.ts`(부속물품), `src/features/products/hs_actions.ts`(식품). 읽기: `data.ts`.

## 서류 탭이 제품 · 부속물품을 같은 코드로 읽는 법 (11/27)

- 두 상세 응답 모두 `item_type`(`food` · `accessory`), `item_id`, `name_ko`, `for`, `external`, `summary`, `fields[]`, `packs`를 준다. 판정은 `fields[].usable`만 쓴다.
- 숫자 계산은 `packs`(같은 모양): 개당 중량 `packs.unit.gross_g`, CTN 입수 · 순중량 · 총중량 · 크기 `packs.outer.units_per_ctn · net_kg · gross_kg · size_cm{l,w,h}`. 부속물품에 없는 값은 null.
- `fields[].field` 이름이 다른 것 (상태 · usable을 볼 때): 개당 중량 제품 `unit_gross_g` ↔ 부속물품 `unit_weight_g`, 원산지 제품 `finished_country`(완제품 제조국) ↔ `origin`, CTN 크기 제품 `ctn_size`(한 칸) ↔ `ctn_l_cm` · `ctn_w_cm` · `ctn_h_cm`, 영문명 제품 `name_en` ↔ `item_name_en`. HS(`hs6` · `hsk10`) · CTN(`units_per_ctn` · `ctn_net_kg` · `ctn_gross_kg`) · 가액(`unit_price` · `currency`)은 같은 이름.
- 목록: 제품 `GET /api/products?selected=1`은 가벼운 목록(code · item_id), 부속물품 `GET /api/accessories?selected=1`은 상세 배열.

## 남은 일

- 식품 HS 검색이 약함("떡" → 떡갈잎 · 떡밥): 별칭 사전(`hs_search_aliases`) 채우기 또는 AI 검색어(OpenAI 승인 필요) 중 결정.
- 공식 HS 코드표: `scripts/build_hs_official_sql.py`로 관세청 엑셀 2개 → SQL을 만들어 psql로 넣는다(로컬은 11/27 적재 완료, 팀 DB는 승인 뒤). 만든 SQL(약 20MB)은 Git에 넣지 않는다.
- 팀 공통 DB 적용 · 실제 AI 호출 · 운영 권한(로그인)은 승인 뒤.
