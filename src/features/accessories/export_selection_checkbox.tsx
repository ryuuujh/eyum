"use client";

import { useState } from "react";

type Props = { option_id: string; selected: boolean; archived: boolean; label: string };

export function ExportSelectionCheckbox({ option_id, selected, archived, label }: Props) {
  const [saved, set_saved] = useState<boolean>();
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState(false);

  async function update_selection(export_selected: boolean) {
    set_busy(true);
    set_error(false);
    try {
      const response = await fetch(`/api/accessories/${encodeURIComponent(option_id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ export_selected }),
      });
      if (!response.ok) throw new Error("selection_failed");
      set_saved(export_selected);
    } catch {
      set_error(true);
    } finally {
      set_busy(false);
    }
  }

  return <>
    <input type="checkbox" aria-label={`${label} 서류에 포함`}
      checked={!archived && (saved ?? selected)} disabled={archived || busy}
      onChange={event => void update_selection(event.target.checked)} />
    {error && <span role="alert">서류 선택을 저장하지 못했습니다.</span>}
  </>;
}
