"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ThemeMode } from "./palette";

/**
 * 테마 모드는 <html>의 .dark 클래스를 단일 진실 원천으로 사용하고
 * useSyncExternalStore 로 구독한다(effect 내 setState 없이 하이드레이션 안전).
 * 인라인 스크립트(layout)가 페인트 전에 클래스를 세팅하므로 플래시 없음.
 */

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): ThemeMode {
  return "dark"; // 다크가 기본
}

export function setTheme(next: ThemeMode): void {
  const d = document.documentElement;
  if (next === "dark") d.classList.add("dark");
  else d.classList.remove("dark");
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* localStorage 불가 환경 무시 */
  }
  listeners.forEach((l) => l());
}

/** 컨텍스트 불필요 — 모듈 스토어를 직접 구독. Provider는 하위호환 passthrough. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTheme(): { mode: ThemeMode; toggle: () => void; mounted: boolean } {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, []);
  return { mode, toggle, mounted: true };
}
