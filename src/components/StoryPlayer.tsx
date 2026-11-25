import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { fmtDateJP } from "../lib/format";
import { playTick } from "../lib/feedback";
import type { StorySlide } from "../lib/story";
import { Icon } from "./Icon";

/** 大きな数字・見出しを、画面の幅に合わせて自動で縮める（長い数字が折り返して崩れないように） */
function FitBig({ base, allowWrap, sample, children }: { base: number; allowWrap: boolean; sample: ReactNode; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const sampleRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ size: base, wrap: false });
  useLayoutEffect(() => {
    let dead = false;
    const run = () => {
      const o = outerRef.current;
      const s = sampleRef.current;
      if (dead || !o || !s) return;
      const avail = o.clientWidth;
      const w = s.offsetWidth;
      if (!avail || !w) return;
      let next = { size: base, wrap: false };
      if (w > avail) {
        const target = Math.floor(base * (avail / w) * 0.94);
        const floor = allowWrap ? Math.round(base * 0.6) : 20;
        next = target >= floor ? { size: target, wrap: false } : { size: floor, wrap: allowWrap };
      }
      setFit((f) => (f.size === next.size && f.wrap === next.wrap ? f : next));
    };
    run();
    document.fonts?.ready.then(run).catch(() => {});
    window.addEventListener("resize", run);
    return () => {
      dead = true;
      window.removeEventListener("resize", run);
    };
  }, [base, allowWrap, sample]);
  return (
    <div
      ref={outerRef}
      className="story-big story-up"
      style={{ fontSize: fit.size, whiteSpace: fit.wrap ? "normal" : "nowrap", animationDelay: "0.3s" }}
    >
      <span ref={sampleRef} aria-hidden="true" className="story-measure" style={{ fontSize: base }}>
        {sample}
      </span>
      {children}
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / 1500);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v.toLocaleString("ja-JP")}</>;
}

const BUBBLES: [number, number, number][] = [
  [8, 12, 120],
  [78, 22, 70],
  [20, 70, 90],
  [84, 78, 150],
  [50, 45, 40],
  [62, 8, 56],
];
const CONFETTI_COLORS = ["#fff", "#FFD166", "#FF7CC8", "#7CF2D0"];

/**
 * 全画面のストーリー再生（インスタのストーリーズ風）。
 * 右側タップで次へ、左側タップで前へ、長押しで一時停止、Esc か × で閉じる。
 */
