'use client';
// HsCodePicker를 서버 동작과 이어 주는 얇은 덮개 (Claude). 확정되면 화면을 다시 읽는다.
import { useRouter } from 'next/navigation';
import HsCodePicker from '@/components/hs/hs_code_picker';
import type { ConfirmedClassification, HsConfirmationInput, HsPickerInput, HsSearchResult } from '@/lib/hs/contracts';

type Props = HsPickerInput & {
  search: (item: HsPickerInput, answers: Record<string, string>) => Promise<HsSearchResult>;
  confirm: (selection: HsConfirmationInput) => Promise<ConfirmedClassification>;
};

export function HsPickerClient(props: Props) {
  const router = useRouter();
  return <HsCodePicker {...props} onConfirmed={() => router.refresh()} />;
}
