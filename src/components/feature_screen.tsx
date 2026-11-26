import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { features, find_country } from "../lib/workspace_navigation";
import type { CountryQuery, Feature } from "../lib/workspace_navigation";
import { DashboardFrame } from "./dashboard_frame";
import { PageHeading } from "./page_heading";

export type WorkspacePageProps = {
  searchParams: Promise<CountryQuery>;
};

type FeatureScreenProps = WorkspacePageProps & {
  slug: Feature["slug"];
  children: ReactNode;
};

export async function FeatureScreen({ slug, searchParams, children }: FeatureScreenProps) {
  const feature = features.find((item) => item.slug === slug);
  if (!feature) notFound();
  const country = find_country((await searchParams).country);
  const country_description = country ? `수출 대상 국가 · ${country.name}` : "상단에서 수출국을 선택하세요.";

  return (
    <DashboardFrame country={country} active={feature}>
      <PageHeading title={feature.title} description={feature.country_scoped ? country_description : undefined} />
      {children}
    </DashboardFrame>
  );
}