export function StoryPlayer({ slides, onClose }: { slides: StorySlide[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdRef = useRef<number | undefined>(undefined);
  const heldRef = useRef(false);
  const slide = slides[idx];
  const isLast = idx === slides.length - 1;
  const dur = slide.kind === "bubbles" ? 7 : slide.kind === "rank" ? 5.5 : 4.2;

  const idxRef = useRef(0);
  idxRef.current = idx;
  const go = (d: number) => {
    const n = Math.min(slides.length - 1, Math.max(0, idxRef.current + d));
    if (n === idxRef.current) return;
    idxRef.current = n;
    playTick(d > 0 ? 784 : 587.33, 0.05);
    setIdx(n);
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const onDown = () => {
    heldRef.current = false;
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
    }, 200);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    window.clearTimeout(holdRef.current);
    if (heldRef.current) {
      heldRef.current = false;
      setPaused(false);
      return;
    }
    go(e.clientX < window.innerWidth * 0.33 ? -1 : 1);
  };
  const onCancel = () => {
    window.clearTimeout(holdRef.current);
    heldRef.current = false;
    setPaused(false);
  };
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const delay = (s: number) => ({ animationDelay: `${s}s` });

  const bigText = slide.title || "";
  const bigSize = slide.count !== undefined ? 76 : bigText.length > 14 ? 30 : bigText.length > 9 ? 38 : 52;
  const bigInner = (live: boolean) =>
    slide.count !== undefined ? (
      <>
        {live ? <CountUp to={slide.count} /> : slide.count.toLocaleString("ja-JP")}
        <span className="story-suffix">{slide.suffix}</span>
      </>
    ) : (
      bigText
    );

  return createPortal(
    <div
      className="story"
      role="dialog"
      aria-label="ストーリー"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      style={{ background: `linear-gradient(160deg, ${slide.bg[0]}, ${slide.bg[1]})` }}
    >
      {BUBBLES.map(([l, t, sz], i) => (
        <div
          key={i}
          className="story-bubble"
          style={{ left: `${l}%`, top: `${t}%`, width: sz, height: sz, animation: `story-float ${6 + i}s ease-in-out ${i * 0.4}s infinite` }}
        />
      ))}

      <div className="story-progress">
        {slides.map((_, i) => (
          <div key={i} className="story-progress-track">
            {i < idx || (i === idx && isLast) ? (
              <div className="story-progress-fill" style={{ width: "100%" }} />
            ) : i === idx ? (
              <div
                key={idx}
                className="story-progress-fill"
                onAnimationEnd={() => go(1)}
                style={{ animation: `story-prog ${dur}s linear forwards`, animationPlayState: paused ? "paused" : "running" }}
              />
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="story-close"
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="閉じる"
      >
        <Icon name="close" size={22} />
      </button>

      {isLast &&
        Array.from({ length: 36 }, (_, i) => (
          <div
            key={i}
            className="story-confetti"
            style={{
              left: `${(i * 97) % 100}%`,
              background: CONFETTI_COLORS[i % 4],
              animation: `story-rain ${3 + (i % 5) * 0.6}s linear ${(i % 9) * 0.25}s infinite`,
            }}
          />
        ))}

      <div key={idx} className="story-body">
        <div className="story-emoji">{slide.emoji}</div>
        <div className="story-caption story-up" style={delay(0.15)}>
          {slide.caption}
        </div>

        {(slide.kind === "text" || slide.kind === "finale") && (
          <>
            <FitBig base={bigSize} allowWrap={slide.count === undefined} sample={bigInner(false)}>
              {bigInner(true)}
            </FitBig>
            {slide.sub && (
              <div className="story-sub story-up" style={delay(0.55)}>
                {slide.sub}
              </div>
            )}
          </>
        )}

        {slide.kind === "bar" && slide.rows && (
          <div className="story-bars">
            {slide.rows.map((r, i) => (
              <div key={i} className="story-up" style={{ ...delay(0.3 + i * 0.2), textAlign: "left" }}>
                <div className="story-bar-head">
                  <span>{r.label}</span>
                  <span>{r.pct}%</span>
                </div>
                <div className="story-bar-track">
                  <div className="story-bar-fill" style={{ width: `${r.pct}%`, animationDelay: `${0.5 + i * 0.2}s` }} />
                </div>
                <div className="story-bar-foot">{r.count.toLocaleString("ja-JP")}件</div>
              </div>
            ))}
            <div className="story-sub story-up" style={delay(0.9)}>
              {slide.sub}
            </div>
          </div>
        )}

        {slide.kind === "rank" && slide.items && (
          <div className="story-rank">
            {slide.items.map((it, i) => {
              const max = slide.items![0].value || 1;
              return (
                <div key={i} className="story-rank-row story-up" style={delay(0.3 + i * 0.18)}>
                  <div className="story-rank-no">{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="story-rank-head" style={{ fontSize: i === 0 ? 22 : 17 }}>
                      <span className="story-ellipsis">{it.label}</span>
                      <span className="story-rank-count">{it.value.toLocaleString("ja-JP")}回</span>
                    </div>
                    <div className="story-bar-track thin">
                      <div className="story-bar-fill" style={{ width: `${(it.value / max) * 100}%`, animationDelay: `${0.5 + i * 0.18}s` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {slide.kind === "bubbles" && slide.topic && slide.names && (
          <div style={{ marginTop: 14 }}>
            <div className="story-sub story-up" style={{ ...delay(0.3), marginTop: 0, marginBottom: 12, fontSize: 13 }}>
              {fmtDateJP(slide.topic.date)} {slide.topic.start}〜{slide.topic.end}（{slide.topic.count}件）
            </div>
            <div className="story-chat">
              {slide.topic.highlights.slice(0, 4).map((m, i) => {
                const mine = m.sender === slide.names!.a;
                return (
                  <div key={i} className={`story-msg story-up ${mine ? "left" : "right"}`} style={delay(0.6 + i * 0.7)}>
                    <div className="story-msg-name">{m.sender}</div>
                    <div className="story-msg-text">{m.content.length > 60 ? `${m.content.slice(0, 60)}…` : m.content}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {slide.hint && (
          <div className="story-hint story-up" style={delay(1)}>
            {slide.hint}
          </div>
        )}

        {isLast && (
          <div className="story-actions story-up" style={delay(1)}>
            <button
              type="button"
              className="story-btn ghost"
              onPointerDown={stop}
              onPointerUp={stop}
              onClick={(e) => {
                e.stopPropagation();
                setIdx(0);
              }}
            >
              もう一度見る
            </button>
            <button
              type="button"
              className="story-btn"
              onPointerDown={stop}
              onPointerUp={stop}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
