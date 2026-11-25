import { useMemo } from "react";
import { BarSeries, Heatmap } from "../components/charts";
import { Card, CardHead, Kpi, StatRow } from "../components/ui";
import {
  HOUR_SEGMENTS,
  hourSegmentTotals,
  lifestyle,
  WEEKDAY_LABELS,
  weekdayHourMatrix,
} from "../lib/analytics";
import { fmtInt, fmtPct } from "../lib/format";
import type { ViewProps } from "./types";

export function HourlyView({ chat, stats }: ViewProps) {
  const { hourly, peakHour, topWeekday, messagesInRange } = stats;
  const segments = useMemo(() => hourSegmentTotals(hourly), [hourly]);
  const matrix = useMemo(() => weekdayHourMatrix(messagesInRange), [messagesInRange]);
  const life = useMemo(() => lifestyle(messagesInRange, chat.names), [messagesInRange, chat.names]);
  const total = hourly.reduce((s, v) => s + v, 0);

  const colorForHour = (h: number) => {
    const seg = HOUR_SEGMENTS.find((s) => (s.hours as readonly number[]).includes(h));
    return seg ? seg.color : "var(--a)";
  };

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Kpi
          label="いちばん話す時間"
          icon="clock"
          value={`${peakHour.hour}時`}
          accent="var(--b)"
          foot={<span>{peakHour.hour}時台・{fmtInt(peakHour.total)}件</span>}
        />
        <Kpi
          label="いちばん話す曜日"
          icon="calendar"
          value={`${WEEKDAY_LABELS[topWeekday.index]}曜`}
          foot={<span>{fmtInt(topWeekday.total)}件</span>}
        />
        <Kpi
          label="深夜（0–5時）"
          icon="moon"
          value={fmtPct(segments[0].count, total)}
          foot={<span>{fmtInt(segments[0].count)} 件</span>}
        />
        <Kpi
          label="やりとりした日"
          icon="message"
          value={fmtInt(stats.sliced.length)}
          unit="日"
          foot={<span>1日平均 {fmtInt(total / Math.max(1, stats.sliced.length))} 件</span>}
        />
      </div>

      <Card>
        <CardHead title="時間帯別メッセージ数" sub="0時から23時まで" icon="clock" />
        <BarSeries
          values={hourly}
          labels={Array.from({ length: 24 }, (_, i) => `${i}時`)}
          titles={Array.from({ length: 24 }, (_, i) => `${i}時台`)}
          height={230}
          colorFor={colorForHour}
          ariaLabel="時間帯別メッセージ数"
        />
        <div className="chart-legend">
          {HOUR_SEGMENTS.map((s) => (
            <span className="legend-item" key={s.key}>
              <i className="legend-swatch" style={{ background: s.color }} />
              {s.label}（{s.range}）
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-main">
        <Card>
          <CardHead title="時間帯の内訳" sub="4つの時間帯で見る生活リズム" icon="pie" />
          <div className="stack" style={{ gap: 12 }}>
            {segments.map((s) => (
              <div key={s.key}>
                <div className="spread" style={{ fontSize: 13, marginBottom: 5 }}>
                  <span className="row" style={{ gap: 7 }}>
                    <i className="legend-swatch" style={{ background: s.color }} />
                    <strong>{s.label}</strong>
                    <span className="faint small">{s.range}</span>
                  </span>
                  <span className="tnum" style={{ fontWeight: 700 }}>
                    {s.pct}% <span className="faint small">{fmtInt(s.count)}件</span>
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="生活タイプ診断" sub="時間帯と曜日の傾向から" icon="sparkles" />
          <div className="stack" style={{ gap: 12 }}>
            {(
              [
                ["a", chat.names.a, life.a],
                ["b", chat.names.b, life.b],
              ] as const
            ).map(([who, name, info]) => (
              <div
                key={who}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                }}
              >
                <div className="spread">
                  <span className="row" style={{ gap: 7 }}>
                    <span className={`person-dot ${who}`}>{Array.from(name)[0]}</span>
                    <strong style={{ fontSize: 13 }}>{name}</strong>
                  </span>
                  <span className={`pill ${who}`}>
                    {info.emoji} {info.label}
                  </span>
                </div>
                <div className="stat-list" style={{ marginTop: 8 }}>
                  <StatRow label="集中スタイル" value={info.concentration || "—"} />
                  <StatRow label="曜日スタイル" value={info.weekdayLabel || "—"} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="曜日 × 時間帯" sub="いつ、どの時間に話しているか" icon="calendar" />
        <Heatmap
          matrix={matrix}
          rowLabels={[...WEEKDAY_LABELS]}
          colLabels={Array.from({ length: 24 }, (_, i) => `${i}時`)}
          ariaLabel="曜日と時間帯ごとのメッセージ数ヒートマップ"
        />
      </Card>
    </div>
  );
}
