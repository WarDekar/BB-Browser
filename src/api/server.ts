import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WorkflowManager } from '../workflows/WorkflowManager.js';
import { SiteConfigManager, StoredSiteConfig, StoredProxy } from '../config/SiteConfigManager.js';
import type { SiteConfig, ProxyConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ApiServerConfig {
  port: number;
  host?: string;
}

/**
 * REST API server for BB-Betting.
 * Provides HTTP endpoints for browser and workflow management.
 */
export class ApiServer {
  private app: express.Application;
  private workflowManager: WorkflowManager;
  private siteConfigManager: SiteConfigManager;
  private config: ApiServerConfig;
  private server: ReturnType<typeof this.app.listen> | null = null;

  constructor(workflowManager: WorkflowManager, config: ApiServerConfig) {
    this.workflowManager = workflowManager;
    this.siteConfigManager = new SiteConfigManager();
    this.config = { host: '127.0.0.1', ...config };
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Serve static files from web/public
    const publicPath = join(__dirname, '..', 'web', 'public');
    this.app.use(express.static(publicPath));

    // Request logging (skip static files)
    this.app.use((req, _res, next) => {
      if (!req.path.match(/\.(html|css|js|png|jpg|ico)$/)) {
        console.log(`[API] ${req.method} ${req.path}`);
      }
      next();
    });
  }

  private setupRoutes(): void {
    const browserMgr = this.workflowManager.getBrowserManager();

    // ============================================
    // Health
    // ============================================
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // ============================================
    // Browsers (direct browser control)
    // ============================================

    // List all browsers
    this.app.get('/browsers', (_req, res) => {
      const browsers = browserMgr.list();
      res.json({ browsers });
    });

    // Create a browser
    this.app.post('/browsers', async (req, res, next) => {
      try {
        const { name, proxy, headless } = req.body as {
          name: string;
          proxy?: ProxyConfig;
          headless?: boolean;
        };

        if (!name) {
          res.status(400).json({ error: 'name is required' });
          return;
        }

        if (browserMgr.has(name)) {
          res.status(409).json({ error: `Browser "${name}" already exists` });
          return;
        }

        const browser = await browserMgr.create({ name, proxy, headless });
        res.status(201).json({ browser: browser.getInfo() });
      } catch (err) {
        next(err);
      }
    });

    // Get browser info
    this.app.get('/browsers/:name', (req, res) => {
      const browser = browserMgr.get(req.params.name);
      if (!browser) {
        res.status(404).json({ error: 'Browser not found' });
        return;
      }
      res.json({ browser: browser.getInfo() });
    });

    // Navigate browser to URL
    this.app.post('/browsers/:name/goto', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { url } = req.body as { url: string };
        if (!url) {
          res.status(400).json({ error: 'url is required' });
          return;
        }

        await browser.goto(url);
        res.json({ success: true, url });
      } catch (err) {
        next(err);
      }
    });

    // Get page content
    this.app.get('/browsers/:name/content', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const text = await browser.getTextContent();
        const page = browser.getCurrentPage();
        res.json({
          url: page?.url(),
          title: await page?.title(),
          content: text,
        });
      } catch (err) {
        next(err);
      }
    });

    // Take screenshot
    this.app.get('/browsers/:name/screenshot', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const fullPage = req.query.fullPage === 'true';
        const screenshot = await browser.screenshot({ fullPage });

        res.set('Content-Type', 'image/png');
        res.send(screenshot);
      } catch (err) {
        next(err);
      }
    });

    // Close browser
    this.app.delete('/browsers/:name', async (req, res, next) => {
      try {
        if (!browserMgr.has(req.params.name)) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        await browserMgr.close(req.params.name);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // Evaluate JavaScript on page (for testing/debugging)
    this.app.post('/browsers/:name/eval', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { script } = req.body as { script: string };
        if (!script) {
          res.status(400).json({ error: 'script is required' });
          return;
        }

        const page = browser.getCurrentPage();
        if (!page) {
          res.status(400).json({ error: 'No page available' });
          return;
        }

        const result = await page.evaluate(script);
        res.json({ result });
      } catch (err) {
        next(err);
      }
    });

    // Fill input field
    this.app.post('/browsers/:name/fill', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { selector, value } = req.body as { selector: string; value: string };
        if (!selector || value === undefined) {
          res.status(400).json({ error: 'selector and value are required' });
          return;
        }

        const page = browser.getCurrentPage();
        if (!page) {
          res.status(400).json({ error: 'No page available' });
          return;
        }

        await page.fill(selector, value);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // Click element
    this.app.post('/browsers/:name/click', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { selector, force, position } = req.body as {
          selector: string;
          force?: boolean;
          position?: { x: number; y: number };
        };
        if (!selector) {
          res.status(400).json({ error: 'selector is required' });
          return;
        }

        const page = browser.getCurrentPage();
        if (!page) {
          res.status(400).json({ error: 'No page available' });
          return;
        }

        await page.click(selector, { force, position });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // Mouse click at coordinates (for Angular apps that don't respond to synthetic clicks)
    this.app.post('/browsers/:name/mouse-click', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { x, y, button = 'left' } = req.body as { x: number; y: number; button?: 'left' | 'right' | 'middle' };
        if (x === undefined || y === undefined) {
          res.status(400).json({ error: 'x and y coordinates are required' });
          return;
        }

        const page = browser.getCurrentPage();
        if (!page) {
          res.status(400).json({ error: 'No page available' });
          return;
        }

        await page.mouse.click(x, y, { button });
        res.json({ success: true, x, y });
      } catch (err) {
        next(err);
      }
    });

    // ============================================
    // Sessions
    // ============================================

    // List sessions
    this.app.get('/sessions', async (_req, res, next) => {
      try {
        const sessions = await browserMgr.listSessions();
        res.json({ sessions });
      } catch (err) {
        next(err);
      }
    });

    // Save session
    this.app.post('/browsers/:name/session', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { sessionName } = req.body as { sessionName: string };
        if (!sessionName) {
          res.status(400).json({ error: 'sessionName is required' });
          return;
        }

        await browserMgr.saveSession(req.params.name, sessionName);
        res.json({ success: true, sessionName });
      } catch (err) {
        next(err);
      }
    });

    // Load session
    this.app.post('/browsers/:name/session/load', async (req, res, next) => {
      try {
        const browser = browserMgr.get(req.params.name);
        if (!browser) {
          res.status(404).json({ error: 'Browser not found' });
          return;
        }

        const { sessionName } = req.body as { sessionName: string };
        if (!sessionName) {
          res.status(400).json({ error: 'sessionName is required' });
          return;
        }

        await browserMgr.loadSession(req.params.name, sessionName);
        res.json({ success: true, sessionName });
      } catch (err) {
        next(err);
      }
    });

    // Delete session
    this.app.delete('/sessions/:name', async (req, res, next) => {
      try {
        await browserMgr.deleteSession(req.params.name);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // ============================================
    // Workflows (site-specific)
    // ============================================

    // List configured sites
    this.app.get('/sites', (_req, res) => {
      const sites = this.siteConfigManager.listSites();
      res.json({ sites });
    });

    // Add site configuration (persisted to disk)
    this.app.post('/sites', async (req, res, next) => {
      try {
        const config = req.body as StoredSiteConfig;
        if (!config.id || !config.name || !config.baseUrl) {
          res.status(400).json({ error: 'id, name, and baseUrl are required' });
          return;
        }

        // Check if site already exists
        const existing = this.siteConfigManager.getSite(config.id);
        if (existing) {
          // Update existing site
          await this.siteConfigManager.updateSite(config.id, config);
        } else {
          // Add new site
          await this.siteConfigManager.addSite(config);
        }

        // Also register with workflow manager
        const proxy = this.siteConfigManager.getProxyForSite(config.id);
        this.workflowManager.addSite({
          id: config.id,
          name: config.name,
          baseUrl: config.baseUrl,
          proxy: config.proxy || proxy,
          username: config.username,
          password: config.password,
        } as SiteConfig);

        res.status(201).json({ site: config });
      } catch (err) {
        next(err);
      }
    });

    // Get site config
    this.app.get('/sites/:id', (req, res) => {
      const config = this.siteConfigManager.getSite(req.params.id);
      if (!config) {
        res.status(404).json({ error: 'Site not found' });
        return;
      }
      res.json({ site: config });
    });

    // Update site config
    this.app.put('/sites/:id', async (req, res, next) => {
      try {
        const updates = req.body as Partial<StoredSiteConfig>;
        const updated = await this.siteConfigManager.updateSite(req.params.id, updates);
        if (!updated) {
          res.status(404).json({ error: 'Site not found' });
          return;
        }

        // Update workflow manager too
        const proxy = this.siteConfigManager.getProxyForSite(updated.id);
        this.workflowManager.addSite({
          id: updated.id,
          name: updated.name,
          baseUrl: updated.baseUrl,
          proxy,
          username: updated.username,
          password: updated.password,
        } as SiteConfig);

        res.json({ site: updated });
      } catch (err) {
        next(err);
      }
    });

    // Delete site config
    this.app.delete('/sites/:id/config', async (req, res, next) => {
      try {
        const deleted = await this.siteConfigManager.deleteSite(req.params.id);
        if (!deleted) {
          res.status(404).json({ error: 'Site not found' });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // Initialize site workflow
    this.app.post('/sites/:id/init', async (req, res, next) => {
      try {
        const workflow = await this.workflowManager.init(req.params.id);
        res.json({
          success: true,
          site: workflow.config,
          loggedIn: await workflow.isLoggedIn(),
        });
      } catch (err) {
        next(err);
      }
    });

    // Login to site
    this.app.post('/sites/:id/login', async (req, res, next) => {
      try {
        const result = await this.workflowManager.login(req.params.id);
        res.json(result);
      } catch (err) {
        next(err);
      }
    });

    // Check login status
    this.app.get('/sites/:id/status', async (req, res, next) => {
      try {
        const loggedIn = await this.workflowManager.isLoggedIn(req.params.id);
        res.json({ loggedIn });
      } catch (err) {
        next(err);
      }
    });

    // Close site browser
    this.app.delete('/sites/:id', async (req, res, next) => {
      try {
        await this.workflowManager.close(req.params.id);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // ============================================
    // Proxies (persistent storage)
    // ============================================

    // List all proxies
    this.app.get('/proxies', (_req, res) => {
      const proxies = this.siteConfigManager.listProxies();
      res.json({ proxies });
    });

    // Add/update proxy
    this.app.post('/proxies', async (req, res, next) => {
      try {
        const proxy = req.body as StoredProxy;
        if (!proxy.name || !proxy.server) {
          res.status(400).json({ error: 'name and server are required' });
          return;
        }

        await this.siteConfigManager.addProxy(proxy);
        res.status(201).json({ proxy });
      } catch (err) {
        next(err);
      }
    });

    // Get proxy
    this.app.get('/proxies/:name', (req, res) => {
      const proxy = this.siteConfigManager.getProxy(req.params.name);
      if (!proxy) {
        res.status(404).json({ error: 'Proxy not found' });
        return;
      }
      res.json({ proxy });
    });

    // Delete proxy
    this.app.delete('/proxies/:name', async (req, res, next) => {
      try {
        const deleted = await this.siteConfigManager.deleteProxy(req.params.name);
        if (!deleted) {
          res.status(404).json({ error: 'Proxy not found' });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // ============================================
    // Bet History Cache
    // ============================================

    const CACHE_DIR = './cache';

    // Save bet history to cache
    this.app.post('/sites/:id/history', async (req, res, next) => {
      try {
        const { bets, fromDate, toDate } = req.body as {
          bets: Array<Record<string, unknown>>;
          fromDate: string;
          toDate: string;
        };

        if (!bets || !Array.isArray(bets)) {
          res.status(400).json({ error: 'bets array is required' });
          return;
        }

        const fs = await import('fs/promises');
        const path = await import('path');

        // Ensure cache directory exists
        await fs.mkdir(CACHE_DIR, { recursive: true });

        const siteId = req.params.id;
        const cacheFile = path.join(CACHE_DIR, `${siteId}-history.json`);

        // Load existing cache or create new
        let cache: {
          siteId: string;
          lastUpdated: string;
          bets: Array<Record<string, unknown>>;
        };

        try {
          const existing = await fs.readFile(cacheFile, 'utf-8');
          cache = JSON.parse(existing);
        } catch {
          cache = { siteId, lastUpdated: '', bets: [] };
        }

        // Merge new bets (dedupe by betId if present)
        const existingIds = new Set(cache.bets.map((b: Record<string, unknown>) => b.betId));
        const newBets = bets.filter((b) => !b.betId || !existingIds.has(b.betId));
        cache.bets = [...cache.bets, ...newBets];
        cache.lastUpdated = new Date().toISOString();

        // Save cache
        await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));

        res.json({
          success: true,
          added: newBets.length,
          total: cache.bets.length,
          cacheFile,
        });
      } catch (err) {
        next(err);
      }
    });

    // Get cached bet history
    this.app.get('/sites/:id/history', async (req, res, next) => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');

        const siteId = req.params.id;
        const cacheFile = path.join(CACHE_DIR, `${siteId}-history.json`);

        try {
          const data = await fs.readFile(cacheFile, 'utf-8');
          res.json(JSON.parse(data));
        } catch {
          res.json({ siteId, lastUpdated: null, bets: [] });
        }
      } catch (err) {
        next(err);
      }
    });

    // ============================================
    // Error handler
    // ============================================
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[API Error]', err);
      res.status(500).json({ error: err.message });
    });
  }

  /** Start the API server */
  async start(): Promise<void> {
    // Load saved site configs and proxies from disk
    await this.siteConfigManager.load();

    // Register saved sites with workflow manager
    for (const site of this.siteConfigManager.listSites()) {
      const proxy = this.siteConfigManager.getProxyForSite(site.id);
      this.workflowManager.addSite({
        id: site.id,
        name: site.name,
        baseUrl: site.baseUrl,
        proxy,
        username: site.username,
        password: site.password,
      } as SiteConfig);
      console.log(`📋 Loaded site: ${site.name}`);
    }

    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host!, () => {
        console.log(`🚀 BB-Betting API running at http://${this.config.host}:${this.config.port}`);
        console.log(`📺 Web UI available at http://${this.config.host}:${this.config.port}/`);
        resolve();
      });
    });
  }

  /** Stop the API server */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('API server stopped');
          resolve();
        });
      });
    }
  }

  /** Get the Express app (for testing) */
  getApp(): express.Application {
    return this.app;
  }
}
