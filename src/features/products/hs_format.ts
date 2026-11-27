// HS 코드 보여 주기 (Claude). 저장 · 복사 · 다른 탭 통로는 숫자 그대로, 화면 · 엑셀에서만 점 · 하이픈 형식.
// 예: 190230 → 1902.30, 1902309000 → 1902.30-9000 (11/26 검토 의견 2-7, 부속물품 화면과 같은 규칙)
export function format_hs_code(v: string | null | undefined): string | null {
  const d = (v ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  if (d.length === 10) return `${d.slice(0, 4)}.${d.slice(4, 6)}-${d.slice(6)}`;
  return d;   // 자리 수가 맞지 않으면 손대지 않고 숫자만
}
