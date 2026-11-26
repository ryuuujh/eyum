# E:YUM · 혜윰 수출 대시보드

팀 공통 개발환경의 첫 화면이다. 어느 화면에서나 상단에서 싱가포르·프랑스를 선택하고, 왼쪽 메뉴로 이동하면서 선택을 유지한다. 제품과 부속물품의 기본 정보는 국가와 독립적으로 관리할 예정이다. 이 버전의 화면 확인에는 서비스 키가 필요하지 않다.

## 기능별 담당자와 작업 파일

내 이름이 있는 행에서 **기능 명세서**를 열어 입력·출력·권한·검증 기준을 채운다. **화면 파일**은 해당 메뉴를 열었을 때 보이는 내용을 수정하는 곳이다. [11월 24일 담당 배정 회의록](https://app.notion.com/p/kitadm/11-24-c97f7984da6d8371937581a0ed59cf63)

| 담당자 | 기능 | 기능 명세서 | 화면 파일 | 작업 브랜치 |
|---|---|---|---|---|
| 주상준 | 홈 화면 | [src/features/home/feature_spec.md](src/features/home/feature_spec.md) | [src/app/page.tsx](src/app/page.tsx) | `feature/home` |
| 채주현 | 제품 등록·관리 (부속물품 HS코드 포함) | [src/features/products/feature_spec.md](src/features/products/feature_spec.md) | [src/app/products/page.tsx](src/app/products/page.tsx) | `feature/products` |
| 유정현 | 식품 규제·필수 서류 체크리스트 | [src/features/regulations/feature_spec.md](src/features/regulations/feature_spec.md) | [src/app/regulations/page.tsx](src/app/regulations/page.tsx) | `feature/regulations` |
| 박진혁 | 식품 라벨링 | [src/features/labels/feature_spec.md](src/features/labels/feature_spec.md) | [src/app/labels/page.tsx](src/app/labels/page.tsx) | `feature/labels` |
| 최유진 | CI·PL 초안 작성 | [src/features/export_documents/feature_spec.md](src/features/export_documents/feature_spec.md) | [src/app/export_documents/page.tsx](src/app/export_documents/page.tsx) | `feature/export_documents` |
| 최유진 | 수출신고 작성 보조 | [src/features/export_declaration/feature_spec.md](src/features/export_declaration/feature_spec.md) | [src/app/export_declaration/page.tsx](src/app/export_declaration/page.tsx) | `feature/export_declaration` |
| 주상준 | CoA 등록·번역 | [src/features/certificates/feature_spec.md](src/features/certificates/feature_spec.md) | [src/app/certificates/page.tsx](src/app/certificates/page.tsx) | `feature/certificates` |

팀 저장소를 복제한 뒤 최신 `develop`에서 작업할 기능의 브랜치를 만든다. 예를 들어 식품 규제의 첫 작업은 `git switch -c feature/regulations`, 이미 만든 로컬 브랜치에서 이어갈 때는 `git switch feature/regulations`를 사용한다. AI는 작업을 마칠 때 담당자의 프롬프트·검증 기록을 갱신한다. 담당자는 기록과 변경 파일을 확인해 직접 커밋·푸시하고 `develop`으로 PR을 보낸다. [조원별 기록 파일](docs/recording_rules.md) · [Git 협업 규칙](docs/git_rules.md)

## Windows에서 시작

개발 폴더 `eyum` 안에서 터미널을 연다. 팀 기준 실행 환경은 Node.js 24.20.0, npm 11.19.0이다. `node --version`, `npm --version`으로 현재 환경을 확인한다.

프로젝트에 `package-lock.json`이 있으면 `npm ci`로 설치한다. 최초 설정 담당자는 잠금 파일이 없는 경우 npm 레지스트리에 접근 가능한 환경에서 `npm install`을 실행하고, 생성된 잠금 파일을 검토해 팀에 공유한다.

```powershell
npm run dev
```

터미널에 출력한 Local 주소(기본 `http://localhost:3000`)를 브라우저에서 연다. 사용을 마치면 해당 터미널에서 Ctrl+C를 누른다.

## 첫 실행 확인

1. E:YUM 홈이 표시되는지 확인한다.
2. 상단에서 프랑스를 선택한 뒤 식품 규제를 열어 선택 국가가 유지되는지, 같은 화면에서 싱가포르로 전환할 수 있는지 확인한다.
3. 사이드바 하단의 제품 관리를 열어 제품과 부속물품 HS코드가 국가 공통 영역에 있는지 확인한다. 그 아래 ‘내 계정’에서 로그인하면 사이드바에 본인의 이름과 소속이 표시된다. 계정 연결 설정 전에는 준비 안내가 표시된다.
4. `npm run lint`, `npm run typecheck`, `npm run build`를 실행한다. AI와 작업할 때는 AI가 실제 검사 결과를 개인 검증 기록에 남기고 담당자가 확인한다.

기존 팀 계정으로 로그인하려면 `.env.example`을 참고해 `.env.local`에 팀 개발 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤 개발 서버를 다시 시작한다. Supabase에 등록된 계정의 이메일과 비밀번호를 사용한다. 실제 환경변수는 Git으로 공유하지 않는다.

## 팀 문서

| 문서 | 내용 |
|---|---|
| [공통 개발 규칙](docs/development.md) | 폴더 구조, npm 패키지, 공통 코드와 설정 |
| [Git 규칙](docs/git_rules.md) | 브랜치, 커밋 제목, 사람이 직접 수행하는 Git 작업 |
| [AI 기록 규칙](docs/recording_rules.md) | 개인별 프롬프트와 검증 기록 갱신 시점 |
| [공통 디자인 가이드](docs/design_system.md) | 기능 담당자가 화면에 맞게 조정할 수 있는 초기 권장안과 공통 카드 사용 예시 |
| [탭 명세 양식](docs/feature_spec.md) | 기능별 입력·출력·검증 기록 |
| [DB 규칙](docs/db_rules.md) | 공유 DB 역할·권한과 변경 적용 방향 |
| [결정 사항](docs/decisions.md) | 확정 사항과 후속 협의 항목 |

공통환경·DB·PR 검토 주담당은 유정현, 부담당은 채주현이다. 기능 작업은 `feature/*`에서 진행하고 `develop`에서 통합한 뒤 `main`으로 반영한다.
