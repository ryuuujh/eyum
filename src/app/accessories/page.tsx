import { redirect } from "next/navigation";
import type { WorkspacePageProps } from "../../components/feature_screen";
import { find_country, workspace_href } from "../../lib/workspace_navigation";

export default async function AccessoriesPage({ searchParams }: WorkspacePageProps) {
  const country = find_country((await searchParams).country);
  redirect(`${workspace_href("/products", country)}#accessories`);
}
