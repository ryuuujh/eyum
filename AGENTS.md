# E:YUM 팀 개발 지침

혜윰 식품 수출 대시보드의 앱과 Git 저장소는 이 폴더를 루트로 사용한다. 공통 개발환경과 DB 주담당은 유정현, 부담당은 채주현이다.

## 작업 시작

- README.md, docs/development.md, docs/git_rules.md, docs/recording_rules.md를 읽고 작업한다. 화면 변경 시 docs/design_system.md의 초기 권장안을 참고하고, 담당 화면의 디자인은 기능 담당자가 자유롭게 정한다. DB 변경 시 docs/db_rules.md를 함께 확인한다.
- 팀이 직접 정하는 파일·폴더·변수·함수·DB 이름에는 영문 소문자 snake_case를 사용한다. 프레임워크 파일 규칙, React 컴포넌트와 훅, 외부 API의 필드명, 환경변수는 각 도구의 표기를 따른다.
- 새 기능 작업은 해당 기능의 명세에 입력·출력·권한·검증 기준을 적고 진행한다. 정해지지 않은 전체 탭 연동과 사용자 권한은 미정으로 기록한다.

## 작업 마무리

- 코드나 규칙을 변경하면 같은 작업 안에서 docs/worklogs/<작업자>/prompt_log.md와 validation.md를 갱신한다. 작업 지시, 바뀐 점, 실제 확인한 결과, 남은 점을 적는다. 실행하지 못한 검증은 미검증으로 적는다.
- 키, 비밀번호, 기업 원본과 개인정보는 기록에서 제외한다. OpenAI 호출은 서버에서 처리한다.
- AI는 변경 요약과 한국어 커밋 제목을 제안한다. 스테이징·커밋·푸시는 담당자가 직접 수행한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
