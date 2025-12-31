import { console } from "node:inspector";
import { startLeanaideServer } from "./src/leanaide_server";
import { startProducerServer } from "./src/producer_server";

const main = async function () {
  const [leanaide, producer] = await Promise.all([startLeanaideServer(), startProducerServer()]);

  console.log(`All servers started`);

  const shutdown = async function () {
    console.log("Shutting down");
    await leanaide.stop();
    await producer.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

await main();
