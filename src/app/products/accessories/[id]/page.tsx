// 부속물품 상세 (Claude, 11/27): 물품 정보 · 옵션 · 서류용 칸 · HS 찾기 · 보관
// GPT 로컬 시안(accessory-local)의 흐름을 따랐다. 디자인은 임시 (11/29 통합 때 정리).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Empty, Field, PageHeader, Section, StatusText, ui } from '@/components/ui';
import { format_hs_code } from '@/features/products/hs_format';
import { get_accessory } from '@/features/accessories/data';
import { add_option, archive_change, confirm_accessory_hs, edit_option, edit_shipping, mark_for_review, rename_accessory, search_accessory_hs } from '@/features/accessories/actions';
import { ExportSelectionCheckbox } from '@/features/accessories/export_selection_checkbox';
import { HsPickerClient } from '@/features/accessories/components/hs_picker_client';

export const dynamic = 'force-dynamic';

const num = (v: number | null) => (v == null ? '' : String(v));

export default async function AccessoryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ option?: string }> }) {
  const { id } = await params;
  const { option } = await searchParams;
  const a = await get_accessory(id).catch(() => null);
  if (!a) notFound();
  const active = a.options.filter((o) => !o.archived);
  const archived = a.options.filter((o) => o.archived);
  const cur = active.find((o) => o.optionId === option) ?? active.find((o) => o.isDefault) ?? active[0];

  if (a.archived) {
    return (
      <main className={ui.page}>
        <PageHeader back={{ href: '/products#accessories', label: '제품 목록' }} title={a.name} sub="보관한 물품이에요. 되살리면 다시 고칠 수 있어요." />
        <form action={archive_change.bind(null, a.id, null, true)} className="mt-6"><button className={ui.btnPrimary}>물품 되살리기</button></form>
      </main>
    );
  }

  return (
    <main className={ui.page}>
      <PageHeader back={{ href: '/products#accessories', label: '제품 목록' }} title={a.name} sub={[a.nameEn, a.description].filter(Boolean).join('  |  ')}
        actions={<form action={archive_change.bind(null, a.id, null, false)}><button className={ui.btnSecondary}>물품 보관</button></form>} />

      <Section title="물품 정보">
        <form action={rename_accessory.bind(null, a.id)} className={ui.card}>
          <div className={ui.formGrid}>
            <Field label="물품명"><input name="name" required defaultValue={a.name} className={ui.input} /></Field>
            <Field label="영문명" optional><input name="nameEn" defaultValue={a.nameEn} className={ui.input} /></Field>
            <Field label="설명" optional><input name="description" defaultValue={a.description} className={ui.input} /></Field>
          </div>
          <p className={ui.hint}>물품명을 바꾸면 확정된 HS는 &quot;재검토 필요&quot;로 바뀌어요.</p>
          <div className="mt-4 flex justify-end"><button className={ui.btnSecondary}>물품 정보 저장</button></div>
        </form>
      </Section>

      <Section title="옵션" count={active.length}>
        <div className="flex flex-wrap gap-2">
          {active.map((o) => (
            <Link key={o.optionId} href={`/products/accessories/${a.id}?option=${o.optionId}`}
              className={o.optionId === cur?.optionId ? ui.btnSmallPrimary : ui.btnSmallSecondary}>
              {o.optionName || '기본 옵션'}{o.isDefault && active.length > 1 ? ' (기본)' : ''}
            </Link>
          ))}
        </div>
        {archived.length > 0 && (
          <div className={ui.hint}>보관한 옵션: {archived.map((o) => (
            <form key={o.optionId} action={archive_change.bind(null, a.id, o.optionId, true)} className="inline">
              {o.optionName || o.code} <button className="text-[#2f5bd3] hover:underline">되살리기</button>{' '}
            </form>
          ))}</div>
        )}
      </Section>

      {cur && (
        <>
          <Section title={`옵션 정보 · ${cur.optionName || '기본 옵션'}`}>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <ExportSelectionCheckbox option_id={cur.optionId} selected={cur.exportSelected} archived={false} label={a.name} />
              <span>서류(CI · PL)에 포함</span>
            </div>
            <form action={edit_option.bind(null, a.id, cur.optionId)} className={ui.card}>
              <div className={ui.formGrid}>
                <Field label="옵션명" optional><input name="optionName" defaultValue={cur.optionName} className={ui.input} placeholder="예: 아크릴" /></Field>
                <Field label="관리 코드"><input name="code" required defaultValue={cur.code} className={ui.input} /></Field>
                <Field label="재질" optional><input name="material" defaultValue={cur.material} className={ui.input} /></Field>
                <Field label="용도" optional><input name="purpose" defaultValue={cur.purpose} className={ui.input} /></Field>
                <Field label="형태" optional><input name="shape" defaultValue={cur.shape} className={ui.input} /></Field>
                <Field label="규격" optional><input name="size" defaultValue={cur.size} className={ui.input} /></Field>
                <Field label="개당 가액 (내부)" optional><input name="unitPrice" type="number" min="0" step="any" defaultValue={num(cur.unitPrice)} className={ui.input} /></Field>
                <Field label="통화 (내부)" optional><input name="currency" pattern="[A-Za-z]{3}" maxLength={3} placeholder="USD" defaultValue={cur.currency ?? ''} className={ui.input} /></Field>
              </div>
              <p className={ui.hint}>가액 · 통화는 내부 서류에만 쓰고, 외부 공유와 AI에는 보내지 않아요. 재질 · 용도 · 형태를 바꾸면 확정된 HS를 다시 확인해야 해요.</p>
              <div className="mt-4 flex justify-end"><button className={ui.btnSecondary}>옵션 저장</button></div>
            </form>
          </Section>

          <Section title="서류용 정보 (CI · PL)">
            <form action={edit_shipping.bind(null, a.id, cur.optionId)} className={ui.card}>
              <div className={ui.formGrid}>
                <Field label="원산지" optional><input name="origin" defaultValue={cur.origin} className={ui.input} placeholder="예: 대한민국" /></Field>
                <Field label="개당 중량 (g)" optional><input name="unitWeightG" type="number" min="0" step="any" defaultValue={num(cur.unitWeightG)} className={ui.input} /></Field>
                <Field label="CTN 입수" optional><input name="unitsPerCtn" type="number" min="1" step="1" defaultValue={num(cur.unitsPerCtn)} className={ui.input} /></Field>
                <Field label="CTN 순중량 (kg)" optional><input name="ctnNetKg" type="number" min="0" step="any" defaultValue={num(cur.ctnNetKg)} className={ui.input} /></Field>
                <Field label="CTN 총중량 (kg)" optional><input name="ctnGrossKg" type="number" min="0" step="any" defaultValue={num(cur.ctnGrossKg)} className={ui.input} /></Field>
                <Field label="CTN 크기 (cm, 길이 · 너비 · 높이)" optional>
                  <div className="flex gap-1">
                    <input name="ctnLcm" type="number" min="0" step="any" defaultValue={num(cur.ctnLcm)} className={ui.input} aria-label="CTN 길이" />
                    <input name="ctnWcm" type="number" min="0" step="any" defaultValue={num(cur.ctnWcm)} className={ui.input} aria-label="CTN 너비" />
                    <input name="ctnHcm" type="number" min="0" step="any" defaultValue={num(cur.ctnHcm)} className={ui.input} aria-label="CTN 높이" />
                  </div>
                </Field>
              </div>
              <div className="mt-4 flex justify-end"><button className={ui.btnSecondary}>서류용 정보 저장</button></div>
            </form>
          </Section>

          <Section title="HS 코드">
            <div className={ui.note}>
              {cur.hs6 ? <>현재 <b>{format_hs_code(cur.hsk10 ?? cur.hs6)}</b> · {cur.hsConfirmedBy} · {cur.hsCheckedAt}</> : <>아직 확정한 HS가 없어요.</>}
              {' · '}{cur.state === 'needs_review' ? <span className="text-amber-700">재검토 필요</span> : <StatusText status={cur.state} />}
            </div>
            <div className="mt-3">
              <HsPickerClient
                item_id={cur.optionId} item_type="accessory" item_name={a.name} {...(a.nameEn ? { item_name_en: a.nameEn } : {})}
                attributes={{ material: cur.material, purpose: cur.purpose, shape: cur.shape }}
                {...(cur.hs6 ? { existing_classification: { hs6: cur.hs6, hsk10: cur.hsk10, hs_checked_at: cur.hsCheckedAt, hs_confirmed_by: cur.hsConfirmedBy, hs_classification_id: cur.hsClassificationId } } : {})}
                search={search_accessory_hs.bind(null, a.id)} confirm={confirm_accessory_hs.bind(null, a.id, cur.optionId)} />
            </div>
            {cur.hsClassificationId && cur.state !== 'needs_review' && (
              <form action={mark_for_review.bind(null, a.id, cur.optionId)} className="mt-3 flex gap-2">
                <input name="why" required className={ui.input} placeholder="재검토가 필요한 이유 (예: 재질이 바뀜)" />
                <button className={ui.btnSecondary}>재검토로 돌리기</button>
              </form>
            )}
            {cur.history.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead><tr>{['날짜', 'HS', '확인한 사람', '근거', '상태'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead>
                <tbody>{cur.history.map((h, i) => (
                  <tr key={i} className={ui.tr}><td className={ui.td}>{h.date}</td><td className={ui.td}>{format_hs_code(h.hsk10 ?? h.hs6)}</td>
                    <td className={ui.td}>{h.by}</td><td className={ui.td}>{h.why}</td><td className={ui.td}>{h.status === 'needs_review' ? `재검토 (${h.reason ?? ''})` : '확정'}</td></tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {active.length > 1 && (
            <Section title="옵션 보관">
              <form action={archive_change.bind(null, a.id, cur.optionId, false)} className="flex flex-wrap items-center gap-2 text-sm">
                {cur.isDefault && active.length > 2 && (
                  <select name="replacement" required className={ui.input + ' max-w-xs'} defaultValue="">
                    <option value="" disabled>새 기본 옵션 고르기</option>
                    {active.filter((o) => o.optionId !== cur.optionId).map((o) => <option key={o.optionId} value={o.optionId}>{o.optionName || o.code}</option>)}
                  </select>
                )}
                <button className={ui.btnSecondary}>이 옵션 보관</button>
                <span className="text-slate-500">보관하면 서류 포함 체크가 풀리고, 기록은 남아요.</span>
              </form>
            </Section>
          )}
        </>
      )}

      <Section title="옵션 추가">
        <form action={add_option.bind(null, a.id)} className={ui.card}>
          <div className={ui.formGrid}>
            <Field label="새 옵션명"><input name="optionName" required className={ui.input} placeholder="예: 아크릴" /></Field>
            {active.length === 1 && !active[0].optionName && <Field label="기존 옵션 이름" optional><input name="defaultName" className={ui.input} placeholder="예: 종이" /></Field>}
            <Field label="재질" optional><input name="material" className={ui.input} /></Field>
            <Field label="용도" optional><input name="purpose" className={ui.input} /></Field>
            <Field label="형태" optional><input name="shape" className={ui.input} /></Field>
            <Field label="규격" optional><input name="size" className={ui.input} /></Field>
          </div>
          <p className={ui.hint}>관리 코드는 저장할 때 만들어져요. 다른 옵션의 HS는 참고만 하고, 새 옵션은 따로 확정해요.</p>
          <div className="mt-4 flex justify-end"><button className={ui.btnSecondary}>옵션 추가</button></div>
        </form>
      </Section>
      {!cur && <p className={ui.note}><Empty /></p>}
    </main>
  );
}
