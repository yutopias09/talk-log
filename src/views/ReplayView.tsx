import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Card, CardHead, Segmented } from "../components/ui";
import { playPop } from "../lib/feedback";
import { fmtDateJP, fmtInt } from "../lib/format";
import { addDays } from "../lib/parse";
import { useStoredState } from "../lib/useStats";
import type { BaseViewProps } from "./types";

type PeriodKey = "day" | "w1" | "w2" | "m1" | "all";
type SpeedKey = "s1" | "s2" | "s3" | "s4";

const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "day", label: "1日", days: 1 },
  { key: "w1", label: "1週間", days: 7 },
  { key: "w2", label: "2週間", days: 14 },
  { key: "m1", label: "1ヶ月", days: 30 },
  { key: "all", label: "全期間", days: Infinity },
];

// ms = 1件あたりの間隔。期間に関係なく、どの期間でも同じ速さで再生する
const SPEEDS: { key: SpeedKey; label: string; ms: number }[] = [
  { key: "s1", label: "ゆっくり", ms: 1200 },
  { key: "s2", label: "ふつう", ms: 700 },
  { key: "s3", label: "はやい", ms: 400 },
  { key: "s4", label: "超はやい", ms: 100 },
];

/** 画面に並べるのは直近のこの件数まで（全期間でも重くならないように） */
const WINDOW = 150;

