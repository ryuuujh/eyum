import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { Panel } from "../../components/panel";

export default function RegulationsPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="regulations" searchParams={searchParams}>
      <Panel
        title="기능 준비 중"
        description="선택한 국가의 제품별 식품 규제와 필수 서류 체크리스트를 확인하는 화면을 준비하고 있습니다."
      />
    </FeatureScreen>
  );
}
