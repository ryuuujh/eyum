import { FeatureScreen, type WorkspacePageProps } from "../../components/feature_screen";
import { AccountPanel } from "../../features/login_management/account_panel";

export default function LoginManagementPage({ searchParams }: WorkspacePageProps) {
  return (
    <FeatureScreen slug="login_management" searchParams={searchParams}>
      <AccountPanel />
    </FeatureScreen>
  );
}
