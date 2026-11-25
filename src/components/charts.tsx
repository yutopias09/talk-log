import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { vibrate } from "../lib/feedback";

export function useElementWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export /**
 * グラフを指でなぞったときの読み取り。
 * - 横になぞると値を追いかけ、縦のスクロールはそのまま使える（touch-action: pan-y）
 * - 押した瞬間から表示し、指を離しても少しのあいだ数字を残す
 * - 値が切り替わるたびに軽く振動（対応端末のみ）
 */
function useScrub(count: number, indexAt: (px: number) => number) {
  const [hover, setHover] = useState<number | null>(null);
  const downRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number | null>(null);

  const update = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (count === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = Math.min(count - 1, Math.max(0, indexAt((e.clientX - rect.left) / rect.width)));
    if (idx !== lastRef.current) {
      if (lastRef.current !== null && e.pointerType !== "mouse") vibrate(4);
      lastRef.current = idx;
      setHover(idx);
    }
  };
  const clearLater = (ms: number) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      lastRef.current = null;
      setHover(null);
    }, ms);
  };
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handlers = {
    style: { touchAction: "pan-y" as const, cursor: "crosshair" },
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
      downRef.current = true;
      window.clearTimeout(timerRef.current);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      update(e);
    },
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "mouse" || downRef.current) update(e);
    },
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => {
      downRef.current = false;
      if (e.pointerType !== "mouse") clearLater(2600);
    },
    onPointerCancel: () => {
      downRef.current = false;
      clearLater(2600);
    },
    onPointerLeave: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "mouse") clearLater(0);
    },
  };
  return { hover, handlers };
}

/** なぞった位置の数字を大きく見せる吹き出し（グラフの上に、はみ出さないように出す） */
function ScrubReadout({
  xPct,
  title,
  value,
  unit,
  rows,
  note,
}: {
  xPct: number;
  title: ReactNode;
  value: string;
  unit?: string;
  rows?: { label: string; value: string; color?: string }[];
  note?: ReactNode;
}) {
  // 端に寄ったときは吹き出しの向きを変えて、画面からはみ出さないようにする
  const align = xPct < 22 ? "start" : xPct > 78 ? "end" : "center";
  const tx = align === "start" ? "-12%" : align === "end" ? "-88%" : "-50%";
  // ふだんはグラフの上に出し、上が画面の外にはみ出すときはグラフの中に出す
  const boxRef = useRef<HTMLDivElement>(null);
  const [inside, setInside] = useState(false);
  useLayoutEffect(() => {
    const el = boxRef.current;
    const wrap = el?.parentElement;
    if (!el || !wrap) return;
    const need = el.offsetHeight + 12;
    const next = wrap.getBoundingClientRect().top < need;
    setInside((v) => (v === next ? v : next));
  });
  return (
    <div
      ref={boxRef}
      className="chart-readout"
      style={{ left: `${xPct}%`, transform: `translate(${tx}, ${inside ? "0.25rem" : "calc(-100% - 0.5rem)"})` }}
    >
      <div className="chart-readout-title">{title}</div>
      <div className="chart-readout-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      {rows && rows.length > 0 && (
        <div className="chart-readout-rows">
          {rows.map((r, i) => (
            <span key={i}>
              {r.color && <i style={{ background: r.color }} />}
              {r.label} <b>{r.value}</b>
            </span>
          ))}
        </div>
      )}
      {note && <div className="chart-readout-note">{note}</div>}
    </div>
  );
}

interface TrendPoint {
  label: string;
  value: number;
  detail?: string;
  /** なぞったときに出す、くわしい日付など */
  title?: string;
  /** なぞったときに出す内訳（ふたりそれぞれの件数など） */
  rows?: { label: string; value: string; color?: string }[];
}

interface AreaTrendProps {
  data: TrendPoint[];
  color?: string;
  height?: number;
  avg?: number;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
  emptyText?: string;
  /** 吹き出しの数字の単位 */
  unit?: string;
}

