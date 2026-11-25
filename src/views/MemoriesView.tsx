import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { StoryPlayer } from "../components/StoryPlayer";
import { Card, CardHead, EmptyState, Segmented, SplitBar } from "../components/ui";
import { streakSegments, WEEKDAY_LABELS } from "../lib/analytics";
import { playCelebration, playTick, vibrate } from "../lib/feedback";
import { fmtDateJP, fmtInt } from "../lib/format";
import {
  anniversaryStatus,
  chatForYear,
  DEFAULT_FIRST_WORDS,
  firstMoments,
  fmtSeconds,
  localToday,
  longestGaps,
  monthsAgoToday,
  nextDayMilestone,
  onThisDay,
  yearsOf,
  yearSummary,
  type Anniversary,
} from "../lib/insights";
import { weekdayOf } from "../lib/parse";
import { buildStorySlides, type StorySlide } from "../lib/story";
import type { Message } from "../lib/types";
import { useStoredState } from "../lib/useStats";
import type { BaseViewProps } from "./types";

function fullDate(date: string): string {
  return `${date.slice(0, 4)}年${fmtDateJP(date)}（${WEEKDAY_LABELS[weekdayOf(date)]}）`;
}

function MiniChat({ messages, names, limit = 8 }: { messages: Message[]; names: { a: string; b: string }; limit?: number }) {
  return (
    <div className="mini-thread">
      {messages.slice(0, limit).map((m, i) => (
        <div key={i} className={`mini-thread-msg ${m.sender === names.a ? "a" : "b"}`}>
          <span className="mini-thread-meta">
            {m.sender}・{m.time}
          </span>
          <span className={m.type !== "text" ? "msg-type" : ""}>{m.content}</span>
        </div>
      ))}
      {messages.length > limit && <div className="small faint" style={{ textAlign: "center" }}>ほか {messages.length - limit} 件</div>}
    </div>
  );
}

