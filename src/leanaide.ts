import { createStore } from "@tanstack/store";
import duplexify from "duplexify";
import { execa } from "execa";
import { PROCESS_CMD, PROCESS_CWD, processArgs } from "./constants";
import { EventEmitter, on } from "node:events";
import { displayQ, outputQ } from "./queues";
import { initState } from "./states";

const controller = new AbortController();
const psReader = new EventEmitter();
const psWriter = new EventEmitter();
const psKiller = new EventEmitter();

const $ps = createStore(() =>
  execa(PROCESS_CMD, processArgs, {
    detached: false,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "pipe",
    cwd: PROCESS_CWD,
    all: true,
    gracefulCancel: true,
    cancelSignal: controller.signal,
  }),
);

const d = duplexify($ps.state.writable({ to: "stdin" }), $ps.state.readable({ from: "all" }));

d.prependListener("error", (_) => {
  $ps.state.kill();
  process.exit(0);
});

d.prependListener("close", (_) => {
  $ps.state.kill();
  process.exit(0);
});

process.prependListener("SIGINT", (_) => {
  d.emit("close");
});
process.prependListener("SIGABRT", (_) => {
  d.emit("close");
});

// READER FROM LEANAIDE
psReader.prependListener("console-output", (s) => {
  console.log(`[DEBUG] : ${s}`);
});
psReader.prependListener("console", (s) => console.log(s));
psReader.prependListener("push-display-queue", (input) => {
  displayQ.addItem(input);
});
psReader.prependListener("output-queue", (res) => {
  outputQ.addItem(JSON.stringify(res));
});

// WRITER TO LEANAIDE
psWriter.prependListener("write", (item) => {
  d.write(item);
  const written = d.write("\r\n");
  return [item, written];
});

// LEANAIDE KILLER
psKiller.prependListener("close", (_) => d.emit("close"));
psKiller.prependListener("error", (_) => d.emit("error", _));

const start = async () => {
  // initialize state to "not-ready"
  void initState();
  try {
    for await (const element of on(d, "data")) {
      if (element) {
        // send to the display queue
        psReader.emit("push-display-queue", element.toString());
      }
    }
  } catch (err) {
    psKiller.emit("error", err);
  }

  return {
    stop: () => {
      psKiller.emit("close");
    },
  };
};

export { psReader, psWriter, start };
