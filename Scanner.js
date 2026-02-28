#!/usr/bin/env node

const net = require('net');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// ─── ANSI Colors ───────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ─── Well-Known Port Services ──────────────────────────────
const KNOWN_SERVICES = {
  20: 'FTP (Data)',
  21: 'FTP (Control)',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  119: 'NNTP',
  123: 'NTP',
  143: 'IMAP',
  161: 'SNMP',
  194: 'IRC',
  443: 'HTTPS',
  445: 'SMB',
  465: 'SMTPS',
  514: 'Syslog',
  587: 'SMTP (Submission)',
  993: 'IMAPS',
  995: 'POP3S',
  1080: 'SOCKS Proxy',
  1433: 'MSSQL',
  1521: 'Oracle DB',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  5900: 'VNC',
  6379: 'Redis',
  8080: 'HTTP Proxy',
  8443: 'HTTPS Alt',
  9090: 'Prometheus',
  27017: 'MongoDB',
};

// ─── Banner Grabbing ───────────────────────────────────────
function grabBanner(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      // Some services send a banner upon connection
      socket.write('\r\n');
    });

    socket.on('data', (data) => {
      banner += data.toString().trim();
      socket.destroy();
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(banner || null);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(banner || null);
    });

    socket.on('close', () => {
      resolve(banner || null);
    });
  });
}

// ─── Single Port Scanner ──────────────────────────────────
function scanPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      socket.destroy();
      resolve({ port, status: 'open' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, status: 'closed' });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ port, status: 'closed' });
    });
  });
}

// ─── Port Range Scanner with Concurrency Control ──────────
async function scanPorts(host, startPort, endPort, options = {}) {
  const {
    timeout = 2000,
    concurrency = 100,
    showClosed = false,
    bannerGrab = false,
  } = options;

  const totalPorts = endPort - startPort + 1;
  const results = [];
  let scanned = 0;
  let openCount = 0;

  printHeader(host, startPort, endPort, totalPorts);

  const ports = [];
  for (let p = startPort; p <= endPort; p++) {
    ports.push(p);
  }

  // Process ports in batches for concurrency control
  for (let i = 0; i < ports.length; i += concurrency) {
    const batch = ports.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((port) => scanPort(host, port, timeout))
    );

    for (const result of batchResults) {
      scanned++;
      if (result.status === 'open') {
        openCount++;
        const service = KNOWN_SERVICES[result.port] || 'Unknown';
        let banner = null;

        if (bannerGrab) {
          banner = await grabBanner(host, result.port, timeout);
        }

        console.log(
          `  ${colors.green}OPEN${colors.reset}    ` +
          `${colors.bright}${String(result.port).padEnd(7)}${colors.reset} ` +
          `${colors.cyan}${service}${colors.reset}` +
          (banner ? ` ${colors.gray}| ${banner}${colors.reset}` : '')
        );

        results.push({ ...result, service, banner });
      } else if (showClosed) {
        console.log(
          `  ${colors.red}CLOSED${colors.reset}  ${colors.gray}${result.port}${colors.reset}`
        );
        results.push(result);
      }

      // Progress bar
      const progress = Math.round((scanned / totalPorts) * 100);
      process.stdout.write(
        `\r  ${colors.gray}Progress: [${
          '█'.repeat(Math.floor(progress / 2)) +
          '░'.repeat(50 - Math.floor(progress / 2))
        }] ${progress}% (${scanned}/${totalPorts})${colors.reset}`
      );
    }
  }

  // Clear progress line and print summary
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  printSummary(results, openCount, totalPorts);

  return results;
}

