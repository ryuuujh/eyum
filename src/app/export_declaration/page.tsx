import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { Panel } from "../../components/panel";

export default function ExportDeclarationPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="export_declaration" searchParams={searchParams}>
      <Panel
        title="기능 준비 중"
        description="선적 정보를 UNI-PASS 수출신고서 입력 항목별로 확인하는 화면을 준비하고 있습니다."
      />
    </FeatureScreen>
  );
}
