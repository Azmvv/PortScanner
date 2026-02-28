# 🔍 Port Scanner

A fast and lightweight TCP port scanner built with Node.js. No external dependencies required.

## Features

- **TCP Connect Scan** — Detects open/closed ports via TCP handshake
- **Concurrency Control** — Adjustable concurrent connections for speed/stability balance
- **Banner Grabbing** — Identifies running services on open ports
- **Common Ports Mode** — Quickly scan the most frequently used ports
- **Custom Port Lists** — Scan specific ports or ranges
- **Service Detection** — Maps 30+ well-known port numbers to service names
- **Progress Bar** — Real-time visual scan progress
- **Zero Dependencies** — Uses only Node.js built-in modules

## Requirements

- Node.js >= 14.0.0

## Installation

```bash
git clone https://github.com/<your-username>/PortScanner.git
cd PortScanner
```

No `npm install` needed — zero dependencies!

## Usage

```bash
node Scanner.js <host> [options]
```

### Options

| Option | Description | Default |
|---|---|---|
| `-p, --ports` | Port range or list | `1-1024` |
| `-c, --common` | Scan common ports only | — |
| `-t, --timeout` | Connection timeout (ms) | `2000` |
| `--concurrency` | Max concurrent connections | `100` |
| `--show-closed` | Show closed ports in output | — |
| `-b, --banner` | Attempt banner grabbing | — |
| `-h, --help` | Show help message | — |

### Examples

```bash
# Scan default port range (1-1024)
node Scanner.js scanme.nmap.org

# Scan all ports
node Scanner.js 192.168.1.1 -p 1-65535

# Scan specific ports
node Scanner.js localhost -p 80,443,3000,8080

# Scan common ports with banner grabbing
node Scanner.js example.com -c -b

# Fast scan with higher concurrency
node Scanner.js 10.0.0.1 -p 1-1000 --concurrency 200 -t 1000

# Show closed ports too
node Scanner.js localhost -p 1-100 --show-closed
```

### Sample Output

```
══════════════════════════════════════════════════
  PORT SCANNER v1.0
══════════════════════════════════════════════════
  Target: scanme.nmap.org
  Range:  1 - 1024 (1024 ports)
  Time:   2/28/2026, 10:00:00 AM
──────────────────────────────────────────────────

  OPEN    22      SSH
  OPEN    80      HTTP
  OPEN    443     HTTPS

──────────────────────────────────────────────────
  3 open / 1021 closed / 1024 total
══════════════════════════════════════════════════

  Scan completed in 12.34s
```

## Using as a Module

```javascript
const { scanPort, scanPorts, scanCommonPorts, grabBanner } = require('./Scanner');

// Scan a single port
const result = await scanPort('localhost', 80);
console.log(result); // { port: 80, status: 'open' }

// Scan a range
const results = await scanPorts('localhost', 1, 1024, {
  timeout: 2000,
  concurrency: 100,
  bannerGrab: true,
});

// Scan common ports
const common = await scanCommonPorts('localhost');
```

## ⚠️ Disclaimer

This tool is intended for **educational purposes** and **authorized security testing only**. Scanning ports on systems you do not own or have permission to test may be **illegal**. Always obtain proper authorization before scanning any network or host.

## License

MIT
