import { useCallback, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { Icon } from "../components/Icon";
import { buildSampleChat } from "../lib/sample";
import { shouldSuggestHomeScreen } from "../lib/pwa";
import type { SavedChatMeta } from "../lib/storage";

interface UploadViewProps {
  onFile: (file: File) => void;
  onSample: (text: string) => void;
  error: string | null;
  loading: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  saved: SavedChatMeta | null;
  onOpenSaved: () => void;
  onClearSaved: () => void;
  remember: boolean;
  onRememberChange: (v: boolean) => void;
}

function fmtSavedAt(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function UploadView({
  onFile,
  onSample,
  error,
  loading,
  theme,
  onToggleTheme,
  saved,
  onOpenSaved,
  onClearSaved,
  remember,
  onRememberChange,
}: UploadViewProps) {
  const [suggestHome] = useState(() => shouldSuggestHomeScreen());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      className="upload-page"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <header className="upload-top">
        <a className="brand" href="./" aria-label="トーク分析 ホーム">
          <span className="brand-mark">
            <Icon name="message" size={21} />
          </span>
          <span>
            <span className="brand-name">トーク分析</span>
            <span className="brand-sub" style={{ display: "block" }}>
              TALK LOG ANALYZER
            </span>
          </span>
        </a>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "ライトテーマに切り替える" : "ダークテーマに切り替える"}
          title={theme === "dark" ? "ライトテーマ" : "ダークテーマ"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
        </button>
      </header>

      {saved && (
        <div className="resume-card resume-top">
          <div className="resume-text">
            <span className="resume-kicker">前回のトーク</span>
            <strong>{saved.name}</strong>
            <span className="small muted">{fmtSavedAt(saved.savedAt)} にこの端末へ保存</span>
          </div>
          <div className="resume-actions">
            <button type="button" className="btn btn-accent btn-lg" onClick={onOpenSaved} disabled={loading}>
              <Icon name="play" size={14} />
              すぐに開く
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClearSaved} disabled={loading} title="この端末に保存したトークを削除">
              <Icon name="trash" size={15} />
              削除
            </button>
          </div>
        </div>
      )}


      <main className="upload-main">
        <section>
          <span className="hero-kicker">
            <Icon name="sparkles" size={13} />
            LINEのトーク履歴を、ふたりの記録に
          </span>
          <h1 className="hero-title">
            会話のなかに、
            <br />
            <span className="grad">ふたりの時間</span>が
            <br />
            見える。
          </h1>
          <p className="hero-lead">
            書き出したトーク履歴ファイルを読み込むだけ。メッセージ数や時間帯、よく使う言葉、返信の速さまで、
            ふたりの会話をやさしく可視化します。
          </p>

          <div className="hero-points">
            {[
              "読み込むだけで、主要な分析がすぐにそろう",
              "データは端末の中だけで処理。どこにも送信しません",
              "スマホでも、デスクトップでも見やすいレイアウト",
            ].map((t) => (
              <div className="hero-point" key={t}>
                <Icon name="check" size={15} strokeWidth={2.4} />
                <span>{t}</span>
              </div>
            ))}
          </div>

          <div
            className={`dropzone${dragging ? " dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">
              <Icon name={loading ? "refresh" : "upload"} size={26} />
            </div>
            <div className="dropzone-title">
              {loading ? "読み込んでいます…" : dragging ? "ここにドロップ" : "トーク履歴ファイルを読み込む"}
            </div>
            <div className="dropzone-sub">.txt ファイル／この端末内だけで処理されます</div>
            <div className="dropzone-actions">
              <button
                type="button"
                className="btn btn-accent btn-lg"
                onClick={() => inputRef.current?.click()}
                disabled={loading}
              >
                <Icon name="file" size={16} />
                ファイルを選ぶ
              </button>
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => onSample(buildSampleChat())}
                disabled={loading}
              >
                <Icon name="play" size={14} />
                サンプルで試す
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,text/plain"
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
                e.target.value = "";
              }}
            />

            <label className="remember-toggle">
              <input type="checkbox" checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />
              <span>この端末に保存して、次回はファイルを選ばずにすぐ開く</span>
            </label>

            <div className="privacy-note">
              <Icon name="check" size={14} strokeWidth={2.6} style={{ flex: "none", marginTop: 1 }} />
              <span>
                ファイルはブラウザの中だけで解析されます。サーバーへの送信は一切ありません。保存する場合も、この端末の中だけです。
              </span>
            </div>

            {error && <div className="upload-error">{error}</div>}
          </div>

          {suggestHome && (
            <div className="home-tip">
              <Icon name="info" size={15} style={{ flex: "none", marginTop: 1 }} />
              <span>
                Safariの共有ボタン →「ホーム画面に追加」で、アプリのように開けます。
              </span>
            </div>
          )}

          <div className="steps">
            <div className="step">
              <span className="step-num">1</span>
              <span>LINEのトーク画面右上の設定を開く</span>
            </div>
            <div className="step">
              <span className="step-num">2</span>
              <span>「トーク履歴を送信」→「テキストファイル」を選ぶ</span>
            </div>
            <div className="step">
              <span className="step-num">3</span>
              <span>保存した .txt ファイルを、ここに読み込む</span>
            </div>
          </div>
        </section>

        <aside className="hero-preview" aria-hidden="true">
          <span className="hero-badge">解析イメージ</span>
          <div className="hero-preview-inner">
            <div className="mini-chat">
              <div className="mini-bubble a">おはよう！今日もいい天気だね☀️</div>
              <div className="mini-bubble b">おはよう〜！ほんと気持ちいいね</div>
              <div className="mini-bubble a">お昼どこ行く？</div>
              <div className="mini-bubble b">駅前の新しいカフェ行ってみたい！</div>
              <div className="mini-bubble a">いいね、12時半に現地集合？</div>
              <div className="mini-bubble b">了解🫡</div>
            </div>
            <div className="mini-stats">
              <div className="mini-stat">
                <strong>2,418</strong>
                <span>メッセージ</span>
              </div>
              <div className="mini-stat">
                <strong>142日</strong>
                <span>やりとり</span>
              </div>
              <div className="mini-stat">
                <strong>21:00</strong>
                <span>いちばん話す時間</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 11.5,
                color: "var(--muted)",
              }}
            >
              <Icon name="flame" size={15} style={{ color: "var(--b)" }} />
              連続記録 <strong style={{ color: "var(--text)" }}>18日</strong> 更新中
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
