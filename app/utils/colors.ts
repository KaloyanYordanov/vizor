
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

export function getStatusColor(
  status: string,
  colors: { available?: string; reserved?: string; sold?: string; unavailable?: string },
  alpha = 0.4
) {
  const map: Record<string, string | undefined> = {
    AVAILABLE: colors.available,
    RESERVED: colors.reserved,
    SOLD: colors.sold,
    UNAVAILABLE: colors.unavailable,
  };

  const base = map[status] || colors.unavailable || "#9ca3af";
  return ensureRgba(base, alpha);
}
