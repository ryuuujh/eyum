"use client";

import { Table } from "@/components/ui";
import { format_hs_code } from "@/features/products/hs_format";
import { useEffect, useRef, useState } from "react";
import type { ConfirmedClassification, HsConfirmationInput, HsPickerInput, HsSearchResult } from "@/lib/hs/contracts";

type Props = HsPickerInput & {
  search: (item: HsPickerInput, answers: Record<string, string>) => Promise<HsSearchResult>;
  confirm: (selection: HsConfirmationInput) => Promise<ConfirmedClassification>;
  onConfirmed: (classification: ConfirmedClassification) => void;
};

export default function HsCodePicker(props: Props) {
  return <PickerSession key={JSON.stringify([props.item_type, props.item_id])} {...props} />;
}

function PickerSession(props: Props) {
  const { item_id, item_name, item_type, item_name_en, attributes, description, existing_classification, search, confirm, onConfirmed } = props;
  const [result, setResult] = useState<HsSearchResult>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<number>();
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    return () => { generation.current += 1; };
  }, []);

  async function run_search() {
    const request = ++generation.current;
    setBusy(true);
    setSelected(undefined);
    setResult(undefined);
    setMessage("");
    try {
      const response = await search({ item_id, item_name, item_type, item_name_en, attributes, description, existing_classification }, answers);
      if (request !== generation.current) return;
      setResult(response);
      if (!response.candidates.length) setMessage("검색 후보가 없습니다.");
    } catch {
      if (request === generation.current) setMessage("후보 검색에 실패했습니다.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }

  async function save() {
    const candidate = selected === undefined ? undefined : result?.candidates[selected];
    if (!result || !candidate || !reviewer.trim() || !reason.trim()) return;
    const request = ++generation.current;
    setBusy(true);
    try {
      const value = await confirm({ classification_id: result.classification_id, hs6: candidate.hs6,
        hsk10: candidate.hsk10, confirmed_by: reviewer.trim(), human_reason: reason.trim() });
      if (request !== generation.current) return;
      onConfirmed(value);
      setMessage("담당자 확인을 저장했습니다.");
      setResult(undefined);
      setSelected(undefined);
    } catch {
      if (request === generation.current) setMessage("확정할 수 없습니다. 후보와 공식 데이터 버전을 다시 확인해 주세요.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }

  return <section>
    <h2>HS코드 탐색</h2>
    {existing_classification && <p>현재 확인 코드 {format_hs_code(existing_classification.hsk10 ?? existing_classification.hs6)}</p>}
    {result?.questions.map(question => <label key={question.field_key}>{question.label}
      {question.options?.length ? <select disabled={busy}
        value={answers[question.field_key] ?? ""} onChange={e => setAnswers({ ...answers, [question.field_key]: e.target.value })}>
        <option value="">선택</option>{question.options.map(option => <option key={option}>{option}</option>)}</select>
        : <input disabled={busy} value={answers[question.field_key] ?? ""}
          onChange={e => setAnswers({ ...answers, [question.field_key]: e.target.value })} />}
    </label>)}
    <button type="button" disabled={busy || !item_id} onClick={run_search}>후보 탐색</button>
    {result?.ai_rationale && <p>AI 검색어 제안 근거 {result.ai_rationale}</p>}
    {!!result?.candidates.length && <Table head={["선택", "HS6", "HSK10", "품명", "공식 자료"]}>{result.candidates.map((candidate, index) => <tr key={candidate.hsk10 ?? candidate.hs6}>
        <td><input type="radio" aria-label={candidate.hsk10 ?? candidate.hs6} checked={index === selected} disabled={busy}
          onChange={() => setSelected(index)} /></td><td>{format_hs_code(candidate.hs6)}</td><td>{format_hs_code(candidate.hsk10) ?? "—"}</td><td>{candidate.label}</td>
        <td><a href={candidate.official_source_url}>관세청 자료</a></td>
      </tr>)}
    </Table>}
    {selected !== undefined && <div>
      <label>담당자 <input value={reviewer} onChange={e => setReviewer(e.target.value)} /></label>
      <label>확정 근거 <input value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button type="button" disabled={busy || !reviewer.trim() || !reason.trim()} onClick={save}>담당자 확인</button>
    </div>}
    <p>이 화면의 확인은 기업 내부 기록입니다. 분류가 불확실하면 관세사 또는 관세청 품목분류 사전심사에서 확인할 수 있습니다.</p>
    <p role="status">{message}</p>
  </section>;
}

