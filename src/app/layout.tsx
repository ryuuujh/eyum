import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SidebarProvider } from "../components/sidebar_toggle";
import { AccountProvider } from "../features/login_management/account_session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "E:YUM | 혜윰 수출 대시보드", template: "%s | E:YUM" },
  description: "혜윰의 제품 관리와 국가별 식품 수출 준비를 위한 업무 공간",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AccountProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
