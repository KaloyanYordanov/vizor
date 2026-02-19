import { PrismaClient, ApartmentStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (ignore errors for fresh databases)
  try {
    await prisma.apartment.deleteMany();
    await prisma.floor.deleteMany();
    await prisma.building.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
  } catch {
    // Tables may not exist yet on first run
  }

  // ─── Company ──────────────────────────────────────────
  const company = await prisma.company.create({
    data: {
      name: "Horizon Developments",
      slug: "horizon",
      website: "https://horizon-dev.example.com",
    },
  });

  // ─── Users ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("password123", 10);

  await prisma.user.create({
    data: {
      email: "admin@vizor.dev",
      password: hashedPassword,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: "company@horizon.dev",
      password: hashedPassword,
      name: "Horizon Admin",
      role: Role.COMPANY_ADMIN,
      companyId: company.id,
    },
  });

  // ─── Project ──────────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      name: "Sunrise Residences",
      slug: "sunrise-residences",
      description: "Modern living in the heart of the city with stunning views and premium amenities.",
      address: "123 Sunrise Blvd, Sofia, Bulgaria",
      companyId: company.id,
    },
  });

  // ─── Building with sample SVG ─────────────────────────
  const buildingSvg = `<svg viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="20" width="300" height="560" fill="#e2e8f0" stroke="#64748b" stroke-width="2" rx="4"/>
  <text x="200" y="50" text-anchor="middle" font-size="16" fill="#334155" font-weight="bold">Building A</text>
  <rect id="floor-5" x="60" y="70" width="280" height="90" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="5" class="floor-region"/>
  <text x="200" y="120" text-anchor="middle" font-size="14" fill="#1e40af">Floor 5</text>
  <rect id="floor-4" x="60" y="170" width="280" height="90" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="4" class="floor-region"/>
  <text x="200" y="220" text-anchor="middle" font-size="14" fill="#1e40af">Floor 4</text>
  <rect id="floor-3" x="60" y="270" width="280" height="90" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="3" class="floor-region"/>
  <text x="200" y="320" text-anchor="middle" font-size="14" fill="#1e40af">Floor 3</text>
  <rect id="floor-2" x="60" y="370" width="280" height="90" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="2" class="floor-region"/>
  <text x="200" y="420" text-anchor="middle" font-size="14" fill="#1e40af">Floor 2</text>
  <rect id="floor-1" x="60" y="470" width="280" height="90" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="1" class="floor-region"/>
  <text x="200" y="520" text-anchor="middle" font-size="14" fill="#1e40af">Floor 1</text>
</svg>`;

  const building = await prisma.building.create({
    data: {
      name: "Building A",
      slug: "building-a",
      description: "Premium residential building with 5 floors",
      svgContent: buildingSvg,
      projectId: project.id,
      sortOrder: 1,
    },
  });

  // ─── Floors with sample SVG floor plans ───────────────
  const floorPlanSvg = (floorNum: number) => `<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="800" height="500" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <text x="400" y="30" text-anchor="middle" font-size="16" fill="#334155" font-weight="bold">Floor ${floorNum} Plan</text>
  <!-- Corridor -->
  <rect x="300" y="50" width="200" height="400" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
  <text x="400" y="260" text-anchor="middle" font-size="12" fill="#64748b">Corridor</text>
  <!-- Apt 1 -->
  <rect id="apt-${floorNum}01" x="20" y="50" width="270" height="190" fill="#dcfce7" stroke="#22c55e" stroke-width="2" rx="3" class="apartment-region" data-apartment="${floorNum}01"/>
  <text x="155" y="130" text-anchor="middle" font-size="14" fill="#166534">Apt ${floorNum}01</text>
  <text x="155" y="155" text-anchor="middle" font-size="11" fill="#166534">2 rooms · 65m²</text>
  <!-- Apt 2 -->
  <rect id="apt-${floorNum}02" x="510" y="50" width="270" height="190" fill="#dcfce7" stroke="#22c55e" stroke-width="2" rx="3" class="apartment-region" data-apartment="${floorNum}02"/>
  <text x="645" y="130" text-anchor="middle" font-size="14" fill="#166534">Apt ${floorNum}02</text>
  <text x="645" y="155" text-anchor="middle" font-size="11" fill="#166534">3 rooms · 85m²</text>
  <!-- Apt 3 -->
  <rect id="apt-${floorNum}03" x="20" y="260" width="270" height="190" fill="#dcfce7" stroke="#22c55e" stroke-width="2" rx="3" class="apartment-region" data-apartment="${floorNum}03"/>
  <text x="155" y="340" text-anchor="middle" font-size="14" fill="#166534">Apt ${floorNum}03</text>
  <text x="155" y="365" text-anchor="middle" font-size="11" fill="#166534">1 room · 45m²</text>
  <!-- Apt 4 -->
  <rect id="apt-${floorNum}04" x="510" y="260" width="270" height="190" fill="#fef9c3" stroke="#f59e0b" stroke-width="2" rx="3" class="apartment-region" data-apartment="${floorNum}04"/>
  <text x="645" y="340" text-anchor="middle" font-size="14" fill="#92400e">Apt ${floorNum}04</text>
  <text x="645" y="365" text-anchor="middle" font-size="11" fill="#92400e">4 rooms · 120m²</text>
</svg>`;

  const statuses: ApartmentStatus[] = [
    ApartmentStatus.AVAILABLE,
    ApartmentStatus.AVAILABLE,
    ApartmentStatus.RESERVED,
    ApartmentStatus.SOLD,
    ApartmentStatus.AVAILABLE,
  ];

  for (let f = 1; f <= 5; f++) {
    const floor = await prisma.floor.create({
      data: {
        number: f,
        label: f === 5 ? "Penthouse Level" : `Floor ${f}`,
        svgContent: floorPlanSvg(f),
        buildingId: building.id,
        sortOrder: f,
      },
    });

    const apartments = [
      { number: `${f}01`, rooms: 2, area: 65, price: 95000 + f * 5000, status: statuses[f - 1] },
      { number: `${f}02`, rooms: 3, area: 85, price: 125000 + f * 5000, status: ApartmentStatus.AVAILABLE },
      { number: `${f}03`, rooms: 1, area: 45, price: 65000 + f * 3000, status: f === 3 ? ApartmentStatus.SOLD : ApartmentStatus.AVAILABLE },
      { number: `${f}04`, rooms: 4, area: 120, price: 180000 + f * 8000, status: f === 4 ? ApartmentStatus.RESERVED : ApartmentStatus.AVAILABLE },
    ];

    for (const apt of apartments) {
      await prisma.apartment.create({
        data: {
          number: apt.number,
          rooms: apt.rooms,
          area: apt.area,
          price: apt.price,
          pricePerSqm: Math.round(apt.price / apt.area),
          status: apt.status,
          svgPathId: `apt-${apt.number}`,
          floorId: floor.id,
          description: `${apt.rooms}-room apartment on floor ${f}, ${apt.area}m² of modern living space.`,
          features: JSON.stringify({
            balcony: apt.rooms >= 2,
            parking: apt.rooms >= 3,
            storage: true,
            airConditioning: apt.rooms >= 2,
          }),
        },
      });
    }
  }

  // ─── Second building ──────────────────────────────────
  const building2Svg = `<svg viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="20" width="300" height="410" fill="#e2e8f0" stroke="#64748b" stroke-width="2" rx="4"/>
  <text x="200" y="50" text-anchor="middle" font-size="16" fill="#334155" font-weight="bold">Building B</text>
  <rect id="floor-3" x="60" y="70" width="280" height="100" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="3" class="floor-region"/>
  <text x="200" y="125" text-anchor="middle" font-size="14" fill="#1e40af">Floor 3</text>
  <rect id="floor-2" x="60" y="180" width="280" height="100" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="2" class="floor-region"/>
  <text x="200" y="235" text-anchor="middle" font-size="14" fill="#1e40af">Floor 2</text>
  <rect id="floor-1" x="60" y="290" width="280" height="100" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5" rx="2" data-floor="1" class="floor-region"/>
  <text x="200" y="345" text-anchor="middle" font-size="14" fill="#1e40af">Floor 1</text>
</svg>`;

  const building2 = await prisma.building.create({
    data: {
      name: "Building B",
      slug: "building-b",
      description: "Boutique residential building with 3 floors",
      svgContent: building2Svg,
      projectId: project.id,
      sortOrder: 2,
    },
  });

  for (let f = 1; f <= 3; f++) {
    const floor = await prisma.floor.create({
      data: {
        number: f,
        label: `Floor ${f}`,
        svgContent: floorPlanSvg(f),
        buildingId: building2.id,
        sortOrder: f,
      },
    });

    for (let a = 1; a <= 3; a++) {
      const num = `B${f}0${a}`;
      const rooms = a + 0.5;
      const area = 50 + a * 20;
      const price = 80000 + f * 10000 + a * 15000;
      await prisma.apartment.create({
        data: {
          number: num,
          rooms,
          area,
          price,
          pricePerSqm: Math.round(price / area),
          status: ApartmentStatus.AVAILABLE,
          svgPathId: `apt-${f}0${a}`,
          floorId: floor.id,
          description: `${rooms}-room apartment ${num}, ${area}m².`,
          features: JSON.stringify({ balcony: true, storage: true }),
        },
      });
    }
  }

  console.log("✅ Seeding complete!");
  console.log("   Login: admin@vizor.dev / password123");
  console.log("   Login: company@horizon.dev / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
