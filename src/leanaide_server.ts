// leanaide_server.ts
import { execa } from "execa";
import * as amqp from "amqplib/callback_api";
import {
  RESULT_QUEUE,
  RABBIT_URL,
  TASK_QUEUE,
  PROCESS_CMD,
  PROCESS_CWD,
  processArgs,
  TASK_TIMEOUT_MS,
} from "./constants";
import { once } from "events";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------
interface Line {
  readonly stream: "stdout" | "stderr";
  readonly line: string;
}

const linesToString = function (arr: Array<Line>): string {
  return arr.reduce(function (a, b) {
    return `${a}\n${b.line}`;
  }, "");
};

interface Task {
  readonly requestId: string;
  readonly msg: amqp.Message;
  readonly channel: amqp.Channel;
  readonly outputLines: Array<Line>;
  readonly timeout: NodeJS.Timeout;
  // TL;DR
  // not readonly because this flag
  // checks for duplicate acknowledgement
  completed: boolean;

  /*
/ ================================================
/ QUESTION :
[*] Why add a boolean flag if  "Server ready ..." 
    is already an indicator?
/ =================================================

 REASON : 
 [*] the marker ("Server ready. Waiting for input...")
  appears twice so finishCurrentTask is also called twice. 

 [*] It leads to a duplicate acknowledgement and the 
    RabbitMQ PRECONDITION_FAILED error. 

 [*] A more reliable approach is to detect the final JSON 
 output line that contains the requestId and result/error. 
 This line is unique and signals the true completion of the task.
*/
}

