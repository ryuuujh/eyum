import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { Panel } from "../../components/panel";

export default function CertificatesPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="certificates" searchParams={searchParams}>
      <Panel
        title="기능 준비 중"
        description="제품에 첨부된 시험성적서(CoA)와 추가로 받은 성적서를 번역하는 화면을 준비하고 있습니다."
      />
    </FeatureScreen>
  );
}
