'use client';
// "수출할 제품" 체크 (Claude): 체크한 제품만 서류 탭 등에서 고를 수 있어요 (GET /api/products?selected=1)
import { useState, useTransition } from 'react';
import { toggle_export_selected } from '@/features/products/save';

export function ExportToggle({ code, selected, label = false }: { code: string; selected: boolean; label?: boolean }) {
  const [on, set_on] = useState(selected);
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm" title="체크하면 서류 탭 등 다른 탭에서 이 제품을 고를 수 있어요">
      <input
        type="checkbox" checked={on} disabled={pending}
        onChange={(e) => { const v = e.target.checked; set_on(v); start(() => toggle_export_selected(code, v)); }}
      />
      {label && <span>수출할 제품</span>}
    </label>
  );
}
