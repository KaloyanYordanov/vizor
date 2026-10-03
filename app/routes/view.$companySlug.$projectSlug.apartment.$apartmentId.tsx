import { ApartmentVisualisationGallery } from "~/components/visualisations/ApartmentVisualisationGallery";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { STATUS_UI } from "~/utils/colors";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "~/components/LanguageSwitcher";
import { publicVisualisations } from "~/lib/visualisations/service.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Apartment | Vizor" }];
  const { apartment, project } = data;
  return [
    { title: `${apartment.number} — ${project.name} | Vizor` },
    {
      name: "description",
      content: `${apartment.rooms} rooms · ${apartment.area} m² — ${project.name}`,
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { companySlug, projectSlug, apartmentId } = params;

  const apartment: any = await (prisma.apartment as any).findUnique({
    where: { id: apartmentId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      floor: {
        include: {
          apartments: {
            select: { id: true, number: true },
            orderBy: { number: "asc" },
          },
          building: {
            include: {
              project: {
                include: {
                  company: { select: { name: true, slug: true, logo: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!apartment) throw new Response("Apartment not found", { status: 404 });

  const project = apartment.floor.building.project;
  if (project.company.slug !== companySlug || project.slug !== projectSlug) {
    throw new Response("Apartment not found", { status: 404 });
  }

  // Compute siblings for prev/next navigation
  const siblings = apartment.floor.apartments;
  const currentIdx = siblings.findIndex((a: any) => a.id === apartment.id);
  const prevApt = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextApt = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;
  const visualisations = await publicVisualisations(apartment.id);

  return json({ apartment, project, prevApt, nextApt, visualisations });
}

export default function ApartmentPage() {
  const { apartment, project, prevApt, nextApt, visualisations } = useLoaderData<typeof loader>() as any;
  const { t } = useTranslation();
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const currencySymbol = project.currencySymbol ?? "€";
  const areaUnit = project.areaUnit ?? "m²";
  const building = apartment.floor.building;
  const sc = STATUS_UI[apartment.status] || STATUS_UI.UNAVAILABLE;

  // Build gallery from floor plan + apartment images
  const gallery = useMemo(() => {
    const imgs: Array<{ url: string; caption: string }> = [];
    if (apartment.floorPlanUrl) {
      imgs.push({ url: apartment.floorPlanUrl, caption: t("apartment.floorPlan") });
    }
    for (const img of apartment.images) {
      imgs.push({ url: img.url, caption: img.caption || "" });
    }
    return imgs;
  }, [apartment.floorPlanUrl, apartment.images, t]);

  // Features parsed
  const features = useMemo(() => {
    if (!apartment.features) return {};
    try {
      return JSON.parse(apartment.features);
    } catch {
      return {};
    }
  }, [apartment.features]);
  const featureEntries = Object.entries(features).filter(([, v]) => v);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i + gallery.length - 1) % gallery.length);
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i + 1) % gallery.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, gallery.length]);

  // Touch swipe support for lightbox
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 50;
    if (dx > threshold) setLightboxIndex((i) => (i + gallery.length - 1) % gallery.length);
    else if (dx < -threshold) setLightboxIndex((i) => (i + 1) % gallery.length);
    touchStartX.current = null;
  }, [gallery.length]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
  }, []);

  const viewerUrl = `/view/${project.company.slug}/${project.slug}?building=${building.slug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {project.company.logo && (
              <img src={project.company.logo} alt="" className="h-8 w-auto" />
            )}
            <div className="text-sm">
              <Link to={viewerUrl} className="text-brand-600 hover:text-brand-700 font-medium">
                ← {project.name}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Prev / Next navigation */}
            <div className="flex items-center gap-1">
              {prevApt ? (
                <Link
                  to={`/view/${project.company.slug}/${project.slug}/apartment/${prevApt.id}`}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  title={`${t("apartment.apt")} ${prevApt.number}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
              ) : (
                <span className="p-1.5 text-gray-300"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></span>
              )}
              {nextApt ? (
                <Link
                  to={`/view/${project.company.slug}/${project.slug}/apartment/${nextApt.id}`}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  title={`${t("apartment.apt")} ${nextApt.number}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <span className="p-1.5 text-gray-300"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></span>
              )}
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column — Gallery */}
          <div className="lg:col-span-8 space-y-4">
            <ApartmentVisualisationGallery
              apartmentId={apartment.id}
              initialItems={visualisations}
            />
            {gallery.length > 0 ? (
              <>
                {/* Main image */}
                <div
                  className="aspect-[4/3] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm cursor-zoom-in"
                  onClick={() => { setLightboxIndex(activeImageIdx); setLightboxOpen(true); }}
                >
                  <img
                    src={gallery[activeImageIdx]?.url}
                    alt={gallery[activeImageIdx]?.caption || `${t("apartment.apartment")} ${apartment.number}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Caption */}
                {gallery[activeImageIdx]?.caption && (
                  <p className="text-sm text-gray-500 text-center">{gallery[activeImageIdx].caption}</p>
                )}
                {/* Thumbnails */}
                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIdx(idx)}
                        className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                          idx === activeImageIdx
                            ? "border-brand-500"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <img src={img.url} alt={img.caption || ""} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : visualisations.length === 0 ? (
              <div className="aspect-[4/3] bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">{t("apartment.noImages")}</p>
                </div>
              </div>
            ) : null}

            {lightboxOpen && (
              <div
                className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
                onClick={(e) => { if (e.target === e.currentTarget) setLightboxOpen(false); }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <button
                  className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  onClick={() => setLightboxOpen(false)}
                >
                  ×
                </button>
                {gallery.length > 1 && (
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl z-10 w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    onClick={() => setLightboxIndex((i) => (i + gallery.length - 1) % gallery.length)}
                  >
                    ‹
                  </button>
                )}
                <img
                  src={gallery[lightboxIndex]?.url}
                  alt={gallery[lightboxIndex]?.caption || ""}
                  className="max-h-[90vh] max-w-[90vw] object-contain select-none"
                  draggable={false}
                />
                {gallery.length > 1 && (
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-4xl z-10 w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    onClick={() => setLightboxIndex((i) => (i + 1) % gallery.length)}
                  >
                    ›
                  </button>
                )}
                {/* Counter */}
                {gallery.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
                    {lightboxIndex + 1} / {gallery.length}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — Details */}
          <div className="lg:col-span-4 space-y-6 text-sm">
            {/* Title & status */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold">
                  {t("apartment.apartment")} {apartment.number}
                </h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                  {t(`status.${apartment.status.toLowerCase()}`)}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {building.name} · {t("floor.floorN", { n: apartment.floor.number })}
                {apartment.floor.label && ` (${apartment.floor.label})`}
              </p>
            </div>

            {/* Price card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{t("apartment.price")}</p>
                  <p className="text-3xl font-bold text-brand-700">
                    {apartment.price
                      ? `${currencySymbol}${apartment.price.toLocaleString()}`
                      : t("apartment.onRequest")}
                  </p>
                </div>
                {apartment.pricePerSqm && (
                  <p className="text-sm text-gray-400">
                    {currencySymbol}{apartment.pricePerSqm.toLocaleString()}/{areaUnit}
                  </p>
                )}
              </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t("apartment.rooms")}</p>
                <p className="text-2xl font-bold mt-1">{apartment.rooms}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t("apartment.area")}</p>
                <p className="text-2xl font-bold mt-1">{apartment.area} <span className="text-base font-normal text-gray-400">{areaUnit}</span></p>
              </div>
            </div>

            {/* Description */}
            {apartment.description && (
              <div>
                <h3 className="text-xs font-semibold text-gray-900 mb-2">{t("common.description")}</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{apartment.description}</p>
              </div>
            )}

            {/* Features */}
            {featureEntries.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-900 mb-2">{t("apartment.features")}</h3>
                <div className="flex flex-wrap gap-2">
                  {featureEntries.map(([key]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 border border-brand-100 px-3 py-1.5 rounded-full text-sm font-medium"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {(key as string).replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA / Request section */}
            {apartment.status === "AVAILABLE" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                {!showRequestForm && !requestSent && (
                  <button
                    onClick={() => setShowRequestForm(true)}
                    className="btn-primary w-full text-base py-3"
                  >
                    {t("apartment.requestInfo")}
                  </button>
                )}
                {showRequestForm && !requestSent && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setRequestSent(true);
                      setShowRequestForm(false);
                    }}
                    className="space-y-3"
                  >
                    <h3 className="font-semibold text-sm">{t("apartment.requestInfo")}</h3>
                    <input name="name" required className="input" placeholder={t("apartment.yourName")} />
                    <input name="email" type="email" required className="input" placeholder={t("apartment.email")} />
                    <input name="phone" type="tel" className="input" placeholder={t("apartment.phone")} />
                    <textarea name="message" className="input" rows={3} placeholder={t("apartment.messageOptional")} />
                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary flex-1">{t("apartment.sendRequest")}</button>
                      <button type="button" onClick={() => setShowRequestForm(false)} className="btn-secondary">
                        {t("common.cancel")}
                      </button>
                    </div>
                  </form>
                )}
                {requestSent && (
                  <div className="text-center py-3">
                    <svg className="w-10 h-10 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-green-700">{t("viewer.thankYouRequest")}</p>
                  </div>
                )}
              </div>
            )}
            {apartment.status === "RESERVED" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-yellow-800">{t("apartment.reservedMessage")}</p>
                <p className="text-xs text-yellow-600 mt-1">{t("apartment.contactForUpdates")}</p>
              </div>
            )}
            {apartment.status === "SOLD" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-red-800">{t("apartment.soldMessage")}</p>
                <p className="text-xs text-red-600 mt-1">{t("apartment.contactForUpdates")}</p>
              </div>
            )}

            {/* Share link */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <input
                readOnly
                value={typeof window !== "undefined" ? window.location.href : ""}
                className="flex-1 bg-transparent text-xs text-gray-500 outline-none truncate"
              />
              <button
                onClick={handleCopyLink}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
              >
                {t("apartment.copyLink")}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {project.company.name} · {project.name}
          </p>
          <Link to={viewerUrl} className="text-xs text-brand-600 hover:text-brand-700">
            ← {t("viewer.backToProject")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
