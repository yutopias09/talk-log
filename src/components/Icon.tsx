import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "overview"
  | "detail"
  | "history"
  | "flame"
  | "clock"
  | "pie"
  | "calendar"
  | "search"
  | "monthly"
  | "compare"
  | "share"
  | "play"
  | "pause"
  | "upload"
  | "sun"
  | "moon"
  | "close"
  | "download"
  | "sparkles"
  | "message"
  | "chevron-right"
  | "chevron-left"
  | "arrow-up"
  | "arrow-down"
  | "check"
  | "info"
  | "users"
  | "file"
  | "refresh"
  | "heart"
  | "zap"
  | "minus"
  | "phone"
  | "link"
  | "gift"
  | "book"
  | "quote"
  | "trash";

const paths: Record<IconName, ReactElement> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.6" />
      <rect x="14" y="3" width="7" height="5" rx="1.6" />
      <rect x="14" y="12" width="7" height="9" rx="1.6" />
      <rect x="3" y="16" width="7" height="5" rx="1.6" />
    </>
  ),
  detail: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  history: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  flame: (
    <path d="M12 22c4.4 0 7.5-2.9 7.5-7.1 0-3.4-2.2-5.6-3.7-7.4C14.4 5.8 13 4.1 13 2c-3.1 1.4-5 4.2-5 7 0 .9.2 1.7.5 2.4-.9-.3-1.6-.9-2.1-1.6-.3 1.1-.9 2.1-.9 3.8C5.5 18.4 8 22 12 22Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pie: (
    <>
      <path d="M21 12A9 9 0 1 1 12 3v9Z" />
      <path d="M15.5 3.6A9 9 0 0 1 20.4 8.5L15.5 10.6Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.4" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  monthly: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  compare: (
    <>
      <path d="M7 3v14a2 2 0 0 0 2 2h12" />
      <path d="m17 5 4 4-4 4" transform="translate(0 -2)" />
      <path d="M17 21V7a2 2 0 0 0-2-2H3" />
      <path d="m7 19-4-4 4-4" transform="translate(0 2)" />
    </>
  ),
  share: (
    <>
      <path d="M12 16V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5Z" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  download: (
    <>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
      <path d="M19 16.5 19.7 18.3 21.5 19l-1.8.7L19 21.5l-.7-1.8L16.5 19l1.8-.7Z" />
    </>
  ),
  message: (
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.2A.5.5 0 0 1 4.6 19.8V17A2.5 2.5 0 0 1 4 15.2Z" />
  ),
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  "chevron-left": <path d="m15 5-7 7 7 7" />,
  "arrow-up": <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  "arrow-down": <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.2 5.2a3.2 3.2 0 0 1 0 6.2M18 14.4a5.6 5.6 0 0 1 3.4 5.1" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  heart: (
    <path d="M12 20.3S3.8 15.4 3.8 9.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.2 2.6c0 5.8-8.2 10.7-8.2 10.7Z" />
  ),
  zap: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12Z" />,
  minus: <path d="M5 12h14" />,
  phone: (
    <path d="M6.6 3.5h2.6l1.4 4.2-1.9 1.3a11.7 11.7 0 0 0 6.3 6.3l1.3-1.9 4.2 1.4v2.6a2.1 2.1 0 0 1-2.3 2.1A16.8 16.8 0 0 1 4.5 5.8 2.1 2.1 0 0 1 6.6 3.5Z" />
  ),
  link: (
    <>
      <path d="M10 14a4.2 4.2 0 0 0 6 0l3.2-3.2a4.2 4.2 0 0 0-6-6L12 6" />
      <path d="M14 10a4.2 4.2 0 0 0-6 0l-3.2 3.2a4.2 4.2 0 0 0 6 6L12 18" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1.2" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8c-1.6-3.6-6-4-6-1.2C6 8 8 8 12 8Zm0 0c1.6-3.6 6-4 6-1.2C18 8 16 8 12 8Z" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
      <path d="M9 8h7" />
    </>
  ),
  quote: (
    <>
      <path d="M5 11h4v6H4v-4.5C4 8.5 5.6 6.4 8.5 6" />
      <path d="M15 11h4v6h-5v-4.5c0-4 1.6-6.1 4.5-6.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7" />
      <path d="M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export function Icon({ name, size = 18, filled, strokeWidth = 1.8, ...rest }: IconProps) {
  const filledNames: IconName[] = ["play", "flame", "moon", "message", "zap", "heart", "sparkles"];
  const isFilled = filled ?? filledNames.includes(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFilled ? "currentColor" : "none"}
      stroke={isFilled ? "none" : "currentColor"}
      strokeWidth={isFilled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
