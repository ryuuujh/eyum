import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { Panel } from "../../components/panel";

export default function ExportDocumentsPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="export_documents" searchParams={searchParams}>
      <Panel
        title="기능 준비 중"
        description="제품과 부속물품을 선택해 상업송장(CI)과 포장명세서(PL)를 작성하는 화면을 준비하고 있습니다."
      />
    </FeatureScreen>
  );
}
