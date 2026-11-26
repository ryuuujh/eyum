"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

const sidebar_context = createContext<[boolean | null, Dispatch<SetStateAction<boolean | null>>] | null>(null);
const narrow_query = "(max-width: 800px)";

function subscribe_to_width(on_change: () => void) {
  const media = window.matchMedia(narrow_query);
  media.addEventListener("change", on_change);
  return () => media.removeEventListener("change", on_change);
}

function is_desktop() {
  return !window.matchMedia(narrow_query).matches;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const state = useState<boolean | null>(null);
  return <sidebar_context.Provider value={state}>{children}</sidebar_context.Provider>;
}

export function SidebarToggle() {
  const state = useContext(sidebar_context);
  const wide = useSyncExternalStore(subscribe_to_width, is_desktop, () => true);
  if (!state) throw new Error("SidebarToggle requires SidebarProvider");
  const [preference, set_preference] = state;
  const expanded = preference ?? wide;
  const label = expanded ? "사이드바 접기" : "사이드바 펼치기";

  return (
    <button
      type="button"
      className="sidebar_toggle"
      aria-expanded={expanded}
      data-auto={preference === null ? "" : undefined}
      aria-controls="sidebar_menu"
      aria-label={label}
      title={label}
      onClick={() => set_preference(!expanded)}
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" focusable="false"
      >
        <path d="M8 4 4 8l4 4M13 4 9 8l4 4" />
      </svg>
    </button>
  );
}
