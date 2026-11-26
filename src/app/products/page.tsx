import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { Panel } from "../../components/panel";
import { AccessoryHsLookup } from "./accessory_hs_lookup";

export default function ProductsPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="products" searchParams={searchParams}>
      <Panel
        id="products"
        title="내 제품"
        description="여기에 등록하는 제품 정보는 모든 수출국에서 함께 사용합니다. 제품 등록 기능을 준비하고 있습니다."
      />
      <AccessoryHsLookup />
    </FeatureScreen>
  );
}
