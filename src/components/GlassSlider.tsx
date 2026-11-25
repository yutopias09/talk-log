import { useCallback, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { playTick, vibrate } from "../lib/feedback";

/**
 * 選択中のボタンの下に「クリアガラスの枠」を敷き、
 * タップで移動・指でなぞって移動できるようにするフック。
 *
 * - 枠は React の再描画を通さず、DOM を直接動かす（なぞっても重くならない）
 * - なぞっている間は枠だけが指に付いてきて、指を離したときに1回だけ選択を反映する
 * - タップしたときだけ「ミ」の音と短い振動
 *
 * 使い方: バーの要素に barRef と onPointerDown を付け、中に <span ref={pillRef} className="glass-pill" /> を置く。
 * 選べるボタンには data-glass-key={key} を付け、onClick で onTap(key) を呼ぶ。
 */
export function useGlassSlider<T extends string>({
  value,
  onSelect,
}: {
  value: T | null;
  onSelect: (key: T) => void;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const draggingRef = useRef(false);
  const justDraggedRef = useRef(false);

  const buttons = () =>
    barRef.current ? Array.from(barRef.current.querySelectorAll<HTMLElement>("[data-glass-key]")) : [];

  const placeOn = useCallback((el: HTMLElement | undefined, animate: boolean) => {
    const pill = pillRef.current;
    if (!pill) return;
    if (!el) {
      pill.style.opacity = "0";
      return;
    }
    pill.style.transition = animate ? "transform 0.16s ease-out, width 0.16s ease-out, opacity 0.2s" : "none";
    pill.style.opacity = "1";
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.transform = `translate3d(${el.offsetLeft}px, 0, 0)`;
  }, []);

  const findButton = (key: T | null) => buttons().find((b) => b.dataset.glassKey === key);

  // 選択が変わったら枠を合わせる（初回は動かさずにその場へ）
  const firstRef = useRef(true);
  useLayoutEffect(() => {
    if (draggingRef.current) return;
    placeOn(findButton(value), !firstRef.current);
    firstRef.current = false;
  });

  // 画面の幅やフォントが変わったら置き直す
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const again = () => {
      if (!draggingRef.current) placeOn(findButton(value), false);
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(again);
      ro.observe(bar);
    }
    window.addEventListener("resize", again);
    document.fonts?.ready.then(again).catch(() => {});
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", again);
    };
  }, [value, placeOn]);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const x0 = e.clientX;
    let active = false;
    let rect: DOMRect | null = null;
    let list: HTMLElement[] = [];
    let current: HTMLElement | undefined;

    const under = (x: number) => {
      const lx = x - (rect ? rect.left : 0);
      let best = list[0];
      for (const b of list) if (lx >= b.offsetLeft) best = b;
      return best;
    };
    const follow = (x: number) => {
      if (!rect || !list.length) return;
      const target = under(x);
      current = target;
      const w = target.offsetWidth;
      const first = list[0];
      const last = list[list.length - 1];
      const minL = first.offsetLeft;
      const maxL = last.offsetLeft + last.offsetWidth - w;
      const left = Math.min(maxL, Math.max(minL, x - rect.left - w / 2));
      pill.style.transition = "width 0.12s ease-out";
      pill.style.opacity = "1";
      pill.style.width = `${w}px`;
      pill.style.transform = `translate3d(${left}px, 0, 0)`;
    };

    const onMove = (ev: PointerEvent) => {
      // 長押しを待たず、指が少しでも横に動いたらすぐに枠を付いてこさせる
      if (!active && Math.abs(ev.clientX - x0) > 4) {
        active = true;
        draggingRef.current = true;
        rect = bar.getBoundingClientRect();
        list = buttons();
      }
      if (active) follow(ev.clientX);
    };
    const end = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!active) return;
      draggingRef.current = false;
      justDraggedRef.current = true;
      setTimeout(() => (justDraggedRef.current = false), 80);
      // 吸い込みアニメーションなしで、その場で選択肢に止める。中身の描画は枠が出てから
      placeOn(current, false);
      const key = current?.dataset.glassKey as T | undefined;
      if (key && key !== value) requestAnimationFrame(() => requestAnimationFrame(() => onSelect(key)));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  /** ボタンの onClick から呼ぶ（なぞった直後のクリックは無視） */
  const onTap = (key: T) => {
    if (justDraggedRef.current) return;
    onSelect(key);
    playTick(659.25, 0.05); // ミ(E5)
    vibrate(7);
  };

  return { barRef, pillRef, onPointerDown, onTap };
}
