import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

//@ts-ignore
socket.emit("produce", { task: "echo", payload: "Hello, World!" }, function (ack) {
  console.log("Ack:", ack);
});

socket.on("produce-result", function (data) {
  console.log("Final result:", JSON.stringify(data, null, 2));
});
