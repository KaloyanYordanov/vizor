import type { ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  return logout(request);
}

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}
