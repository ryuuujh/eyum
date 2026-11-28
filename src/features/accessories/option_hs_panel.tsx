"use client";

import HsCodePicker from "@/components/hs/hs_code_picker";
import { Section } from "@/components/ui";
import type {
  ConfirmedClassification, HsConfirmationInput, HsPickerInput, HsSearchResult,
} from "@/lib/hs/contracts";

type OptionHsPanelProps = {
  option_id: string;
  item_name: string;
  item_name_en?: string;
  description?: string;
  attributes?: Record<string, unknown>;
  existing_classification?: ConfirmedClassification;
  search: (item: HsPickerInput, answers: Record<string, string>) => Promise<HsSearchResult>;
  confirm: (selection: HsConfirmationInput) => Promise<ConfirmedClassification>;
  on_confirmed: (value: ConfirmedClassification) => void;
};

export function OptionHsPanel({ option_id, on_confirmed, ...props }: OptionHsPanelProps) {
  return (
    <Section title="품목분류">
      <HsCodePicker
        {...props}
        item_id={option_id}
        item_type="accessory"
        onConfirmed={on_confirmed}
      />
    </Section>
  );
}
