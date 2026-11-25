import { useMemo } from "react";
import { AreaTrend, BarSeries } from "../components/charts";
import { Icon } from "../components/Icon";
import { Card, CardHead, SplitBar, StatRow, TrendBadge } from "../components/ui";
import { hotConversation, WEEKDAY_LABELS } from "../lib/analytics";
import { fmtDateJP, fmtInt, fmtNum, fmtRange } from "../lib/format";
import { localToday, onThisDay } from "../lib/insights";
import type { ViewKey } from "../nav";
import type { ViewProps } from "./types";

export function OverviewView({ chat, stats, onGo }: ViewProps & { onGo?: (v: ViewKey) => void }) {
  // ○年前の今日：あれば概要のいちばん上でお知らせ
  const memory = useMemo(() => onThisDay(chat, localToday())[0] || null, [chat]);
  const memoryPreview = memory?.messages.find((m) => m.type === "text" && !m.content.startsWith("☎"));
  const { summary, sliced, trend, weekday, hourly, peakHour, topWeekday, weekly } = stats;
  const hot = useMemo(
    () => hotConversation(stats.messagesInRange, stats.startDate),
    [stats.messagesInRange, stats.startDate],
  );

  const rangeLabel = sliced.length
    ? fmtRange(sliced[0].date, sliced[sliced.length - 1].date)
    : "データなし";

  return (
    <div className="stack">
      {memory && onGo && (
        <button type="button" className="memory-banner" onClick={() => onGo("memories")}>
          <span className="memory-banner-emoji" aria-hidden="true">
            🎁
          </span>
          <span className="memory-banner-text">
            <strong>
              {memory.yearsAgo}年前の今日、{fmtInt(memory.total)}件のやりとりがありました
            </strong>
            {memoryPreview && (
              <span className="small">
                {memoryPreview.sender}「{memoryPreview.content.length > 34 ? `${memoryPreview.content.slice(0, 34)}…` : memoryPreview.content}」
              </span>
            )}
          </span>
          <Icon name="chevron-right" size={18} />
        </button>
      )}
      <Card className="overview-hero">
        <div>
          <div className="kpi-label">
            <Icon name="message" size={14} style={{ color: "var(--a)" }} />
            この期間のやりとり
          </div>
          <div className="hero-stat">
            {fmtInt(summary.total)}
            <span className="unit">件</span>
          </div>
          <div className="kpi-foot">
            <span>{rangeLabel}</span>
            <span>・1日平均 {fmtNum(summary.avg)} 件</span>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-mini">
            <strong>{fmtInt(sliced.length)}日</strong>
            <span>やりとりした日</span>
          </div>
          <div className="hero-mini">
            <strong>{fmtInt(summary.chars)}</strong>
            <span>文字数</span>
          </div>
          <div className="hero-mini">
            <strong>{peakHour.hour}時</strong>
            <span>よく話す時間</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-main">
        <Card>
          <CardHead
            title="メッセージ数の推移"
            sub={`${rangeLabel}・1日平均 ${fmtNum(summary.avg)} 件`}
            icon="detail"
          />
          <AreaTrend
            data={trend}
            height={250}
            avg={summary.avg}
            ariaLabel={`メッセージ数の推移。合計${fmtInt(summary.total)}件、1日平均${fmtNum(summary.avg)}件`}
          />
          <div className="chart-legend">
            <span className="legend-item">
              <i className="legend-swatch" style={{ background: "var(--a)" }} />
              1日のメッセージ数
            </span>
            <span className="legend-item faint">点線：期間中の1日平均</span>
            <span className="faint" style={{ marginLeft: "auto", fontSize: 11 }}>
              チャートをなぞると日別の件数が見られます
            </span>
          </div>
          <div className="chart-foot">
            <div>
              <span>いちばん多い日</span>
              <strong>
                {fmtDateJP(summary.peak.date)}・{fmtInt(summary.peak.total)}件
              </strong>
            </div>
            <div>
              <span>いちばん静かな日</span>
              <strong>
                {fmtDateJP(summary.low.date)}・{fmtInt(summary.low.total)}件
              </strong>
            </div>
            <div>
              <span>1日あたりの文字数</span>
              <strong>{fmtInt(summary.avgChars)}字</strong>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="ふたりの割合" icon="users" />
            <SplitBar a={summary.a} b={summary.b} aLabel={chat.names.a} bLabel={chat.names.b} />
            <div className="stat-list" style={{ marginTop: 14 }}>
              <StatRow label={chat.names.a} value={`${fmtInt(summary.a)} 件`} />
              <StatRow label={chat.names.b} value={`${fmtInt(summary.b)} 件`} />
            </div>
          </Card>

          <Card>
            <CardHead title="ハイライト" icon="sparkles" />
            <div className="stat-list">
              <StatRow label="いちばん話した日" value={`${fmtDateJP(summary.peak.date)}・${fmtInt(summary.peak.total)}件`} />
              <StatRow label="いちばん静かな日" value={`${fmtDateJP(summary.low.date)}・${fmtInt(summary.low.total)}件`} />
              <StatRow label="いちばん話す曜日" value={`${WEEKDAY_LABELS[topWeekday.index]}曜日`} />
              <StatRow label="やりとりした日" value={`${sliced.length} 日`} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead title="曜日別" sub={`${WEEKDAY_LABELS[topWeekday.index]}曜がいちばん多い`} icon="calendar" />
          <BarSeries
            values={weekday}
            labels={WEEKDAY_LABELS}
            titles={WEEKDAY_LABELS.map((w) => `${w}曜日`)}
            height={180}
            colorFor={(i) => (i === topWeekday.index ? "var(--a)" : "color-mix(in srgb, var(--a) 40%, var(--surface))")}
            ariaLabel="曜日別メッセージ数"
          />
        </Card>
        <Card>
          <CardHead title="時間帯別" sub={`${peakHour.hour}時台がいちばん多い`} icon="clock" />
          <BarSeries
            values={hourly}
            labels={Array.from({ length: 24 }, (_, i) => `${i}`)}
            titles={Array.from({ length: 24 }, (_, i) => `${i}時台`)}
            height={180}
            colorFor={(i) => (i === peakHour.hour ? "var(--b)" : "var(--a)")}
            ariaLabel="時間帯別メッセージ数"
          />
        </Card>
      </div>

      <div className="grid grid-main">
        <Card>
          <CardHead
            title="盛り上がった話"
            sub={hot ? `${fmtDateJP(hot.date)} ${hot.start}〜${hot.end}・${hot.count}件` : undefined}
            icon="flame"
            right={<span className="pill accent">自動検出</span>}
          />
          {hot ? (
            <div className="bubble-list">
              {hot.highlights.map((m, i) => (
                <div
                  key={i}
                  className={`bubble ${m.sender === chat.names.a ? "a" : "b"}`}
                  style={{ alignSelf: m.sender === chat.names.a ? "flex-start" : "flex-end" }}
                >
                  <div className="bubble-meta">
                    <span>{m.sender}</span>
                    <span>{m.time}</span>
                  </div>
                  {m.content.length > 90 ? `${m.content.slice(0, 90)}…` : m.content}
                </div>
              ))}
            </div>
          ) : (
            <div className="chart-empty">この期間には盛り上がった話が見つかりませんでした</div>
          )}
        </Card>

        <Card>
          <CardHead title="直近7日間" sub="前の7日間との比較" icon="zap" />
          <div className="spread" style={{ alignItems: "flex-end", marginBottom: 6 }}>
            <div>
              <div className="kpi-value" style={{ fontSize: 30 }}>
                {fmtInt(weekly.last7Total)}
                <span className="kpi-unit">件</span>
              </div>
              <div className="kpi-foot">
                <TrendBadge value={weekly.diff} suffix="件" />
                <span>前週 {fmtInt(weekly.prev7Total)} 件</span>
              </div>
            </div>
          </div>
          <div className="divider" />
          <div className="stat-list">
            <StatRow label="いちばん話した日" value={fmtDateJP(weekly.busiest.date)} />
            <StatRow label="その日のメッセージ" value={`${fmtInt(weekly.busiest.total)} 件`} />
            <StatRow label="記録した日数" value={`${weekly.days} 日`} />
          </div>
          {weekly.diff >= 0 ? (
            <div className="pill pos" style={{ marginTop: 14 }}>
              <Icon name="arrow-up" size={12} />
              先週より {fmtInt(weekly.diff)} 件多いペース
            </div>
          ) : (
            <div className="pill neg" style={{ marginTop: 14 }}>
              <Icon name="arrow-down" size={12} />
              先週より {fmtInt(Math.abs(weekly.diff))} 件少ないペース
            </div>
          )}
        </Card>
      </div>

      <p className="small faint" style={{ textAlign: "center", marginTop: 4 }}>
        集計期間は上のボタンから切り替えられます。データはこの端末の中だけで処理されています。
      </p>
    </div>
  );
}
