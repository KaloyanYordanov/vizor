import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Vizor — Interactive Apartment Selector Platform" },
  { name: "description", content: "Explore floor plans and find your perfect apartment with our interactive building viewer." },
];

export default function IndexPage() {
  return (
    <div className="min-h-full bg-gradient-to-br from-brand-50 via-white to-brand-50">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold">V</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Vizor</span>
          </div>
          <Link to="/login" className="btn-primary btn-sm">
            Admin Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          Find Your{" "}
          <span className="text-brand-600">Perfect Apartment</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Explore interactive floor plans, browse available apartments, and
          discover your dream home with our innovative building visualisation platform.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link to="/login" className="btn-primary px-8 py-3 text-base">
            Get Started
          </Link>
          <a href="#features" className="btn-secondary px-8 py-3 text-base">
            Learn More
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            title="Interactive Floor Plans"
            description="Navigate buildings visually with SVG-powered floor plans. Hover to preview, click to explore."
          />
          <FeatureCard
            icon="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            title="Smart Filtering"
            description="Filter by rooms, price, and availability. Instantly see matching apartments highlighted on the plan."
          />
          <FeatureCard
            icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            title="Multi-Tenant Platform"
            description="Support multiple construction companies, projects, and buildings from a single powerful admin panel."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Vizor. Interactive Apartment Selector Platform.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card p-6 text-center hover:shadow-md transition-shadow">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
        <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}
