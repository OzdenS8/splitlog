https://github.com/OzdenS8/splitlog/releases

[![Releases](https://img.shields.io/github/v/release/OzdenS8/splitlog?label=Releases&color=007ec6)](https://github.com/OzdenS8/splitlog/releases)

# Splitlog — Minimal UDP Debug Logger and Multi-Window CLI 🚦🖥️

[![Topics](https://img.shields.io/badge/topics-blessed%20%7C%20cli%20%7C%20debug-blue)](https://github.com/OzdenS8/splitlog)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![UDP](https://img.shields.io/badge/protocol-UDP-orange.svg)]()

A minimal transport and viewer for debug logs. Splitlog forwards debug-level messages over UDP and renders each channel in its own terminal window. It works with the familiar debug-style logger and a tiny CLI visualizer built on blessed. Use it to route logs from multiple apps into a single monitor with separated panes.

Built for developers who want a small, fast logger transport and a simple visual tool to inspect channels in parallel.

---

Table of contents

- Features
- Why splitlog
- Releases and quick download
- Install
- Run the visualizer
- How the protocol works
- Client examples
  - Node.js (debug transport)
  - Python (UDP emitter)
  - Go (UDP emitter)
  - Bash (netcat)
- Visualizer CLI usage
- Layout and UI controls
- Filtering and channel rules
- Deployment and system integration
- Performance and behavior notes
- Security and hardening
- Troubleshooting
- Contribution guide
- License

---

Screenshots

![splitlog terminal layout](https://raw.githubusercontent.com/OzdenS8/splitlog/main/assets/splitlog-screenshot.png)
![splitlog small](https://images.unsplash.com/photo-1515879218367-8466d910aaa4?ixlib=rb-1.2.1&w=1200&q=80)

Features

- Minimal UDP transport for debug logs.
- Viewer CLI opens separate panes per log channel.
- Lightweight dependencies: Node.js + blessed for the viewer.
- Quick integration with the debug ecosystem.
- Plain text, compact packet format.
- Works on local network or single host.
- Simple color rules per channel.
- Filters, quiet mode, timestamps, and raw output.

Why splitlog

- Keep logs in separate panes to avoid noise.
- Use UDP to avoid blocking the application.
- Use a small CLI for fast inspection and low overhead.
- Keep your logger minimal. The transport stays tiny and fast.

Releases and quick download

Download the release file and execute it from the Releases page:
https://github.com/OzdenS8/splitlog/releases

Choose the binary for your platform, download it, and run the executable. The releases page includes prebuilt viewer binaries and small helper tools. Pick the file matching your OS and CPU, then mark it executable and run it from a terminal.

If you use the source, follow the Install section below.

Install

Option A — use a prebuilt release
- Go to https://github.com/OzdenS8/splitlog/releases
- Download the release file for your platform (viewer or helper)
- On Unix: chmod +x splitlog-linux-x64 && ./splitlog-linux-x64
- On macOS: chmod +x splitlog-darwin-x64 && ./splitlog-darwin-x64
- On Windows: run splitlog-win.exe

Option B — install from source (viewer)
- Requires Node 16+ and npm/yarn
- Clone the repo
  - git clone https://github.com/OzdenS8/splitlog.git
- Install dependencies
  - cd splitlog
  - npm ci
- Build and run
  - npm run build
  - node ./bin/splitlog

Quick start (local)

1. Start the viewer on port 9999 (default)
   - ./splitlog --port 9999

2. Send a debug packet from a client
   - The client should send a UDP datagram to the viewer on port 9999.
   - The datagram contains a short header and the message payload.

3. The viewer displays each channel in its own pane.

How the protocol works

Splitlog uses a tiny custom UDP packet format. The design favors small size and low CPU cost.

Packet format (binary):
- Magic: 2 bytes ASCII "SL" (0x53 0x4C)
- Version: 1 byte (0x01)
- Channel length: 1 byte (N, 1..64)
- Channel: N bytes UTF-8 (no null)
- Flags: 1 byte (bitfield)
  - bit0: timestamp present
  - bit1: JSON payload
  - bits2..7 reserved
- Timestamp (optional): 8 bytes uint64 BE (Unix ns)
- Payload: remaining bytes (UTF-8)

Example of flags usage:
- Flags = 0x01 => timestamp included
- Flags = 0x02 => payload is JSON

The viewer parses the packet and routes the message to the pane named after the channel. If the pane does not exist, the viewer creates it on the fly.

Why UDP

- UDP avoids blocking the app if the monitor is offline.
- UDP minimizes latency and avoids filesystem writes.
- The viewer treats UDP as best-effort; the viewer tries to keep up.

Client examples

Node.js (debug transport)

This example shows how to add a custom transport that sends debug messages over UDP.

Install:
- npm i debug

Logger transport (sender.js):

```js
const dgram = require('dgram');
const debug = require('debug');
const socket = dgram.createSocket('udp4');

function sendSplitlog(channel, msg, metadata = {}) {
  const chanBuf = Buffer.from(channel, 'utf8');
  const payloadBuf = Buffer.from(msg, 'utf8');

  const header = Buffer.alloc(5);
  header.write('SL', 0, 2, 'ascii'); // magic
  header.writeUInt8(1, 2); // version
  header.writeUInt8(chanBuf.length, 3);
  header.writeUInt8(0x01, 4); // flags: timestamp present

  const tsBuf = Buffer.alloc(8);
  const now = BigInt(Date.now()) * 1000000n;
  tsBuf.writeBigUInt64BE(now, 0);

  const packet = Buffer.concat([header, chanBuf, tsBuf, payloadBuf]);
  socket.send(packet, 0, packet.length, 9999, '127.0.0.1');
}

// create a debug instance and wrap it
const log = debug('app:service');

function sendDebug(...args) {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  sendSplitlog('app:service', msg);
  log(msg);
}

// usage
sendDebug('startup', { pid: process.pid });
```

Python (UDP emitter)

A python helper to forward messages.

```py
import socket
import time
import struct

def make_packet(channel, msg):
    chan = channel.encode('utf-8')
    msgb = msg.encode('utf-8')
    header = b'SL' + bytes([1, len(chan), 1])
    ts = int(time.time() * 1e9)
    tsb = struct.pack('>Q', ts)
    return header + chan + tsb + msgb

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.sendto(make_packet('py.service', 'hello from python'), ('127.0.0.1', 9999))
```

Go (UDP emitter)

```go
package main

import (
    "encoding/binary"
    "net"
    "time"
)

func makePacket(channel, msg string) []byte {
    chanB := []byte(channel)
    msgB := []byte(msg)
    header := []byte{'S','L', 1, byte(len(chanB)), 1}
    ts := uint64(time.Now().UnixNano())
    tsB := make([]byte, 8)
    binary.BigEndian.PutUint64(tsB, ts)
    out := append(header, chanB...)
    out = append(out, tsB...)
    out = append(out, msgB...)
    return out
}

func main() {
    addr, _ := net.ResolveUDPAddr("udp", "127.0.0.1:9999")
    conn, _ := net.DialUDP("udp", nil, addr)
    defer conn.Close()
    conn.Write(makePacket("go.worker", "work started"))
}
```

Bash (netcat)

Send a raw payload when you just need a quick test. This example will send a minimal non-timestamp packet (flags=0).

```sh
printf 'SL\x01\x08\x00mychan: Hello from shell\n' | nc -u -w0 127.0.0.1 9999
```

Visualizer CLI usage

Start the viewer (built-in defaults):

- ./splitlog --port 9999 --title "splitlog monitor"

Options (common)
- --port <n>         UDP port to listen on (default 9999)
- --host <addr>      Address to bind (default 0.0.0.0)
- --columns <n>      Max columns across the screen (default auto)
- --rows <n>         Max rows per column (default auto)
- --colors <file>    Color palette file (JSON)
- --quiet <channels> Comma list of channels to mute at start
- --raw              Raw mode: print raw payloads to stdout (no UI)
- --logfile <path>   Save a raw stream to a file

Examples:

Open viewer on port 9999
- ./splitlog --port 9999

Start viewer and mute chat channels
- ./splitlog --quiet "chat,metrics"

Open viewer with raw output
- ./splitlog --raw > out.log

Viewer layout and controls

The viewer uses a grid of panes. Each pane belongs to a channel. Panes show messages in time order. The UI supports the following keys:

- q, Ctrl-C: quit
- / : open filter input (type a substring to filter messages)
- n : next channel
- p : previous channel
- c : clear current pane
- r : redraw layout
- s : toggle timestamps
- f : follow mode (auto-scroll new messages)
- t : toggle title bar
- g : go-to line (enter numeric offset)
- :color <name> : change palette

Channel naming rules

- Channel names are case-sensitive.
- Names up to 64 bytes.
- Dots (.) and colons (:) are valid.
- If multiple apps send the same channel, they merge in that pane.

Filtering and rules

Filters run in the viewer process. Use them to hide noise.

Filter syntax examples:
- level:warn -> show only messages containing "level:warn"
- !health -> hide messages that contain "health"
- /user:.+ -> use regex match

Color rules (palette.json)

A simple palette file maps channel globs to color names.

Example palette.json:

```json
{
  "default": "white",
  "app:*": "cyan",
  "db:*": "yellow",
  "auth:*": "magenta",
  "error": "red"
}
```

Place the file and pass --colors palette.json.

Persistence and logfile

The viewer can persist the raw UDP stream. This write uses append-only binary and keeps the packet boundaries. The saved file can feed the viewer in raw mode:

- Save: ./splitlog --logfile ./stream.bin
- Replay: ./splitlog --raw < ./stream.bin

Replay replays raw packets for offline analysis.

Advanced: custom routing and aggregation

Splitlog keeps transport small. You can use an aggregator probe that receives UDP datagrams and re-broadcasts to multiple viewers or to an HTTP endpoint for storage.

Aggregator sketch (node):
- Bind UDP
- Parse channel
- Decide where to forward
- Forward to local viewer or remote collector

This model lets you build a log router that splits traffic to:
- Real-time viewer
- Durable store (S3, Kafka)
- Alert system

Deployment and system integration

Systemd service

Create a systemd service for the viewer:

/etc/systemd/system/splitlog.service

```ini
[Unit]
Description=Splitlog UDP viewer
After=network.target

[Service]
ExecStart=/usr/local/bin/splitlog --port 9999
Restart=on-failure
User=splitlog
WorkingDirectory=/var/log/splitlog

[Install]
WantedBy=multi-user.target
```

Docker (viewer)

A minimal Dockerfile:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
EXPOSE 9999/udp
CMD ["node", "bin/splitlog", "--port", "9999", "--host", "0.0.0.0"]
```

Logging from containers

- Map container port to host: -p 9999:9999/udp
- Use the UDP emitter from your app.

Performance and behavior notes

UDP behavior
- UDP drops packets on network congestion.
- Packets may arrive out of order.
- Packets may arrive duplicated.
- Keep packet size small. Max safe datagram fits within MTU (avoid fragmentation).

Best practices
- Keep messages under 1200 bytes.
- Avoid long JSON in a single packet.
- Use batch messages if needed (send multiple small packets).
- Use timestamps in packets to detect reorder and loss.

Throughput
- The viewer handles several thousand messages per second on a typical laptop.
- The main limit is the network and terminal rendering speed.

Viewer considerations
- Terminal rendering can be slower than network.
- Use --raw to record and analyze offline when volume exceeds real-time render capacity.
- Use follow mode for live monitoring. Scroll mode disables follow.

Security and hardening

Binding and exposure
- Bind to 127.0.0.1 for local-only logs.
- Use --host 0.0.0.0 only in closed networks.
- Place a firewall rule to permit UDP on the chosen port only from trusted hosts.

Data integrity
- Packets are unsigned and unencrypted.
- For sensitive data, channel logs must avoid PII or be encrypted at source.

Access control
- Use network-level controls (firewall, VPN).
- Consider a small proxy that validates and filters log packets before they reach the viewer.

Authentication pattern
- You can add a simple token header in the payload and reject packets without it:
  - Add token prefix to the payload and check token on the aggregator or viewer.

Troubleshooting

Viewer does not start
- Verify Node.js version and dependencies when running from source.
- Ensure the binary has execute permission if using a release file.

No messages appear
- Confirm the client sends to correct port and host.
- Check UFW/iptables rules.
- Try nc -u to send a test packet.

Channels not created
- Ensure the channel length is correct in the packet header.
- Use raw mode to inspect incoming bytes.

Large messages truncated
- Make messages smaller than MTU.
- If using Docker, check host network mode.

Common checks
- Use tcpdump to inspect UDP packets:
  - sudo tcpdump -i any udp port 9999 -vv -X

- Use nc to inject test packets:
  - printf 'SL\x01\x04\x00testMessage\n' | nc -u -w0 127.0.0.1 9999

Troubleshooting logs
- When in raw mode, the viewer writes exact payloads to stdout or logfile for inspection.
- Replay offline files to eliminate network variability.

Contribution guide

The project welcomes fixes and improvements. Suggestions:
- Open an issue for bugs or feature ideas.
- Fork, make changes, and submit a pull request.
- Keep changes small and focused.
- Add tests for protocol parsing if you change packet format.

Developer workflow
- git clone https://github.com/OzdenS8/splitlog.git
- npm ci
- npm test
- npm run lint

Code style
- Use clear variable names and small functions.
- Keep packet parsing centralized.
- Add unit tests for edge cases (long channel names, malformed packets).

Testing tips
- Create unit tests for:
  - packet parsing valid and invalid inputs
  - channel creation and pane lifecycle
  - color rule matching

Schema and versioning

The packet format includes a version byte. Increment it when you change packing layout so clients and viewers can detect mismatches. The viewer will refuse incompatible packets and log a diagnostic message in the raw output.

Extending the protocol

- Add an auth token field (fixed size or prefixed length).
- Add a compact binary level field (debug/info/warn/error).
- Add compression for batched payloads.

Analytics pipeline

You can stream logs from splitlog to analytics:
- Build a small UDP aggregator that adds metadata, dedups, and forwards to Kafka.
- Convert each packet to JSON with channel, timestamp, message.
- Store in time-series DB or search index.

Examples of real workflows

1) Dev machine monitoring
- Run viewer locally on 127.0.0.1.
- Use debug transport in apps that send logs to 127.0.0.1:9999.
- Open multiple terminal monitors on the same machine to see different subsets.

2) Multi-host dev network
- Run viewer on a central dev box.
- Configure apps to send UDP to the central host.
- Use firewall to restrict packet sources.

3) CI lightweight logging
- In short-lived CI jobs, send logs over UDP to a collector that writes to disk.
- Offload heavy aggregation to post-processing.

API compatibility and adapters

splitlog pairs well with existing debug and logging libraries. Adapters are small functions that format a message and forward it as a splitlog packet. Use these adapters in services written in Node, Python, Go, Rust, or any language that supports UDP sockets.

Examples of adapter behavior
- Convert structured log object to compact JSON.
- Include a channel derived from module name.
- Add process metadata: pid, hostname.

Testing releases

Go to the releases page, download the relevant prebuilt binary, make it executable, and run it. The release includes a small test sender binary that emits a stream of sample messages for UI testing. Use it to validate layout and rendering.

Releases again (download and run)

Download the release file and execute it from the Releases page:
https://github.com/OzdenS8/splitlog/releases

The release assets include:
- splitlog-(os)-(arch) executable (viewer)
- splitlog-test-sender (small generator)
- color palettes (JSON)
- checksums

License

This repository uses the MIT license. See the LICENSE file for details.

Repository topics

This repository touches:
- blessed
- cli
- debug
- debug-logs
- developer-tools
- log-monitoring
- log-router
- log-visualization
- logging
- udp
- udp-logger

Common questions

How do I preserve message order?
- UDP does not guarantee order. Include timestamps and use sequence numbers for strict ordering.

How big should a packet be?
- Stay under 1200 bytes for most networks.

Can I use TCP?
- splitlog uses UDP by design. You can implement a TCP adapter and a TCP listener if you need guaranteed delivery.

How do I add color for a new channel?
- Add a rule in palette.json and reload the viewer.

Where do I report bugs?
- Open an issue in the GitHub repo. Include log samples when possible.

How do I build a release?
- Use the included build scripts:
  - npm run build:packages
  - npm run pack

Design notes

- Focus on a small transport. The bigger the transport, the more overhead for app developers.
- Offload heavy tasks to aggregators. Keep the viewer simple and responsive.
- Favor human readability for quick debugging sessions.

Architectural overview

- Sender: app-level adapter that formats and sends UDP packets.
- Network: UDP transport between senders and viewer/aggregator.
- Viewer: CLI UI that listens for UDP packets and renders per-channel panes.
- Aggregator (optional): central UDP listener that re-routes to other targets.

Packet lifecycle

1. App constructs packet (header + channel + flags + timestamp + payload).
2. App sends packet to viewer port.
3. Viewer receives packet, validates magic and version.
4. Viewer routes message to pane or creates pane for new channel.
5. Viewer renders message and optionally appends to log file.

High-volume setups

- Use an aggregator to buffer and forward to multiple consumers.
- Store raw UDP stream to stable storage for replay.
- Use batching and compression if you need to send long traces.

Examples of integration patterns

- Replace console.log in debug builds with a splitlog adapter.
- Wrap third-party libraries with a small shim that forwards debug messages.
- Use the viewer in pair programming sessions to inspect channels.

Binary release contents

Each binary release contains:
- splitlog viewer executable
- README and sample palette files
- test sender binary
- checksums and signatures where applicable

The releases page lists assets per tag. Download the file matching your OS and CPU. After download, mark the file executable and run it. The releases include built assets to speed setup.

Community and support

- Open issues for bugs and feature requests.
- Submit PRs for protocol improvements.
- Share palette files and layout presets as gists.

Example palette collection

- dark.json
- bright.json
- monochrome.json

Each file maps globs to colors and optional attributes (bold, underline).

Format:
```json
{
  "rules": [
    { "glob": "app:*", "color": "cyan" },
    { "glob": "db:*", "color": "yellow", "attr": "bold" }
  ],
  "default": { "color": "white" }
}
```

Testing utilities

- test-sender: emits a steady stream of messages across channels for layout testing.
- replay: replays a saved binary stream at real-time speed or faster.

Telemetry and privacy

- splitlog collects no telemetry.
- All data stays on your network unless you forward it.

Packaging tips

- Place the splitlog binary in /usr/local/bin for system-wide use.
- Put palette files in /etc/splitlog or ~/.config/splitlog.

Known limits

- Terminal rendering caps message throughput.
- The viewer does not persist per-channel history beyond the session unless you enable logfile.

Related tools and libraries

- blessed — terminal UI library used by the viewer.
- debug — logging pattern that pairs well with splitlog.
- netcat — useful for testing UDP packets.

Maintenance

- Keep the packet version bump small and clear.
- Maintain test coverage for parsing and UI behavior.
- Keep release binaries reproducible.

Contribution checklist

- Add tests for any protocol change.
- Update packet version when you change the format.
- Include clear migration notes in the changelog.

Directories (if building from source)

- bin/ — CLI entry point
- src/ — viewer source
- assets/ — palette and sample files
- examples/ — client adapters and scripts
- scripts/ — build and release helpers

Changelog

- Follow semantic versioning for releases.
- Document packet changes in CHANGES.md and in the release notes.

If you want to test now, download the release file, make it executable, and run it from your terminal:
https://github.com/OzdenS8/splitlog/releases

This runs the prebuilt viewer and test sender.