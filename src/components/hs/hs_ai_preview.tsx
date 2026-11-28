"use client";

import { useState } from "react";
import type { Preview, Approval } from "@/lib/hs/ai_preview.mts";

type Props = {
  initialFields: Record<string, string>;
  preview: (fields: Record<string, string>) => Promise<Preview>;
  submit: (approval: Approval) => Promise<void>;
};

export function HsAiPreview({ initialFields, preview, submit }: Props) {
  const [fields, setFields] = useState(initialFields);
  const [token, setToken] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function prepare() {
    setBusy(true);
    setToken("");
    setConfirmed(false);
    setMessage("");
    try {
      const result = await preview(fields);
      if (result.ok) {
        setFields(result.fields);
        setToken(result.token);
      } else setMessage(result.reason);
    } catch {
      setMessage("미리보기를 가져오지 못했습니다.");
    } finally { setBusy(false); }
  }
  async function send() {
    if (!confirmed || !token || busy) return;
    setBusy(true);
    setToken("");
    setConfirmed(false);
    try {
      await submit({ fields, token, confirmed });
    } catch { setMessage("AI 요청을 완료하지 못했습니다. 미리보기부터 다시 진행해 주세요."); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = {
    item_name:"물품명",item_name_en:"영문명", material:"재질", purpose:"용도",intended_use:"용도",form:"형태",shape:"형태",
    description:"형태 및 설명",food_type:"식품 유형",ingredients:"원재료",main_ingredients:"원재료",
    existing_classification:"기존 분류",packaging_form:"포장 형태",processing:"가공 방식",storage:"보관 조건",
    size:"크기",printed:"인쇄 여부",components:"구성품",
  };
  return <fieldset disabled={busy}>
    <legend>AI 전송 정보 확인</legend>
    {Object.entries(fields).map(([key,value]) => <label key={key}>
      {labels[key] ?? key}
      <textarea value={value} onChange={event => {
        setFields({ ...fields, [key]: event.target.value });
        setToken("");
        setConfirmed(false);
      }} />
    </label>)}
    <button type="button" onClick={prepare}>전송 정보 미리보기</button>
    {token && <>
      <p>아래 확인을 선택하면 화면에 표시된 물품 정보와 비교 대상 공식 품명·코드가 AI로 전송될 수 있습니다.</p>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> 전송 정보에 민감정보가 없는지 확인했습니다.</label>
      <button type="button" disabled={!confirmed} onClick={send}>확인한 정보 전송</button>
    </>}
    <p role="status">{message}</p>
  </fieldset>;
}

