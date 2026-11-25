import { useDeferredValue, useMemo, useState } from "react";
import { AreaTrend } from "../components/charts";
import { Icon } from "../components/Icon";
import { Card, CardHead, EmptyState, PersonChip, SplitBar, StatRow } from "../components/ui";
import { wordRanking } from "../lib/analytics";
import { fmtDateJP, fmtInt } from "../lib/format";
import { sharedLinks, signatureWords, wordTrend } from "../lib/insights";
import { playTick } from "../lib/feedback";
import { useStoredState } from "../lib/useStats";
import type { BaseViewProps } from "./types";

export function WordsView({ chat }: BaseViewProps) {
  const { names } = chat;
  const top = useMemo(() => wordRanking(chat.messages, 8), [chat.messages]);
  const [word, setWord] = useStoredState<string>("talklog-word-trend", "");
  const [draft, setDraft] = useState(word || top[0]?.word || "");
  const current = useDeferredValue((word || top[0]?.word || "").trim());
  const trend = useMemo(() => (current ? wordTrend(chat, current) : null), [chat, current]);

  const sig = useMemo(() => signatureWords(chat.messages, names, 8), [chat.messages, names]);
  const links = useMemo(() => sharedLinks(chat.messages), [chat.messages]);
  const kinds = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.kind, (m.get(l.kind) || 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [links]);
  const [kind, setKind] = useState<string>("all");
  const [linkLimit, setLinkLimit] = useState(30);
  const shownLinks = kind === "all" ? links : links.filter((l) => l.kind === kind);

  const apply = (w: string) => {
    setDraft(w);
    setWord(w);
    playTick(659.25, 0.05);
  };

  const total = trend ? trend.totalA + trend.totalB : 0;

  return (
    <div className="stack">
      <Card>
        <CardHead title="言葉の推移" sub="好きな言葉を入れると、月ごとに何回使ったかがわかります" icon="detail" />
        <form
          className="row"
          style={{ marginBottom: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft.trim());
          }}
        >
          <div className="search-box" style={{ flex: "1 1 200px" }}>
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              value={draft}
              placeholder="例：好き、ねむい、ラーメン"
              onChange={(e) => setDraft(e.target.value)}
              aria-label="調べる言葉"
            />
          </div>
          <button type="submit" className="btn btn-accent">
            調べる
          </button>
        </form>
        {top.length > 0 && (
          <div className="chip-row">
            {top.map((t) => (
              <button key={t.word} type="button" className="chip" aria-pressed={current === t.word} onClick={() => apply(t.word)}>
                {t.word}
              </button>
            ))}
          </div>
        )}

        {!trend || total === 0 ? (
          <EmptyState icon="search" title={current ? `「${current}」はトークに出てきませんでした` : "言葉を入れてください"} />
        ) : (
          <>
            <div className="word-trend-head">
              <div>
                <div className="kpi-label">「{trend.word}」を使った回数</div>
                <div className="kpi-value">
                  {fmtInt(total)}
                  <span className="kpi-unit">回</span>
                </div>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <SplitBar a={trend.totalA} b={trend.totalB} aLabel={names.a} bLabel={names.b} />
              </div>
            </div>
            <AreaTrend
              data={trend.months.map((m) => ({
                label: m.label,
                value: m.a + m.b,
                title: `${m.ym.slice(0, 4)}年${parseInt(m.ym.slice(5), 10)}月`,
                rows: [
                  { label: names.a, value: `${m.a}`, color: "var(--a)" },
                  { label: names.b, value: `${m.b}`, color: "var(--b)" },
                ],
              }))}
              height={210}
              unit="回"
              ariaLabel={`「${trend.word}」を月ごとに使った回数`}
            />
            <div className="stat-list" style={{ marginTop: 12 }}>
              {trend.first && (
                <StatRow
                  label="はじめて使った日"
                  value={`${trend.first.date.slice(0, 4)}年${fmtDateJP(trend.first.date)}・${trend.first.sender}`}
                />
              )}
              {trend.peakMonth && (
                <StatRow label="いちばん使った月" value={`${trend.peakMonth.slice(0, 4)}年${parseInt(trend.peakMonth.slice(5), 10)}月`} />
              )}
              {trend.last && <StatRow label="最後に使った日" value={`${trend.last.date.slice(0, 4)}年${fmtDateJP(trend.last.date)}・${trend.last.sender}`} />}
            </div>
            {trend.first && (
              <div className="quote-bubble">
                <span className="small muted">はじめての「{trend.word}」</span>
                <p>{trend.first.content}</p>
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardHead title="ふたりの口ぐせ" sub="相手よりも自分のほうが、特によく使う言葉" icon="quote" />
        <div className="grid grid-2" style={{ gap: 14 }}>
          {([
            ["a", sig.a],
            ["b", sig.b],
          ] as const).map(([who, list]) => (
            <div key={who} className="sig-col">
              <PersonChip name={names[who]} who={who} />
              {list.length === 0 ? (
                <p className="small muted" style={{ marginTop: 10 }}>
                  まだ口ぐせと言えるほどの言葉がありません
                </p>
              ) : (
                <ol className="sig-list">
                  {list.map((s, i) => (
                    <li key={s.word}>
                      <span className="rank-index">{i + 1}</span>
                      <strong>{s.word}</strong>
                      <span className="small muted tnum">
                        {s.mine}回<span className="faint">（相手 {s.theirs}回）</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="共有したリンク" sub={`${fmtInt(links.length)} 件のURL`} icon="link" />
        {links.length === 0 ? (
          <EmptyState icon="link" title="トークにURLは見つかりませんでした" />
        ) : (
          <>
            <div className="chip-row">
              <button type="button" className="chip" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
                すべて {links.length}
              </button>
              {kinds.map(([k, n]) => (
                <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k} {n}
                </button>
              ))}
            </div>
            <div className="link-list">
              {shownLinks.slice(0, linkLimit).map((l, i) => (
                <a key={`${l.url}${i}`} className="link-row" href={l.url} target="_blank" rel="noopener noreferrer">
                  <span className="link-kind">{l.kind}</span>
                  <span className="link-main">
                    <strong>{l.domain}</strong>
                    <span className="small muted">
                      {l.date.slice(0, 4)}年{fmtDateJP(l.date)} {l.time}・{l.sender}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={15} />
                </a>
              ))}
            </div>
            {shownLinks.length > linkLimit && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setLinkLimit((n) => n + 30)}>
                  さらに表示（残り {shownLinks.length - linkLimit} 件）
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