// ─── Common Ports Scan ────────────────────────────────────
async function scanCommonPorts(host, options = {}) {
  const commonPorts = [
    21, 22, 23, 25, 53, 80, 110, 119, 123, 143, 161, 194,
    443, 445, 465, 587, 993, 995, 1080, 1433, 1521, 3306,
    3389, 5432, 5900, 6379, 8080, 8443, 9090, 27017,
  ];

  const {
    timeout = 2000,
    concurrency = 30,
    bannerGrab = false,
  } = options;

  const results = [];
  let openCount = 0;

  console.log(`\n${colors.cyan}${colors.bright}══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  PORT SCANNER - Common Ports${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}══════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Target: ${colors.bright}${host}${colors.reset}`);
  console.log(`  Ports:  ${colors.yellow}${commonPorts.length} common ports${colors.reset}`);
  console.log(`${colors.cyan}──────────────────────────────────────────────────${colors.reset}\n`);

  for (let i = 0; i < commonPorts.length; i += concurrency) {
    const batch = commonPorts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((port) => scanPort(host, port, timeout))
    );

    for (const result of batchResults) {
      if (result.status === 'open') {
        openCount++;
        const service = KNOWN_SERVICES[result.port] || 'Unknown';
        let banner = null;

        if (bannerGrab) {
          banner = await grabBanner(host, result.port, timeout);
        }

        console.log(
          `  ${colors.green}OPEN${colors.reset}    ` +
          `${colors.bright}${String(result.port).padEnd(7)}${colors.reset} ` +
          `${colors.cyan}${service}${colors.reset}` +
          (banner ? ` ${colors.gray}| ${banner}${colors.reset}` : '')
        );

        results.push({ ...result, service, banner });
      }
    }
  }

  console.log(`\n${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);
  console.log(`  ${colors.green}${openCount} open${colors.reset} / ${colors.gray}${commonPorts.length - openCount} closed${colors.reset} / ${commonPorts.length} total`);
  console.log(`${colors.cyan}══════════════════════════════════════════════════${colors.reset}\n`);

  return results;
}

// ─── UI Helpers ───────────────────────────────────────────
function printHeader(host, startPort, endPort, totalPorts) {
  console.log(`\n${colors.cyan}${colors.bright}══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  PORT SCANNER v1.0${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}══════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Target: ${colors.bright}${host}${colors.reset}`);
  console.log(`  Range:  ${colors.yellow}${startPort} - ${endPort}${colors.reset} (${totalPorts} ports)`);
  console.log(`  Time:   ${colors.gray}${new Date().toLocaleString()}${colors.reset}`);
  console.log(`${colors.cyan}──────────────────────────────────────────────────${colors.reset}\n`);
}

function printSummary(results, openCount, totalPorts) {
  const closedCount = totalPorts - openCount;
  console.log(`\n${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);
  console.log(`  ${colors.green}${openCount} open${colors.reset} / ${colors.gray}${closedCount} closed${colors.reset} / ${totalPorts} total`);
  console.log(`${colors.cyan}══════════════════════════════════════════════════${colors.reset}\n`);
}

function printUsage() {
  console.log(`
${colors.cyan}${colors.bright}PORT SCANNER - Usage${colors.reset}

${colors.bright}Usage:${colors.reset}
  node Scanner.js <host> [options]

${colors.bright}Options:${colors.reset}
  ${colors.yellow}-p, --ports${colors.reset}       Port range (default: 1-1024)
                    Examples: -p 80 | -p 1-1024 | -p 80,443,8080
  ${colors.yellow}-c, --common${colors.reset}      Scan common ports only
  ${colors.yellow}-t, --timeout${colors.reset}     Connection timeout in ms (default: 2000)
  ${colors.yellow}--concurrency${colors.reset}     Max concurrent connections (default: 100)
  ${colors.yellow}--show-closed${colors.reset}     Show closed ports in output
  ${colors.yellow}-b, --banner${colors.reset}      Attempt banner grabbing on open ports
  ${colors.yellow}-h, --help${colors.reset}        Show this help message

${colors.bright}Examples:${colors.reset}
  node Scanner.js scanme.nmap.org
  node Scanner.js 192.168.1.1 -p 1-65535
  node Scanner.js localhost -p 80,443,3000,8080
  node Scanner.js example.com -c -b
  node Scanner.js 10.0.0.1 -p 1-1000 --concurrency 200 -t 3000
`);
}

