import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarAccount } from "../features/login_management/sidebar_account";
import { features, workspace_href } from "../lib/workspace_navigation";
import type { Country, Feature } from "../lib/workspace_navigation";
import { CountrySelect } from "./country_select";
import { SidebarToggle } from "./sidebar_toggle";

const common_pages = features.filter((feature) => !feature.country_scoped && feature.slug !== "login_management");
const country_tasks = features.filter((feature) => feature.country_scoped);
const brand_name = "E:YUM";
const brand_byline = "by Hyeum";
const dashboard_name = `${brand_name} ${brand_byline}`;

type FrameProps = {
  country?: Country;
  active?: Feature;
  children: ReactNode;
};

export function DashboardFrame({ country, active, children }: FrameProps) {
  return (
    <div className="app_shell">
      <a href="#main_content" className="skip_link">본문 바로가기</a>
      <aside className="sidebar" aria-label="사이드바">
        <div className="sidebar_header">
          <Link className="wordmark" href={workspace_href("/", country)} aria-label={`${dashboard_name} 홈`}>
            <svg className="brand_mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="10" fill="currentColor" />
              <path d="M8 9h4v6h8v4h-8v5H8z M20 16h4v8h-4z" fill="white" />
              <path d="M16 13c0-5 3.4-7 8.5-7-.5 4.7-3.3 7.5-8.5 7Z" fill="#b9efd7" />
            </svg>
            <span className="wordmark_text">
              {brand_name}
              <span className="wordmark_byline">{brand_byline}</span>
            </span>
          </Link>
          <SidebarToggle />
        </div>
        <nav id="sidebar_menu" aria-label="업무 메뉴">
          <Link href={workspace_href("/", country)} aria-label="홈" title="홈" aria-current={active ? undefined : "page"}>
            <svg className="menu_icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5V21h-6v-8H9v8H3z" />
            </svg>
            <span className="menu_label">홈</span>
          </Link>
          <hr className="menu_divider" />
          <h2 className="menu_heading" id="country_menu_heading">
            {country ? `수출국 · ${country.name}` : "국가별 수출 업무"}
          </h2>
          <ol className="country_menu" aria-labelledby="country_menu_heading">
            {country_tasks.map((feature, index) => (
              <li key={feature.slug}>
                <Link
                  href={workspace_href(`/${feature.slug}`, country)}
                  aria-label={feature.title}
                  title={feature.title}
                  aria-current={active?.slug === feature.slug ? "page" : undefined}
                >
                  <span className="task_number" aria-hidden="true">{index + 1}</span>
                  <span className="menu_label">{feature.slug === "export_documents" ? "CI / PL" : feature.title}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="sidebar_footer">
            {common_pages.map((page) => (
              <Link
                key={page.slug}
                href={workspace_href(`/${page.slug}`, country)}
                aria-label={page.title}
                title={page.title}
                aria-current={active?.slug === page.slug ? "page" : undefined}
              >
                <svg className="menu_icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 7 9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10" />
                </svg>
                <span className="menu_label">{page.title}</span>
              </Link>
            ))}
            <hr className="menu_divider" />
            <SidebarAccount href={workspace_href("/login_management", country)} active={active?.slug === "login_management"} />
          </div>
        </nav>
      </aside>
      <header className="top_bar">
        <span className="dashboard_name">
          {dashboard_name}
          <span className="breadcrumb_chevron" aria-hidden="true" />
          <strong>{active?.title ?? "홈"}</strong>
        </span>
        <CountrySelect country_code={country?.code} />
      </header>
      <main id="main_content" className="main_content">{children}</main>
    </div>
  );
}
