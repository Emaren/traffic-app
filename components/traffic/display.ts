export function flagFromCountryCode(countryCode?: string): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) {
    return "";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function withFlag(countryCode: string | undefined, label: string): string {
  const flag = flagFromCountryCode(countryCode);
  return flag ? `${flag} ${label}` : label;
}

type VisitorLocationFields = {
  city?: string | null;
  area?: string | null;
  country?: string | null;
};

export function formatVisitorLocation(
  location: VisitorLocationFields,
  fallback = "Location pending",
): string {
  const parts = [location.city, location.area, location.country].flatMap((value) => {
    const cleaned = value?.trim();
    return cleaned && cleaned.toLowerCase() !== "unknown" ? [cleaned] : [];
  });

  return parts.length > 0 ? parts.join(", ") : fallback;
}

export type KnownVisitor = {
  label: string;
  detail: string;
  tone: "owner" | "family" | "known_player" | "known_human" | "known_automation" | "crawler";
  confirmed?: boolean;
};

type KnownVisitorSource = {
  ip?: string | null;
  known_visitor_label?: string | null;
  known_visitor_detail?: string | null;
  known_visitor_kind?: string | null;
  known_visitor_confirmed?: boolean | null;
};

const KNOWN_VISITORS_BY_IP: Record<string, KnownVisitor> = {
  "172.219.42.87": {
    label: "Tony",
    detail: "owner",
    tone: "owner",
  },
  "104.28.116.13": {
    label: "Tony",
    detail: "owner",
    tone: "owner",
  },
  "104.28.116.14": {
    label: "Tony",
    detail: "owner",
    tone: "owner",
  },
  "187.137.98.115": {
    label: "Julio",
    detail: "known player",
    tone: "known_player",
  },
  "174.90.223.103": {
    label: "Joe",
    detail: "likely family",
    tone: "known_player",
  },
  "68.131.37.96": {
    label: "Jim",
    detail: "known player",
    tone: "known_player",
  },
};

export function knownVisitorForIp(ip?: string | null): KnownVisitor | null {
  const cleaned = ip?.trim();
  if (!cleaned) return null;

  return KNOWN_VISITORS_BY_IP[cleaned] ?? null;
}

function knownVisitorToneForKind(kind?: string | null): KnownVisitor["tone"] {
  switch ((kind || "").trim()) {
    case "owner":
      return "owner";
    case "family":
      return "family";
    case "known_player":
      return "known_player";
    case "known_automation":
      return "known_automation";
    case "crawler":
      return "crawler";
    default:
      return "known_human";
  }
}

export function knownVisitorForSession(source?: KnownVisitorSource | null): KnownVisitor | null {
  const label = source?.known_visitor_label?.trim();

  if (label) {
    const detail = source?.known_visitor_detail?.trim() || "known visitor";

    return {
      label,
      detail,
      tone: knownVisitorToneForKind(source?.known_visitor_kind),
      confirmed: Boolean(source?.known_visitor_confirmed),
    };
  }

  return knownVisitorForIp(source?.ip);
}

export function knownVisitorChipClassName(visitor: KnownVisitor): string {
  const tone =
    visitor.tone === "owner"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : visitor.tone === "family"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : visitor.tone === "known_automation" || visitor.tone === "crawler"
          ? "border-zinc-400/30 bg-zinc-400/10 text-zinc-200"
          : "border-sky-400/30 bg-sky-400/10 text-sky-200";

  return `rounded-full border px-2.5 py-1 font-medium ${tone}`;
}

export function knownVisitorChipLabel(visitor: KnownVisitor): string {
  return `${visitor.label} · ${visitor.detail}`;
}
