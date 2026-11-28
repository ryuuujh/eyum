export type ItemType = "food" | "accessory";
export type ItemStatus = "draft" | "active" | "archived";

export interface ConfirmedClassification {
  hs6: string;
  hsk10: string | null;
  // Manually entered legacy codes can exist without a review record.
  hs_checked_at: string | null;
  hs_confirmed_by: string | null;
  hs_classification_id: string | null;
}

export interface HsPickerInput {
  item_id: string;
  item_name: string;
  item_type: ItemType;
  item_name_en?: string;
  attributes?: Record<string, unknown>;
  description?: string;
  existing_classification?: ConfirmedClassification;
}

export interface HsCandidate {
  hs6: string;
  hsk10: string | null;
  label: string;
  official_source_url: string;
  source: "registered_item" | "dictionary" | "hsk" | "standard_name";
}

export interface HsQuestion {
  field_key: string;
  label: string;
  options?: string[];
}

export interface HsSearchResult {
  classification_id: string;
  candidates: HsCandidate[];
  questions: HsQuestion[];
  ai_rationale?: string;
}

export interface HsConfirmationInput {
  classification_id: string;
  hs6: string;
  hsk10: string | null;
  confirmed_by: string;
  human_reason: string;
}

