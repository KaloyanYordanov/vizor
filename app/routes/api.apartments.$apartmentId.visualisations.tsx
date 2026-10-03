import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { publicVisualisations } from "~/lib/visualisations/service.server";
export async function loader({ params }: LoaderFunctionArgs) {
  return json(
    { visualisations: await publicVisualisations(params.apartmentId!) },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
