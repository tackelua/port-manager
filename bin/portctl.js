#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const {
  registry,
  allocator,
  tunnel,
  probePort,
  detectProjectName,
  getMachineNodeId
} = require('../src');

const program = new Command();

program
  .name('portctl')
  .description('Universal Port Manager & Cloudflare Ingress CLI for Githsoft')
  .version('2.0.0', '-v, --version', 'Output the current version number')
  .option('-V', 'Output the current version number', () => {
    console.log('2.0.0');
    process.exit(0);
  });

// 1. LIST COMMAND
program
  .command('list')
  .description('List all registered ports and active process statuses')
  .option('--json', 'Output results in JSON format')
  .action((options) => {
    const all = registry.getAllMerged();
    const currentNodeId = getMachineNodeId();

    if (options.json) {
      console.log(JSON.stringify(all, null, 2));
      return;
    }

    console.log(`\n📌 GITHSOFT PORT REGISTRY (Node: \x1b[36m${currentNodeId}\x1b[0m)\n`);
    console.log(
      '┌──────────────────────────────┬───────┬──────────────────┬───────────┬────────────────────────────────┐'
    );
    console.log(
      '│ Service / App Name           │ Port  │ Scope            │ Status    │ Ingress Domain / Tunnel        │'
    );
    console.log(
      '├──────────────────────────────┼───────┼──────────────────┼───────────┼────────────────────────────────┤'
    );

    for (const item of all) {
      const probe = probePort(item.port);
      let statusStr = '\x1b[90mOFFLINE\x1b[0m';
      if (probe.isListening) {
        statusStr = `\x1b[32mON (PID ${probe.pid})\x1b[0m`;
      }

      const namePadded = item.name.padEnd(28).slice(0, 28);
      const portPadded = String(item.port).padEnd(5);
      const scopePadded = item.scope.padEnd(16).slice(0, 16);
      const statusPadded = statusStr.padEnd(19);
      const domainPadded = (item.tunnel ? `🔗 ${item.tunnel}` : '-').padEnd(30).slice(0, 30);

      console.log(`│ ${namePadded} │ ${portPadded} │ ${scopePadded} │ ${statusPadded} │ ${domainPadded} │`);
    }

    console.log(
      '└──────────────────────────────┴───────┴──────────────────┴───────────┴────────────────────────────────┘\n'
    );
  });

// 2. GET COMMAND
program
  .command('get [appName]')
  .description('Get allocated port for an app (defaults to current project directory)')
  .action((appName) => {
    const targetName = appName || detectProjectName(process.cwd());
    const entry = registry.findByName(targetName);
    if (!entry) {
      console.error(`Error: No port configuration found for '${targetName}'. Run 'portctl assign' to allocate one.`);
      process.exit(1);
    }
    console.log(entry.port);
  });

// 3. ASSIGN COMMAND
program
  .command('assign [appName]')
  .description('Allocate a new port or register a fixed service')
  .option('-f, --fixed <port>', 'Register a fixed port number (for 3rd-party or static services)')
  .option('-s, --scope <scope>', 'Scope: local (machine-local) or global (canonical-global)', 'global')
  .option('-d, --domain <domain>', 'Associated Cloudflare Tunnel subdomain')
  .option('--desc <desc>', 'Description of the service')
  .action((appName, options) => {
    const targetName = appName || detectProjectName(process.cwd());
    try {
      const result = allocator.allocate(targetName, {
        fixedPort: options.fixed,
        scope: options.scope,
        domain: options.domain,
        description: options.desc
      });

      if (result.isNew) {
        console.log(`✅ Successfully allocated for '\x1b[36m${targetName}\x1b[0m': Port \x1b[32m${result.port}\x1b[0m`);
      } else {
        console.log(`ℹ️ '${targetName}' already assigned: Port \x1b[32m${result.port}\x1b[0m`);
      }

      if (options.domain) {
        console.log(`Configuring Cloudflare Tunnel for ${options.domain}...`);
        tunnel.expose(targetName, options.domain);
      }
    } catch (err) {
      console.error(`❌ Port allocation failed: ${err.message}`);
      process.exit(1);
    }
  });

