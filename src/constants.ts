import path from "node:path";

// Configuration from environment variables
export const {
  RABBIT_HOST = "localhost",
  RABBIT_PORT = "5672",
  RABBIT_USER = "guest",
  RABBIT_PASS = "guest",
  TASK_QUEUE = "tasks",
  RESULT_QUEUE = "results",
  PROCESS_CMD = "lake",
  PROCESS_ARGS = "exe leanaide_process",
  TASK_TIMEOUT_MS = 60000,
  PROCESS_CWD = path.resolve(import.meta.dir, "../../"),
} = process.env;

export const RABBIT_URL = `amqp://${RABBIT_USER}:${RABBIT_PASS}@${RABBIT_HOST}:${RABBIT_PORT}`;
export const processArgs = PROCESS_ARGS.split(" ").filter((arg) => arg.trim() !== "");
