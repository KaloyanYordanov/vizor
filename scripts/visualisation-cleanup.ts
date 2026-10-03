import { cleanupOrphanAssets } from "../app/lib/visualisations/maintenance.server";
import { prisma } from "../app/lib/db.server";
const apply = process.argv.includes("--apply");
try {
  const keys = await cleanupOrphanAssets(!apply);
  console.info(
    `${apply ? "Removed" : "Would remove"} ${keys.length} unreferenced assets older than 24 hours.`,
  );
} finally {
  await prisma.$disconnect();
}