export async function startLeanaideServer() {
  console.log("Starting Leanaide server...");

  // Spawn the external process
  const ps = execa(PROCESS_CMD, processArgs, {
    detached: false,
    stdio: ["pipe", "pipe", "pipe"],
    cwd: PROCESS_CWD,
  });

  let currentTask: Task | null = null;

  // --------------------------------------------------------------------
  // Helper to complete the task
  // --------------------------------------------------------------------
  const finishCurrentTask = function (success: boolean, errorMessage?: string) {
    if (!currentTask || currentTask.completed) return;

    const { requestId, msg, channel, outputLines, timeout } = currentTask;

    // =============================================
    // [REMEMBER]
    // currently tasks are fired at 60 secs (max)
    // if task finishes before 60 secs,
    // we should cancel the timeout allocated
    /*
      -- Fn Start --

        const timeout = setTimeout(function () {
          finishCurrentTask(false, "Task timeout");
        }, Number(TASK_TIMEOUT_MS));

      -- Fn End
    */
    // TASK_TIMEOUT_MS or 60 secs
    // eliminating the excess time allocated
    // and clear timeout
    clearTimeout(timeout);

    // the only caveat is placing this inside the
    // function we are passing to setTimeout
    // setTimeout helps in making function "atomic"
    // by providing hardcoded time cycles for compute

    // This pattern guarantees that the completion
    // logic runs at most once per task, which
    // is a form of concurrency control but not
    // the same as atomicity.
    // ==============================================

    // Mark as completed to prevent re‑entry
    currentTask.completed = true;

    if (success) {
      const resultMsg = {
        requestId,
        output: outputLines,
      };

      const outputString = linesToString(outputLines);

      channel.sendToQueue(RESULT_QUEUE, Buffer.from(JSON.stringify(resultMsg)), {
        persistent: true,
      });

      channel.ack(msg);
      console.log(
        `Task ${requestId} completed containing 
        \n\t ${outputString} \t\n
        \t with ${outputLines.length} lines \n`,
      );
    } else {
      const outputString = linesToString(outputLines);

      const errorMsg = {
        requestId,
        error: errorMessage || "Task failed",
        partialOutput: outputLines,
      };

      channel.sendToQueue(RESULT_QUEUE, Buffer.from(JSON.stringify(errorMsg)), {
        persistent: true,
      });

      // ===============================================
      // [REMEMBER why nack]
      /*
       [*] msg – the specific message to reject.

       [*] allUpTo (false) – reject only this message, 
          not any previous unacknowledged ones.
        
       [*] requeue (false) – do not requeue the message; 
          it will be discarded (or sent to a dead‑letter 
          queue if configured).
      */

      channel.nack(msg, false, false);
      // ================================================

      console.error(
        `Task ${requestId} failed: ${errorMessage} 
        \n\t ${outputString} \t\n`,
      );
    }

    currentTask = null;
  };

  // --------------------------------------------------------------------
  // Line‑buffering for stdout and stderr
  // --------------------------------------------------------------------
  let stdoutBuffer = "";
  ps.stdout.on("data", function (chunk: Buffer) {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed === "") continue;

      // Store line if a task is active
      if (currentTask && !currentTask.completed) {
        currentTask.outputLines.push({
          stream: "stdout",
          line: trimmed,
        });
      }

      // Try to parse JSON – this may be the final result
      try {
        const parsed = JSON.parse(trimmed);
        // If we have an active task and the JSON contains its requestId, complete it
        if (currentTask && !currentTask.completed && parsed.requestId === currentTask.requestId) {
          // The line itself is already stored; we can complete based on presence of result/error

          const success = !parsed.error; // assume result field indicates success
          finishCurrentTask(success, parsed.error);
        }
      } catch {
        // Not JSON so ignore and continue
        continue;
      }
    }
  });

  let stderrBuffer = "";
  ps.stderr.on("data", function (chunk: Buffer) {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed === "") continue;

      // Store the error lines with a different label
      if (currentTask && !currentTask.completed) {
        currentTask.outputLines.push({
          stream: "stderr",
          line: trimmed,
        });
      }
    }
  });

  // Process exit handling
  ps.on("exit", function (code, signal) {
    console.log(`Process exited with code ${code} signal ${signal}`);

    if (currentTask && !currentTask.completed) {
      finishCurrentTask(false, `Process exited unexpectedly (code ${code})`);
    }
  });

  ps.on("error", function (err) {
    console.error(`Process error: ${err}`);

    if (currentTask && !currentTask.completed) {
      finishCurrentTask(false, `Process error: ${err.message}`);
    }
  });

  // --------------------------------------------------------------------
  // RabbitMQ connection with automatic reconnection
  // --------------------------------------------------------------------
  let rabbitConn: amqp.Connection | null = null;
  let rabbitChannel: amqp.Channel | null = null;

  const connectToRabbitMQ = function () {
    amqp.connect(RABBIT_URL, function (err, conn) {
      if (err) {
        console.error(`Failed to connect to RabbitMQ, retrying in 5s... ${err.message}`);
        setTimeout(connectToRabbitMQ, 5000);
        return;
      }

      rabbitConn = conn;
      console.log("Connected to RabbitMQ");

      conn.on("error", function (e) {
        console.error(`RabbitMQ connection error: ${e.message}`);
      });

      conn.on("close", function () {
        console.log("RabbitMQ connection closed, reconnecting...");
        setTimeout(connectToRabbitMQ, 5000);
      });

      conn.createChannel(function (err, ch) {
        if (err) {
          console.error(`Failed to create channel:`, err);
          return;
        }

        rabbitChannel = ch;

        ch.assertQueue(TASK_QUEUE, { durable: true });
        ch.assertQueue(RESULT_QUEUE, { durable: true });
        ch.prefetch(1);

        console.log(`Leanaide server waiting for tasks...`);

        ch.consume(TASK_QUEUE, function (msg) {
          if (!msg) return;

          const { requestId, data } = JSON.parse(msg.content.toString());

          console.log(`Received task ${requestId}`);

          if (currentTask) {
            console.error(`Task received while another is active! This should not happen.`);
            ch.nack(msg, false, true);
            return;
          }

          // Set a timeout for the task
          const timeout = setTimeout(function () {
            finishCurrentTask(false, `Task timeout`);
          }, Number(TASK_TIMEOUT_MS));

          // Initialize current task
          currentTask = {
            requestId,
            msg,
            channel: ch,
            outputLines: [],
            timeout,
            completed: false,
          };

          // Write to process stdin (include requestId for correlation)
          const inputLine =
            JSON.stringify({
              requestId,
              ...data,
            }) + "\n";

          ps.stdin.write(inputLine);
          console.log(`[stdin] ${inputLine.trim()}`);
        });
      });
    });
  };

  connectToRabbitMQ();

  // --------------------------------------------------------------------
  // Return stop function for graceful shutdown
  // --------------------------------------------------------------------
  return {
    stop: async () => {
      console.log("Stopping Leanaide server...");

      if (!ps.killed) {
        ps.kill();
        await once(ps, "exit").catch((_) => _);
      }

      if (rabbitChannel) {
        await rabbitChannel.close((_) => _);
      }
      if (rabbitConn) {
        await rabbitConn.close();
      }
      console.log("Leanaide server stopped.");
    },
  };
}
