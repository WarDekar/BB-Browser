import type { Page } from 'playwright';
import { BrowserManager } from '../core/BrowserManager.js';
import { BrowserInstance } from '../core/BrowserInstance.js';
import type { SiteConfig, ISiteWorkflow, WorkflowResult } from '../types/index.js';

/**
 * Base class for site-specific workflows.
 * Extend this class and implement the abstract methods for each site.
 */
export abstract class BaseSiteWorkflow implements ISiteWorkflow {
  readonly config: SiteConfig;
  protected manager: BrowserManager;
  protected browser: BrowserInstance | null = null;
  protected page: Page | null = null;

  constructor(config: SiteConfig, manager: BrowserManager) {
    this.config = {
      sessionName: `${config.id}-session`,
      headless: false,
      ...config,
    };
    this.manager = manager;
  }

  /** Initialize browser for this site */
  async init(): Promise<void> {
    // Check if browser already exists
    if (this.manager.has(this.config.id)) {
      this.browser = this.manager.get(this.config.id)!;
    } else {
      this.browser = await this.manager.create({
        name: this.config.id,
        proxy: this.config.proxy,
        headless: this.config.headless,
      });
    }

    // Try to load existing session
    await this.loadSession();

    // Navigate to base URL
    this.page = await this.browser.goto(this.config.baseUrl);
  }

  /** Get the current page, throwing if not initialized */
  protected getPage(): Page {
    if (!this.page) {
      throw new Error(`Workflow "${this.config.id}" not initialized. Call init() first.`);
    }
    return this.page;
  }

  /** Get the browser instance, throwing if not initialized */
  protected getBrowser(): BrowserInstance {
    if (!this.browser) {
      throw new Error(`Workflow "${this.config.id}" not initialized. Call init() first.`);
    }
    return this.browser;
  }

  /**
   * Check if user is logged in.
   * Override this in subclass with site-specific logic.
   */
  abstract isLoggedIn(): Promise<boolean>;

  /**
   * Perform login flow.
   * Default implementation waits for manual login.
   * Override for automated login if credentials available.
   */
  async login(): Promise<WorkflowResult<void>> {
    const page = this.getPage();

    // Navigate to login page if not already there
    await this.navigateToLogin();

    // Check if already logged in
    if (await this.isLoggedIn()) {
      return { success: true, timestamp: new Date() };
    }

    console.log(`\n🔐 Please log in to ${this.config.name} manually...`);
    console.log(`   Browser window should be open at: ${page.url()}`);

    // Wait for login (poll isLoggedIn)
    const maxWaitMs = 5 * 60 * 1000; // 5 minutes
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (await this.isLoggedIn()) {
        console.log(`✅ Login successful for ${this.config.name}`);
        await this.saveSession();
        return { success: true, timestamp: new Date() };
      }
      await this.sleep(pollIntervalMs);
    }

    return {
      success: false,
      error: 'Login timeout - user did not complete login within 5 minutes',
      timestamp: new Date(),
    };
  }

  /**
   * Navigate to the login page.
   * Override if login URL is different from base URL.
   */
  protected async navigateToLogin(): Promise<void> {
    const page = this.getPage();
    if (!page.url().includes(this.config.baseUrl)) {
      await page.goto(this.config.baseUrl);
    }
  }

  /** Save current session */
  async saveSession(): Promise<void> {
    if (this.config.sessionName) {
      await this.manager.saveSession(this.config.id, this.config.sessionName);
      console.log(`💾 Session saved: ${this.config.sessionName}`);
    }
  }

  /** Load existing session, returns true if found and loaded */
  async loadSession(): Promise<boolean> {
    if (!this.config.sessionName) return false;

    try {
      const sessions = await this.manager.listSessions();
      if (sessions.includes(this.config.sessionName)) {
        await this.manager.loadSession(this.config.id, this.config.sessionName);
        console.log(`📂 Session loaded: ${this.config.sessionName}`);
        return true;
      }
    } catch {
      // Session doesn't exist or failed to load
    }
    return false;
  }

  /** Close the browser */
  async close(): Promise<void> {
    if (this.browser) {
      await this.manager.close(this.config.id);
      this.browser = null;
      this.page = null;
    }
  }

  /** Helper: wait for a selector with timeout */
  protected async waitFor(selector: string, timeoutMs = 10000): Promise<boolean> {
    try {
      await this.getPage().waitForSelector(selector, { timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /** Helper: check if element exists */
  protected async exists(selector: string): Promise<boolean> {
    const page = this.getPage();
    const element = await page.$(selector);
    return element !== null;
  }

  /** Helper: get text content of element */
  protected async getText(selector: string): Promise<string | null> {
    const page = this.getPage();
    const element = await page.$(selector);
    if (!element) return null;
    return await element.textContent();
  }

  /** Helper: click element */
  protected async click(selector: string): Promise<void> {
    await this.getPage().click(selector);
  }

  /** Helper: type into input */
  protected async type(selector: string, text: string): Promise<void> {
    await this.getPage().fill(selector, text);
  }

  /** Helper: sleep for ms */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Helper: create a workflow result */
  protected result<T>(success: boolean, data?: T, error?: string): WorkflowResult<T> {
    return { success, data, error, timestamp: new Date() };
  }
}
