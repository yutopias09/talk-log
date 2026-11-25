import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { StoryPlayer } from "../components/StoryPlayer";
import { buildStorySlides, type StorySlide } from "../lib/story";
import { playTick, vibrate } from "../lib/feedback";
import { Card, CardHead, Segmented, StatRow } from "../components/ui";
import { emojiRanking, wordRanking } from "../lib/analytics";
import { fmtDateJP, fmtInt, fmtNum, fmtRange } from "../lib/format";
import {
  CARD_FORMATS,
  CARD_THEMES,
  canvasToBlob,
  downloadBlob,
  drawShareCard,
  ensureFonts,
  type CardFormat,
  type CardThemeKey,
  type ShareData,
} from "../lib/share";
import type { BaseViewProps } from "./types";

export function ShareView({ chat, stats }: BaseViewProps) {
  const { summary, sliced, messagesInRange, peakHour, currentStreak, longestStreak } = stats;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<CardFormat>("portrait");
  const [theme, setTheme] = useState<CardThemeKey>("midnight");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // ストーリーは「ストーリーで振り返る」を押したときに初めて作る
  const [story, setStory] = useState<StorySlide[] | null>(null);
  const openStory = () => {
    playTick(659.25, 0.05);
    vibrate(7);
    setStory(buildStorySlides(chat, { longest: longestStreak, current: currentStreak }));
  };

  const words = useMemo(() => wordRanking(messagesInRange, 1), [messagesInRange]);
  const emojis = useMemo(() => emojiRanking(messagesInRange, 1), [messagesInRange]);

  const data: ShareData = useMemo(
    () => ({
      title: chat.chatTitle || `${chat.names.a}とのトーク`,
      names: chat.names,
      rangeLabel: sliced.length ? fmtRange(sliced[0].date, sliced[sliced.length - 1].date) : "",
      total: summary.total,
      days: sliced.length,
      avg: summary.avg,
      chars: summary.chars,
      peakHour: peakHour.hour,
      topWord: words[0]?.word,
      topEmoji: emojis[0]?.emoji,
      a: summary.a,
      b: summary.b,
      streak: currentStreak?.length ?? 0,
      longestStreak: longestStreak?.length ?? 0,
    }),
    [chat, summary, sliced, peakHour, words, emojis, currentStreak, longestStreak],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFonts();
      if (cancelled || !canvasRef.current) return;
      await drawShareCard(canvasRef.current, format, theme, data);
    })();
    return () => {
      cancelled = true;
    };
  }, [format, theme, data]);

  const save = async () => {
    if (!canvasRef.current) return;
    setBusy(true);
    setStatus(null);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      if (!blob) throw new Error("no blob");
      downloadBlob(blob, `talklog_${format}_${new Date().toISOString().slice(0, 10)}.png`);
      setStatus("画像を保存しました");
    } catch {
      setStatus("画像を作れませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!canvasRef.current) return;
    setBusy(true);
    setStatus(null);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      if (!blob) throw new Error("no blob");
      const file = new File([blob], `talklog_${format}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "ふたりのトークまとめ" });
        setStatus("共有しました");
      } else {
        downloadBlob(blob, `talklog_${format}.png`);
        setStatus("共有に未対応のため、画像として保存しました");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setStatus(null);
      else setStatus("共有できませんでした。画像として保存をお試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {story && story.length > 0 && <StoryPlayer slides={story} onClose={() => setStory(null)} />}
      <button type="button" className="story-launch" onClick={openStory}>
        <Icon name="play" size={22} />
        <span>
          ストーリーで振り返る
          <small>ふたりのトークを、全画面のスライドでふり返ります</small>
        </span>
        <span aria-hidden="true">✨</span>
      </button>
      <div className="share-layout">
        <Card className="share-preview-card">
          <CardHead
            title="プレビュー"
            sub={`${CARD_FORMATS.find((f) => f.key === format)?.label}・${CARD_THEMES.find((t) => t.key === theme)?.label}`}
            icon="share"
            right={<span className="pill accent">PNG</span>}
          />
          <div className="share-preview">
            <canvas
              ref={canvasRef}
              style={{ width: "100%", maxWidth: format === "story" ? 300 : 420 }}
              aria-label="シェアカードのプレビュー"
            />
          </div>
          <div className="row" style={{ marginTop: 14, justifyContent: "center" }}>
            <button type="button" className="btn btn-accent" onClick={save} disabled={busy}>
              <Icon name="download" size={15} />
              {busy ? "作成中…" : "画像で保存"}
            </button>
            <button type="button" className="btn" onClick={share} disabled={busy}>
              <Icon name="share" size={15} />
              シェアする
            </button>
          </div>
          {status && (
            <p className="small" style={{ textAlign: "center", marginTop: 10, color: "var(--muted)" }}>
              {status}
            </p>
          )}
        </Card>

        <div className="share-options">
          <Card>
            <CardHead title="サイズ" icon="detail" />
            <Segmented
              options={CARD_FORMATS.map((f) => ({ key: f.key, label: f.label }))}
              value={format}
              onChange={setFormat}
              ariaLabel="カードのサイズ"
            />
            <p className="small muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
              4:5 はフィード向け、9:16 はストーリー向け、1:1 は正方形です。
            </p>
          </Card>

          <Card>
            <CardHead title="テーマ" icon="sparkles" />
            <div className="row">
              {CARD_THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="swatch"
                  style={{ background: t.swatch }}
                  aria-label={t.label}
                  aria-pressed={theme === t.key}
                  title={t.label}
                  onClick={() => setTheme(t.key)}
                />
              ))}
              <span className="small muted">{CARD_THEMES.find((t) => t.key === theme)?.label}</span>
            </div>
          </Card>

          <Card>
            <CardHead title="カードに入る内容" icon="info" />
            <div className="stat-list">
              <StatRow label="やりとり" value={`${fmtInt(summary.total)} 件`} />
              <StatRow label="期間" value={sliced.length ? `${sliced.length} 日` : "—"} />
              <StatRow label="1日平均" value={`${fmtNum(summary.avg)} 件`} />
              <StatRow label="よく使う言葉" value={words[0] ? `「${words[0].word}」` : "—"} />
              <StatRow label="よく使う絵文字" value={emojis[0]?.emoji || "—"} />
              <StatRow label="連続記録" value={`${currentStreak?.length ?? 0} 日`} />
            </div>
          </Card>

          <p className="small faint" style={{ lineHeight: 1.8 }}>
            画像はこの端末の中で作られます。SNSに投稿するときは、相手のプライバシーにも配慮しましょう。
          </p>
        </div>
      </div>
    </div>
  );
}
