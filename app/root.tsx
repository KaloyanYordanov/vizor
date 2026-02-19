import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  },
];

export default function App() {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full font-['Inter',sans-serif]">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full font-['Inter',sans-serif] flex items-center justify-center">
        <div className="text-center p-8">
          {isRouteErrorResponse(error) ? (
            <>
              <h1 className="text-6xl font-bold text-gray-300">{error.status}</h1>
              <p className="mt-4 text-xl text-gray-600">{error.statusText}</p>
            </>
          ) : (
            <>
              <h1 className="text-6xl font-bold text-gray-300">500</h1>
              <p className="mt-4 text-xl text-gray-600">Something went wrong</p>
            </>
          )}
          <a href="/" className="mt-6 inline-block btn-primary">
            Go Home
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
