import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_EMBED_CONFIG,
  mergeEmbedConfig,
  diffFromDefaults,
  type EmbedConfig,
} from "~/utils/embed-config";

interface EmbedSettingsProps {
  project: {
    id: string;
    slug: string;
    company: { slug: string };
    embedConfig?: any;
  };
  baseUrl: string;
}

type SectionKey = "layout" | "header" | "theme" | "filters" | "floorPlan" | "apartment" | "listView" | "navigation" | "branding";

export default function EmbedSettings({ project, baseUrl }: EmbedSettingsProps) {
  const { t } = useTranslation();

  const [config, setConfig] = useState<EmbedConfig>(() =>
    mergeEmbedConfig(project.embedConfig as Partial<EmbedConfig> | null)
  );

  const [activeSection, setActiveSection] = useState<SectionKey>("layout");
  const [copied, setCopied] = useState<string | null>(null);

  // Update a nested config value
  const set = <S extends SectionKey>(section: S, key: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  // Compute diff for compact embed code
  const configDiff = useMemo(() => diffFromDefaults(config), [config]);
  const hasChanges = Object.keys(configDiff).length > 0;

  // Hidden form field value
  const configJson = JSON.stringify(config);

  // Generate embed code snippets
  const companySlug = project.company.slug;
  const projectSlug = project.slug;

  const sdkSnippet = useMemo(() => {
    const opts: string[] = [
      `  target: "vizor-widget",`,
      `  company: "${companySlug}",`,
      `  project: "${projectSlug}",`,
    ];

    // Only include non-default sections
    for (const [section, values] of Object.entries(configDiff)) {
      if (section === "locale") {
        opts.push(`  locale: ${JSON.stringify(values)},`);
      } else {
        const lines = JSON.stringify(values, null, 4)
          .split("\n")
          .map((l, i) => (i === 0 ? l : "  " + l))
          .join("\n");
        opts.push(`  ${section}: ${lines},`);
      }
    }

    return `<div id="vizor-widget"></div>
<script src="${baseUrl}/vizor-embed.js"></script>
<script>
Vizor.init({
${opts.join("\n")}
});
</script>`;
  }, [baseUrl, companySlug, projectSlug, configDiff]);

  const legacySnippet = `<div id="vizor-embed"></div>
<script src="${baseUrl}/embed/${companySlug}/${projectSlug}?target=vizor-embed&width=${config.layout.width}&height=${config.layout.height}"></script>`;

  const iframeSnippet = `<iframe
  src="${baseUrl}/view/${companySlug}/${projectSlug}?embed=1"
  width="${config.layout.width}"
  height="${config.layout.height}"
  style="border:none;border-radius:${config.layout.borderRadius}"
  allowfullscreen
  loading="lazy"
></iframe>`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Section nav ──────────────────────────────────────────────────
  const sections: { key: SectionKey; label: string; icon: string }[] = [
    { key: "layout", label: "Layout", icon: "□" },
    { key: "header", label: "Header", icon: "▬" },
    { key: "theme", label: "Theme", icon: "◐" },
    { key: "filters", label: "Filters", icon: "⚙" },
    { key: "floorPlan", label: "Floor Plan", icon: "⊞" },
    { key: "apartment", label: "Apartment", icon: "🏠" },
    { key: "listView", label: "List View", icon: "☰" },
    { key: "navigation", label: "Navigation", icon: "⇄" },
    { key: "branding", label: "Branding", icon: "✦" },
  ];

  // ── Form helpers ─────────────────────────────────────────────────
  const Toggle = ({ section, field, label }: { section: SectionKey; field: string; label: string }) => (
    <label className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={(config[section] as any)[field]}
        onClick={() => set(section, field, !(config[section] as any)[field])}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          (config[section] as any)[field] ? "bg-brand-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            (config[section] as any)[field] ? "translate-x-4.5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );

  const ColorInput = ({ section, field, label }: { section: SectionKey; field: string; label: string }) => (
    <div className="flex items-center gap-3 py-1">
      <input
        type="color"
        value={(config[section] as any)[field] || "#000000"}
        onChange={(e) => set(section, field, e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-gray-200"
      />
      <div className="flex-1">
        <span className="text-sm text-gray-700">{label}</span>
        <input
          type="text"
          value={(config[section] as any)[field] || ""}
          onChange={(e) => set(section, field, e.target.value)}
          className="input mt-0.5 text-xs"
          placeholder="#000000"
        />
      </div>
    </div>
  );

  const TextInput = ({ section, field, label, placeholder }: { section: SectionKey; field: string; label: string; placeholder?: string }) => (
    <div className="py-1">
      <label className="text-sm text-gray-700">{label}</label>
      <input
        type="text"
        value={(config[section] as any)[field] || ""}
        onChange={(e) => set(section, field, e.target.value)}
        className="input mt-0.5"
        placeholder={placeholder}
      />
    </div>
  );

  const NumberInput = ({ section, field, label, min, max, step }: { section: SectionKey; field: string; label: string; min?: number; max?: number; step?: number }) => (
    <div className="py-1">
      <label className="text-sm text-gray-700">{label}</label>
      <input
        type="number"
        value={(config[section] as any)[field] ?? ""}
        onChange={(e) => set(section, field, e.target.value === "" ? null : Number(e.target.value))}
        className="input mt-0.5"
        min={min}
        max={max}
        step={step}
      />
    </div>
  );

  const SelectInput = ({ section, field, label, options }: { section: SectionKey; field: string; label: string; options: { value: string; label: string }[] }) => (
    <div className="py-1">
      <label className="text-sm text-gray-700">{label}</label>
      <select
        value={(config[section] as any)[field] || options[0]?.value}
        onChange={(e) => set(section, field, e.target.value)}
        className="select mt-0.5"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  // ── Section content ──────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case "layout":
        return (
          <div className="space-y-2">
            <TextInput section="layout" field="width" label="Width" placeholder="100%" />
            <TextInput section="layout" field="height" label="Height" placeholder="800px" />
            <TextInput section="layout" field="maxWidth" label="Max Width" placeholder="none" />
            <TextInput section="layout" field="borderRadius" label="Border Radius" placeholder="12px" />
            <TextInput section="layout" field="boxShadow" label="Box Shadow" placeholder="0 1px 3px rgba(0,0,0,0.1)" />
            <TextInput section="layout" field="padding" label="Padding" placeholder="0" />
          </div>
        );

      case "header":
        return (
          <div className="space-y-2">
            <Toggle section="header" field="show" label="Show Header" />
            <Toggle section="header" field="showProjectName" label="Show Project Name" />
            <Toggle section="header" field="showCompanyName" label="Show Company Name" />
            <Toggle section="header" field="showAddress" label="Show Address" />
            <Toggle section="header" field="showLogo" label="Show Logo" />
            <TextInput section="header" field="logoUrl" label="Custom Logo URL" placeholder="https://..." />
            <Toggle section="header" field="showViewTabs" label="Show View Tabs" />
            <Toggle section="header" field="showLanguageSwitcher" label="Show Language Switcher" />
            <ColorInput section="header" field="backgroundColor" label="Background Color" />
            <ColorInput section="header" field="textColor" label="Text Color" />
          </div>
        );

      case "theme":
        return (
          <div className="space-y-2">
            <ColorInput section="theme" field="primaryColor" label="Primary Color" />
            <ColorInput section="theme" field="backgroundColor" label="Background Color" />
            <ColorInput section="theme" field="cardBackgroundColor" label="Card Background" />
            <ColorInput section="theme" field="cardBorderColor" label="Card Border" />
            <ColorInput section="theme" field="textColor" label="Text Color" />
            <ColorInput section="theme" field="textSecondaryColor" label="Secondary Text Color" />
            <TextInput section="theme" field="fontFamily" label="Font Family" placeholder="Inter, system-ui, sans-serif" />
            <TextInput section="theme" field="fontSize" label="Font Size" placeholder="14px" />
            <TextInput section="theme" field="borderRadius" label="Border Radius" placeholder="12px" />
          </div>
        );

      case "filters":
        return (
          <div className="space-y-2">
            <Toggle section="filters" field="show" label="Show Filter Bar" />
            <Toggle section="filters" field="showRoomFilter" label="Show Room Filter" />
            <Toggle section="filters" field="showPriceFilter" label="Show Price Filter" />
            <Toggle section="filters" field="showStatusFilter" label="Show Status Filter" />
            <NumberInput section="filters" field="defaultRooms" label="Default Rooms" min={1} max={10} step={0.5} />
            <NumberInput section="filters" field="defaultMinPrice" label="Default Min Price" min={0} />
            <NumberInput section="filters" field="defaultMaxPrice" label="Default Max Price" min={0} />
            <div className="py-1">
              <label className="text-sm text-gray-700">Default Statuses</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["AVAILABLE", "RESERVED", "SOLD"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const current = config.filters.defaultStatuses;
                      const updated = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
                      set("filters", "defaultStatuses", updated);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      config.filters.defaultStatuses.includes(s)
                        ? "border-gray-300 bg-white text-gray-900 shadow-sm"
                        : "border-transparent bg-gray-100 text-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "floorPlan":
        return (
          <div className="space-y-2">
            <Toggle section="floorPlan" field="showZoomControls" label="Show Zoom Controls" />
            <NumberInput section="floorPlan" field="defaultZoom" label="Default Zoom" min={0.5} max={3} step={0.1} />
            <NumberInput section="floorPlan" field="polygonOpacity" label="Polygon Opacity" min={0} max={1} step={0.05} />
            <NumberInput section="floorPlan" field="polygonHoverOpacity" label="Hover Opacity" min={0} max={1} step={0.05} />
            <SelectInput section="floorPlan" field="tooltipStyle" label="Tooltip Style" options={[
              { value: "modern", label: "Modern" },
              { value: "minimal", label: "Minimal" },
              { value: "detailed", label: "Detailed" },
            ]} />
            <SelectInput section="floorPlan" field="tooltipShape" label="Tooltip Shape" options={[
              { value: "rounded", label: "Rounded" },
              { value: "rectangular", label: "Rectangular" },
            ]} />
          </div>
        );

      case "apartment":
        return (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Visibility</p>
            <Toggle section="apartment" field="showPrice" label="Show Price" />
            <Toggle section="apartment" field="showPricePerSqm" label="Show Price/m²" />
            <Toggle section="apartment" field="showArea" label="Show Area" />
            <Toggle section="apartment" field="showRooms" label="Show Rooms" />
            <Toggle section="apartment" field="showFloorPlan" label="Show Floor Plan" />
            <Toggle section="apartment" field="showFeatures" label="Show Features" />
            <Toggle section="apartment" field="showDescription" label="Show Description" />
            <Toggle section="apartment" field="showShareButton" label="Show Share Button" />
            <Toggle section="apartment" field="showRequestForm" label="Show Request Form" />
            <Toggle section="apartment" field="showDetailLink" label="Show Detail Link" />
            <div className="border-t border-gray-100 mt-3 pt-3" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Behavior</p>
            <SelectInput section="apartment" field="clickAction" label="Click Action" options={[
              { value: "modal", label: "Open Modal" },
              { value: "panel", label: "Side Panel" },
              { value: "callback", label: "Send to Parent (postMessage)" },
            ]} />
            <TextInput section="apartment" field="detailLinkPattern" label="Detail Link Pattern" placeholder="https://yoursite.com/property/{id}" />
            <TextInput section="apartment" field="requestFormWebhook" label="Request Form Webhook URL" placeholder="https://yoursite.com/api/request" />
          </div>
        );

      case "listView":
        return (
          <div className="space-y-2">
            <SelectInput section="listView" field="defaultMode" label="Default Mode" options={[
              { value: "grid", label: "Grid" },
              { value: "table", label: "Table" },
            ]} />
            <Toggle section="listView" field="showNumber" label="Show Number" />
            <Toggle section="listView" field="showFloor" label="Show Floor" />
            <Toggle section="listView" field="showRooms" label="Show Rooms" />
            <Toggle section="listView" field="showArea" label="Show Area" />
            <Toggle section="listView" field="showPrice" label="Show Price" />
            <Toggle section="listView" field="showStatus" label="Show Status" />
            <NumberInput section="listView" field="pageSize" label="Page Size" min={10} max={200} />
            <SelectInput section="listView" field="defaultSort" label="Default Sort" options={[
              { value: "number", label: "Number" },
              { value: "price", label: "Price" },
              { value: "area", label: "Area" },
              { value: "rooms", label: "Rooms" },
              { value: "floor", label: "Floor" },
            ]} />
            <SelectInput section="listView" field="defaultSortDirection" label="Sort Direction" options={[
              { value: "asc", label: "Ascending" },
              { value: "desc", label: "Descending" },
            ]} />
          </div>
        );

      case "navigation":
        return (
          <div className="space-y-2">
            <SelectInput section="navigation" field="defaultView" label="Default View" options={[
              { value: "interactive", label: "Interactive Floor Plans" },
              { value: "list", label: "Apartment List" },
            ]} />
            <Toggle section="navigation" field="showBuildingSelector" label="Show Building Selector" />
            <Toggle section="navigation" field="showFloorSelector" label="Show Floor Selector" />
            <Toggle section="navigation" field="showBreadcrumbs" label="Show Breadcrumbs" />
            <Toggle section="navigation" field="showLegend" label="Show Legend" />
            <NumberInput section="navigation" field="autoSelectBuilding" label="Auto-Select Building (index)" min={0} max={20} />
            <NumberInput section="navigation" field="autoSelectFloor" label="Auto-Select Floor (number)" min={-5} max={100} />
          </div>
        );

      case "branding":
        return (
          <div className="space-y-2">
            <Toggle section="branding" field="showPoweredBy" label='Show "Powered by Vizor"' />
            <TextInput section="branding" field="customFontUrl" label="Custom Font URL" placeholder="https://fonts.googleapis.com/css2?family=..." />
            <div className="py-1">
              <label className="text-sm text-gray-700">Custom CSS</label>
              <textarea
                value={config.branding.customCss}
                onChange={(e) => set("branding", "customCss", e.target.value)}
                className="input mt-0.5 font-mono text-xs"
                rows={4}
                placeholder={`.card { border-radius: 8px; }\n.btn-primary { background: #e11d48; }`}
              />
            </div>
            <div className="py-1">
              <label className="text-sm text-gray-700">Locale</label>
              <select
                value={config.locale}
                onChange={(e) => setConfig((prev) => ({ ...prev, locale: e.target.value }))}
                className="select mt-0.5"
              >
                <option value="en">English</option>
                <option value="bg">Български</option>
              </select>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden form field for saving */}
      <input type="hidden" name="embedConfig" value={configJson} />

      {/* Settings panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Section tabs */}
        <div className="lg:col-span-3">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {sections.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === s.key
                    ? "bg-brand-50 text-brand-700 border border-brand-200"
                    : "text-gray-600 hover:bg-gray-50 border border-transparent"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings form */}
        <div className="lg:col-span-4">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 capitalize">
              {sections.find((s) => s.key === activeSection)?.label} Settings
            </h4>
            {renderSection()}
          </div>
        </div>

        {/* Preview & code */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live preview */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="bg-gray-800 px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-400 ml-2">Preview</span>
            </div>
            <div className="p-4 bg-gray-100">
              <div
                className="mx-auto overflow-hidden transition-all"
                style={{
                  maxWidth: config.layout.maxWidth !== "none" ? config.layout.maxWidth : "100%",
                  borderRadius: config.layout.borderRadius,
                  boxShadow: config.layout.boxShadow,
                  backgroundColor: config.theme.backgroundColor,
                  fontFamily: config.theme.fontFamily || undefined,
                }}
              >
                {/* Mini header preview */}
                {config.header.show && (
                  <div
                    className="px-3 py-2 flex items-center justify-between border-b"
                    style={{
                      backgroundColor: config.header.backgroundColor,
                      borderColor: config.theme.cardBorderColor,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {config.header.showLogo && (
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: config.theme.primaryColor }}
                        >
                          V
                        </div>
                      )}
                      <div>
                        {config.header.showProjectName && (
                          <div className="text-sm font-bold" style={{ color: config.header.textColor }}>
                            Project Name
                          </div>
                        )}
                        <div className="text-[10px]" style={{ color: config.theme.textSecondaryColor }}>
                          {config.header.showCompanyName && "Company"}
                          {config.header.showAddress && " · City, Street 1"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.header.showViewTabs && (
                        <div className="flex bg-gray-100 rounded p-0.5 text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-white shadow text-brand-700 font-medium">Floor Plans</span>
                          <span className="px-2 py-0.5 text-gray-500">List</span>
                        </div>
                      )}
                      {config.header.showLanguageSwitcher && (
                        <span className="text-[10px] text-gray-400 border rounded px-1.5 py-0.5">EN</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Mini content preview */}
                <div className="p-3 space-y-2">
                  {config.filters.show && (
                    <div
                      className="rounded-lg border p-2 flex gap-2"
                      style={{
                        backgroundColor: config.theme.cardBackgroundColor,
                        borderColor: config.theme.cardBorderColor,
                      }}
                    >
                      {config.filters.showRoomFilter && (
                        <div className="bg-gray-100 rounded px-2 py-1 text-[10px] text-gray-500">Rooms ▾</div>
                      )}
                      {config.filters.showPriceFilter && (
                        <>
                          <div className="bg-gray-100 rounded px-2 py-1 text-[10px] text-gray-500">Min-Max €</div>
                        </>
                      )}
                      {config.filters.showStatusFilter && (
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-400 mt-1.5" />
                          <span className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5" />
                          <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {/* Floor plan mockup */}
                    <div
                      className="rounded-lg border p-3 h-28 flex items-center justify-center"
                      style={{
                        backgroundColor: config.theme.cardBackgroundColor,
                        borderColor: config.theme.cardBorderColor,
                      }}
                    >
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400">Interactive Floor Plan</div>
                        <div className="mt-1 flex gap-1 justify-center">
                          <div className="w-6 h-8 rounded" style={{ backgroundColor: config.theme.primaryColor, opacity: config.floorPlan.polygonOpacity }} />
                          <div className="w-8 h-8 rounded bg-green-400" style={{ opacity: config.floorPlan.polygonOpacity }} />
                          <div className="w-5 h-8 rounded bg-red-400" style={{ opacity: config.floorPlan.polygonOpacity }} />
                        </div>
                      </div>
                    </div>

                    {/* Side panel mockup */}
                    <div
                      className="rounded-lg border p-2 space-y-1.5"
                      style={{
                        backgroundColor: config.theme.cardBackgroundColor,
                        borderColor: config.theme.cardBorderColor,
                      }}
                    >
                      <div className="text-xs font-semibold" style={{ color: config.theme.textColor }}>Apt 101</div>
                      <div className="flex gap-1">
                        {config.apartment.showRooms && <div className="bg-gray-50 rounded px-1.5 py-0.5 text-[10px]">2 rooms</div>}
                        {config.apartment.showArea && <div className="bg-gray-50 rounded px-1.5 py-0.5 text-[10px]">65m²</div>}
                      </div>
                      {config.apartment.showPrice && (
                        <div className="text-xs font-bold" style={{ color: config.theme.primaryColor }}>€95,000</div>
                      )}
                      {config.apartment.showRequestForm && (
                        <div
                          className="text-center text-[10px] text-white rounded py-1"
                          style={{ backgroundColor: config.theme.primaryColor }}
                        >
                          Request Info
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Legend mockup */}
                  {config.navigation.showLegend && (
                    <div className="flex gap-3 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400" />Available</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-400" />Reserved</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" />Sold</span>
                    </div>
                  )}

                  {config.branding.showPoweredBy && (
                    <div className="text-center text-[10px] text-gray-300 pt-1">Powered by Vizor</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Code snippets */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Embed Code</h4>
                {hasChanges && (
                  <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-medium">
                    Customized
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {/* SDK method */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    Recommended: SDK
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sdkSnippet, "sdk")}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    {copied === "sdk" ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre">{sdkSnippet}</pre>
              </div>

              {/* Legacy script method */}
              <details className="group">
                <summary className="px-4 py-2.5 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                  Alternative: Script Tag
                </summary>
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Uses stored config from dashboard</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(legacySnippet, "legacy")}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {copied === "legacy" ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre">{legacySnippet}</pre>
                </div>
              </details>

              {/* Iframe method */}
              <details className="group">
                <summary className="px-4 py-2.5 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                  Alternative: iFrame
                </summary>
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Direct iframe embed</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(iframeSnippet, "iframe")}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {copied === "iframe" ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre">{iframeSnippet}</pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
