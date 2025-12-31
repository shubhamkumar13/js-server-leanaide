import express from "express";
import * as http from "node:http";
import { Server } from "socket.io";
import * as amqp from "amqplib/callback_api";

export const startProducerServer = async function () {
  const app = express();
  const server = http.createServer(app);

  // For producer clients
  const clientIo = new Server(server);

  const pendingRequests = new Map();

  // mutable state
  let channel: amqp.Channel | null = null;

  // Connect to consumer server
  // <----------------------------------->
  // |<-- start consumer socket -->|
  // Handle connection to consumer server
  amqp.connect("amqp://localhost", function (err, conn) {
    if (err) throw err;

    conn.createChannel(function (err, ch) {
      if (err) throw err;
      channel = ch;

      // declare tasks queue
      ch.assertQueue("tasks", {
        durable: true,
      });

      // also declare results queue
      ch.assertQueue("results", {
        durable: true,
      });

      // start consuming results
      ch.consume("results", function (msg) {
        if (!msg) return;

        const { requestId, output, error, partialOutput } = JSON.parse(msg.content.toString());

        const clientSocketId = pendingRequests.get(requestId);

        if (clientSocketId) {
          const clientSocket = clientIo.sockets.sockets.get(clientSocketId);

          if (clientSocket) {
            if (output) {
              // Send the full output array to the client
              clientSocket.emit("produce-result", { requestId, output });
            } else if (error) {
              // Send error and any partial output
              clientSocket.emit("produce-result", { requestId, error, partialOutput });
            }
          }
          pendingRequests.delete(requestId);
        }
        ch.ack(msg);
      });
    });
  });

  // <----------------------------------->
  // |<-- start producer socket -->|
  // Handle producer client connections
  //@ts-ignore
  clientIo.on("connection", function (socket) {
    console.log("Producer client connected:", socket.id);

    //@ts-ignore
    socket.on("produce", function (data, ackFn) {
      // Unique ID for this request
      const requestId = crypto.randomUUID();
      pendingRequests.set(requestId, socket.id);

      // Immediate acknowledgement (optional, but good practice)
      const task = {
        requestId,
        data,
      };

      if (!channel) throw new Error("channel is empty");

      channel.sendToQueue("tasks", Buffer.from(JSON.stringify(task)), { persistent: true });

      ackFn({ status: "queued", requestId });

      // Forward the task to the consumer server
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      // Remove all pending requests for this client
      for (const [reqId, sId] of pendingRequests.entries()) {
        if (sId === socket.id) pendingRequests.delete(reqId);
      }
    });
  });
  // |<-- end producer socket -->|
  // <----------------------------------->

  await new Promise<void>(function (resolve) {
    server.listen(3000, resolve);
  });
  console.log(`Producer listening on 3000`);

  return {
    stop: async function () {
      // close socket
      clientIo.close();
      // close server
      server.close();
    },
  };
};
