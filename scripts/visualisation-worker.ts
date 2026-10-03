import { heartbeat } from "../app/lib/visualisations/maintenance.server";
import {
  runOneJob,
  reconcileJobs,
} from "../app/lib/visualisations/worker.server";
import { visualisationConfig } from "../app/lib/visualisations/config.server";
import { prisma } from "../app/lib/db.server";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const config = visualisationConfig();
if (!config.configured) {
  console.error("Set OPENAI_API_KEY before starting the visualisation worker.");
  process.exitCode = 1;
} else {
  await heartbeat();
  const heartbeater = setInterval(() => {
    void heartbeat().catch(() =>
      console.error("Worker heartbeat write failed"),
    );
  }, 30000);
  console.info(
    `Visualisation worker: ${config.size}, ${config.quality}, concurrency ${config.concurrency}`,
  );
  while (!stopping) {
    try {
      await reconcileJobs();
      await Promise.all(
        Array.from({ length: config.concurrency }, () => runOneJob()),
      );
    } catch {
      console.error(
        "Visualisation worker database/processing error; retrying polling.",
      );
    }
    if (!stopping) await new Promise((r) => setTimeout(r, 2000));
  }
  clearInterval(heartbeater);
}
await prisma.$disconnect();
