# Feature Parity Checklist: `api_server.py` vs. `index.ts`

This checklist outlines the features present in `api_server.py` that need to be implemented in the `index.ts` server to achieve 1:1 parity.

### Core Server & Endpoints
- [ ] Implement a `GET /` endpoint that provides a simple status message.
- [ ] Add a new endpoint `POST /run-sim-search` for handling similarity searches.
- [ ] Make the main server multi-threaded or ensure it can handle concurrent requests efficiently (Python uses `ThreadingMixIn`; Bun's runtime may handle this automatically).

### AI Model & Search Integration
- [ ] Implement a lazy-loading mechanism for a sentence-transformer model (e.g., using `transformers.js`).
- [ ] The model loading should happen in a background "thread" (e.g., a worker or non-awaited promise) to not block server startup.
- [ ] Integrate a similarity search module (like the `similarity_search.py` script) and call it from the `/run-sim-search` endpoint.

### Child Process Management

This section covers how the `leanaide_process` is started, managed, and restarted. The goal is to have a single, long-running process that is only started when needed and is automatically revived if it crashes.

- [ ] **Change the `leanaide_process` to be started lazily on the first request, rather than at startup.**
    *   **Why:** This saves resources by not running the process when the server is idle. It also ensures the process is always running the latest configuration, as environment variables are read just before it starts.
    *   **How:** Maintain a global variable for the process. In your request handler, check if this variable is `null` or if the process has exited before attempting to communicate with it.

    ```typescript
    // In the global scope of index.ts
    let leanaideProcess: ChildProcess | null = null;

    // Inside your request handler (e.g., the POST handler)
    // You would wrap this logic in a dedicated function.
    if (leanaideProcess === null || leanaideProcess.exitCode !== null) {
      console.log("Starting new leanaide_process...");
      leanaideProcess = spawn(...);
      // ... attach listeners for stdout, stderr, etc.
    }
    ```

- [ ] **Implement a locking mechanism to prevent race conditions where multiple concurrent requests might try to start the process at the same time.**
    *   **Why:** If two requests arrive simultaneously when the process is down, both might try to start a new process, leading to resource conflicts and unpredictable behavior.
    *   **How:** Use a "starting promise" that represents the process of spinning up the new child process. If a second request comes in while the first is still starting the process, the second request should `await` this "starting promise" instead of trying to create its own.

    ```typescript
    let leanaideProcess: ChildProcess | null = null;
    let startingPromise: Promise<void> | null = null;

    async function ensureProcessIsRunning() {
      // If a startup is already in progress, wait for it to complete.
      if (startingPromise) {
        await startingPromise;
        return;
      }

      if (leanaideProcess === null || leanaideProcess.exitCode !== null) {
        // Create a promise to represent the startup task.
        startingPromise = new Promise((resolve, reject) => {
          const newProcess = spawn(...);
          newProcess.on('spawn', () => {
            console.log("Process spawned successfully.");
            leanaideProcess = newProcess;
            startingPromise = null; // Clear the lock
            resolve();
          });
          newProcess.on('error', (err) => {
            console.error("Failed to start process:", err);
            startingPromise = null; // Clear the lock
            reject(err);
          });
          // It's also good practice to listen for early exits
          newProcess.on('exit', (code) => {
             if (leanaideProcess !== newProcess) return; // Not the process we were starting
             console.error(`Process exited prematurely with code ${code}`);
             startingPromise = null;
             reject(new Error(`Process exited with code ${code}`));
          });
        });
        await startingPromise;
      }
    }
    ```

- [ ] **Add logic to restart the process if it has crashed (detected via a `BrokenPipeError` equivalent or process exit).**
    *   **Why:** This makes the server self-healing. If the child process crashes due to an internal error, the server can automatically recover on the next request.
    *   **How:** The key is to reset the global `leanaideProcess` variable to `null` when a fatal communication error occurs. The lazy-start logic will then handle restarting it on the next request. The most common error indicating a crashed process is an `EPIPE` (Broken Pipe) error when trying to write to `stdin`.

    ```typescript
    // Inside your function that writes to the process (e.g., sendToLeanaide)
    leanaideProcess.stdin.write(message + '\n', (err) => {
      if (err) {
        // 'EPIPE' means the reading end of the pipe has closed.
        if (err.code === 'EPIPE') {
          console.error("Process crashed (Broken Pipe). It will be restarted on the next request.");
          // By setting this to null, our `ensureProcessIsRunning` logic
          // will automatically create a new process on the next API call.
          leanaideProcess = null;
        }
        reject(err); // Reject the promise to signal the failure
      }
    });
    ```

### Configuration & Security
- [ ] Implement a function to dynamically build the `leanaide_process` command string from environment variables, similar to `updated_leanaide_command()`.
- [ ] Add a utility function to hide sensitive information (like API keys) from the command string when it's logged.

### Request Handling & Logging
- [ ] Implement a mechanism to capture the `stdout` and `stderr` of the child process on a **per-request** basis.
- [ ] Modify the JSON response for all endpoints to include a `logs` field containing the captured logs for that specific request.
- [ ] Implement a robust timeout for waiting on a response from the child process.

### Error Handling
- [ ] Add specific error handling for a request timeout, returning a `504` status code with a JSON error message.
- [ ] Add specific error handling for a "broken pipe" scenario (when the child process crashes), returning a `500` status code with a JSON error message.
- [ ] Standardize all error responses to return a JSON object containing an `error` key and a `logs` key.

### Server Lifecycle
- [ ] Implement a graceful shutdown sequence on `KeyboardInterrupt` (`process.on('SIGINT', ...)` in Node.js) to ensure the `leanaide_process` is terminated when the server stops.