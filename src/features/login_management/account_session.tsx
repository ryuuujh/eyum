"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AccountProfile = { name: string; team: string; email: string };
type AccountState = {
  profile: AccountProfile | null;
  status: "unconfigured" | "loading" | "ready" | "error";
};
type AccountContext = AccountState & {
  sign_in: (email: string, password: string) => Promise<void>;
  sign_out: () => Promise<void>;
};

const account_context = createContext<AccountContext | null>(null);
const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishable_key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const configured = Boolean(supabase_url && publishable_key);
let browser_client: SupabaseClient | undefined;

function get_client() {
  if (!supabase_url || !publishable_key) throw new Error("로그인 연결 설정이 필요합니다.");
  browser_client ??= createClient(supabase_url, publishable_key);
  return browser_client;
}

function profile_text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function account_profile(user: User): AccountProfile {
  const metadata = user.user_metadata ?? {};
  const email = user.email ?? "";
  const name = profile_text(metadata.display_name) || profile_text(metadata.full_name) ||
    profile_text(metadata.name) || email || "사용자";
  const team = profile_text(metadata.team) || profile_text(metadata.department);
  return { name, team, email };
}

async function sign_in(email: string, password: string) {
  const { error } = await get_client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

async function sign_out() {
  const { error } = await get_client().auth.signOut({ scope: "local" });
  if (error) throw error;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, set_account] = useState<AccountState>({
    profile: null,
    status: configured ? "loading" : "unconfigured",
  });

  useEffect(() => {
    if (!configured) return;
    let revision = 0;
    let verified_user_id: string | undefined;
    let active = true;

    async function verify_user(access_token: string, request_revision: number) {
      try {
        const { data, error } = await get_client().auth.getUser(access_token);
        if (!active || request_revision !== revision) return;
        if (error?.status === 401 || error?.status === 403) {
          verified_user_id = undefined;
          set_account({ profile: null, status: "ready" });
          return;
        }
        if (error || !data.user) throw new Error("사용자 정보를 확인할 수 없습니다.");
        verified_user_id = data.user.id;
        set_account({ profile: account_profile(data.user), status: "ready" });
      } catch {
        if (!active || request_revision !== revision) return;
        verified_user_id = undefined;
        set_account({ profile: null, status: "error" });
      }
    }

    try {
      const { data } = get_client().auth.onAuthStateChange((event, session) => {
        if (!active) return;
        const request_revision = ++revision;
        if (event === "SIGNED_OUT" || !session) {
          verified_user_id = undefined;
          set_account({ profile: null, status: "ready" });
          return;
        }
        if (verified_user_id !== session.user.id) {
          set_account({ profile: null, status: "loading" });
        }
        // Auth notifies subscribers under a lock. Start verification after the callback returns.
        queueMicrotask(() => void verify_user(session.access_token, request_revision));
      });
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch {
      // Invalid connection settings must still allow the public dashboard to render.
      queueMicrotask(() => { if (active) set_account({ profile: null, status: "error" }); });
      return () => { active = false; };
    }
  }, []);

  return (
    <account_context.Provider value={{ ...account, sign_in, sign_out }}>
      {children}
    </account_context.Provider>
  );
}

export function useAccount() {
  const account = useContext(account_context);
  if (!account) throw new Error("useAccount requires AccountProvider");
  return account;
}
