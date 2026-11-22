import type { CSSProperties, ReactNode } from "react";
import { RANGE_OPTIONS } from "../lib/analytics";
import type { RangeKey } from "../lib/types";
import { Icon, type IconName } from "./Icon";

export function Card({
  children,
  className = "",
  style,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={`card ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export function CardHead({
  title,
  sub,
  icon,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div style={{ minWidth: 0 }}>
        <h2 className="card-title">
          {icon && <Icon name={icon} size={17} style={{ color: "var(--muted)" }} />}
          {title}
        </h2>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {right && <div className="row" style={{ flexWrap: "nowrap" }}>{right}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  foot,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  icon?: IconName;
  accent?: string;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-label">
        {icon && <Icon name={icon} size={14} style={{ color: accent || "var(--muted)" }} />}
        {label}
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  small,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  small?: boolean;
}) {
  return (
    <div className={`segmented${small ? " sm" : ""}`} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RangePicker({
  value,
  onChange,
  small,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
  small?: boolean;
}) {
  return (
    <Segmented
      options={RANGE_OPTIONS.map((r) => ({ key: r.key, label: r.label }))}
      value={value}
      onChange={onChange}
      ariaLabel="集計する期間"
      small={small}
    />
  );
}

export function TrendBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return (
    <span className={`trend ${dir}`}>
      <Icon name={dir === "up" ? "arrow-up" : dir === "down" ? "arrow-down" : "minus"} size={11} strokeWidth={2.6} />
      {Math.abs(Math.round(value)).toLocaleString("ja-JP")}
      {suffix}
    </span>
  );
}

export function BarList({
  items,
  formatValue = (v) => v.toLocaleString("ja-JP"),
  color,
}: {
  items: { label: ReactNode; value: number; hint?: ReactNode }[];
  formatValue?: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bar-list">
      {items.map((it, i) => (
        <div className="bar-row" key={i}>
          <div className="bar-label" title={typeof it.label === "string" ? it.label : undefined}>
            {it.label}
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(it.value / max) * 100}%`, background: color }}
            />
          </div>
          <div className="bar-value">
            {formatValue(it.value)}
            {it.hint && <div style={{ fontSize: 10, color: "var(--faint)", fontWeight: 500 }}>{it.hint}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatRow({
  label,
  value,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="stat-row">
      <span className="stat-key">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </span>
      <span className="stat-val">{value}</span>
    </div>
  );
}

export function SplitBar({ a, b, aLabel, bLabel }: { a: number; b: number; aLabel: string; bLabel: string }) {
  const total = Math.max(1, a + b);
  const pct = Math.round((a / total) * 100);
  return (
    <div>
      <div className="meter" aria-label={`${aLabel} ${pct}%、${bLabel} ${100 - pct}%`}>
        <i style={{ width: `${pct}%`, background: "var(--a)" }} />
        <i style={{ width: `${100 - pct}%`, background: "var(--b)" }} />
      </div>
      <div className="split-labels">
        <span style={{ color: "var(--a-text)" }}>
          {aLabel} {pct}%
        </span>
        <span style={{ color: "var(--b-text)" }}>
          {100 - pct}% {bLabel}
        </span>
      </div>
    </div>
  );
}

export function PersonChip({ name, who }: { name: string; who: "a" | "b" }) {
  return (
    <span className="person-chip" title={name}>
      <span className={`person-dot ${who}`} aria-hidden="true">{Array.from(name)[0] || (who === "a" ? "A" : "B")}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </span>
  );
}

export function EmptyState({ icon = "info", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <strong style={{ color: "var(--text-2)" }}>{title}</strong>
      {children}
    </div>
  );
}

export function RankItem({
  index,
  name,
  count,
  max,
  suffix = "回",
}: {
  index: number;
  name: ReactNode;
  count: number;
  max: number;
  suffix?: string;
}) {
  return (
    <div className="rank-item">
      <span className="rank-index">{index + 1}</span>
      <div className="rank-main">
        <div className="rank-name">{name}</div>
        <div className="rank-bar">
          <i style={{ width: `${Math.max(4, (count / Math.max(1, max)) * 100)}%` }} />
        </div>
      </div>
      <span className="rank-count">
        {count.toLocaleString("ja-JP")}
        {suffix}
      </span>
    </div>
  );
}
