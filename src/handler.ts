import express from "express";
import { inputQ, resultQ } from "./queues";
import { on } from "node:events";
import { psReader } from "./leanaide";

const app = express();
app.use(express.json());

const runHandler = async () => {
  console.log("---- SERVER START ----");
  app.post("/", async (req, res) => {
    const inputData = JSON.stringify(req.body);
    console.log(`Received input via POST: ${inputData}`);
    inputQ.addItem(inputData);
    resultQ.start();
    for await (const element of on(psReader, "result")) {
      if (element) {
        psReader.emit("console", element);
        res.send(element[0]);
        break;
      }
    }
  });

  const server = app.listen(7654, () => {
    console.log(`server on 7654`);
    console.log("---- SERVER STARTED ----");
  });

  return server;
};

const run = async () => {
  const server = await runHandler();
  return {
    stop: server.close,
    server,
  };
};

export { run };
