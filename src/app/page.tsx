import Link from "next/link";
import { DashboardFrame } from "../components/dashboard_frame";
import { Panel } from "../components/panel";
import { features, find_country, workspace_href } from "../lib/workspace_navigation";
import type { CountryQuery } from "../lib/workspace_navigation";
import styles from "./home.module.css";

const task_features = features.filter((feature) => feature.country_scoped);

const icon_paths = {
  regulations: "M12 3 4.5 6v5.4c0 4.4 3.1 7.7 7.5 9.6 4.4-1.9 7.5-5.2 7.5-9.6V6L12 3Z M8.8 11.7l2.1 2.1 4.5-4.5",
  labels: "M3.5 4h8.2l8.5 8.5a1.8 1.8 0 0 1 0 2.5l-5.5 5.5a1.8 1.8 0 0 1-2.5 0l-8.7-8.7V4Z M7.8 8h.1",
  export_documents: "M8 3h7l4 4v12H8z M15 3v5h4 M5 7H4v15h11v-1 M11 12h5 M11 15h4",
  export_declaration: "M4 20h16 M5 16h4l2.5-4.2 3.7 1.6 5.3-8.2-8.2 5.4 1.1 1.1 M5 9h3 M3 12h3",
  certificates: "M2.5 6h10 M7.5 3v3 M4.5 8.5a13 13 0 0 0 6 6 M10.5 6c-.7 4.1-3.5 7.8-7 10 M13 20l4-10 4 10 M14.5 16.5h5",
  products: "m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z M3.5 7.5 12 12l8.5-4.5 M12 12v9 M7.8 5.3l8.5 4.5",
  accessories: "m12 3 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5",
};

function ShortcutIcon({ name }: { name: keyof typeof icon_paths }) {
  return (
    <span className={styles.icon_tile} data-icon={name} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
        <path d={icon_paths[name]} />
      </svg>
    </span>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<CountryQuery>;
}) {
  const country = find_country((await searchParams).country);
  const products_href = workspace_href("/products", country);
  return (
    <DashboardFrame country={country}>
      <header className={styles.hero}>
        <h1>수출 대시보드</h1>
        <p>혜윰의 제품과 국가별 수출 준비 업무를 확인하세요.</p>
        <a className={styles.hero_action} href={country ? "#country_tasks" : "#export_country"}>
          {country ? "수출 업무 보기" : "수출국 선택"}
          <span className={styles.arrow} aria-hidden="true">→</span>
        </a>
      </header>
      <div className={styles.panel_grid}>
        <Panel id="country_tasks" title={country ? `${country.name} 수출 업무` : "국가별 수출 업무"}>
          <ul className={styles.task_grid}>
            {task_features.map((feature) => (
              <li key={feature.slug}>
                <Link className={styles.task_link} href={workspace_href(`/${feature.slug}`, country)}>
                  <ShortcutIcon name={feature.slug} />
                  {feature.title}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="제품·부속물품">
          <ul className={styles.product_links}>
            <li>
              <Link href={products_href}>
                <ShortcutIcon name="products" />
                제품 관리
                <span className={styles.chevron} aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link href={`${products_href}#accessories`}>
                <ShortcutIcon name="accessories" />
                부속물품 HS코드
                <span className={styles.chevron} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </DashboardFrame>
  );
}
