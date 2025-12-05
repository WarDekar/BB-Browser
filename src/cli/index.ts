#!/usr/bin/env node

import { Command } from 'commander';
import { BrowserManager } from '../core/BrowserManager.js';
import { WorkflowManager } from '../workflows/WorkflowManager.js';
import { PinnacleWorkflow } from '../workflows/PinnacleWorkflow.js';
import { Sports411Workflow } from '../workflows/Sports411Workflow.js';
import { BetOnlineWorkflow } from '../workflows/BetOnlineWorkflow.js';
import { ApiServer } from '../api/server.js';

const program = new Command();

// Shared instances (created lazily)
let browserManager: BrowserManager | null = null;
let workflowManager: WorkflowManager | null = null;

function getBrowserManager(): BrowserManager {
  if (!browserManager) {
    browserManager = new BrowserManager();
  }
  return browserManager;
}

function getWorkflowManager(): WorkflowManager {
  if (!workflowManager) {
    workflowManager = new WorkflowManager(getBrowserManager());
    // Register site workflows
    workflowManager.register('pinnacle', PinnacleWorkflow);
    workflowManager.register('sports411', Sports411Workflow);
    workflowManager.register('betonline', BetOnlineWorkflow);
  }
  return workflowManager;
}

program
  .name('bb-betting')
  .description('Chrome-based browser automation for logging into betting sites and downloading bet histories')
  .version('1.0.0');

// ============================================
// Browser Commands
// ============================================

program
  .command('launch')
  .description('Launch a new browser instance')
  .requiredOption('-n, --name <name>', 'Browser instance name')
  .option('-p, --proxy <proxy>', 'Proxy URL (http://user:pass@host:port)')
  .option('--headless', 'Run in headless mode', false)
  .action(async (options) => {
    const manager = getBrowserManager();

    try {
      console.log(`🚀 Launching browser "${options.name}"...`);

      const proxyConfig = options.proxy
        ? parseProxy(options.proxy)
        : undefined;

      const browser = await manager.create({
        name: options.name,
        proxy: proxyConfig,
        headless: options.headless,
      });

      console.log(`✅ Browser launched: ${browser.getInfo().name}`);
      console.log('   Press Ctrl+C to close');

      // Keep process alive
      await new Promise(() => {});
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List running browser instances')
  .action(() => {
    const manager = getBrowserManager();
    const browsers = manager.list();

    if (browsers.length === 0) {
      console.log('No browsers running');
      return;
    }

    console.log('Running browsers:');
    for (const b of browsers) {
      console.log(`  - ${b.name} (${b.status}, ${b.pageCount} pages)`);
      if (b.proxy) {
        console.log(`    Proxy: ${b.proxy.server}`);
      }
    }
  });

program
  .command('close')
  .description('Close a browser instance')
  .requiredOption('-n, --name <name>', 'Browser instance name')
  .action(async (options) => {
    const manager = getBrowserManager();

    try {
      await manager.close(options.name);
      console.log(`✅ Browser "${options.name}" closed`);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('goto')
  .description('Navigate browser to URL')
  .requiredOption('-n, --name <name>', 'Browser instance name')
  .requiredOption('-u, --url <url>', 'URL to navigate to')
  .action(async (options) => {
    const manager = getBrowserManager();

    try {
      const browser = manager.getOrThrow(options.name);
      await browser.goto(options.url);
      console.log(`✅ Navigated to ${options.url}`);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// ============================================
// Session Commands
// ============================================

program
  .command('sessions')
  .description('List saved sessions')
  .action(async () => {
    const manager = getBrowserManager();

    try {
      const sessions = await manager.listSessions();

      if (sessions.length === 0) {
        console.log('No saved sessions');
        return;
      }

      console.log('Saved sessions:');
      for (const s of sessions) {
        console.log(`  - ${s}`);
      }
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('save-session')
  .description('Save browser session')
  .requiredOption('-n, --name <name>', 'Browser instance name')
  .requiredOption('-s, --session <session>', 'Session name')
  .action(async (options) => {
    const manager = getBrowserManager();

    try {
      await manager.saveSession(options.name, options.session);
      console.log(`✅ Session saved: ${options.session}`);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('load-session')
  .description('Load session into browser')
  .requiredOption('-n, --name <name>', 'Browser instance name')
  .requiredOption('-s, --session <session>', 'Session name')
  .action(async (options) => {
    const manager = getBrowserManager();

    try {
      await manager.loadSession(options.name, options.session);
      console.log(`✅ Session loaded: ${options.session}`);
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      process.exit(1);
    }
  });

// ============================================
// API Server Command
// ============================================

program
  .command('serve')
  .description('Start the REST API server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .action(async (options) => {
    const wfManager = getWorkflowManager();

    const server = new ApiServer(wfManager, {
      port: parseInt(options.port, 10),
      host: options.host,
    });

    await server.start();
    console.log('Press Ctrl+C to stop');

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await server.stop();
      await wfManager.closeAll();
      process.exit(0);
    });
  });

// ============================================
// Interactive Mode (future)
// ============================================

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(() => {
    console.log('Interactive mode coming soon!');
    // TODO: Implement REPL-style interface
  });

// ============================================
// Helpers
// ============================================

function parseProxy(proxyString: string): { server: string; username?: string; password?: string } {
  // Parse proxy URL: http://user:pass@host:port or http://host:port
  try {
    const url = new URL(proxyString);
    return {
      server: `${url.protocol}//${url.host}`,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    // If not a valid URL, assume it's just host:port
    return { server: proxyString };
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (browserManager) {
    await browserManager.closeAll();
  }
  process.exit(0);
});

program.parse();
