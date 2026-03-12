import { pipe, String } from "effect";
import path from "node:path";

// Configuration from environment variables
export const {
  TASK_QUEUE = "tasks",
  RESULT_QUEUE = "results",
  PROCESS_CMD = "lake",
  PROCESS_ARGS = "exe leanaide_process",
  TASK_TIMEOUT_MS = 600000,
  PRODUCER_SERVER_PORT = 7654,
  PROCESS_CWD = path.resolve(import.meta.dir, "../../"),
} = process.env;

export const processArgs = PROCESS_ARGS.split(" ").filter((arg) => arg.trim() !== "");

//@ts-ignore
const isServerReady = (line) =>
  pipe(
    line,
    (_) => {
      if (_) {
        return _.toString().trim();
      }
    },
    String.includes("Server ready"),
  );

//@ts-ignore
const isOutputSent = (line) =>
  pipe(
    line,
    (_) => {
      if (_) {
        return _.toString().trim();
      }
    },
    String.includes("Output sent"),
  );

//@ts-ignore
const isRanSuccessfully = (line) =>
  pipe(
    line,
    (_) => {
      if (_) {
        return _.toString().trim();
      }
    },
    String.includes("Ran successfully"),
  );

export { isServerReady, isRanSuccessfully, isOutputSent };
