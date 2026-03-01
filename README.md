# Vizor — Interactive Apartment Selector Platform

An interactive apartment selector platform built with **Node 24 + Remix + Prisma + PostgreSQL + Tailwind CSS**. Designed for construction companies to showcase buildings and let buyers explore floor plans interactively.

## Features

### Core
- **Multi-tenant architecture** — Companies → Projects → Buildings → Floors → Apartments
- **Interactive SVG building viewer** — Click floors on a building silhouette to explore
- **Interactive SVG floor plan viewer** — Hover/click apartment regions with status-colored overlays and tooltips
- **Real-time filtering** — Filter by rooms, price range, and availability status; results update on the SVG
- **Apartment detail panel** — View size, price, features, and status; CTA for inquiries
- **Admin dashboard** — Stats, recent activity, full CRUD for all entities
- **Role-based access** — SUPER_ADMIN (platform-wide), COMPANY_ADMIN (tenant-scoped), VIEWER
- **Embeddable widget** — `<script>` tag or `<iframe>` to embed the viewer on any website
- **Public REST API** — JSON endpoints with CORS for headless integrations
- **Responsive design** — Mobile-first with desktop sidebar layout
- **Internationalisation (i18n)** — Multi-language support with Bulgarian 🇧🇬 as default and English 🇬🇧; language switcher on all pages

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 |
| Framework | Remix (Vite) |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Styling | Tailwind CSS 3 |
| Auth | Cookie sessions + bcrypt |
| Floor Plans | SVG with interactive regions |
| i18n | i18next + react-i18next |
| Testing | Vitest |

## Quick Start

### Prerequisites
- Node.js 24+ (use `nvm use 24`)
- PostgreSQL running locally
- npm 11+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env  # or edit .env with your DATABASE_URL

# 3. Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# 4. Seed database with sample data
npx tsx prisma/seed.ts

# 5. Start development server
npm run dev
```

### Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@vizor.dev | password123 |
| Company Admin | company@horizon.dev | password123 |

## Project Structure

```
app/
├── components/           # Reusable UI components
│   ├── ApartmentDetailPanel.tsx   # Apartment info sidebar
│   ├── FilterBar.tsx              # Room/price/status filters
│   ├── FloorPlanViewer.tsx        # Interactive floor plan SVG
│   └── ui.tsx                     # Shared UI primitives
├── lib/                  # Server utilities
│   ├── auth.server.ts    # Auth, sessions, role guards
│   └── db.server.ts      # Prisma client singleton
├── routes/               # Remix file-based routing
│   ├── _index.tsx                 # Landing page
│   ├── login.tsx                  # Login form
│   ├── logout.tsx                 # Logout action
│   ├── admin.tsx                  # Admin layout (sidebar)
│   ├── admin._index.tsx           # Admin dashboard
│   ├── admin.companies.tsx        # Companies CRUD
│   ├── admin.companies.$companyId.tsx
│   ├── admin.projects.tsx         # Projects CRUD
│   ├── admin.projects.$projectId.tsx
│   ├── admin.buildings.tsx        # Buildings CRUD
│   ├── admin.buildings.$buildingId.tsx  # Building + floors + apartments
│   ├── admin.buildings.$buildingId.apartments.$apartmentId.tsx
│   ├── view.$companySlug.$projectSlug.tsx   # Public interactive viewer
│   ├── embed.$companySlug.$projectSlug.tsx  # Embeddable script
│   ├── api.projects.$companySlug.$projectSlug.tsx  # REST API
│   └── api.apartments.$apartmentId.tsx             # REST API
├── __tests__/            # Test files
├── i18n/                 # Internationalisation
│   ├── config.ts         # Supported languages, resources
│   ├── i18n.client.ts    # Client-side i18n init
│   ├── i18n.server.ts    # Server-side i18n factory
│   ├── bg.json           # 🇧🇬 Bulgarian translations (default)
│   └── en.json           # 🇬🇧 English translations
├── entry.client.tsx
├── entry.server.tsx
├── root.tsx
└── tailwind.css
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Seed data
```

## SVG Floor Plan Format

### Building SVG
Floor regions must have:
- `class="floor-region"` — enables interactivity
- `data-floor="<number>"` — links to floor number

```svg
<rect id="floor-1" class="floor-region" data-floor="1"
      x="60" y="470" width="280" height="90" fill="#bfdbfe" />
```

### Floor Plan SVG
Apartment regions must have:
- `class="apartment-region"` — enables interactivity
- `id` matching the apartment's `svgPathId` field (e.g. `apt-101`)
- `data-apartment="<number>"` — optional, for reference

```svg
<rect id="apt-101" class="apartment-region" data-apartment="101"
      x="20" y="50" width="270" height="190" fill="#dcfce7" />
```

Status colors are applied automatically:
- 🟢 Available — green
- 🟡 Reserved — yellow
- 🔴 Sold — red
- ⚪ Unavailable — gray

## Embedding

### Script Tag
```html
<div id="vizor-container"></div>
<script src="https://your-domain.com/embed/horizon/sunrise-residences?target=vizor-container&width=100%&height=800px"></script>
```

### iframe
```html
<iframe
  src="https://your-domain.com/view/horizon/sunrise-residences"
  width="100%" height="800" frameborder="0"
  allowfullscreen loading="lazy"
