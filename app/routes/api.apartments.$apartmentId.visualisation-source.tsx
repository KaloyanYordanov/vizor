import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  apartmentImage,
  authorizeApartment,
  sourceImage,
} from "~/lib/visualisations/source.server";
import { VisualisationError } from "~/lib/visualisations/validation.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { apartment } = await authorizeApartment(request, params.apartmentId!);
  try {
    const image =
      new URL(request.url).searchParams.get("crop") === "apartment"
        ? await apartmentImage(apartment)
        : await sourceImage(apartment);
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    throw new Response(
      e instanceof VisualisationError ? e.code : "SOURCE_MISSING",
      { status: 400 },
    );
  }
}
