import { useMemo, useState } from "react";
import { AreaTrend, Donut } from "../components/charts";
import { BarList, Card, CardHead, EmptyState, RankItem, Segmented, SplitBar } from "../components/ui";
import {
  emojiRanking,
  emojiTrend,
  RANGE_OPTIONS,
  replyStats,
  topicCounts,
  typeCounts,
  wordRanking,
  type TypeKey,
} from "../lib/analytics";
import { fmtInt } from "../lib/format";
import { conversationHabits } from "../lib/insights";
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

export function BreakdownView({ chat, stats, rangeKey }: ViewProps) {
  const { messagesInRange } = stats;
  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === rangeKey)?.label || "";
  const [wordWho, setWordWho] = useState<"all" | "a" | "b">("all");
  const words = useMemo(() => {
    const who = wordWho === "a" ? chat.names.a : wordWho === "b" ? chat.names.b : null;
    return wordRanking(who ? messagesInRange.filter((m) => m.sender === who) : messagesInRange, 12);
  }, [messagesInRange, wordWho, chat.names]);
  const reply = useMemo(() => replyStats(messagesInRange, chat.names), [messagesInRange, chat.names]);
  const habits = useMemo(() => conversationHabits(messagesInRange, chat.names), [messagesInRange, chat.names]);
  const habitRows: { label: string; hint: string; list: { name: string; count: number }[]; unit: string }[] = [
    { label: "話しかけるのは", hint: "3時間以上あいたあと、先にメッセージした回数", list: habits.starters, unit: "回" },
    { label: "会話を締めるのは", hint: "そのあと3時間以上あいた、最後のメッセージ", list: habits.enders, unit: "回" },
    { label: "先に「おはよう」", hint: "その日いちばん先に言った日数", list: habits.morning, unit: "日" },
    { label: "先に「おやすみ」", hint: "その日いちばん先に言った日数", list: habits.night, unit: "日" },
  ];
  const emojis = useMemo(() => emojiRanking(messagesInRange, 12), [messagesInRange]);
  const topics = useMemo(() => topicCounts(messagesInRange), [messagesInRange]);
  const trend = useMemo(() => emojiTrend(messagesInRange), [messagesInRange]);
  const types = useMemo(() => typeCounts(messagesInRange, chat.names), [messagesInRange, chat.names]);

  const typeRows = (["text", "stamp", "photo", "video", "file", "other"] as TypeKey[])
    .map((k) => ({ key: k, value: types.a[k] + types.b[k] }))
    .filter((t) => t.value > 0);
  const typeTotal = typeRows.reduce((s, t) => s + t.value, 0);
  const wordMax = words[0]?.count || 1;
  const topicTotal = topics.reduce((s, t) => s + t.count, 0);

  // ふたりの相性（占い感覚の遊び要素）：やりとりのバランスと返信の速さから
  const totalA = Object.values(types.a).reduce((s, v) => s + v, 0);
  const totalB = Object.values(types.b).reduce((s, v) => s + v, 0);
  const aPct = totalA + totalB === 0 ? 50 : Math.round((totalA / (totalA + totalB)) * 100);
  const balanceScore = Math.max(0, 100 - Math.abs(50 - aPct) * 1.6);
  const fastReplies = reply.buckets.slice(0, 3).reduce((s, b) => s + b.count, 0);
  const speedScore = reply.totalReplies === 0 ? 50 : Math.min(100, Math.round((fastReplies / reply.totalReplies) * 100));
  const compat = Math.max(0, Math.min(100, Math.round(balanceScore * 0.5 + speedScore * 0.5)));
  const tier =
    compat >= 85
      ? { label: "運命の相性", emoji: "💞" }
      : compat >= 65
        ? { label: "いい感じ", emoji: "💛" }
        : compat >= 40
          ? { label: "まだ発展中", emoji: "🌿" }
          : { label: "個性バラバラ型", emoji: "🔮" };

  return (
    <div className="stack">
      <div className="grid grid-main">
        <Card>
          <CardHead title="メッセージの種類" sub={`${fmtInt(typeTotal)} 件の内訳`} icon="pie" />
          <div className="donut-wrap">
            <Donut
              segments={typeRows.map((t) => ({ label: TYPE_LABEL[t.key], value: t.value, color: TYPE_COLOR[t.key] }))}
              centerLabel="メッセージ"
              size={158}
            />
            <div style={{ flex: 1, minWidth: 190 }}>
              <div className="stat-list">
                {typeRows.map((t) => (
                  <div className="stat-row" key={t.key} style={{ padding: "8px 0" }}>
                    <span className="stat-key">
                      <i className="legend-swatch" style={{ background: TYPE_COLOR[t.key] }} />
                      {TYPE_LABEL[t.key]}
                    </span>
                    <span className="stat-val">
                      {fmtInt(t.value)}
                      <small>{typeTotal ? Math.round((t.value / typeTotal) * 100) : 0}%</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="送信者別" sub="だれが何を送っているか" icon="users" />
          <div className="stack" style={{ gap: 16 }}>
            {(
              [
                ["a", chat.names.a, types.a],
                ["b", chat.names.b, types.b],
              ] as const
            ).map(([who, name, t]) => {
              const total = Object.values(t).reduce((s, v) => s + v, 0);
              return (
                <div key={who}>
                  <div className="spread" style={{ marginBottom: 8 }}>
                    <span className="row" style={{ gap: 7 }}>
                      <span className={`person-dot ${who}`}>{Array.from(name)[0]}</span>
                      <strong style={{ fontSize: 13 }}>{name}</strong>
                    </span>
                    <span className="small muted">{fmtInt(total)} 件</span>
                  </div>
                  <SplitBar
                    a={t.text}
                    b={total - t.text}
                    aLabel="テキスト"
                    bLabel="その他"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title="よく使った言葉"
            sub={`${rangeLabel}のテキストから集計`}
            icon="message"
            right={
              <Segmented
                options={[
                  { key: "all", label: "全員" },
                  { key: "a", label: chat.names.a },
                  { key: "b", label: chat.names.b },
                ]}
                value={wordWho}
                onChange={setWordWho}
                ariaLabel="だれの言葉を数えるか"
                small
              />
            }
          />
          {words.length === 0 ? (
            <EmptyState icon="message" title="集計できる言葉がありません" />
          ) : (
            <div>
              {words.map((w, i) => (
                <RankItem key={w.word} index={i} name={w.word} count={w.count} max={wordMax} suffix="回" />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="絵文字ランキング" sub={`${rangeLabel}によく使った絵文字`} icon="heart" />
          {emojis.length === 0 ? (
            <EmptyState icon="heart" title="絵文字が見つかりませんでした" />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
                gap: 10,
              }}
            >
              {emojis.map((e, i) => (
                <div
                  key={e.emoji}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "10px 8px",
                    textAlign: "center",
                    background: i === 0 ? "var(--a-soft)" : "var(--surface)",
                  }}
                >
                  <div style={{ fontSize: 26, lineHeight: 1.2 }}>{e.emoji}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4 }}>{fmtInt(e.count)} 回</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-main">
        <Card>
          <CardHead title="会話トピック分類" sub="キーワードから見た話題の傾向" icon="pie" />
          <BarList
            items={topics.map((t) => ({
              label: (
                <span className="row" style={{ gap: 7 }}>
                  <span>{t.emoji}</span>
                  {t.label}
                </span>
              ),
              value: t.count,
              hint: `${t.pct}%`,
            }))}
            formatValue={(v) => `${fmtInt(v)}件`}
          />
          <p className="small faint" style={{ marginTop: 12 }}>
            キーワードから簡易的に分類した話題の傾向です。合計 {fmtInt(topicTotal)} 件が分類されました。
          </p>
        </Card>

        <Card>
          <CardHead title="絵文字使用率の推移" sub="月ごとの絵文字の数" icon="detail" />
          {trend.length === 0 ? (
            <EmptyState icon="heart" title="絵文字の記録がありません" />
          ) : (
            <AreaTrend
              data={trend.map((t) => ({ label: t.label, value: t.count }))}
              unit="個"
              color="var(--accent)"
              height={220}
            />
          )}
        </Card>
      </div>

      <Card>
        <CardHead title="会話のくせ" sub={`${rangeLabel}・${habits.sessions}回の会話から`} icon="users" />
        <div className="habit-list">
          {habitRows.map((r) => {
            const [x, y] = r.list;
            const sum = x.count + y.count;
            const lead = sum === 0 ? null : x.count === y.count ? "同じくらい" : x.count > y.count ? x.name : y.name;
            return (
              <div key={r.label} className="habit-row">
                <div className="habit-head">
                  <span>{r.label}</span>
                  <strong>{lead ?? "—"}</strong>
                </div>
                {sum > 0 ? (
                  <SplitBar a={x.count} b={y.count} aLabel={`${x.name} ${x.count}${r.unit}`} bLabel={`${y.name} ${y.count}${r.unit}`} />
                ) : (
                  <span className="small faint">この期間にはありません</span>
                )}
                <span className="small faint">{r.hint}</span>
              </div>
            );
          })}
          <div className="habit-row">
            <div className="habit-head">
              <span>続けて送る数</span>
              <strong>
                {habits.burst[0].avg >= habits.burst[1].avg ? habits.burst[0].name : habits.burst[1].name}が多め
              </strong>
            </div>
            <div className="stat-list">
              {habits.burst.map((b) => (
                <div key={b.name} className="stat-row">
                  <span className="stat-key">{b.name}</span>
                  <span className="stat-val">1回に平均 {b.avg.toFixed(1)} 通</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="相性レポート" sub="やりとりのバランスと返信の速さから" icon="heart" />
        <div className="compat">
          <div className="compat-score">
            <span className="compat-emoji">{tier.emoji}</span>
            <span className="compat-num tnum">{compat}</span>
            <span className="compat-label">{tier.label}</span>
          </div>
          <div className="stat-list" style={{ flex: 1, minWidth: 200 }}>
            <div className="stat-row">
              <span className="stat-key">やりとりのバランス</span>
              <span className="stat-val">
                {Math.round(balanceScore)}
                <small>
                  {chat.names.a} {aPct}% ・ {chat.names.b} {100 - aPct}%
                </small>
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-key">返信の速さ</span>
              <span className="stat-val">
                {speedScore}
                <small>30分以内の返信 {reply.totalReplies ? Math.round((fastReplies / reply.totalReplies) * 100) : 0}%</small>
              </span>
            </div>
          </div>
        </div>
        <p className="small faint" style={{ marginTop: 12 }}>
          ※ メッセージの量と返信スピードから計算した、占い感覚の遊び要素です。
        </p>
      </Card>
    </div>
  );
}
