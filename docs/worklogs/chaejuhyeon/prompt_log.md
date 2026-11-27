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
  - DB: `20261126000100_product_core.sql`에 `products.export_selected`(기본 false)와 `product_label_texts` 표 추가, `20261126000900_save_product_rpc.sql`에 라벨 문구 저장 추가(수출 체크는 등록 · 수정 저장으로 바뀌지 않음), `seed.sql`에 또떡EZ 체크 · 영어 라벨 문구 5줄(주소 항목 제외).
  - 칸: `fields.ts`에 기한 종류 · 포장 크기 · 라벨 부착 면적(라벨), 교차접촉 알레르기(구성품, 라벨), HSK 10자리(서류, HS 찾기로만 채워져 할 일 제외) · 통화 · CTN 순중량 · 총중량 · 크기(서류) 추가. 여러 DB 칸을 묶은 칸(포장 크기 등)은 `COMPOSITE_FIELDS`.
  - 통로: `share.ts` — 칸마다 `raw`(계산용 원값), `packs`(개별포장 · 외박스 · 팔레트 숫자), `label_texts`; `GET /api/products?selected=1`.
  - 화면(임시 UI): 목록 "수출" 체크 열, 상세 "수출할 제품" 체크 · 기존 라벨 문구 표, 등록 · 수정 "표시 정보" 탭에 기존 라벨 문구 입력, 새 칸 아래 상태 안내.
  - 그 밖에: `form.ts` · `view.ts` · `apply_changes.ts`(묶은 칸 다시 올리기) · `data.ts` · `sample.ts` · `persist.ts` · `save.ts` · `types.ts`, 새 파일 `src/app/products/export_toggle.tsx`.
- **판단:** 수출 체크는 나라와 상관없이 제품마다 하나(제품 화면은 국가 선택 없음, 11/25 결정). 라벨 문구는 원문 보관용이라 확인 상태를 두지 않음. 새 칸이 할 일에 들어가서 제품마다 할 일 개수가 늘어남.
- **남은 질문:** 나라별로 다른 제품을 고를 필요가 있는지(서류 담당), 유니패스 HS 표기 형식(서류 담당), 라벨 문구 항목 구분이 라벨 명세와 맞는지(라벨 담당).