export function MemoriesView({ chat }: BaseViewProps) {
  const { names } = chat;
  const today = localToday();
  const chatKey = `${chat.chatTitle || ""}:${names.a}:${names.b}`;

  /* ○年前の今日 */
  const yearsAgo = useMemo(() => onThisDay(chat, today), [chat, today]);
  const monthsAgo = useMemo(() => (yearsAgo.length ? [] : monthsAgoToday(chat, today)), [chat, today, yearsAgo.length]);
  const memories = yearsAgo.length ? yearsAgo : monthsAgo;
  const [memIdx, setMemIdx] = useState(0);
  const mem = memories[Math.min(memIdx, memories.length - 1)];

  /* 記念日 */
  const [annis, setAnnis] = useStoredState<Anniversary[]>(`talklog-anniversaries:${chatKey}`, []);
  const firstDate = chat.RAW[0]?.date || today;
  const allAnnis = useMemo(
    () =>
      [{ id: "start", name: "トークを始めた日", date: firstDate, yearly: true }, ...(annis || [])].map((a) =>
        anniversaryStatus(a, today),
      ),
    [annis, firstDate, today],
  );
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newYearly, setNewYearly] = useState(true);
  const addAnni = () => {
    if (!newName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    setAnnis([...(annis || []), { id: `${Date.now()}`, name: newName.trim(), date: newDate, yearly: newYearly }]);
    setNewName("");
    setNewDate("");
    playTick(783.99, 0.07);
    vibrate(8);
  };
  const todayAnni = allAnnis.find((a) => a.yearly && a.daysUntil === 0 && a.nth > 0);

  /* はじめての記録 */
  const [extraWords, setExtraWords] = useStoredState<string[]>(`talklog-first-words:${chatKey}`, []);
  const [wordDraft, setWordDraft] = useState("");
  const words = useMemo(() => [...DEFAULT_FIRST_WORDS, ...(extraWords || [])], [extraWords]);
  const firsts = useMemo(() => firstMoments(chat.messages, words), [chat.messages, words]);

  /* いちばん空いた期間 */
  const gaps = useMemo(() => longestGaps(chat, 5), [chat]);

  /* 年ごとのまとめ */
  const years = useMemo(() => yearsOf(chat), [chat]);
  const [year, setYear] = useState(() => years[years.length - 1] || "");
  const summary = useMemo(() => (year ? yearSummary(chat, year) : null), [chat, year]);
  const [story, setStory] = useState<StorySlide[] | null>(null);
  const openYearStory = () => {
    const sub = chatForYear(chat, year);
    const segs = streakSegments(sub.RAW);
    const longest = segs.reduce((best, s) => (s.length > best.length ? s : best), segs[0] || { start: "", end: "", length: 0 });
    playTick(659.25, 0.05);
    setStory(buildStorySlides(sub, { longest, current: null }));
  };

  return (
    <div className="stack">
      {story && story.length > 0 && <StoryPlayer slides={story} onClose={() => setStory(null)} />}

      {todayAnni && (
        <button
          type="button"
          className="anni-today"
          onClick={() => {
            playCelebration();
          }}
        >
          🎉 今日は「{todayAnni.name}」の {todayAnni.nth}周年です！ <span className="small">タップでお祝い</span>
        </button>
      )}

      <Card>
        <CardHead
          title={yearsAgo.length ? "○年前の今日" : "○ヶ月前の今日"}
          sub={`${parseInt(today.slice(5, 7), 10)}月${parseInt(today.slice(8), 10)}日に、ふたりが話していたこと`}
          icon="gift"
          right={
            memories.length > 1 ? (
              <Segmented
                options={memories.map((m, i) => ({
                  key: String(i),
                  label: m.yearsAgo > 0 ? `${m.yearsAgo}年前` : `${-m.yearsAgo}ヶ月前`,
                }))}
                value={String(Math.min(memIdx, memories.length - 1))}
                onChange={(k) => setMemIdx(Number(k))}
                ariaLabel="何年前の今日か"
                small
              />
            ) : undefined
          }
        />
        {mem ? (
          <>
            <div className="memory-head">
              <strong>{fullDate(mem.date)}</strong>
              <span className="pill accent">{fmtInt(mem.total)}件</span>
            </div>
            <MiniChat messages={mem.messages} names={names} limit={10} />
          </>
        ) : (
          <EmptyState icon="calendar" title="今日と同じ日付のトークは、まだありません">
            <span className="small muted">トークが続くと、1ヶ月後・1年後の今日にここで思い出が開きます。</span>
          </EmptyState>
        )}
      </Card>

      <div className="grid grid-main">
        <Card>
          <CardHead title="記念日カウントダウン" sub="誕生日や付き合った日などを登録できます（この端末に保存）" icon="heart" />
          <div className="anni-list">
            {allAnnis
              .slice()
              .sort((x, y) => (x.yearly ? x.daysUntil : 1e9) - (y.yearly ? y.daysUntil : 1e9))
              .map((a) => {
                const ms = nextDayMilestone(a.dayCount);
                return (
                  <div key={a.id} className="anni-row">
                    <div className="anni-main">
                      <strong>{a.name}</strong>
                      <span className="small muted">
                        {fullDate(a.date)}
                        {a.dayCount > 0 ? `・今日で${fmtInt(a.dayCount)}日目` : `・あと${fmtInt(1 - a.dayCount)}日`}
                      </span>
                      {a.dayCount > 0 && (
                        <span className="small faint">
                          {fmtInt(ms.days)}日目まで あと{fmtInt(ms.inDays)}日
                        </span>
                      )}
                    </div>
                    <div className="anni-count">
                      {a.yearly ? (
                        a.daysUntil === 0 ? (
                          <span className="pill pos">今日！</span>
                        ) : (
                          <>
                            <span className="anni-days tnum">{fmtInt(a.daysUntil)}</span>
                            <span className="small muted">日後{a.nth > 0 ? `・${a.nth}周年` : ""}</span>
                          </>
                        )
                      ) : null}
                    </div>
                    {a.id !== "start" && (
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost"
                        aria-label={`${a.name}を削除`}
                        onClick={() => setAnnis((annis || []).filter((x) => x.id !== a.id))}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
          <form
            className="anni-form"
            onSubmit={(e) => {
              e.preventDefault();
              addAnni();
            }}
          >
            <input className="input" type="text" placeholder="名前（例：付き合った日）" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="記念日の名前" />
            <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="記念日の日付" />
            <label className="small muted anni-yearly">
              <input type="checkbox" checked={newYearly} onChange={(e) => setNewYearly(e.target.checked)} />
              毎年くり返す
            </label>
            <button type="submit" className="btn btn-accent" disabled={!newName.trim() || !newDate}>
              追加
            </button>
          </form>
        </Card>

        <Card>
          <CardHead title="いちばん空いた期間" sub="やりとりが途切れていた日数" icon="clock" />
          {gaps.length === 0 ? (
            <EmptyState icon="flame" title="1日も空かずに続いています！" />
          ) : (
            <div className="gap-list">
              {gaps.map((g, i) => (
                <details key={g.from} className="gap-row" open={i === 0}>
                  <summary>
                    <span className="rank-index">{i + 1}</span>
                    <span className="gap-main">
                      <strong>{fmtInt(g.days)}日</strong>
                      <span className="small muted">
                        {fmtDateJP(g.from)} 〜 {fmtDateJP(g.to)}
                      </span>
                    </span>
                  </summary>
                  <div className="gap-detail">
                    {g.before && (
                      <div className="gap-msg">
                        <span className="small faint">途切れる前の最後のメッセージ</span>
                        <span>
                          <b>{g.before.sender}</b>：{g.before.content}
                        </span>
                      </div>
                    )}
                    {g.after && (
                      <div className="gap-msg">
                        <span className="small faint">再開した最初のメッセージ</span>
                        <span>
                          <b>{g.after.sender}</b>：{g.after.content}
                        </span>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHead title="はじめての記録" sub="ふたりの「はじめて」を、日付つきで" icon="sparkles" />
        <div className="first-grid">
          {firsts.map((f) => (
            <div key={f.key} className="first-card">
              <div className="first-top">
                <span className="first-emoji">{f.emoji}</span>
                <span className="first-label">{f.label}</span>
                {f.key.startsWith("w:") && (extraWords || []).some((w) => `w:${w.normalize("NFKC").toLowerCase()}` === f.key) && (
                  <button
                    type="button"
                    className="first-remove"
                    aria-label="この言葉を外す"
                    onClick={() =>
                      setExtraWords((extraWords || []).filter((w) => `w:${w.normalize("NFKC").toLowerCase()}` !== f.key))
                    }
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </div>
              {f.message && (
                <>
                  <div className="first-date">
                    {f.message.date.slice(0, 4)}年{fmtDateJP(f.message.date)} {f.message.time}
                  </div>
                  <div className="first-text">
                    <b>{f.message.sender}</b>：{f.message.content.length > 70 ? `${f.message.content.slice(0, 70)}…` : f.message.content}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <form
          className="row"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            const w = wordDraft.trim();
            if (!w || words.includes(w)) return;
            setExtraWords([...(extraWords || []), w]);
            setWordDraft("");
            playTick(783.99, 0.06);
          }}
        >
          <input
            className="input"
            style={{ flex: "1 1 180px" }}
            type="text"
            placeholder="ほかの言葉の「はじめて」を探す"
            value={wordDraft}
            onChange={(e) => setWordDraft(e.target.value)}
            aria-label="はじめてを探す言葉"
          />
          <button type="submit" className="btn">
            追加
          </button>
        </form>
      </Card>

      <Card>
        <CardHead
          title="年ごとのまとめ"
          sub={year ? `${year}年のふたり` : ""}
          icon="book"
          right={
            years.length > 1 ? (
              <Segmented options={years.map((y) => ({ key: y, label: `${y}` }))} value={year} onChange={setYear} ariaLabel="年を選ぶ" small />
            ) : undefined
          }
        />
        {summary ? (
          <>
            <div className="year-grid">
              <div className="year-stat">
                <span>メッセージ</span>
                <strong>{fmtInt(summary.total)}件</strong>
              </div>
              <div className="year-stat">
                <span>やりとりした日</span>
                <strong>{fmtInt(summary.days)}日</strong>
              </div>
              <div className="year-stat">
                <span>最長の連続記録</span>
                <strong>{fmtInt(summary.longestStreak)}日</strong>
              </div>
              <div className="year-stat">
                <span>打った文字数</span>
                <strong>{fmtInt(summary.chars)}字</strong>
              </div>
              <div className="year-stat">
                <span>いちばん話した日</span>
                <strong>
                  {fmtDateJP(summary.peak.date)}・{fmtInt(summary.peak.total)}件
                </strong>
              </div>
              <div className="year-stat">
                <span>通話</span>
                <strong>{summary.calls ? `${fmtInt(summary.calls)}回・${fmtSeconds(summary.callSec)}` : "—"}</strong>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <SplitBar a={summary.a} b={summary.b} aLabel={names.a} bLabel={names.b} />
            </div>
            {(summary.words.length > 0 || summary.emojis.length > 0) && (
              <div className="year-tags">
                {summary.words.map((w) => (
                  <span key={w.word} className="chip">
                    {w.word} <span className="faint">{w.count}</span>
                  </span>
                ))}
                {summary.emojis.map((e) => (
                  <span key={e.emoji} className="chip">
                    {e.emoji} <span className="faint">{e.count}</span>
                  </span>
                ))}
              </div>
            )}
            <button type="button" className="story-launch" style={{ marginTop: 16 }} onClick={openYearStory}>
              <Icon name="play" size={22} />
              <span>
                {year}年をストーリーで振り返る
                <small>
                  {fmtDateJP(summary.firstDate)} 〜 {fmtDateJP(summary.lastDate)}
                </small>
              </span>
              <span aria-hidden="true">✨</span>
            </button>
          </>
        ) : (
          <EmptyState icon="book" title="まとめられる年がありません" />
        )}
      </Card>
    </div>
  );
}
