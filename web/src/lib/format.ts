/** 한국어 숫자·수치 포맷 유틸 */

const nf = new Intl.NumberFormat("ko-KR");

export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return nf.format(Math.round(n));
}

/** 소수 자릿수 고정 */
export function dec(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 배율 표기 (예: 2.3배) */
export function mult(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${dec(n, digits)}배`;
}

/** 만 단위 축약 (예: 12,345 → 1.2만) — 큰 KPI용 */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 10000) return `${dec(n / 10000, 1)}만`;
  return nf.format(Math.round(n));
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${dec(n * 100, digits)}%`;
}

/** 연월 문자열 "2007-01" → "2007년 1월" */
export function ym(year: number, month: number): string {
  return `${year}년 ${month}월`;
}
