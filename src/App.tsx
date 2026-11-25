import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "./components/Icon";
import { PersonChip, RangePicker } from "./components/ui";
import { useGlassSlider } from "./components/GlassSlider";
import { parseLineChat } from "./lib/parse";
import type { ParsedChat, RangeKey } from "./lib/types";
import { useChatStats, useStoredState, useTheme } from "./lib/useStats";
import { fmtInt } from "./lib/format";
import { MOBILE_VIEWS, VIEWS, VIEW_MAP, type ViewKey } from "./nav";
import { UploadView } from "./views/UploadView";
import { OverviewView } from "./views/OverviewView";
import { DetailView } from "./views/DetailView";
import { HistoryView } from "./views/HistoryView";
import { StreakView } from "./views/StreakView";
import { HourlyView } from "./views/HourlyView";
import { BreakdownView } from "./views/BreakdownView";
import { CalendarView } from "./views/CalendarView";
import { SearchView } from "./views/SearchView";
import { MonthlyView } from "./views/MonthlyView";
import { CompareView } from "./views/CompareView";
import { ShareView } from "./views/ShareView";
import { ReplayView } from "./views/ReplayView";
import { MemoriesView } from "./views/MemoriesView";
import { WordsView } from "./views/WordsView";
import { CallsView } from "./views/CallsView";
import { clearLastChat, loadLastChatMeta, loadLastChatText, saveLastChat, type SavedChatMeta } from "./lib/storage";

const RANGE_VIEWS: ViewKey[] = ["overview", "detail", "hourly", "breakdown", "history", "search"];

async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("shift-jis").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

export default function App() {
  const [chat, setChat] = useState<ParsedChat | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, toggleTheme] = useTheme();
  // 前回のトークをこの端末に保存して、次回すぐ開けるようにする
  const [remember, setRemember] = useStoredState<boolean>("talklog-remember", true);
  const [saved, setSaved] = useState<SavedChatMeta | null>(null);
  const refreshSaved = useCallback(() => {
    loadLastChatMeta().then(setSaved);
  }, []);
  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const loadText = useCallback(
    (text: string, name?: string, persist = true) => {
      setError(null);
      try {
        const parsed = parseLineChat(text);
        if (!parsed) {
          setError("メッセージが見つかりませんでした。LINEの「トーク履歴を送信」で書き出した .txt を選んでください（例：「2025/12/06(土)」または「2025.12.06 土曜日」の日付行が必要です）。");
          return;
        }
        setChat(parsed);
        setFileName(name ?? null);
        if (persist && remember && name !== "サンプルデータ") {
          saveLastChat(text, name || parsed.chatTitle || "トーク履歴").then(refreshSaved);
        }
      } catch {
        setError("ファイルの読み込みに失敗しました。もう一度お試しください。");
      }
    },
    [remember, refreshSaved],
  );

  const openSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await loadLastChatText();
      if (text) loadText(text, saved?.name, false);
      else setError("保存したトークが見つかりませんでした。もう一度ファイルを選んでください。");
    } finally {
      setLoading(false);
    }
  }, [loadText, saved]);

  const clearSaved = useCallback(() => {
    clearLastChat().then(refreshSaved);
  }, [refreshSaved]);

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const text = await readTextFile(file);
        loadText(text, file.name);
      } catch {
        setError("ファイルの読み込みに失敗しました。もう一度お試しください。");
      } finally {
        setLoading(false);
      }
    },
    [loadText],
  );

  if (!chat) {
    return (
      <UploadView
        onFile={loadFile}
        onSample={(text) => loadText(text, "サンプルデータ")}
        error={error}
        loading={loading}
        theme={theme}
        onToggleTheme={toggleTheme}
        saved={saved}
        onOpenSaved={openSaved}
        onClearSaved={clearSaved}
        remember={remember}
        onRememberChange={(v) => {
          setRemember(v);
          if (!v) clearSaved();
        }}
      />
    );
  }

  return (
    <Analyzer
      chat={chat}
      fileName={fileName}
      theme={theme}
      onToggleTheme={toggleTheme}
      onNewFile={loadFile}
      onReset={() => {
        setChat(null);
        setFileName(null);
        setError(null);
        refreshSaved();
      }}
    />
  );
}

