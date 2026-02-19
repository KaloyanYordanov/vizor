import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { getUser, login, createUserSession } from "~/lib/auth.server";

export const meta: MetaFunction = () => [{ title: "Login | Vizor" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) return redirect("/admin");
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await login(email, password);
  if (!user) {
    return json({ error: "Invalid email or password" }, { status: 401 });
  }

  return createUserSession(user.id, "/admin");
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-700">
            Vizor
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Interactive Apartment Selector Platform
          </p>
        </div>

        <div className="card">
          <div className="card-body space-y-6">
            <h2 className="text-xl font-semibold text-center">Sign in</h2>

            {actionData?.error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {actionData.error}
              </div>
            )}

            <Form method="post" className="space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  placeholder="admin@vizor.dev"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </Form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Demo: admin@vizor.dev / password123
        </p>
      </div>
    </div>
  );
}
