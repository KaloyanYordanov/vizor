import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { getUser, login, createUserSession } from "~/lib/auth.server";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "~/components/LanguageSwitcher";

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
  const { t } = useTranslation();

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-700">
            Vizor
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="card">
          <div className="card-body space-y-6">
            <h2 className="text-xl font-semibold text-center">{t("login.signIn")}</h2>

            {actionData?.error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {actionData.error}
              </div>
            )}

            <Form method="post" className="space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  {t("login.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  placeholder={t("login.emailPlaceholder")}
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  {t("login.password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  placeholder={t("login.passwordPlaceholder")}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
              >
                {isSubmitting ? t("login.signingIn") : t("login.signIn")}
              </button>
            </Form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          {t("login.demo")}
        </p>

        <div className="text-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
