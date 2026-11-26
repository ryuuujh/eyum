# E:YUM 개발 규칙

[README](../README.md)의 공통 버전과 실행 절차를 따른다. 패키지 관리자는 npm을 사용하고, 팀원은 잠금 파일을 기준으로 `npm ci`를 실행한다.

## 파일 위치와 이름

| 위치 | 관리할 내용 |
|---|---|
| `src/app/` | 페이지 진입점, 레이아웃, 공통 스타일 |
| `src/features/<기능명>/` | 각 탭의 업무 로직과 기능 명세 |
| `src/components/` | 여러 탭이 함께 쓰는 화면 요소 |
| `src/lib/` | 여러 기능이 함께 쓰는 서버·외부 서비스 연결 |
| `supabase/migrations/` | DB 구축 시점부터 순서대로 적용할 SQL 변경 이력 |
| `docs/worklogs/<담당자>/` | 개인별 개발 지시와 검증 결과 |

- 앱 루트에 설정 파일과 소스를 바로 둔다. 직접 짓는 파일·폴더·일반 변수·함수·DB 이름은 영문 소문자 `snake_case`로 작성한다.
- 도구가 인식하는 표준 이름(`README.md`, `AGENTS.md`, `package-lock.json`, `.env.example`), React 컴포넌트(`ProductForm`)·훅(`useProductForm`), 환경변수(`OPENAI_API_KEY`)는 각 용도에 맞는 표기를 따른다.
- 기능 작업을 시작할 때 [README의 담당자 표](../README.md#기능별-담당자와-작업-파일)에서 본인의 기능 명세서를 열어 입력·출력·권한·검증 기준을 적는다. 새 기능에 명세서가 필요하면 [기능 명세 양식](feature_spec.md)을 해당 기능 폴더의 `feature_spec.md`로 복사한다.

## 팀 공통 변경

- 패키지를 추가할 때는 프로젝트에서 이미 사용하는 기능을 확인하고 PR에 추가 이유를 적는다. `package.json`과 `package-lock.json`을 함께 반영한다.
- 새 업무 탭에서는 공통 UI를 출발점으로 삼을 수 있다. 각 담당자가 자기 화면의 디자인과 컴포넌트를 자유롭게 선택한다. 공통 스타일·컴포넌트나 입력 형식의 변경이 다른 탭에도 영향을 줄 때는 해당 담당자와 조율한다. [디자인 가이드와 적용 예시](design_system.md)
- 새 환경변수가 필요하면 비밀값 없는 이름과 용도를 `.env.example`에 추가한다. 실제 값은 로컬 `.env.local` 또는 해당 환경의 서버 설정에 둔다.
- 서비스의 모델 이름·오류 처리·클라이언트 연결은 공통 서버 코드에서 관리하고, 탭별 프롬프트와 출력 항목은 해당 기능에서 관리한다. 사용할 OpenAI 상위 모델의 정확한 ID는 실제 연동 시 확정한다. 서버 비밀 키는 브라우저에서 참조하지 않는다.
- 발표와 인수인계에는 실제로 확인한 동작과 남은 사항을 함께 적는다. 대표 사례로 기업의 기존 업무와 비교할 때 개선된 점과 한계를 팀 검증 기록에 남긴다.

## 메뉴별 화면 파일

공통 헤더와 메뉴는 `src/components/dashboard_frame.tsx`에서 관리한다. 헤더의 수출국 드롭다운은 `src/components/country_select.tsx`에 있다. 아래 경로는 `src/app/` 기준이다.

| 메뉴 | 화면 진입 파일 |
|---|---|
| 홈 | `page.tsx` |
| 식품 규제 | `regulations/page.tsx` |
| 라벨링 | `labels/page.tsx` |
| CI/PL | `export_documents/page.tsx` |
| 수출신고서 | `export_declaration/page.tsx` |
| CoA 번역 | `certificates/page.tsx` |
| 제품 관리 · 부속물품 HS코드 | `products/page.tsx` |
| 내 계정 | `login_management/page.tsx` |

사이드바 맨 위에는 E:YUM by Hyeum 로고와 접기 버튼이 있다. 홈 아래 구분선 다음에는 ‘국가별 수출 업무’ 또는 ‘수출국 · 프랑스’처럼 선택한 국가를 표시한다. 다섯 업무는 원형 숫자 1~5로 구분하고 현재 탭을 연녹색으로 강조한다. 하단에는 제품 관리와 현재 사용자의 계정 영역을 차례로 둔다. 국가 선택값은 주소에 유지해 새로고침하거나 계정 화면을 열어도 같은 국가에서 시작한다.