interface AnalyzerProps {
  chat: ParsedChat;
  fileName: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNewFile: (file: File) => void;
  onReset: () => void;
}

function Analyzer({ chat, fileName, theme, onToggleTheme, onNewFile, onReset }: AnalyzerProps) {
  const [view, setView] = useState<ViewKey>("overview");
  const [rangeKey, setRangeKey] = useStoredState<RangeKey>("talklog-range", "1M");
  const [compareChat, setCompareChat] = useState<ParsedChat | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const stats = useChatStats(chat, rangeKey);
  const meta = VIEW_MAP[view];

  const loadCompare = useCallback(async (file: File) => {
    setCompareError(null);
    try {
      const text = await readTextFile(file);
      const parsed = parseLineChat(text);
      if (!parsed) {
        setCompareError("比較用ファイルからメッセージを読み取れませんでした。");
        return;
      }
      setCompareChat(parsed);
    } catch {
      setCompareError("比較用ファイルの読み込みに失敗しました。");
    }
  }, []);

  const go = useCallback((v: ViewKey) => {
    setView(v);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 下のタブバー：選択中のタブにクリアガラスの枠を敷き、なぞって切り替えられるようにする
  const navGlass = useGlassSlider<ViewKey>({
    value: MOBILE_VIEWS.includes(view) ? view : null,
    onSelect: go,
  });

  const totalDays = chat.RAW.length;
  const grouped = useMemo(
    () =>
      (["分析", "ふり返り", "ツール"] as const).map((g) => ({
        group: g,
        items: VIEWS.filter((v) => v.group === g),
      })),
    [],
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="./" onClick={(e) => { e.preventDefault(); onReset(); }}>
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

        <div className="chat-card">
          <div className="chat-card-title">
            <Icon name="message" size={14} style={{ color: "var(--a)", flex: "none" }} />
            <span>{chat.chatTitle || fileName || "ふたりのトーク"}</span>
          </div>
          <div className="chat-card-meta">
            <span>{fmtInt(chat.messageCount)} 件</span>
            <span>{fmtInt(totalDays)} 日分</span>
          </div>
          <div className="chat-people">
            <PersonChip name={chat.names.a} who="a" />
            <PersonChip name={chat.names.b} who="b" />
          </div>
        </div>

        <nav className="nav" aria-label="メインナビゲーション">
          {grouped.map((g) => (
            <div key={g.group}>
              <div className="nav-label">{g.group}</div>
              {g.items.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="nav-item"
                  aria-current={view === v.key ? "page" : undefined}
                  onClick={() => go(v.key)}
                >
                  <span className="nav-icon">
                    <Icon name={v.icon} size={17} />
                  </span>
                  {v.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-actions">
            <label className="btn" style={{ flex: 1, cursor: "pointer" }}>
              <Icon name="refresh" size={15} />
              別のファイル
              <input
                type="file"
                accept=".txt,text/plain"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onNewFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-icon"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "ライトテーマに切り替える" : "ダークテーマに切り替える"}
              title={theme === "dark" ? "ライトテーマ" : "ダークテーマ"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <div className="topbar">
            <div className="page-heading">
              <div className="eyebrow">
                <Icon name={meta.icon} size={13} />
                {meta.group}
              </div>
              <h1 className="page-title">{meta.title}</h1>
              <p className="page-desc">{meta.description}</p>
            </div>
            <div className="topbar-tools">
              {view === "overview" && (
                <button type="button" className="btn btn-accent topbar-share" onClick={() => go("share")}>
                  <Icon name="share" size={15} />
                  シェアカード
                </button>
              )}
              {RANGE_VIEWS.includes(view) && <RangePicker value={rangeKey} onChange={setRangeKey} />}
              <button
                type="button"
                className="btn btn-icon"
                onClick={onToggleTheme}
                aria-label={theme === "dark" ? "ライトテーマに切り替える" : "ダークテーマに切り替える"}
                title={theme === "dark" ? "ライトテーマ" : "ダークテーマ"}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
              </button>
            </div>
          </div>

          <div key={view} className="fade-in">
            {view === "overview" && (
              <OverviewView chat={chat} stats={stats} rangeKey={rangeKey} setRangeKey={setRangeKey} onGo={go} />
            )}
            {view === "detail" && <DetailView chat={chat} stats={stats} rangeKey={rangeKey} setRangeKey={setRangeKey} />}
            {view === "history" && <HistoryView chat={chat} stats={stats} rangeKey={rangeKey} setRangeKey={setRangeKey} />}
            {view === "streak" && <StreakView chat={chat} stats={stats} />}
            {view === "hourly" && <HourlyView chat={chat} stats={stats} rangeKey={rangeKey} setRangeKey={setRangeKey} />}
            {view === "breakdown" && <BreakdownView chat={chat} stats={stats} rangeKey={rangeKey} setRangeKey={setRangeKey} />}
            {view === "calendarmap" && <CalendarView chat={chat} stats={stats} />}
            {view === "search" && <SearchView chat={chat} stats={stats} rangeKey={rangeKey} setRangeKey={setRangeKey} />}
            {view === "monthly" && <MonthlyView chat={chat} stats={stats} />}
            {view === "compare" && (
              <CompareView
                chat={chat}
                stats={stats}
                compareChat={compareChat}
                compareError={compareError}
                onLoadCompare={loadCompare}
                onClearCompare={() => setCompareChat(null)}
              />
            )}
            {view === "share" && <ShareView chat={chat} stats={stats} />}
            {view === "replay" && <ReplayView chat={chat} stats={stats} />}
            {view === "memories" && <MemoriesView chat={chat} stats={stats} />}
            {view === "words" && <WordsView chat={chat} stats={stats} />}
            {view === "calls" && <CallsView chat={chat} stats={stats} />}
          </div>
        </div>
      </main>

      <nav
        ref={navGlass.barRef}
        onPointerDown={navGlass.onPointerDown}
        className="bottom-nav glass-bar"
        aria-label="モバイルナビゲーション"
      >
        <span ref={navGlass.pillRef} className="glass-pill" aria-hidden="true" />
        {MOBILE_VIEWS.map((key) => {
          const v = VIEW_MAP[key];
          return (
            <button
              key={key}
              type="button"
              data-glass-key={key}
              aria-current={view === key ? "page" : undefined}
              onClick={() => navGlass.onTap(key)}
            >
              <Icon name={v.icon} size={19} />
              {v.label}
            </button>
          );
        })}
        <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog">
          <Icon name="detail" size={19} />
          メニュー
        </button>
      </nav>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" role="dialog" aria-label="メニュー" onClick={(e) => e.stopPropagation()}>
            <div className="spread" style={{ marginBottom: 14 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>メニュー</strong>
              <button type="button" className="btn btn-icon" onClick={() => setMenuOpen(false)} aria-label="閉じる">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="sheet-actions">
              <label className="btn" style={{ flex: 1, cursor: "pointer" }}>
                <Icon name="refresh" size={15} />
                別のファイル
                <input
                  type="file"
                  accept=".txt,text/plain"
                  className="visually-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onNewFile(file);
                    e.target.value = "";
                    setMenuOpen(false);
                  }}
                />
              </label>
              <button type="button" className="btn" onClick={onReset}>
                <Icon name="upload" size={15} />
                最初の画面へ
              </button>
            </div>
            <div className="sheet-grid">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="sheet-item"
                  aria-current={view === v.key ? "page" : undefined}
                  onClick={() => go(v.key)}
                >
                  <Icon name={v.icon} size={19} />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