export function AreaTrend({
  data,
  color = "var(--a)",
  height = 220,
  avg,
  formatValue = (v) => v.toLocaleString("ja-JP"),
  ariaLabel,
  emptyText = "表示できるデータがありません",
  unit = "件",
}: AreaTrendProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");

  const pad = { top: 16, right: 12, bottom: 26, left: 44 };
  const w = Math.max(width, 280);
  const innerW = Math.max(10, w - pad.left - pad.right);
  const innerH = Math.max(10, height - pad.top - pad.bottom);

  const { max, min, points, ticks } = useMemo(() => {
    const values = data.map((d) => d.value);
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, 0);
    const span = Math.max(1, rawMax - rawMin);
    const top = Math.ceil(rawMax + span * 0.12);
    const bottom = Math.max(0, Math.floor(rawMin - span * 0.12));
    const y = (v: number) => pad.top + innerH - ((v - bottom) / Math.max(1, top - bottom)) * innerH;
    const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
    const tickVals = [bottom, Math.round((bottom + top) / 2), top];
    return {
      max: top,
      min: bottom,
      points: pts,
      ticks: tickVals.map((v) => ({ v, y: y(v) })),
    };
  }, [data, innerW, innerH, pad.top, pad.left]);

  const { hover, handlers } = useScrub(data.length, (ratio) => {
    const t = (ratio * w - pad.left) / innerW;
    return Math.round(t * (data.length - 1));
  });

  if (data.length === 0) {
    return <div className="chart-empty">{emptyText}</div>;
  }

  const line = smoothPath(points);
  const area = `${line} L${points[points.length - 1][0]},${pad.top + innerH} L${points[0][0]},${pad.top + innerH} Z`;
  const avgY =
    avg !== undefined && max > min
      ? pad.top + innerH - ((avg - min) / Math.max(1, max - min)) * innerH
      : null;
  const active = hover !== null ? data[hover] : null;
  const activePt = hover !== null ? points[hover] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={
          ariaLabel ||
          `${data[0].label}から${data[data.length - 1].label}までの推移。最大${formatValue(
            Math.max(...data.map((d) => d.value)),
          )}`
        }
        {...handlers}
      >
        <defs>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
            <text x={pad.left - 8} y={t.y + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)">
              {formatValue(t.v)}
            </text>
          </g>
        ))}

        {avgY !== null && (
          <line
            x1={pad.left}
            x2={w - pad.right}
            y1={avgY}
            y2={avgY}
            stroke="var(--muted)"
            strokeDasharray="2 4"
            strokeOpacity="0.7"
          />
        )}

        <path d={area} fill={`url(#fill-${uid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />

        {data.length > 1 &&
          [0, Math.floor((data.length - 1) / 2), data.length - 1]
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .map((i) => (
              <text
                key={i}
                x={points[i][0]}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize="10"
                fill="var(--faint)"
              >
                {data[i].label}
              </text>
            ))}

        {activePt && (
          <>
            <line
              x1={activePt[0]}
              x2={activePt[0]}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke={color}
              strokeOpacity="0.55"
              strokeWidth="1.5"
            />
            <circle cx={activePt[0]} cy={activePt[1]} r="11" fill={color} opacity="0.18" />
            <circle cx={activePt[0]} cy={activePt[1]} r="6" fill={color} stroke="var(--surface)" strokeWidth="2.5" />
          </>
        )}
      </svg>

      {active && activePt && hover !== null && (
        <ScrubReadout
          xPct={(activePt[0] / w) * 100}
          title={active.title || active.label}
          value={formatValue(active.value)}
          unit={unit}
          rows={active.rows}
          note={
            <>
              {active.detail && <span>{active.detail}</span>}
              {avg !== undefined && avg > 0 && (
                <span>
                  平均の{(active.value / avg).toFixed(1)}倍
                </span>
              )}
            </>
          }
        />
      )}
    </div>
  );
}

interface BarsProps {
  values: number[];
  labels: string[];
  height?: number;
  colorFor?: (i: number) => string;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
  highlight?: number;
  unit?: string;
  /** なぞったときの見出し（ラベルより詳しく出したいとき） */
  titles?: string[];
}

export function BarSeries({
  values,
  labels,
  height = 200,
  colorFor,
  formatValue = (v) => v.toLocaleString("ja-JP"),
  ariaLabel,
  highlight,
  unit = "件",
  titles,
}: BarsProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const w = Math.max(width, 280);
  const pad = { top: 14, right: 6, bottom: 24, left: 6 };
  const innerW = Math.max(10, w - pad.left - pad.right);
  const innerH = Math.max(10, height - pad.top - pad.bottom);
  const max = Math.max(...values, 1);
  const step = innerW / Math.max(1, values.length);
  const barW = Math.max(3, Math.min(26, step * 0.62));
  const showEvery = values.length > 16 ? 3 : values.length > 10 ? 2 : 1;
  const { hover, handlers } = useScrub(values.length, (ratio) => Math.floor((ratio * w - pad.left) / step));
  const total = values.reduce((sum, v) => sum + v, 0);

  const active = hover !== null ? hover : highlight ?? null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={ariaLabel || `棒グラフ。最大値 ${formatValue(max)}`}
        {...handlers}
      >
        <line
          x1={pad.left}
          x2={w - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          stroke="var(--border)"
        />
        {values.map((v, i) => {
          const h = Math.max(v > 0 ? 3 : 0, (v / max) * innerH);
          const x = pad.left + i * step + (step - barW) / 2;
          const y = pad.top + innerH - h;
          const isActive = active === i;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={Math.min(6, barW / 2)}
                fill={colorFor ? colorFor(i) : "var(--a)"}
                opacity={isActive ? 1 : 0.72}
              />
              {i % showEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - 7}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--faint)"
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <ScrubReadout
          xPct={((pad.left + hover * step + step / 2) / w) * 100}
          title={titles?.[hover] ?? labels[hover]}
          value={formatValue(values[hover])}
          unit={unit}
          note={total > 0 ? <span>全体の{Math.round((values[hover] / total) * 100)}%</span> : undefined}
        />
      )}
    </div>
  );
}

interface HeatmapProps {
  matrix: number[][];
  rowLabels: string[];
  colLabels: string[];
  color?: string;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
}

export function Heatmap({
  matrix,
  rowLabels,
  colLabels,
  color = "var(--a)",
  formatValue = (v) => `${v}件`,
  ariaLabel,
}: HeatmapProps) {
  const [hover, setHover] = useState<{ r: number; c: number; x: number; y: number } | null>(null);
  const max = Math.max(1, ...matrix.flat());
  return (
    <div style={{ position: "relative" }}>
      <div className="scroll-x">
        <div
          className="heatmap"
          style={{ gridTemplateColumns: `26px repeat(${colLabels.length}, minmax(14px, 1fr))`, minWidth: 420 }}
          role="img"
          aria-label={ariaLabel || "時間帯と曜日ごとのメッセージ量ヒートマップ"}
        >
          <div />
          {colLabels.map((c, i) => (
            <div key={i} style={{ textAlign: "center", color: "var(--faint)", fontSize: 9 }}>
              {i % 3 === 0 ? c : ""}
            </div>
          ))}
          {matrix.map((row, r) => (
            <Row key={r}>
              <div style={{ display: "flex", alignItems: "center", color: "var(--muted)", fontSize: 10 }}>
                {rowLabels[r]}
              </div>
              {row.map((v, c) => {
                const ratio = v / max;
                return (
                  <div
                    key={c}
                    className="heatmap-cell"
                    style={{
                      background:
                        v === 0
                          ? "var(--surface-2)"
                          : `color-mix(in srgb, ${color} ${Math.round(14 + ratio * 80)}%, var(--surface))`,
                      outline: hover?.r === r && hover?.c === c ? "1.5px solid var(--text)" : "none",
                    }}
                    onPointerEnter={(e) => {
                      const host = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                      const box = e.currentTarget.getBoundingClientRect();
                      setHover({
                        r,
                        c,
                        x: box.left - host.left + box.width / 2,
                        y: box.top - host.top,
                      });
                    }}
                    onPointerLeave={() => setHover(null)}
                    title={`${rowLabels[r]}曜 ${colLabels[c]} ${formatValue(v)}`}
                  />
                );
              })}
            </Row>
          ))}
        </div>
      </div>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div style={{ opacity: 0.75, fontSize: 10.5 }}>
            {rowLabels[hover.r]}曜 {colLabels[hover.c]}
          </div>
          <strong>{formatValue(matrix[hover.r][hover.c])}</strong>
        </div>
      )}
      <div className="heatmap-legend">
        <span>少</span>
        {[0.12, 0.32, 0.52, 0.72, 0.92].map((o) => (
          <i key={o} style={{ background: `color-mix(in srgb, ${color} ${o * 100}%, var(--surface))` }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

interface DonutProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function Donut({ segments, size = 148, thickness = 18, centerLabel, centerValue }: DonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="内訳のドーナツグラフ">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = total === 0 ? 0 : s.value / total;
          const dash = frac * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, dash - 2)} ${c}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              opacity={s.value === 0 ? 0 : 1}
            >
              <title>{`${s.label} ${s.value.toLocaleString("ja-JP")}`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="donut-center">
        <div>
          <strong>{centerValue ?? total.toLocaleString("ja-JP")}</strong>
          <span>{centerLabel ?? "合計"}</span>
        </div>
      </div>
    </div>
  );
}

export function MiniBars({ values, color = "var(--a)", maxBars = 14 }: { values: number[]; color?: string; maxBars?: number }) {
  const first = values.findIndex((v) => v > 0);
  const last = values.length - 1 - [...values].reverse().findIndex((v) => v > 0);
  const active = first < 0 ? values.slice(0, 4) : values.slice(Math.max(0, last - maxBars + 1), last + 1);
  const shown = active.length ? active : values.slice(0, 4);
  const max = Math.max(...shown, 1);
  return (
    <div className="day-spark" aria-hidden="true">
      {shown.map((v, i) => (
        <i
          key={i}
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: color,
            opacity: 0.35 + (v / max) * 0.65,
          }}
        />
      ))}
    </div>
  );
}
