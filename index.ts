import { console } from "node:inspector";
import { start } from "./src/leanaide";
import { run } from "./src/handler";

const main = async () => {
  const [leanaide, handler] = await Promise.all([start(), run()]);

  // start the leanaide process spawn
  await start();
  console.log(`All servers started`);

  const shutdown = async function () {
    console.log("Shutting down");
    await leanaide.stop();
    await handler.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

await main();
