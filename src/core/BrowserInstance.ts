import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'events';
import type {
  BrowserInstanceConfig,
  ProxyConfig,
  BrowserStatus,
  BrowserInfo,
  SessionData,
} from '../types/index.js';

export class BrowserInstance extends EventEmitter {
  readonly name: string;
  readonly config: BrowserInstanceConfig;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private _status: BrowserStatus = 'closed';
  private _createdAt: Date | null = null;

  constructor(config: BrowserInstanceConfig) {
    super();
    this.name = config.name;
    this.config = {
      headless: false, // Default to showing browser
      viewport: { width: 1920, height: 1080 },
      ...config,
    };
  }

  get status(): BrowserStatus {
    return this._status;
  }

  get isReady(): boolean {
    return this._status === 'ready';
  }

  get pageCount(): number {
    return this.pages.size;
  }

  /** Get info about this browser instance */
  getInfo(): BrowserInfo {
    return {
      name: this.name,
      status: this._status,
      proxy: this.config.proxy,
      headless: this.config.headless ?? false,
      pageCount: this.pages.size,
      createdAt: this._createdAt ?? new Date(),
    };
  }

  /** Launch the browser */
  async launch(): Promise<void> {
    if (this.browser) {
      throw new Error(`Browser "${this.name}" is already launched`);
    }

    this._status = 'launching';
    this._createdAt = new Date();

    try {
      // Build launch options
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: this.config.headless,
      };

      // Add proxy if configured
      if (this.config.proxy) {
        launchOptions.proxy = this.buildProxyConfig(this.config.proxy);
      }

      this.browser = await chromium.launch(launchOptions);

      // Create browser context with viewport
      const contextOptions: Parameters<Browser['newContext']>[0] = {
        viewport: this.config.viewport,
      };

      this.context = await this.browser.newContext(contextOptions);

      // Listen for new pages
      this.context.on('page', (page) => {
        const pageId = this.generatePageId();
        this.pages.set(pageId, page);
        this.emit('page:created', { pageId, url: page.url() });

        page.on('close', () => {
          this.pages.delete(pageId);
          this.emit('page:closed', { pageId });
        });
      });

      this._status = 'ready';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /** Create a new page */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error(`Browser "${this.name}" is not launched`);
    }

    const page = await this.context.newPage();
    return page;
  }

  /** Get all open pages */
  getPages(): Page[] {
    return Array.from(this.pages.values());
  }

  /** Get the current/active page (most recently created) */
  getCurrentPage(): Page | null {
    const pages = this.getPages();
    return pages[pages.length - 1] ?? null;
  }

  /** Navigate to a URL in the current page (or create one if none exists) */
  async goto(url: string): Promise<Page> {
    let page = this.getCurrentPage();
    if (!page) {
      page = await this.newPage();
    }
    await page.goto(url);
    this.emit('page:navigated', { url });
    return page;
  }

  /** Extract session data (cookies, storage) from current context */
  async extractSession(): Promise<Omit<SessionData, 'name' | 'createdAt' | 'updatedAt'>> {
    if (!this.context) {
      throw new Error(`Browser "${this.name}" is not launched`);
    }

    const page = this.getCurrentPage();
    const url = page?.url() ?? '';

    // Get cookies
    const cookies = await this.context.cookies();

    // Get localStorage and sessionStorage from current page
    let localStorage: Record<string, string> = {};
    let sessionStorage: Record<string, string> = {};

    if (page) {
      try {
        localStorage = await page.evaluate(() => {
          const data: Record<string, string> = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
              data[key] = window.localStorage.getItem(key) ?? '';
            }
          }
          return data;
        });

        sessionStorage = await page.evaluate(() => {
          const data: Record<string, string> = {};
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key) {
              data[key] = window.sessionStorage.getItem(key) ?? '';
            }
          }
          return data;
        });
      } catch {
        // Page might not be ready or navigated
      }
    }

    return {
      browserName: this.name,
      cookies,
      localStorage,
      sessionStorage,
      url,
    };
  }

  /** Inject session data (cookies, storage) into current context */
  async injectSession(session: SessionData): Promise<void> {
    if (!this.context) {
      throw new Error(`Browser "${this.name}" is not launched`);
    }

    // Add cookies
    if (session.cookies.length > 0) {
      await this.context.addCookies(session.cookies);
    }

    // Navigate to the saved URL first (needed for storage to work)
    let page = this.getCurrentPage();
    if (!page) {
      page = await this.newPage();
    }

    if (session.url) {
      await page.goto(session.url);
    }

    // Inject localStorage
    if (Object.keys(session.localStorage).length > 0) {
      await page.evaluate((data) => {
        for (const [key, value] of Object.entries(data)) {
          window.localStorage.setItem(key, value);
        }
      }, session.localStorage);
    }

    // Inject sessionStorage
    if (Object.keys(session.sessionStorage).length > 0) {
      await page.evaluate((data) => {
        for (const [key, value] of Object.entries(data)) {
          window.sessionStorage.setItem(key, value);
        }
      }, session.sessionStorage);
    }

    // Reload to apply storage changes
    await page.reload();

    this.emit('session:loaded', { sessionName: session.name });
  }

  /** Take a screenshot of the current page */
  async screenshot(options?: { fullPage?: boolean }): Promise<Buffer> {
    const page = this.getCurrentPage();
    if (!page) {
      throw new Error('No page available for screenshot');
    }

    return await page.screenshot({
      fullPage: options?.fullPage ?? false,
      type: 'png',
    });
  }

  /** Get page content as text */
  async getTextContent(): Promise<string> {
    const page = this.getCurrentPage();
    if (!page) {
      throw new Error('No page available');
    }

    return await page.evaluate(() => document.body.innerText);
  }

  /** Get page HTML */
  async getHtml(): Promise<string> {
    const page = this.getCurrentPage();
    if (!page) {
      throw new Error('No page available');
    }

    return await page.content();
  }

  /** Close the browser */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.pages.clear();
      this._status = 'closed';
    }
  }

  /** Build Playwright proxy config from our ProxyConfig */
  private buildProxyConfig(proxy: ProxyConfig): { server: string; username?: string; password?: string; bypass?: string } {
    return {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
      bypass: proxy.bypass?.join(','),
    };
  }

  /** Generate unique page ID */
  private generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
