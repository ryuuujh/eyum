# E:YUM 프롬프트·검증 기록

개발 도우미는 작업 하나를 마칠 때마다 아래 두 파일을 갱신한다. 담당자는 변경 사항과 함께 기록을 읽고 커밋한다. 해당 작업의 지시·수정·검증 근거를 요약하고 관련 원문은 공개 가능한 부분만 인용한다.

- `docs/worklogs/<담당자>/prompt_log.md` — 요청, 수행한 변경, AI 출력에 대한 판단, 재지시·개선 내용
- `docs/worklogs/<담당자>/validation.md` — 기대 결과, 실제 실행한 방법, 관찰한 결과와 미검증 범위

## 조원별 기록

| 조원 | 폴더명 | 기록 파일 |
|---|---|---|
| 유정현 | `ryujeonghyeon` | [프롬프트](worklogs/ryujeonghyeon/prompt_log.md) · [검증](worklogs/ryujeonghyeon/validation.md) |
| 최유진 | `choiyujin` | [프롬프트](worklogs/choiyujin/prompt_log.md) · [검증](worklogs/choiyujin/validation.md) |
| 채주현 | `chaejuhyeon` | [프롬프트](worklogs/chaejuhyeon/prompt_log.md) · [검증](worklogs/chaejuhyeon/validation.md) |
| 주상준 | `joosangjun` | [프롬프트](worklogs/joosangjun/prompt_log.md) · [검증](worklogs/joosangjun/validation.md) |
| 박진혁 | `parkjinhyeok` | [프롬프트](worklogs/parkjinhyeok/prompt_log.md) · [검증](worklogs/parkjinhyeok/validation.md) |

## 작성 방법

1. 작업 요청, 명시된 담당 기능, 사용자 확인 순으로 기록 대상을 확인한다. 알 수 없으면 담당자를 확인하고 다른 사람 기록에 임의로 추가하지 않는다.
2. 위 표에서 담당자의 프롬프트 기록과 검증 기록을 열어 해당 작업을 추가한다.
3. 아래 형식으로 두 파일에 같은 날짜·작업 제목을 적는다. 후속 실험은 이전 기록에 이어 추가한다.
4. AI 응답을 제품에 사용하는 기능은 실제 이용한 모델·프롬프트 수정 사유·근거 누락 또는 추정값 처리 결과를 기록한다. 테스트하지 않은 항목은 ‘미검증’으로 표시한다.
5. API 키, 토큰, 실제 계정 정보, 기업 기밀 자료·원문은 기록에 넣지 않는다. 근거가 필요한 경우 공유 가능한 샘플명이나 자료 유형을 적는다.

### prompt_log.md 예시 항목

- 날짜 / 작업 제목
- 요청 및 개선 목적
- 반영한 파일과 주요 변경
- 재지시·남은 질문

### validation.md 예시 항목

- 날짜 / 작업 제목
- 확인할 동작과 기대 결과
- 수행 방법 / 관찰한 결과
- 미검증 범위
