// 画面の文字を長押し・右クリック・ドラッグで選択／コピーできないようにする。
// 入力欄（検索・メモなど）と、画像の長押し保存はそのまま使える。
// ※ ブラウザに届いたプログラムを完全に隠すことはできないので、見えにくくするだけです。

export function installCopyGuard(): void {
  try {
    const allowed = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("input, textarea, select, img, canvas, [contenteditable='true']");

    for (const type of ["copy", "cut", "contextmenu", "selectstart", "dragstart"] as const) {
      document.addEventListener(
        type,
        (e) => {
          if (!allowed(e.target)) e.preventDefault();
        },
        true,
      );
    }

    // 長押しなどで選択が始まってしまっても、入力欄の外ならすぐに選択を解除する
    document.addEventListener("selectionchange", () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const node = sel.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement || null;
      const active = document.activeElement;
      const inField =
        (el && el.closest("input, textarea, [contenteditable='true']")) ||
        (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement);
      if (!inField) sel.removeAllRanges();
    });

    // 開発者ツール・ソース表示のショートカットを止める
    document.addEventListener(
      "keydown",
      (e) => {
        const k = (e.key || "").toLowerCase();
        const mod = e.ctrlKey || e.metaKey;
        const devtools =
          e.key === "F12" ||
          (mod && k === "u") ||
          (mod && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
          (e.metaKey && e.altKey && (k === "i" || k === "j" || k === "u"));
        if (devtools) e.preventDefault();
      },
      true,
    );
  } catch {
    /* ignore */
  }
}
