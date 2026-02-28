/* ─── Canonical status hex values ────────────────────────────────────
 * Must match the `status.*` tokens in tailwind.config.ts.
 * Every component that needs a status color should import from here.
 * ──────────────────────────────────────────────────────────────────── */

/** Raw hex colours for the four apartment statuses */
export const STATUS_HEX = {
  AVAILABLE: "#22c55e",
  RESERVED: "#f59e0b",
  SOLD: "#ef4444",
  UNAVAILABLE: "#9ca3af",
} as const;

/** Default viewer / interactive-plan stroke settings */
export const DEFAULT_VIEWER_COLORS = {
  available: STATUS_HEX.AVAILABLE,
  reserved: STATUS_HEX.RESERVED,
  sold: STATUS_HEX.SOLD,
  unavailable: STATUS_HEX.UNAVAILABLE,
  stroke: "#1e293b",
  strokeWidth: 2,
} as const;

/** Default project-level settings (server + preview fallback) */
export const DEFAULT_PROJECT_SETTINGS = {
  currencySymbol: "€",
  areaUnit: "m²",
  primaryColor: "#3b82f6",
  availableColor: STATUS_HEX.AVAILABLE,
  reservedColor: STATUS_HEX.RESERVED,
  soldColor: STATUS_HEX.SOLD,
  unavailableColor: STATUS_HEX.UNAVAILABLE,
  strokeColor: "#1e293b",
  strokeWidth: 2,
  tooltipStyle: "modern" as const,
};

/**
 * Tailwind-class config for status badges / cards.
 * Keyed by uppercase status string so usage is `STATUS_UI[apt.status]`.
 */
export const STATUS_UI: Record<
  string,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  AVAILABLE: {
    label: "Available",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  RESERVED: {
    label: "Reserved",
    text: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
  },
  SOLD: {
    label: "Sold",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    text: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-gray-200",
    dot: "bg-gray-400",
  },
};

/* ─── Colour math helpers ─────────────────────────────────────────── */

/**
 * Ensure a color string is returned as rgba(..., alpha).
 * - accepts hex (#rrggbb / #rgb), rgb(...), rgba(...)
 * - if input is unrecognized, returns the original string (can't safely apply alpha)
 */
export function ensureRgba(color: string | undefined, alpha = 1) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  const c = color.trim();

  // hex (#rgb or #rrggbb)
  if (c.startsWith("#")) {
    const clean = c.replace(/^#/, "");
    const normalized = clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean;
    const int = parseInt(normalized, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // already rgb/rgba
  const m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map((s) => s.trim());
    const r = parseInt(parts[0], 10) || 0;
    const g = parseInt(parts[1], 10) || 0;
    const b = parseInt(parts[2], 10) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // unknown format (CSS var, named color, etc.) — return as-is
  return c;
}

/** Return an rgba fill for a given apartment status. */
export function getStatusColor(
  status: string,
  colors: { available?: string; reserved?: string; sold?: string; unavailable?: string } = {},
  alpha = 0.4,
) {
  const map: Record<string, string | undefined> = {
    AVAILABLE: colors.available,
    RESERVED: colors.reserved,
    SOLD: colors.sold,
    UNAVAILABLE: colors.unavailable,
  };

  const base = map[status] || colors.unavailable || STATUS_HEX.UNAVAILABLE;
  return ensureRgba(base, alpha);
}

/** Return the solid hex stroke colour for a given apartment status. */
export function getStatusStroke(
  status: string,
  colors: { available?: string; reserved?: string; sold?: string; unavailable?: string } = {},
) {
  const map: Record<string, string | undefined> = {
    AVAILABLE: colors.available,
    RESERVED: colors.reserved,
    SOLD: colors.sold,
    UNAVAILABLE: colors.unavailable,
  };
  return map[status] || colors.unavailable || STATUS_HEX.UNAVAILABLE;
}
