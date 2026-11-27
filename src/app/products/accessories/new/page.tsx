// 새 부속물품 등록 (Claude, 11/27)
import { Field, PageHeader, ui } from '@/components/ui';
import { create_accessory } from '@/features/accessories/actions';

export default function NewAccessoryPage() {
  return (
    <main className={ui.page}>
      <PageHeader back={{ href: '/products#accessories', label: '제품 목록' }} title="새 부속물품" sub="카탈로그 · 포장상자 · 굿즈처럼 제품과 함께 나가는 물품" />
      <form action={create_accessory} className={`mt-6 ${ui.card}`}>
        <div className={ui.formGrid}>
          <Field label="물품명"><input name="name" required className={ui.input} placeholder="예: 제품 카탈로그" /></Field>
          <Field label="영문명" optional><input name="nameEn" className={ui.input} placeholder="예: Product catalog" /></Field>
          <Field label="설명" optional><input name="description" className={ui.input} /></Field>
          <Field label="재질" optional><input name="material" className={ui.input} placeholder="예: 종이" /></Field>
          <Field label="용도" optional><input name="purpose" className={ui.input} placeholder="예: 상품 광고" /></Field>
          <Field label="형태" optional><input name="shape" className={ui.input} placeholder="예: 인쇄 책자" /></Field>
          <Field label="규격" optional><input name="size" className={ui.input} placeholder="예: A4 20쪽" /></Field>
        </div>
        <p className={ui.hint}>재질 · 용도 · 형태를 적으면 HS 후보를 더 좁힐 수 있어요. 단가 · 공급처 같은 정보는 여기 적지 마세요.</p>
        <div className="mt-6 flex justify-end"><button className={ui.btnPrimary}>등록</button></div>
      </form>
    </main>
  );
}
