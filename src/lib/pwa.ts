// ホーム画面に追加してアプリのように使えるようにする（GitHub Pages などで公開したときだけ）。
// manifest.webmanifest / sw.js / アイコンは、index.html と同じ場所に置いておく。

export function installPwa(): void {
  try {
    if (!/^https?:$/.test(location.protocol)) return;
    if (window.top !== window.self) return; // 埋め込み（プレビュー）では何もしない
    const add = (rel: string, href: string, sizes?: string) => {
      if (document.head.querySelector(`link[rel="${rel}"]`)) return;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      if (sizes) link.setAttribute("sizes", sizes);
      document.head.appendChild(link);
    };
    add("manifest", "./manifest.webmanifest");
    add("apple-touch-icon", "./apple-touch-icon.png", "180x180");
    if ("serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
  } catch {
    /* ignore */
  }
}

/** iPhone の Safari で、まだホーム画面に追加していないとき */
export function shouldSuggestHomeScreen(): boolean {
  try {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    return ios && !standalone && window.top === window.self;
  } catch {
    return false;
  }
}