></iframe>
```

## API Reference

### GET `/api/projects/:companySlug/:projectSlug`
Returns full project data with buildings, floors, and apartments.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status (AVAILABLE, RESERVED, SOLD, UNAVAILABLE) |
| rooms | number | Filter by room count |
| minPrice | number | Minimum price |
| maxPrice | number | Maximum price |

### GET `/api/apartments/:apartmentId`
Returns detailed apartment info with floor/building/project context.

Both endpoints return JSON with `Access-Control-Allow-Origin: *`.

## Internationalisation (i18n)

The app uses [i18next](https://www.i18next.com/) with [react-i18next](https://react.i18next.com/) for full internationalisation support. Bulgarian 🇧🇬 is the default language.

### Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `bg` | Български (Bulgarian) | ✅ Default |
| `en` | English | ✅ Available |

### Architecture

- **Bundled translations** — All translations are imported at build time (no HTTP fetching), ensuring instant language switching and SSR compatibility.
- **Client-side language detection** — Uses `i18next-browser-languagedetector` to detect preference from `localStorage` or browser `navigator.language`.
- **Server-side rendering** — A separate i18n instance is created per request via `i18n.server.ts` to avoid state leaking between requests.
- **Language switcher** — A dropdown component (`LanguageSwitcher.tsx`) is available on the landing page, login page, admin layout, and public viewer.

### Translation Files

Translations live in `app/i18n/`:

```
app/i18n/
├── config.ts        # Supported languages, resource imports
├── i18n.client.ts   # Client init (with language detector)
├── i18n.server.ts   # Server init (per-request instance)
├── bg.json          # Bulgarian translations (~250 keys)
└── en.json          # English translations (~250 keys)
```

Keys are organised by namespace: `common.*`, `status.*`, `apartment.*`, `building.*`, `floor.*`, `filter.*`, `admin.*`, `dashboard.*`, `companies.*`, `projects.*`, `settings.*`, `login.*`, `landing.*`, `viewer.*`, `polygon.*`, `upload.*`, `editApartment.*`, `editBuilding.*`, `zoom.*`.

### Adding a New Language

1. Copy `app/i18n/en.json` to `app/i18n/<code>.json` (e.g. `de.json` for German)
2. Translate all values in the new file
3. Update `app/i18n/config.ts`:
   ```ts
   import de from "./de.json";
   export const supportedLngs = ["bg", "en", "de"] as const;
   export const languageNames = { bg: "Български", en: "English", de: "Deutsch" };
   export const i18nResources = { bg: { translation: bg }, en: { translation: en }, de: { translation: de } };
   ```
4. The language will appear automatically in all `LanguageSwitcher` dropdowns.

## Testing Plan

### Unit Tests (Vitest)
```bash
npm test
```
- Filter logic (rooms, price, status, combined)
- Status validation
- Slug format validation
- Auth helpers (login, session, role guards)
- Price calculation (price per sqm)

### Integration Tests
- Prisma operations: CRUD for all entities
- Tenant isolation: Company admin cannot access other companies' data
- Cascade deletes: Deleting a company removes projects → buildings → floors → apartments

### E2E Tests (Recommended: Playwright)
- Login flow → dashboard
- CRUD operations in admin
- Public viewer: building click → floor → apartment detail
- Filter bar: apply filters → SVG updates
- Embed: script tag creates iframe correctly
- Responsive: mobile navigation

### Manual Testing Checklist
- [ ] Login with both admin accounts
- [ ] Create/edit/delete company, project, building
- [ ] Add floors with SVG floor plans
- [ ] Add apartments with SVG path IDs
- [ ] Verify interactive building viewer (hover/click)
- [ ] Verify floor plan viewer (hover/click/tooltips)
- [ ] Test all filter combinations
- [ ] Verify embed script generation
- [ ] Test API endpoints with curl
- [ ] Test on mobile viewport

## Security Considerations

### Implemented
1. **Password hashing** — bcrypt with salt rounds
2. **Cookie-based sessions** — HttpOnly, Secure (prod), SameSite=Lax
3. **Role-based access control** — SUPER_ADMIN, COMPANY_ADMIN, VIEWER
4. **Tenant isolation** — Company admins can only access their own data
5. **CSRF protection** — Remix forms use built-in CSRF tokens
6. **Input validation** — Server-side validation on all mutations
7. **SQL injection prevention** — Prisma parameterized queries

### Recommended for Production
1. **Rate limiting** — Add express-rate-limit or similar middleware
2. **CORS restrictions** — Restrict API origins to known domains
3. **Content Security Policy** — Add CSP headers for SVG rendering safety
4. **SVG sanitization** — Sanitize uploaded SVG content (DOMPurify server-side) to prevent XSS
5. **File upload validation** — Validate MIME types and file sizes
6. **HTTPS** — Enforce TLS in production
7. **Environment secrets** — Use a secrets manager, rotate SESSION_SECRET
8. **Audit logging** — Log admin actions (who changed what, when)
9. **Password policy** — Enforce minimum length, complexity
10. **Session expiry** — Implement idle timeout and absolute expiry

## Suggested Additional Features

### Near-term
- **Image upload** — Upload raster building/floor images alongside SVGs
- **Bulk apartment import** — CSV/Excel upload for apartment data
- **Comparison mode** — Compare 2-3 apartments side by side
- **Favorites** — Let public users bookmark apartments (localStorage)
- **Print/PDF** — Generate apartment specification sheets
- **Additional languages** — Add more languages beyond Bulgarian and English

### Medium-term
- **3D building view** — Three.js integration for 3D building visualization
- **Virtual tours** — Link to 360° panorama views per apartment
- **Price history** — Track and display price changes over time
- **Analytics dashboard** — Track which apartments get the most views
- **Lead capture** — Contact forms per apartment with email notifications
- **Webhooks** — Notify external systems on status changes

### Long-term
- **White-labeling** — Custom themes, logos, domains per company
- **Payment integration** — Reservation deposits
- **Document management** — Floor plans, contracts, brochures per apartment
- **Mobile app** — React Native companion app
- **AI-powered recommendations** — Suggest apartments based on user preferences
- **AR view** — Augmented reality furniture placement

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3030) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run lint` | TypeScript type check |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## License

ISC
