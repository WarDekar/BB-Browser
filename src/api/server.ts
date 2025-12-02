import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WorkflowManager } from '../workflows/WorkflowManager.js';
import type { SiteConfig, ProxyConfig } from '../types/index.js';

export interface ApiServerConfig {
  port: number;
  host?: string;
}

/**
 * REST API server for BB-Browser.
 * Provides HTTP endpoints for browser and workflow management.
 */
export class ApiServer {
  private app: express.Application;
  private workflowManager: WorkflowManager;
  private config: ApiServerConfig;
  private server: ReturnType<typeof this.app.listen> | null = null;

  constructor(workflowManager: WorkflowManager, config: ApiServerConfig) {
    this.workflowManager = workflowManager;
    this.config = { host: '127.0.0.1', ...config };
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`[API] ${req.method} ${req.path}`);
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
      const sites = this.workflowManager.listSites();
      res.json({ sites });
    });

    // Add site configuration
    this.app.post('/sites', (req, res) => {
      const config = req.body as SiteConfig;
      if (!config.id || !config.name || !config.baseUrl) {
        res.status(400).json({ error: 'id, name, and baseUrl are required' });
        return;
      }

      this.workflowManager.addSite(config);
      res.status(201).json({ site: config });
    });

    // Get site config
    this.app.get('/sites/:id', (req, res) => {
      const config = this.workflowManager.getSiteConfig(req.params.id);
      if (!config) {
        res.status(404).json({ error: 'Site not found' });
        return;
      }
      res.json({ site: config });
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
    // Error handler
    // ============================================
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[API Error]', err);
      res.status(500).json({ error: err.message });
    });
  }

  /** Start the API server */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host!, () => {
        console.log(`🚀 BB-Browser API running at http://${this.config.host}:${this.config.port}`);
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
