"use client";

import { useState, type FormEvent } from "react";
import { Panel } from "../../components/panel";
import { useAccount } from "./account_session";
import styles from "./account_panel.module.css";

function LoginForm() {
  const { sign_in } = useAccount();
  const [submitting, set_submitting] = useState(false);
  const [message, set_message] = useState("");

  async function submit_login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    set_message("");
    set_submitting(true);
    try {
      await sign_in(email, password);
    } catch {
      set_message("로그인하지 못했습니다. 이메일과 비밀번호, 네트워크 연결을 확인해 주세요.");
    } finally {
      set_submitting(false);
    }
  }

  return (
    <Panel title="팀 계정 로그인">
      <form className={styles.form} onSubmit={submit_login} method="post" aria-busy={submitting}>
        <label className={styles.field}>
          이메일
          <input type="email" name="email" autoComplete="username" required readOnly={submitting} />
        </label>
        <label className={styles.field}>
          비밀번호
          <input type="password" name="password" autoComplete="current-password" required readOnly={submitting} />
        </label>
        {message && <p role="alert" className={styles.error}>{message}</p>}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </Panel>
  );
}

export function AccountPanel() {
  const { profile, status } = useAccount();

  if (status === "unconfigured") {
    return <Panel title="팀 계정 연결 준비 중" description="연결이 완료되면 팀 계정으로 로그인할 수 있습니다." />;
  }
  if (status === "loading") {
    return <Panel title="계정 정보"><p className="hint" role="status">로그인 상태를 확인하고 있습니다.</p></Panel>;
  }
  if (status === "error") {
    return (
      <Panel title="계정 정보">
        <p className="hint" role="alert">로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
        <button className={styles.button} type="button" onClick={() => window.location.reload()}>다시 시도</button>
      </Panel>
    );
  }
  if (!profile) return <LoginForm />;

  return (
    <Panel title="로그인한 계정">
      <dl className={styles.details}>
        <div><dt>이름</dt><dd>{profile.name || "미등록"}</dd></div>
        <div><dt>소속</dt><dd>{profile.team || "미등록"}</dd></div>
        <div><dt>이메일</dt><dd>{profile.email || "미등록"}</dd></div>
      </dl>
    </Panel>
  );
}
