import dgram from "node:dgram";
import fs from "node:fs";

const CHANNEL_FILE = "/tmp/splitlog_channel";
const idleTimeout = 1000; // ms of idle time before cleanup

let socket = null;
let cleanupTimer = null;
let port = null;

function closeSocket() {
  socket && typeof socket.close === "function" && socket.close();
}
 
process.on( "exit", () => {
  closeSocket();
});

process.on( "SIGINT", () => {
  closeSocket();
  process.exit();
});

process.on( "SIGTERM", () => {
  closeSocket();
  process.exit();
});    

function createSocket() {
  if (!socket || socket._handle === null) {
    socket = dgram.createSocket("udp4");
  }
}

function scheduleCleanup() {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }
  cleanupTimer = setTimeout(() => {
    if (socket) {
      socket.close();
      socket = null;
    }
  }, idleTimeout);
}

function discoverOpenPort() {
  try {
    return parseInt(fs.readFileSync(CHANNEL_FILE, "utf8"), 10);
  } catch (err) {
    return 0;
  }
}

/**
 * Creates a wrapped logger that sends messages via both debug and UDP.
 * @param {Function} logger - A `debug` logger instance.
 * @param {Object} [options]
 * @param {string} [options.host="127.0.0.1"]
 * @param {number} [options.port=41234]
 */
export default function splitlog( logger, options = {} ) {
  port = port || options.port || discoverOpenPort();
  const host = options.host || "127.0.0.1",
        channel = logger.namespace;

  return function (...args) {
    // Original debug output
    logger(...args);

    // Ensure socket is open
    createSocket();

    const message = JSON.stringify({
      channel,
      options,
      timestamp: new Date().toISOString(),
      payload: args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" "),
    });

    socket.send(Buffer.from(message), port, host, (err) => {
      if (err) {
        console.error(`[splitlog] UDP error: ${err.message}`);
      }
      scheduleCleanup();
    });
  };
}