// ─── CLI Argument Parser ──────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const config = {
    host: args[0],
    startPort: 1,
    endPort: 1024,
    customPorts: null,
    commonScan: false,
    timeout: 2000,
    concurrency: 100,
    showClosed: false,
    bannerGrab: false,
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-p':
      case '--ports': {
        const portArg = args[++i];
        if (!portArg) {
          console.error(`${colors.red}Error: --ports requires a value${colors.reset}`);
          process.exit(1);
        }
        if (portArg.includes(',')) {
          config.customPorts = portArg.split(',').map(Number);
        } else if (portArg.includes('-')) {
          const [start, end] = portArg.split('-').map(Number);
          config.startPort = start;
          config.endPort = end;
        } else {
          config.startPort = Number(portArg);
          config.endPort = Number(portArg);
        }
        break;
      }
      case '-c':
      case '--common':
        config.commonScan = true;
        break;
      case '-t':
      case '--timeout':
        config.timeout = Number(args[++i]) || 2000;
        break;
      case '--concurrency':
        config.concurrency = Number(args[++i]) || 100;
        break;
      case '--show-closed':
        config.showClosed = true;
        break;
      case '-b':
      case '--banner':
        config.bannerGrab = true;
        break;
      default:
        console.error(`${colors.red}Unknown option: ${args[i]}${colors.reset}`);
        printUsage();
        process.exit(1);
    }
  }

  // Validate ports
  if (config.startPort < 1 || config.endPort > 65535 || config.startPort > config.endPort) {
    console.error(`${colors.red}Error: Invalid port range (must be 1-65535)${colors.reset}`);
    process.exit(1);
  }

  return config;
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  const config = parseArgs(process.argv);
  const startTime = Date.now();

  let results;

  if (config.commonScan) {
    results = await scanCommonPorts(config.host, {
      timeout: config.timeout,
      concurrency: config.concurrency,
      bannerGrab: config.bannerGrab,
    });
  } else if (config.customPorts) {
    // Scan specific ports
    console.log(`\n${colors.cyan}${colors.bright}══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  PORT SCANNER - Custom Ports${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}══════════════════════════════════════════════════${colors.reset}`);
    console.log(`  Target: ${colors.bright}${config.host}${colors.reset}`);
    console.log(`  Ports:  ${colors.yellow}${config.customPorts.join(', ')}${colors.reset}`);
    console.log(`${colors.cyan}──────────────────────────────────────────────────${colors.reset}\n`);

    results = [];
    const batchResults = await Promise.all(
      config.customPorts.map((port) => scanPort(config.host, port, config.timeout))
    );

    for (const result of batchResults) {
      if (result.status === 'open') {
        const service = KNOWN_SERVICES[result.port] || 'Unknown';
        let banner = null;
        if (config.bannerGrab) {
          banner = await grabBanner(config.host, result.port, config.timeout);
        }
        console.log(
          `  ${colors.green}OPEN${colors.reset}    ` +
          `${colors.bright}${String(result.port).padEnd(7)}${colors.reset} ` +
          `${colors.cyan}${service}${colors.reset}` +
          (banner ? ` ${colors.gray}| ${banner}${colors.reset}` : '')
        );
        results.push({ ...result, service, banner });
      } else if (config.showClosed) {
        console.log(
          `  ${colors.red}CLOSED${colors.reset}  ${colors.gray}${result.port}${colors.reset}`
        );
      }
    }

    const openCount = results.filter((r) => r.status === 'open').length;
    console.log(`\n${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);
    console.log(`  ${colors.green}${openCount} open${colors.reset} / ${colors.gray}${config.customPorts.length - openCount} closed${colors.reset} / ${config.customPorts.length} total`);
    console.log(`${colors.cyan}══════════════════════════════════════════════════${colors.reset}\n`);
  } else {
    results = await scanPorts(config.host, config.startPort, config.endPort, {
      timeout: config.timeout,
      concurrency: config.concurrency,
      showClosed: config.showClosed,
      bannerGrab: config.bannerGrab,
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`  ${colors.gray}Scan completed in ${elapsed}s${colors.reset}\n`);
}

// ─── Module Export & CLI Entry ─────────────────────────────
module.exports = { scanPort, scanPorts, scanCommonPorts, grabBanner, KNOWN_SERVICES };

if (require.main === module) {
  main().catch((err) => {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
  });
}

