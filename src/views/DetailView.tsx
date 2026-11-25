import { useMemo } from "react";
import { AreaTrend, Donut } from "../components/charts";
import { Icon } from "../components/Icon";
import { BarList, Card, CardHead, Kpi, StatRow } from "../components/ui";
import {
  hotConversation,
  lifestyle,
  replyStats,
  typeCounts,
  type TypeKey,
} from "../lib/analytics";
import { fmtDateJP, fmtDuration, fmtInt, fmtNum } from "../lib/format";
import type { ViewProps } from "./types";

const TYPE_LABEL: Record<TypeKey, string> = {
  text: "テキスト",
  stamp: "スタンプ",
  photo: "写真",
  video: "動画",
  file: "ファイル",
  other: "その他",
};

const TYPE_COLOR: Record<TypeKey, string> = {
  text: "var(--a)",
  stamp: "#8B7CFF",
  photo: "#3ED598",
  video: "#FFA63D",
  file: "#5B9DFF",
  other: "var(--muted)",
};

export function DetailView({ chat, stats }: ViewProps) {
  const { summary, sliced, messagesInRange, startDate } = stats;
  const replies = useMemo(() => replyStats(messagesInRange, chat.names), [messagesInRange, chat.names]);
  const life = useMemo(() => lifestyle(messagesInRange, chat.names), [messagesInRange, chat.names]);
  const types = useMemo(() => typeCounts(messagesInRange, chat.names), [messagesInRange, chat.names]);
  const hot = useMemo(() => hotConversation(messagesInRange, startDate), [messagesInRange, startDate]);

  const charsTrend = useMemo(
    () =>
      sliced.map((d) => ({
        label: `${parseInt(d.date.slice(5, 7), 10)}/${parseInt(d.date.slice(8, 10), 10)}`,
        value: d.chars || 0,
        title: `${parseInt(d.date.slice(5, 7), 10)}月${parseInt(d.date.slice(8, 10), 10)}日`,
        detail: d.total ? `1件あたり ${Math.round((d.chars || 0) / d.total)}字` : undefined,
      })),
    [sliced],
  );

  const allTypes = (["text", "stamp", "photo", "video", "file", "other"] as TypeKey[]).map((k) => ({
    key: k,
    value: types.a[k] + types.b[k],
  }));
  const totalTyped = allTypes.reduce((s, t) => s + t.value, 0);
  const textRate = totalTyped === 0 ? 0 : Math.round(((types.a.text + types.b.text) / totalTyped) * 100);
  const avgReply =
    replies.avgA === null && replies.avgB === null
      ? null
      : ((replies.avgA ?? 0) * (replies.avgA !== null ? 1 : 0) + (replies.avgB ?? 0) * (replies.avgB !== null ? 1 : 0)) /
        ((replies.avgA !== null ? 1 : 0) + (replies.avgB !== null ? 1 : 0));

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Kpi label="1日の文字数" icon="file" value={fmtInt(summary.avgChars)} unit="字" foot={<span>打った文字の量</span>} />
        <Kpi label="1日のメッセージ" icon="message" value={fmtNum(summary.avg)} unit="件" foot={<span>{sliced.length} 日間の平均</span>} />
        <Kpi
          label="平均返信時間"
          icon="clock"
          value={avgReply === null ? "—" : fmtDuration(avgReply)}
          foot={<span>{fmtInt(replies.totalReplies)} 回の返信から</span>}
        />
        <Kpi label="テキストの割合" icon="detail" value={`${textRate}%`} foot={<span>スタンプ・写真を除く</span>} />
      </div>

      <div className="grid grid-main">
        <Card>
          <CardHead title="返信スピード" sub="相手のメッセージに返すまでの時間" icon="zap" />
          <BarList
            items={replies.buckets.map((b) => ({ label: b.label, value: b.count }))}
            formatValue={(v) => `${fmtInt(v)}回`}
          />
          <div className="divider" />
          <div className="stat-list">
            <StatRow
              label={`${chat.names.a} の平均返信`}
              value={replies.avgA === null ? "—" : fmtDuration(replies.avgA)}
            />
            <StatRow
              label={`${chat.names.b} の平均返信`}
              value={replies.avgB === null ? "—" : fmtDuration(replies.avgB)}
            />
          </div>
        </Card>

        <Card>
          <CardHead title="生活タイプ" sub="よく話す時間帯と曜日の傾向" icon="clock" />
          <div className="stack" style={{ gap: 14 }}>
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
                  <span className={`pill ${who}`}>{info.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.7 }}>
                  {info.detail || "データが足りません"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-main">
        <Card>
          <CardHead title="文字数の推移" sub="1日に打った文字の量" icon="file" />
          <AreaTrend data={charsTrend} color="var(--accent)" height={210} unit="字" />
        </Card>

        <Card>
          <CardHead title="メッセージの種類" sub={`${fmtInt(totalTyped)} 件の内訳`} icon="pie" />
          <div className="donut-wrap" style={{ justifyContent: "center" }}>
            <Donut
              segments={allTypes
                .filter((t) => t.value > 0)
                .map((t) => ({ label: TYPE_LABEL[t.key], value: t.value, color: TYPE_COLOR[t.key] }))}
              centerLabel="メッセージ"
            />
            <div style={{ flex: 1, minWidth: 150 }}>
              <div className="stat-list">
                {allTypes.map((t) => (
                  <div className="stat-row" key={t.key} style={{ padding: "7px 0" }}>
                    <span className="stat-key">
                      <i className="legend-swatch" style={{ background: TYPE_COLOR[t.key] }} />
                      {TYPE_LABEL[t.key]}
                    </span>
                    <span className="stat-val">
                      {fmtInt(t.value)}
                      <small>{totalTyped ? `${Math.round((t.value / totalTyped) * 100)}%` : "0%"}</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="いちばん盛り上がった話"
          sub={hot ? `${fmtDateJP(hot.date)} ${hot.start}〜${hot.end}・${hot.count}件・約${hot.durMin}分` : undefined}
          icon="flame"
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
                {m.content.length > 120 ? `${m.content.slice(0, 120)}…` : m.content}
              </div>
            ))}
          </div>
        ) : (
          <div className="chart-empty">この期間には盛り上がった話が見つかりませんでした</div>
        )}
      </Card>

      <div className="grid grid-2">
        <Card>
          <CardHead title="いちばん多い日・少ない日" icon="calendar" />
          <div className="stat-list">
            <StatRow label="最多日" value={`${fmtDateJP(summary.peak.date)}・${fmtInt(summary.peak.total)}件`} />
            <StatRow label="最少日" value={`${fmtDateJP(summary.low.date)}・${fmtInt(summary.low.total)}件`} />
            <StatRow label="やりとりした日" value={`${sliced.length} 日`} />
          </div>
        </Card>
        <Card>
          <CardHead title="メッセージ数の前日比" sub="期間中の変化" icon="compare" />
          <div className="stat-list">
            <StatRow
              label="増えた日"
              value={`${sliced.filter((d) => d.dayDelta > 0).length} 日`}
            />
            <StatRow
              label="減った日"
              value={`${sliced.filter((d) => d.dayDelta < 0).length} 日`}
            />
            <StatRow
              label="いちばん伸びた日"
              value={(() => {
                const best = [...sliced].sort((a, b) => b.dayDelta - a.dayDelta)[0];
                return best && best.dayDelta > 0 ? `${fmtDateJP(best.date)}・+${fmtInt(best.dayDelta)}件` : "—";
              })()}
            />
          </div>
          <div className="pill accent" style={{ marginTop: 12 }}>
            <Icon name="info" size={12} />
            前日との差が大きい日をまとめています
          </div>
        </Card>
      </div>
    </div>
  );
}
