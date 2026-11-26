"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAccount } from "./account_session";

const guest_status = {
  unconfigured: "로그인 연결 준비 중",
  loading: "계정 확인 중",
  ready: "로그인 필요",
  error: "계정 확인 필요",
};

export function SidebarAccount({ href, active }: { href: string; active: boolean }) {
  const { profile, status, sign_out } = useAccount();
  const [pending, set_pending] = useState(false);
  const [failed, set_failed] = useState(false);
  const account_link = useRef<HTMLAnchorElement>(null);
  const name = profile?.name ?? "내 계정";
  const detail = profile ? profile.team || "내 계정" : guest_status[status];
  const label = profile ? `${name} · 내 계정` : `내 계정 · ${detail}`;

  async function handle_sign_out() {
    set_pending(true);
    set_failed(false);
    try {
      await sign_out();
      account_link.current?.focus();
    } catch {
      set_failed(true);
    } finally {
      set_pending(false);
    }
  }

  return (
    <div className="sidebar_account">
      <Link ref={account_link} className="account_link" href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined}>
        <span className="account_avatar" aria-hidden="true">
          {profile ? Array.from(name)[0] : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span className="account_text menu_label">
          <strong>{name}</strong>
          <span>{detail}</span>
        </span>
      </Link>
      {profile && (
        <button type="button" className="sidebar_logout" onClick={handle_sign_out} disabled={pending}
          aria-label={pending ? "로그아웃 중" : "로그아웃"} title="로그아웃">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 4H5v16h5m-1-8h12m-5-5 5 5-5 5" />
          </svg>
        </button>
      )}
      {profile && failed && <p className="logout_error" role="alert">로그아웃에 실패했어요. 다시 시도해 주세요.</p>}
    </div>
  );
}
