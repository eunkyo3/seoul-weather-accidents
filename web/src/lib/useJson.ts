"use client";

import { useEffect, useState } from "react";

export type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "empty"; data: null; error: null }
  | { status: "error"; data: null; error: string };

const cache = new Map<string, unknown>();

function initial<T>(name: string): LoadState<T> {
  return cache.has(name)
    ? { status: "ready", data: cache.get(name) as T, error: null }
    : { status: "loading", data: null, error: null };
}

/**
 * `/data/<name>.json` 을 런타임에 클라이언트 fetch.
 * 빌드 시 데이터에 의존하지 않으며(next build는 public/data 비어도 성공),
 * 파일이 없으면(404) 'empty' 로 우아하게 처리한다.
 */
export function useJson<T>(name: string): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>(() => initial<T>(name));
  const [loadedFor, setLoadedFor] = useState(name);

  // name 이 바뀌면 렌더 중 상태 조정 (React 권장 패턴 — effect 내 setState 회피)
  if (name !== loadedFor) {
    setLoadedFor(name);
    setState(initial<T>(name));
  }

  useEffect(() => {
    if (cache.has(name)) return; // 캐시 히트는 initial()이 처리
    let cancelled = false;

    fetch(`/data/${name}.json`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: "empty", data: null, error: null });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", data: null, error: `HTTP ${res.status}` });
          return;
        }
        const text = await res.text();
        if (!text.trim()) {
          setState({ status: "empty", data: null, error: null });
          return;
        }
        let json: T;
        try {
          json = JSON.parse(text) as T;
        } catch {
          setState({ status: "error", data: null, error: "JSON 파싱 실패" });
          return;
        }
        cache.set(name, json);
        setState({ status: "ready", data: json, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: err instanceof Error ? err.message : "네트워크 오류",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [name]);

  return state;
}