// 4. CHECK COMMAND
program
  .command('check [target]')
  .description('Inspect socket status and process owning a port or app')
  .action((target) => {
    let port;
    let targetName = target;

    if (!target) {
      targetName = detectProjectName(process.cwd());
      const entry = registry.findByName(targetName);
      if (entry) port = entry.port;
    } else if (/^\d+$/.test(target)) {
      port = parseInt(target, 10);
    } else {
      const entry = registry.findByName(target);
      if (entry) port = entry.port;
      else {
        console.error(`Error: Service '${target}' not found in registry.`);
        process.exit(1);
      }
    }

    if (!port) {
      console.error('Error: Please provide a valid port number or app name.');
      process.exit(1);
    }

    console.log(`\n🔍 Socket Inspection for Port \x1b[33m${port}\x1b[0m:`);
    const regEntry = registry.findByPort(port);
    if (regEntry) {
      console.log(`- Registry: Claimed by '\x1b[36m${regEntry.name}\x1b[0m' (Scope: ${regEntry.scope})`);
    } else {
      console.log(`- Registry: Not registered.`);
    }

    const probe = probePort(port);
    if (probe.isListening) {
      console.log(`- Status: \x1b[32mLISTENING\x1b[0m`);
      console.log(`  • Process: ${probe.command}`);
      console.log(`  • PID:     ${probe.pid}`);
      console.log(`  • User:    ${probe.user}`);
    } else {
      console.log(`- Status: \x1b[90mPORT IS IDLE (No process listening)\x1b[0m`);
    }
    console.log('');
  });

// 5. EXPOSE COMMAND
program
  .command('expose <appName>')
  .description('Expose an application to the Internet via Cloudflare Tunnel')
  .requiredOption('-d, --domain <domain>', 'Public subdomain (e.g. myapp.githsoft.com)')
  .option('--force', 'Bypass security blacklist check for sensitive ports')
  .action((appName, options) => {
    try {
      console.log(`🚀 Exposing '\x1b[36m${appName}\x1b[0m' to \x1b[32m${options.domain}\x1b[0m...`);
      const res = tunnel.expose(appName, options.domain, { force: options.force });
      console.log(`✅ Successfully exposed!`);
      console.log(`   Public URL  : \x1b[34m${res.url}\x1b[0m`);
      console.log(`   Local Target: http://localhost:${res.port}`);
    } catch (err) {
      console.error(`❌ Ingress failed: ${err.message}`);
      process.exit(1);
    }
  });

// 6. ENV COMMAND
program
  .command('env')
  .description('Generate or update PORT environment variable')
  .option('-w, --write', 'Write or update PORT in .env file of current directory')
  .option('-e, --export', 'Print shell export command (export PORT=xxxx)')
  .action((options) => {
    const appName = detectProjectName(process.cwd());
    let entry = registry.findByName(appName);
    if (!entry) {
      // Auto-assign if not exists
      const res = allocator.allocate(appName);
      entry = res.entry;
    }

    const port = entry.port;

    if (options.export) {
      console.log(`export PORT=${port}`);
      return;
    }

    if (options.write) {
      // Auto-detect Next.js convention to avoid dirtying git
      const isNext = fs.existsSync(path.join(process.cwd(), 'next.config.js')) ||
                     fs.existsSync(path.join(process.cwd(), 'next.config.mjs')) ||
                     fs.existsSync(path.join(process.cwd(), 'next.config.ts'));

      const targetEnvFile = isNext ? '.env.local' : '.env';
      const envPath = path.join(process.cwd(), targetEnvFile);
      let content = '';
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
      }

      if (/^PORT=.*/m.test(content)) {
        content = content.replace(/^PORT=.*/m, `PORT=${port}`);
      } else {
        content = content.trim() ? `${content.trim()}\nPORT=${port}\n` : `PORT=${port}\n`;
      }

      fs.writeFileSync(envPath, content, 'utf8');
      console.log(`✅ Updated ${targetEnvFile}: PORT=${port} (for '${appName}')`);
      return;
    }

    console.log(`PORT=${port}`);
  });

// 7. RUN COMMAND
program
  .command('run')
  .description('Execute any command with $PORT injected into environment')
  .allowUnknownOption()
  .argument('<command...>', 'Command to execute (e.g. npm run dev, uvicorn main:app)')
  .action((cmdParts) => {
    const appName = detectProjectName(process.cwd());
    let entry = registry.findByName(appName);
    if (!entry) {
      const res = allocator.allocate(appName);
      entry = res.entry;
    }

    const port = entry.port;
    console.log(`⚡ [portctl run] Injecting PORT=\x1b[32m${port}\x1b[0m for '\x1b[36m${appName}\x1b[0m'`);

    const [executable, ...args] = cmdParts;
    // On Windows, running batch files like npm/npx requires shell: true; on Unix, shell: false eliminates command injection
    const useShell = process.platform === 'win32';
    const child = spawnSync(executable, args, {
      shell: useShell,
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(port)
      }
    });

    if (child.error) {
      console.error(`\x1b[31mError executing '${executable}':\x1b[0m`, child.error.message);
      process.exit(1);
    }

    process.exit(child.status !== null ? child.status : 0);
  });

// 8. SYNC COMMAND
program
  .command('sync')
  .description('Sync port registry with local disk and system state')
  .action(() => {
    registry.syncPortsJson();
    console.log('✅ Successfully synchronized ~/port-manager/ports.json');
  });

program.parse(process.argv);