function lowerBound(arr: { date: string }[], date: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].date < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function fmtEta(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分${s % 60 ? `${s % 60}秒` : ""}`;
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}

export function ReplayView({ chat }: BaseViewProps) {
  const { messages, names } = chat;
  const days = useMemo(() => {
    const out: string[] = [];
    for (const m of messages) if (out[out.length - 1] !== m.date) out.push(m.date);
    return out;
  }, [messages]);
  const [day, setDay] = useState(() => days[days.length - 1] || "");
  const [period, setPeriod] = useStoredState<PeriodKey>("talklog-replay-period", "day");
  const [speed, setSpeed] = useStoredState<SpeedKey>("talklog-replay-speed", "s2");
  const [sound, setSound] = useStoredState<boolean>("talklog-replay-sound", true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);

  const periodDef = PERIODS.find((p) => p.key === period) || PERIODS[0];
  const speedDef = SPEEDS.find((s) => s.key === speed) || SPEEDS[1];

  // 選んだ日を「最後の日」として、期間ぶんさかのぼったメッセージを再生する
  const startDate = periodDef.days === Infinity ? days[0] || "" : addDays(day, -(periodDef.days - 1));
  const list = useMemo(() => {
    if (!day) return [];
    const from = lowerBound(messages, startDate);
    const to = lowerBound(messages, addDays(day, 1));
    return messages.slice(from, to);
  }, [messages, startDate, day]);

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    setPlaying(false);
  }, [list]);

  // 再生ループ：1件ずつ同じ間隔で出し、出すたびに「しゅぽっ」
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = speedDef.ms; // 押した直後に1件目を出す
    const fast = speedDef.ms <= 400;
    const step = (now: number) => {
      acc += now - last;
      last = now;
      let moved = false;
      while (acc >= speedDef.ms && indexRef.current < list.length) {
        acc -= speedDef.ms;
        indexRef.current += 1;
        moved = true;
      }
      if (moved) {
        setIndex(indexRef.current);
        const m = list[indexRef.current - 1];
        if (soundRef.current && m) playPop(m.sender !== names.a, fast);
      }
      if (indexRef.current >= list.length) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedDef.ms, list, names.a]);

  useEffect(() => {
    const el = stageRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [index]);

  const from = Math.max(0, index - WINDOW);
  const visible = list.slice(from, index);
  const progress = list.length ? (index / list.length) * 100 : 0;
  const current = index > 0 ? list[index - 1] : null;
  const remainMs = (list.length - index) * speedDef.ms;
  const single = periodDef.key === "day";
  const rangeLabel = single ? fmtDateJP(day) : `${fmtDateJP(list[0]?.date || startDate)} 〜 ${fmtDateJP(day)}`;

  const restart = () => {
    setPlaying(false);
    indexRef.current = 0;
    setIndex(0);
  };

  return (
    <div className="stack">
      <div className="grid grid-main">
        <Card>
          <CardHead
            title="トーク再生"
            sub={day ? `${rangeLabel}・${fmtInt(list.length)}件` : "日付を選んでください"}
            icon="play"
            right={
              <label className="row" style={{ gap: 6 }}>
                <span className="small muted">{single ? "日付" : "この日まで"}</span>
                <select
                  className="select"
                  style={{ width: "auto", minWidth: 140 }}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  aria-label={single ? "再生する日を選ぶ" : "再生を終える日を選ぶ"}
                >
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d.slice(0, 4)}年{fmtDateJP(d)}
                    </option>
                  ))}
                </select>
              </label>
            }
          />

          <div className="replay-options">
            <Segmented
              options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
              value={period}
              onChange={setPeriod}
              ariaLabel="再生する期間"
              small
            />
            <Segmented
              options={SPEEDS.map((s) => ({ key: s.key, label: s.label }))}
              value={speed}
              onChange={setSpeed}
              ariaLabel="再生スピード"
              small
            />
          </div>

          <div className="replay-stage" ref={stageRef} aria-live="polite">
            {visible.length === 0 && (
              <div className="chart-empty">
                {list.length ? "「再生」を押すと、会話が1通ずつ流れます。" : "この期間にはメッセージがありません。"}
              </div>
            )}
            {from > 0 && <div className="replay-day-label">これより前の {fmtInt(from)} 件は省略しています</div>}
            {visible.map((m, i) => {
              const prev = i > 0 ? visible[i - 1] : from > 0 ? list[from - 1] : null;
              const showDate = !prev || prev.date !== m.date;
              const left = m.sender === names.a;
              return (
                <div key={from + i} style={{ display: "contents" }}>
                  {showDate && <div className="replay-day-label">{fmtDateJP(m.date)}</div>}
                  <div
                    className={`bubble ${left ? "a" : "b"}`}
                    style={{ alignSelf: left ? "flex-start" : "flex-end", animation: "fadeIn .3s var(--ease) both" }}
                  >
                    <div className="bubble-meta">
                      <span>{m.sender}</span>
                      <span>{m.time}</span>
                    </div>
                    <span className={m.type !== "text" ? "msg-type" : ""}>{m.content}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="replay-controls">
            <button
              type="button"
              className="btn btn-accent"
              disabled={list.length === 0}
              onClick={() => {
                if (index >= list.length) {
                  indexRef.current = 0;
                  setIndex(0);
                }
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "一時停止" : "再生"}
            >
              <Icon name={playing ? "pause" : "play"} size={14} />
              {playing ? "一時停止" : index >= list.length && list.length > 0 ? "もう一度" : index > 0 ? "つづきから" : "再生"}
            </button>
            <button type="button" className="btn" onClick={restart}>
              <Icon name="refresh" size={14} />
              最初から
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-pressed={sound}
              onClick={() => setSound(!sound)}
              title="再生中の効果音"
            >
              {sound ? "🔔 音あり" : "🔕 音なし"}
            </button>
            <div className="progress-track" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
            <span className="small muted tnum">
              {fmtInt(Math.min(index, list.length))} / {fmtInt(list.length)}
            </span>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title={single ? "この日について" : "この期間について"} icon="info" />
            {list.length > 0 ? (
              <div className="stat-list">
                <div className="stat-row">
                  <span className="stat-key">メッセージ</span>
                  <span className="stat-val">{fmtInt(list.length)} 件</span>
                </div>
                <div className="stat-row">
                  <span className="stat-key">最初のメッセージ</span>
                  <span className="stat-val">
                    {single ? "" : `${fmtDateJP(list[0].date)} `}
                    {list[0].time}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-key">最後のメッセージ</span>
                  <span className="stat-val">
                    {single ? "" : `${fmtDateJP(list[list.length - 1].date)} `}
                    {list[list.length - 1].time}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-key">いま表示中</span>
                  <span className="stat-val">{current ? `${single ? "" : `${fmtDateJP(current.date)} `}${current.time}` : "—"}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-key">残り時間のめやす</span>
                  <span className="stat-val">{index >= list.length ? "—" : fmtEta(remainMs)}</span>
                </div>
              </div>
            ) : (
              <div className="chart-empty">この期間のメッセージはありません</div>
            )}
          </Card>
          <Card>
            <CardHead title="ヒント" icon="zap" />
            <p className="small muted" style={{ lineHeight: 1.9 }}>
              期間を「1週間」以上にすると、選んだ日までの会話をまとめて再生できます。スピードはどの期間でも同じなので、長い期間は「超はやい」がおすすめです。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
