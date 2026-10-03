import { useEffect, useRef, useState } from "react";
import {
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useTranslation } from "react-i18next";
import type {
  loader,
  action,
} from "~/routes/admin.buildings_.$buildingId_.visualisations";
import {
  activeStates,
  type Region,
  type StyleId,
} from "~/lib/visualisations/shared";
import { PlanCropEditor } from "./PlanCropEditor";
import { StylePicker } from "./StylePicker";
export function VisualisationStudio() {
  const data = useLoaderData<typeof loader>();
  return (
    <Studio
      key={`${data.selected?.id || "none"}:${data.selected?.plan?.revision || 0}`}
      data={data}
    />
  );
}
function Studio({
  data,
}: {
  data: ReturnType<typeof useLoaderData<typeof loader>>;
}) {
  const { building, selected: a, config } = data;
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const plan = a?.plan;
  const [style, setStyle] = useState<StyleId>("contemporary");
  const [replacePlan, setReplacePlan] = useState(false);
  const [crop, setCrop] = useState<Region>({ x: 0, y: 0, width: 1, height: 1 }),
    [manualCrop, setManualCrop] = useState(
      Boolean(a && !a.dedicated && !a.hasMappedRegion),
    ),
    [review, setReview] = useState<string | null>(null),
    [ack, setAck] = useState<Record<string, boolean>>({});
  const previousState = useRef(fetcher.state);
  const pendingRequest = useRef<string | null>(null);
  const autoPrepareAttempted = useRef(false);
  const busy = fetcher.state !== "idle";
  const running = a?.batches.some((b) =>
    b.jobs.some((j) => (activeStates as readonly string[]).includes(j.state)),
  );
  const runningBatches =
    a?.batches.filter((b) =>
      b.jobs.some((j) => (activeStates as readonly string[]).includes(j.state)),
    ) || [];
  const runningSignature = JSON.stringify(
    runningBatches.map((b) => ({
      id: b.id,
      jobs: b.jobs.map((j) => ({ id: j.id, state: j.state })),
    })),
  );
  useEffect(() => {
    if (!running) return;
    let polling = false,
      stopped = false;
    const controller = new AbortController();
    const id = setInterval(async () => {
      if (document.hidden || busy || polling) return;
      polling = true;
      try {
        const batches = JSON.parse(runningSignature) as {
          id: string;
          jobs: { id: string; state: string }[];
        }[];
        const statuses = await Promise.all(
          batches.map(async (b) => {
            const res = await fetch(`/api/visualisation-batches/${b.id}`, {
              signal: controller.signal,
            });
            if (!res.ok) throw new Error();
            return res.json();
          }),
        );
        const changed = statuses.some((b, i) =>
          b.jobs.some(
            (j: { id: string; state: string }) =>
              batches[i].jobs.find((old) => old.id === j.id)?.state !== j.state,
          ),
        );
        if (changed && !stopped && revalidator.state === "idle")
          revalidator.revalidate();
      } catch {
        /* Network errors must never resubmit generation. */
      } finally {
        polling = false;
      }
    }, 3000);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(id);
    };
  }, [running, runningSignature, revalidator, busy]);
  useEffect(() => {
    if (
      previousState.current !== "idle" &&
      fetcher.state === "idle" &&
      fetcher.data?.ok
    ) {
      pendingRequest.current = null;
    }
    previousState.current = fetcher.state;
  }, [fetcher.state, fetcher.data, plan]);
  const send = (intent: string, extra: Record<string, string> = {}) => {
    fetcher.submit(
      {
        intent,
        apartmentId: a!.id,
        planRevision: String(plan?.revision || 0),
        ...extra,
      },
      { method: "post" },
    );
  };
  const generate = (styleId = style, retryOfId?: string) => {
    // Preserve ID through an uncertain transport response; a new intentional action gets a new ID.
    const requestId = pendingRequest.current || crypto.randomUUID();
    pendingRequest.current = requestId;
    send("generate", {
      styleId,
      clientRequestId: requestId,
      ...(retryOfId ? { retryOfId } : {}),
    });
  };
  const floorId = a?.floorId || params.get("floor") || "";
  const floor = building.floors.find((f) => f.id === floorId);
  const error = fetcher.data?.error;
  const sourceUrl = `/api/apartments/${a?.id}/visualisation-source`;
  const canAutoPrepare = Boolean(
    a &&
      a.hasSource &&
      !plan &&
      !replacePlan &&
      !manualCrop &&
      (a.dedicated || a.hasMappedRegion),
  );
  const autoPreparing =
    canAutoPrepare &&
    (!autoPrepareAttempted.current || busy || fetcher.data?.ok);
  useEffect(() => {
    if (!canAutoPrepare || autoPrepareAttempted.current) return;
    autoPrepareAttempted.current = true;
    fetcher.submit(
      {
        intent: "prepare",
        apartmentId: a!.id,
        planRevision: "0",
      },
      { method: "post" },
    );
  }, [canAutoPrepare, fetcher, a]);
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("visualisations.title")}</h1>
          <p className="text-gray-500">
            {building.name} · {t("visualisations.subtitle")}
          </p>
        </div>
        <Link to={`/admin/buildings/${building.id}`} className="btn-secondary">
          {t("common.back")}
        </Link>
      </div>
      <div className="card p-4 grid sm:grid-cols-2 gap-4">
        <label className="label">
          {t("visualisations.floor")}
          <select
            className="select mt-1"
            value={floorId}
            onChange={(e) =>
              setParams(e.target.value ? { floor: e.target.value } : {})
            }
          >
            <option value="">{t("common.select")}</option>
            {building.floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label || t("floor.floorN", { n: f.number })}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          {t("apartment.apartment")}
          <select
            className="select mt-1"
            value={a?.id || ""}
            disabled={!floor}
            onChange={(e) =>
              setParams({
                floor: floorId,
                ...(e.target.value ? { apartment: e.target.value } : {}),
              })
            }
          >
            <option value="">{t("common.select")}</option>
            {floor?.apartments.map((ap) => (
              <option key={ap.id} value={ap.id}>
                {ap.number}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3">
          {t(`visualisations.errors.${error}`, {
            defaultValue: t("visualisations.errors.OPERATION_FAILED"),
          })}
          <button
            type="button"
            className="underline ml-3"
            onClick={() => {
              pendingRequest.current = null;
              revalidator.revalidate();
            }}
          >
            {t("visualisations.refresh")}
          </button>
        </p>
      )}
      {a && (
        <>
          {config.configured && !config.workerOnline && (
            <p
              role="status"
              className="rounded-lg bg-amber-50 p-3 text-amber-900"
            >
              {t("visualisations.workerOffline")}
            </p>
          )}
          {(!config.configured || !config.enabled) && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
              {t("visualisations.notConfigured")}
            </p>
          )}
          {!a.hasSource ? (
            <div className="card p-5">
              <p>{t("visualisations.noSource")}</p>
              <Link
                className="btn-secondary mt-3"
                to={`/admin/buildings/${building.id}/apartments/${a.id}`}
              >
                {t("visualisations.uploadPlan")}
              </Link>
            </div>
          ) : autoPreparing ? (
            <section
              className="card p-5"
              aria-busy="true"
              aria-labelledby="preparing-plan-title"
            >
              <div className="grid min-h-80 items-center gap-5 md:grid-cols-2">
                <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
                <div className="space-y-3">
                  <h2
                    id="preparing-plan-title"
                    className="text-lg font-semibold"
                  >
                    {t("visualisations.wholeApartment")}
                  </h2>
                  <p role="status" className="text-sm text-gray-500">
                    {t("visualisations.preparingPlan")}
                  </p>
                </div>
              </div>
            </section>
          ) : !plan || plan.stale || replacePlan ? (
            <section className="card p-5 space-y-4">
              <h2 className="font-semibold text-lg">
                {t("visualisations.prepare")}
              </h2>
              {plan?.stale && (
                <p className="text-amber-700">
                  {t("visualisations.stalePlan")}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {a.dedicated
                  ? t("visualisations.dedicatedSource")
                  : manualCrop
                    ? t("visualisations.customCropSource")
                    : t("visualisations.mappedSource")}
              </p>
              {manualCrop ? (
                <PlanCropEditor
                  imageUrl={sourceUrl}
                  region={crop}
                  onChange={setCrop}
                />
              ) : (
                <img
                  src={`${sourceUrl}${a.dedicated ? "" : "?crop=apartment"}`}
                  alt={t("visualisations.sourcePlan")}
                  className="max-h-96 object-contain mx-auto"
                />
              )}
              {!a.dedicated && a.hasMappedRegion && (
                <button
                  type="button"
                  className="w-fit text-sm underline"
                  onClick={() => setManualCrop((current) => !current)}
                >
                  {manualCrop
                    ? t("visualisations.useMappedCrop")
                    : t("visualisations.replacePlan")}
                </button>
              )}
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  send(
                    "prepare",
                    manualCrop ? { crop: JSON.stringify(crop) } : {},
                  )
                }
              >
                {t("visualisations.usePlan")}
              </button>
            </section>
          ) : (
            <>
              <section className="card p-5 space-y-5">
                <div className="grid md:grid-cols-2 gap-5 items-center">
                  <img
                    src={`/api/visualisation-plans/${plan.id}?r=${plan.revision}`}
                    alt={t("visualisations.sourcePlan")}
                    className="max-h-80 w-full object-contain"
                  />
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold">
                      {t("visualisations.wholeApartment")}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {t("visualisations.wholeHint")}
                    </p>
                    {!a.dedicated && (
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() => {
                          setManualCrop(true);
                          setReplacePlan(true);
                        }}
                      >
                        {t("visualisations.replacePlan")}
                      </button>
                    )}
                  </div>
                </div>
                <StylePicker
                  value={style}
                  onChange={(s) => {
                    pendingRequest.current = null;
                    setStyle(s);
                  }}
                />
                <div className="border-t pt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {a.number} · {t(`visualisations.styles.${style}.name`)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {config.size} ·{" "}
                      {t(`visualisations.quality.${config.quality}`)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t("visualisations.oneImageCost")}
                    </p>
                  </div>
                  <button
                    className="btn-primary"
                    disabled={
                      busy || running || !config.configured || !config.enabled
                    }
                    onClick={() => generate(style)}
                  >
                    {t("visualisations.generateApartment")}
                  </button>
                </div>
              </section>
            </>
          )}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              {t("visualisations.history")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("visualisations.costNote")}{" "}
              <a
                className="underline"
                href="https://platform.openai.com/usage"
                target="_blank"
                rel="noreferrer"
              >
                {t("visualisations.providerUsage")}
              </a>
            </p>
            {a.batches
              .filter((b) => b.jobs.some((j) => j.kind === "IMAGE"))
              .map((b) => (
                <div key={b.id} className="card p-4 space-y-3">
                  <div className="flex justify-between flex-wrap gap-2">
                    <p className="text-sm text-gray-500">
                      {new Date(b.createdAt).toLocaleString()} ·{" "}
                      {t(`visualisations.styles.${b.styleId}.name`)} ·{" "}
                      {b.settings.size} /{" "}
                      {t(`visualisations.quality.${b.settings.quality}`)}
                    </p>
                    {b.jobs.some(
                      (j) =>
                        j.scope === "apartment" &&
                        j.kind === "IMAGE" &&
                        j.state === "FAILED" &&
                        !j.stale,
                    ) && (
                      <button
                        className="btn-secondary btn-sm"
                        disabled={busy || running || !config.configured}
                        onClick={() => {
                          pendingRequest.current = null;
                          generate(b.styleId as StyleId, b.id);
                        }}
                      >
                        {t("visualisations.retryFailed")}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500" aria-live="polite">
                    {t("visualisations.progress", {
                      done: b.jobs.filter(
                        (j) => ![...activeStates].includes(j.state as any),
                      ).length,
                      total: b.jobs.length,
                    })}
                  </p>
                  {(b.cost.known > 0 || b.cost.unknown > 0) && (
                    <p className="text-sm font-medium">
                      {b.cost.known > 0
                        ? t("visualisations.batchCost", {
                            amount: b.cost.usd.toFixed(5),
                          })
                        : t("visualisations.costUnknown")}
                      {b.cost.unknown > 0 &&
                        ` · ${t("visualisations.costExcluded", { count: b.cost.unknown })}`}
                    </p>
                  )}
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {b.jobs.map((j) => (
                      <article
                        key={j.id}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <h3 className="font-medium">
                          {j.scope === "apartment"
                            ? t("visualisations.wholeApartment")
                            : j.label || t("visualisations.wholeApartment")}
                        </h3>
                        <p role="status" className="text-sm">
                          {t(`visualisations.states.${j.state}`)}
                          {j.published && ` · ${t("visualisations.published")}`}
                        </p>
                        {j.kind === "IMAGE" && (
                          <div className="text-sm text-gray-600">
                            {j.cost ? (
                              <details>
                                <summary className="cursor-pointer">
                                  {t("visualisations.imageCost", {
                                    amount: j.cost.usd.toFixed(5),
                                  })}
                                </summary>
                                <p className="text-xs mt-1">
                                  {t("visualisations.costBreakdown", {
                                    text: j.cost.textUsd.toFixed(5),
                                    image: j.cost.imageUsd.toFixed(5),
                                    output: j.cost.outputUsd.toFixed(5),
                                  })}
                                </p>
                                <p className="text-xs">
                                  {b.settings.model} ·{" "}
                                  {t("visualisations.costRates", {
                                    date: j.cost.rateDate,
                                  })}
                                </p>
                              </details>
                            ) : (
                              t("visualisations.costUnknown")
                            )}
                          </div>
                        )}
                        {j.stale && (
                          <p className="text-xs text-amber-700">
                            {t("visualisations.staleResult")}
                          </p>
                        )}
                        {j.errorCode && (
                          <p className="text-sm text-red-700">
                            {t(`visualisations.errors.${j.errorCode}`, {
                              defaultValue: t(
                                "visualisations.errors.GENERATION_FAILED",
                              ),
                            })}
                          </p>
                        )}
                        {j.kind === "IMAGE" && j.state === "SUCCEEDED" && (
                          <>
                            <button
                              type="button"
                              className="w-full"
                              onClick={() =>
                                setReview(review === j.id ? null : j.id)
                              }
                            >
                              <img
                                className="rounded-lg w-full"
                                src={`/api/visualisations/${j.id}/asset?thumbnail=1`}
                                alt={j.label || ""}
                              />
                              <span className="text-sm underline">
                                {t("visualisations.review")}
                              </span>
                            </button>
                            {review === j.id && (
                              <div className="space-y-2">
                                <img
                                  src={`/api/visualisations/${j.id}/asset?source=1`}
                                  alt={t("visualisations.sourcePlan")}
                                  className="w-full"
                                />
                                <a
                                  className="underline text-sm"
                                  href={`/api/visualisations/${j.id}/asset`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("visualisations.fullSize")}
                                </a>
                                <p className="text-xs text-gray-500">
                                  {t("visualisations.assumptions")}
                                </p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <a
                                className="btn-secondary btn-sm"
                                href={`/api/visualisations/${j.id}/asset?download=1`}
                              >
                                {t("visualisations.download")}
                              </a>
                              <button
                                className="btn-secondary btn-sm"
                                disabled={
                                  busy ||
                                  j.stale ||
                                  running ||
                                  j.scope !== "apartment" ||
                                  !config.configured
                                }
                                onClick={() => {
                                  pendingRequest.current = null;
                                  generate(b.styleId as StyleId, b.id);
                                }}
                              >
                                {t("visualisations.regenerate")}
                              </button>
                            </div>
                            {!j.stale && !j.published && (
                              <label className="text-xs flex gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!ack[j.id]}
                                  onChange={(e) =>
                                    setAck({ ...ack, [j.id]: e.target.checked })
                                  }
                                />
                                {t("visualisations.reviewAck")}
                              </label>
                            )}
                            {j.published ? (
                              <button
                                className="btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() =>
                                  send("unpublish", { jobId: j.id })
                                }
                              >
                                {t("visualisations.unpublish")}
                              </button>
                            ) : (
                              <button
                                className="btn-primary btn-sm"
                                disabled={busy || j.stale || !ack[j.id]}
                                onClick={() =>
                                  send("publish", {
                                    jobId: j.id,
                                    reviewed: "true",
                                  })
                                }
                              >
                                {t("visualisations.publish")}
                              </button>
                            )}
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
          </section>
        </>
      )}
    </div>
  );
}
