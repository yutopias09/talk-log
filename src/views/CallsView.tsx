import { useMemo } from "react";
import { BarSeries } from "../components/charts";
import { BarList, Card, CardHead, EmptyState, Kpi, SplitBar, StatRow } from "../components/ui";
import { WEEKDAY_LABELS } from "../lib/analytics";
import { fmtDateJP, fmtInt } from "../lib/format";
import { callStats, fmtSeconds } from "../lib/insights";
import type { BaseViewProps } from "./types";

export function CallsView({ chat }: BaseViewProps) {
  const stats = useMemo(() => callStats(chat.messages, chat.names), [chat.messages, chat.names]);
  const { calls, missed, totalSec, longest, byCaller, missedByCaller, hours, monthly, weekday } = stats;

  if (calls.length === 0 && missed.length === 0) {
    return (
      <Card>
        <EmptyState icon="phone" title="通話の記録が見つかりませんでした">
          <span className="small muted">
            LINEの書き出しに「☎ 通話時間 12:34」のような行があると、ここに通話の記録が出ます。
          </span>
        </EmptyState>
      </Card>
    );
  }

  const avgSec = calls.length ? totalSec / calls.length : 0;
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakWeekday = weekday.indexOf(Math.max(...weekday));
  const longCalls = calls.filter((c) => c.sec >= 3600).length;
  const lastCall = calls[calls.length - 1];

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Kpi label="通話した回数" icon="phone" value={fmtInt(calls.length)} unit="回" foot={<span>不在・キャンセル {fmtInt(missed.length)} 回</span>} />
        <Kpi label="合計の通話時間" icon="clock" value={fmtSeconds(totalSec)} foot={<span>1回あたり {fmtSeconds(avgSec)}</span>} />
        <Kpi
          label="いちばん長い通話"
          icon="flame"
          value={longest[0] ? fmtSeconds(longest[0].sec) : "—"}
          foot={<span>{longest[0] ? fmtDateJP(longest[0].date) : ""}</span>}
        />
        <Kpi label="1時間以上の長電話" icon="heart" value={fmtInt(longCalls)} unit="回" foot={<span>{lastCall ? `最後の通話 ${fmtDateJP(lastCall.date)}` : ""}</span>} />
      </div>

      <div className="grid grid-main">
        <Card>
          <CardHead title="長電話ランキング" sub="通話時間が長かった順" icon="flame" />
          {longest.length === 0 ? (
            <EmptyState icon="phone" title="通話時間の記録がありません" />
          ) : (
            <div className="call-rank">
              {longest.map((c, i) => (
                <div key={`${c.date}${c.time}`} className="call-rank-row">
                  <span className="rank-index">{i + 1}</span>
                  <div className="call-rank-main">
                    <strong>{fmtSeconds(c.sec)}</strong>
                    <span className="small muted">
                      {c.date.slice(0, 4)}年{fmtDateJP(c.date)} {c.time}・{c.caller}からかけた
                    </span>
                  </div>
                  <div className="call-rank-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(6, (c.sec / Math.max(1, longest[0].sec)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="かけるのはどっち？" sub="通話を始めた回数" icon="users" />
          <SplitBar a={byCaller[0].count} b={byCaller[1].count} aLabel={byCaller[0].name} bLabel={byCaller[1].name} />
          <div className="stat-list" style={{ marginTop: 14 }}>
            {byCaller.map((c) => (
              <StatRow key={c.name} label={`${c.name} からかけた`} value={`${fmtInt(c.count)} 回・${fmtSeconds(c.sec)}`} />
            ))}
            {missedByCaller.map((c) => (
              <StatRow key={`m${c.name}`} label={`${c.name} の不在・キャンセル`} value={`${fmtInt(c.count)} 回`} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHead title="通話する時間帯" sub={calls.length ? `${peakHour}時台がいちばん多い` : ""} icon="clock" />
          <BarSeries
            values={hours}
            labels={Array.from({ length: 24 }, (_, i) => `${i}`)}
            titles={Array.from({ length: 24 }, (_, i) => `${i}時台`)}
            height={180}
            unit="回"
            colorFor={(i) => (i === peakHour ? "var(--b)" : "var(--a)")}
            ariaLabel="通話した時間帯"
          />
        </Card>
        <Card>
          <CardHead title="通話する曜日" sub={calls.length ? `${WEEKDAY_LABELS[peakWeekday]}曜日がいちばん多い` : ""} icon="calendar" />
          <BarSeries
            values={weekday}
            labels={WEEKDAY_LABELS}
            titles={WEEKDAY_LABELS.map((w) => `${w}曜日`)}
            height={180}
            unit="回"
            colorFor={(i) => (i === peakWeekday ? "var(--b)" : "var(--a)")}
            ariaLabel="通話した曜日"
          />
        </Card>
      </div>

      {monthly.length > 0 && (
        <Card>
          <CardHead title="月ごとの通話時間" sub="なぞると回数も見られます" icon="monthly" />
          <BarSeries
            values={monthly.map((m) => Math.round(m.sec / 60))}
            labels={monthly.map((m) => m.label)}
            titles={monthly.map((m) => `${m.ym.slice(0, 4)}年${parseInt(m.ym.slice(5), 10)}月（${m.count}回）`)}
            height={200}
            unit="分"
            ariaLabel="月ごとの通話時間"
          />
          <div className="divider" />
          <BarList
            items={[...monthly]
              .sort((x, y) => y.sec - x.sec)
              .slice(0, 3)
              .map((m) => ({ label: `${m.ym.slice(0, 4)}年${parseInt(m.ym.slice(5), 10)}月`, value: m.sec, hint: `${m.count}回` }))}
            formatValue={(v) => fmtSeconds(v)}
          />
        </Card>
      )}
    </div>
  );
}
