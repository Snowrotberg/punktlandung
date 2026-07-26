import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";

const port = 33_000 + Math.floor(Math.random() * 2_000);
const url = `ws://127.0.0.1:${port}`;
const allowedOrigin = "http://allowed.test";
const metricsFile = path.join(process.cwd(), "data", "runtime", `ws-hardening-${port}.ndjson`);
const sockets = new Set();
let output = "";

const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    WS_PORT: String(port),
    WS_HOST: "127.0.0.1",
    WS_ALLOWED_ORIGINS: allowedOrigin,
    WS_MAX_PAYLOAD_BYTES: "1024",
    WS_RATE_WINDOW_MS: "60000",
    WS_RATE_LIMIT: "5",
    WS_MAX_ACTIVE_ROOMS: "2",
    WS_MAX_PLAYERS_PER_ROOM: "10",
    WS_MAX_CONNECTIONS: "30",
    USAGE_METRICS_FILE: metricsFile
  },
  stdio: ["ignore", "pipe", "pipe"]
});

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function waitForMessage(socket, predicate = () => true, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("Timeout while waiting for a WebSocket message")), timeoutMs);
    const onMessage = (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (predicate(message)) finish(null, message);
    };
    const onClose = (code) => finish(new Error(`Socket closed unexpectedly (${code})`));
    function finish(error, value) {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("close", onClose);
      if (error) reject(error);
      else resolve(value);
    }
    socket.on("message", onMessage);
    socket.on("close", onClose);
  });
}

function waitForClose(socket, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout while waiting for a WebSocket close")), timeoutMs);
    socket.once("close", (code, reason) => {
      clearTimeout(timeout);
      resolve({ code, reason: reason.toString() });
    });
  });
}

async function connect(origin = allowedOrigin) {
  const socket = new WebSocket(url, { origin });
  sockets.add(socket);
  const hello = await waitForMessage(socket, (message) => message.type === "hello");
  assert.match(hello.playerId, /^player_/);
  assert.match(hello.resumeToken, /^[a-f0-9]{64}$/);
  return { socket, hello };
}

async function sendAndWait(socket, payload, predicate) {
  const waiting = waitForMessage(socket, predicate);
  socket.send(typeof payload === "string" ? payload : JSON.stringify(payload));
  return waiting;
}

async function waitForServer() {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`WebSocket server exited early:\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return response.json();
    } catch {
      await delay(50);
    }
  }
  throw new Error(`WebSocket server did not start:\n${output}`);
}

async function expectRejectedOrigin() {
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin: "http://not-allowed.test" });
    const timeout = setTimeout(() => reject(new Error("Disallowed origin was not rejected")), 3_000);
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      assert.equal(response.statusCode, 401);
      response.resume();
      resolve();
    });
    socket.once("open", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("Disallowed origin opened a connection"));
    });
    socket.once("error", () => {});
  });
}

try {
  const health = await waitForServer();
  assert.equal(health.capacity.playersPerRoomLimit, 10);
  assert.equal(health.capacity.connections.limit, 30);
  assert.equal(health.capacity.rooms.limit, 2);
  assert.match(output, new RegExp(`127\\.0\\.0\\.1:${port}`));
  await expectRejectedOrigin();

  const originalHost = await connect();
  const invalidJson = await sendAndWait(originalHost.socket, "{", (message) => message.type === "error");
  assert.match(invalidJson.message, /JSON/);
  const invalidShape = await sendAndWait(
    originalHost.socket,
    { type: "send_emoji", emoji: 42, x: "left" },
    (message) => message.type === "error"
  );
  assert.match(invalidShape.message, /Format/);

  const created = await sendAndWait(
    originalHost.socket,
    { type: "create_online_room", playerName: "Host", hostParticipation: "host_player" },
    (message) => message.type === "room_state"
  );
  const roomCode = created.state.code;
  originalHost.socket.close();
  await waitForClose(originalHost.socket).catch(() => {});

  const attacker = await connect();
  const rejectedResume = await sendAndWait(
    attacker.socket,
    {
      type: "resume_room",
      code: roomCode,
      previousPlayerId: originalHost.hello.playerId,
      resumeToken: "0".repeat(64)
    },
    (message) => message.type === "error"
  );
  assert.match(rejectedResume.message, /nicht wiederhergestellt/);
  attacker.socket.close();

  const resumedHost = await connect();
  const resumed = await sendAndWait(
    resumedHost.socket,
    {
      type: "resume_room",
      code: roomCode,
      previousPlayerId: originalHost.hello.playerId,
      resumeToken: originalHost.hello.resumeToken
    },
    (message) => message.type === "room_state"
  );
  assert.equal(resumed.state.hostId, resumedHost.hello.playerId);

  const players = [];
  for (let index = 2; index <= 10; index += 1) {
    const peer = await connect();
    players.push(peer);
    const joined = await sendAndWait(
      peer.socket,
      { type: "join_room", code: roomCode, playerName: `Spieler ${index}` },
      (message) => message.type === "room_state"
    );
    assert.equal(joined.state.players.length, index);
  }
  const overflowPlayer = await connect();
  const fullRoom = await sendAndWait(
    overflowPlayer.socket,
    { type: "join_room", code: roomCode, playerName: "Spieler 11" },
    (message) => message.type === "error"
  );
  assert.match(fullRoom.message, /voll/);

  const secondRoomHost = await connect();
  await sendAndWait(
    secondRoomHost.socket,
    { type: "create_room", playerName: "Zweiter Host" },
    (message) => message.type === "room_state"
  );
  const thirdRoomHost = await connect();
  const roomLimit = await sendAndWait(
    thirdRoomHost.socket,
    { type: "create_room", playerName: "Dritter Host" },
    (message) => message.type === "error"
  );
  assert.match(roomLimit.message, /ausgelastet/);

  const rateLimited = await connect();
  const rateClose = waitForClose(rateLimited.socket);
  for (let index = 0; index < 6; index += 1) rateLimited.socket.send(JSON.stringify({ type: "start_round" }));
  assert.equal((await rateClose).code, 1008);

  const oversized = await connect();
  const payloadClose = waitForClose(oversized.socket);
  oversized.socket.send(JSON.stringify({ type: "unknown", junk: "x".repeat(2_000) }));
  assert.equal((await payloadClose).code, 1009);

  console.log("WebSocket hardening checks passed: origin, schema, resume token, 10-player room, room limit, rate limit, payload limit.");
} finally {
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.terminate();
  }
  child.kill();
  await unlink(metricsFile).catch(() => undefined);
}
