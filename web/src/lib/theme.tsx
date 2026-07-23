"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ThemeMode } from "./palette";

interface ThemeCtx {
  mode: ThemeMode;
  toggle: () => void;
  /** 하이드레이션 완료 여부 — 차트가 실제 테마로 렌더되도록 게이팅 */
  mounted: boolean;
}

const Ctx = createContext<ThemeCtx>({ mode: "dark", toggle: () => {}, mounted: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 인라인 스크립트가 이미 class를 설정했음 — 실제 상태를 읽어 동기화
    const isDark = document.documentElement.classList.contains("dark");
    setMode(isDark ? "dark" : "light");
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      const d = document.documentElement;
      if (next === "dark") d.classList.add("dark");
      else d.classList.remove("dark");
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* localStorage 불가 환경 무시 */
      }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ mode, toggle, mounted }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
