import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { Panel } from "../../components/panel";

export default function LabelsPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="labels" searchParams={searchParams}>
      <Panel
        title="기능 준비 중"
        description="선택한 국가의 언어로 제품 라벨 초안을 작성하고 검토하는 화면을 준비하고 있습니다."
      />
    </FeatureScreen>
  );
}
