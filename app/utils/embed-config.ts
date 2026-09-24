/* ─── Embed Configuration ─────────────────────────────────────────────
 * Complete configuration schema for embedding Vizor viewers in external
 * websites. Covers layout, theming, visibility, behaviour, and branding.
 *
 * Priority chain:  DB defaults  →  SDK overrides  →  URL param overrides
 * ──────────────────────────────────────────────────────────────────── */

// ── Sub-types ────────────────────────────────────────────────────────

export interface EmbedLayoutConfig {
  width: string;
  height: string;
  maxWidth: string;
  borderRadius: string;
  boxShadow: string;
  padding: string;
}

export interface EmbedHeaderConfig {
  show: boolean;
  showProjectName: boolean;
  showCompanyName: boolean;
  showAddress: boolean;
  showLogo: boolean;
  logoUrl: string;
  showViewTabs: boolean;
  showLanguageSwitcher: boolean;
  backgroundColor: string;
  textColor: string;
}

export interface EmbedThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  textColor: string;
  textSecondaryColor: string;
  fontFamily: string;
  fontSize: string;
  borderRadius: string;
}

export interface EmbedFilterConfig {
  show: boolean;
  showRoomFilter: boolean;
  showPriceFilter: boolean;
  showStatusFilter: boolean;
  defaultRooms: number | null;
  defaultMinPrice: number | null;
  defaultMaxPrice: number | null;
  defaultStatuses: string[];
}

export interface EmbedFloorPlanConfig {
  showZoomControls: boolean;
  defaultZoom: number;
  polygonOpacity: number;
  polygonHoverOpacity: number;
  tooltipStyle: "modern" | "minimal" | "detailed";
  tooltipShape: "rounded" | "rectangular";
}

export interface EmbedApartmentConfig {
  showPrice: boolean;
  showPricePerSqm: boolean;
  showArea: boolean;
  showRooms: boolean;
  showFloorPlan: boolean;
  showFeatures: boolean;
  showDescription: boolean;
  showShareButton: boolean;
  showRequestForm: boolean;
  showDetailLink: boolean;
  /** "modal" opens the built-in modal, "panel" shows inline side panel, "callback" fires parent postMessage */
  clickAction: "modal" | "panel" | "callback";
  /** External URL pattern for detail link. Use {id} placeholder. Leave empty for default. */
  detailLinkPattern: string;
  /** URL to post request-form submissions to (empty = console log only) */
  requestFormWebhook: string;
}

export interface EmbedListViewConfig {
  defaultMode: "grid" | "table";
  showNumber: boolean;
  showFloor: boolean;
  showRooms: boolean;
  showArea: boolean;
  showPrice: boolean;
  showStatus: boolean;
  pageSize: number;
  defaultSort: "number" | "price" | "area" | "rooms" | "floor";
  defaultSortDirection: "asc" | "desc";
}

export interface EmbedNavigationConfig {
  defaultView: "interactive" | "list";
  showBuildingSelector: boolean;
  showFloorSelector: boolean;
  showBreadcrumbs: boolean;
  showLegend: boolean;
  autoSelectBuilding: number | null;
  autoSelectFloor: number | null;
}

export interface EmbedBrandingConfig {
  showPoweredBy: boolean;
  customCss: string;
  customFontUrl: string;
}

// ── Main config type ─────────────────────────────────────────────────

export interface EmbedConfig {
  layout: EmbedLayoutConfig;
  header: EmbedHeaderConfig;
  theme: EmbedThemeConfig;
  filters: EmbedFilterConfig;
  floorPlan: EmbedFloorPlanConfig;
  apartment: EmbedApartmentConfig;
  listView: EmbedListViewConfig;
  navigation: EmbedNavigationConfig;
  branding: EmbedBrandingConfig;
  /** Default locale key ("en", "bg", etc.) */
  locale: string;
}

// ── Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_EMBED_CONFIG: EmbedConfig = {
  layout: {
    width: "100%",
    height: "800px",
    maxWidth: "none",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    padding: "0",
  },
  header: {
    show: true,
    showProjectName: true,
    showCompanyName: true,
    showAddress: true,
    showLogo: true,
    logoUrl: "",
    showViewTabs: true,
    showLanguageSwitcher: true,
    backgroundColor: "#ffffff",
    textColor: "#111827",
  },
  theme: {
    primaryColor: "#3b82f6",
    backgroundColor: "#f9fafb",
    cardBackgroundColor: "#ffffff",
    cardBorderColor: "#e5e7eb",
    textColor: "#111827",
    textSecondaryColor: "#6b7280",
    fontFamily: "",
    fontSize: "14px",
    borderRadius: "12px",
  },
  filters: {
    show: true,
    showRoomFilter: true,
    showPriceFilter: true,
    showStatusFilter: true,
    defaultRooms: null,
    defaultMinPrice: null,
    defaultMaxPrice: null,
    defaultStatuses: ["AVAILABLE", "RESERVED", "SOLD"],
  },
  floorPlan: {
    showZoomControls: true,
    defaultZoom: 1,
    polygonOpacity: 0.4,
    polygonHoverOpacity: 0.6,
    tooltipStyle: "modern",
    tooltipShape: "rounded",
  },
  apartment: {
    showPrice: true,
    showPricePerSqm: true,
    showArea: true,
    showRooms: true,
    showFloorPlan: true,
    showFeatures: true,
    showDescription: true,
    showShareButton: true,
    showRequestForm: true,
    showDetailLink: true,
    clickAction: "modal",
    detailLinkPattern: "",
    requestFormWebhook: "",
  },
  listView: {
    defaultMode: "grid",
    showNumber: true,
    showFloor: true,
    showRooms: true,
    showArea: true,
    showPrice: true,
    showStatus: true,
    pageSize: 50,
    defaultSort: "number",
    defaultSortDirection: "asc",
  },
  navigation: {
    defaultView: "interactive",
    showBuildingSelector: true,
    showFloorSelector: true,
    showBreadcrumbs: true,
    showLegend: true,
    autoSelectBuilding: null,
    autoSelectFloor: null,
  },
  branding: {
    showPoweredBy: true,
    customCss: "",
    customFontUrl: "",
  },
  locale: "en",
};

// ── Utilities ────────────────────────────────────────────────────────

/** Deep-merge one or more partial configs over the defaults, in priority order. */
export function mergeEmbedConfig(
  ...partials: Array<Partial<EmbedConfig> | null | undefined>
): EmbedConfig {
  return partials.reduce<EmbedConfig>((current, partial) => {
    if (!partial) return current;

    return {
      layout: { ...current.layout, ...(partial.layout ?? {}) },
      header: { ...current.header, ...(partial.header ?? {}) },
      theme: { ...current.theme, ...(partial.theme ?? {}) },
      filters: { ...current.filters, ...(partial.filters ?? {}) },
      floorPlan: { ...current.floorPlan, ...(partial.floorPlan ?? {}) },
      apartment: { ...current.apartment, ...(partial.apartment ?? {}) },
      listView: { ...current.listView, ...(partial.listView ?? {}) },
      navigation: { ...current.navigation, ...(partial.navigation ?? {}) },
      branding: { ...current.branding, ...(partial.branding ?? {}) },
      locale: partial.locale ?? current.locale,
    };
  }, {
    layout: { ...DEFAULT_EMBED_CONFIG.layout },
    header: { ...DEFAULT_EMBED_CONFIG.header },
    theme: { ...DEFAULT_EMBED_CONFIG.theme },
    filters: {
      ...DEFAULT_EMBED_CONFIG.filters,
      defaultStatuses: [...DEFAULT_EMBED_CONFIG.filters.defaultStatuses],
    },
    floorPlan: { ...DEFAULT_EMBED_CONFIG.floorPlan },
    apartment: { ...DEFAULT_EMBED_CONFIG.apartment },
    listView: { ...DEFAULT_EMBED_CONFIG.listView },
    navigation: { ...DEFAULT_EMBED_CONFIG.navigation },
    branding: { ...DEFAULT_EMBED_CONFIG.branding },
    locale: DEFAULT_EMBED_CONFIG.locale,
  });
}

/**
 * Encode an embed config as a URL-safe base64 string.
 * Only includes non-default values to keep URLs short.
 */
export function encodeEmbedConfig(config: Partial<EmbedConfig>): string {
  const json = JSON.stringify(config);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64url");
  }
  return btoa(json);
}

/** Decode a base64url-encoded embed config string. */
export function decodeEmbedConfig(encoded: string): Partial<EmbedConfig> {
  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(encoded, "base64url").toString("utf-8");
    } else {
      json = atob(encoded);
    }
    return JSON.parse(json) as Partial<EmbedConfig>;
  } catch {
    return {};
  }
}

/**
 * Compute only the values that differ from defaults (for compact serialization).
 */
export function diffFromDefaults(config: EmbedConfig): Partial<EmbedConfig> {
  const diff: Record<string, any> = {};
  const d = DEFAULT_EMBED_CONFIG;

  for (const section of Object.keys(d) as (keyof EmbedConfig)[]) {
    if (section === "locale") {
      if (config.locale !== d.locale) diff.locale = config.locale;
      continue;
    }
    const sectionDiff: Record<string, any> = {};
    const defaultSection = d[section] as Record<string, any>;
    const configSection = config[section] as Record<string, any>;
    let hasDiff = false;

    for (const key of Object.keys(defaultSection)) {
      const dv = defaultSection[key];
      const cv = configSection[key];
      if (Array.isArray(dv)) {
        if (JSON.stringify(dv) !== JSON.stringify(cv)) {
          sectionDiff[key] = cv;
          hasDiff = true;
        }
      } else if (dv !== cv) {
        sectionDiff[key] = cv;
        hasDiff = true;
      }
    }
    if (hasDiff) diff[section] = sectionDiff;
  }
  return diff as Partial<EmbedConfig>;
}
