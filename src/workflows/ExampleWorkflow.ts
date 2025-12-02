import { BaseSiteWorkflow } from './BaseSiteWorkflow.js';
import type { BrowserManager } from '../core/BrowserManager.js';
import type { SiteConfig, WorkflowResult } from '../types/index.js';

/**
 * Example workflow demonstrating how to create a site-specific workflow.
 * This example uses "example.com" as a placeholder.
 *
 * To create your own workflow:
 * 1. Extend BaseSiteWorkflow
 * 2. Implement isLoggedIn() to detect login state
 * 3. Optionally override login() for automated login
 * 4. Add site-specific methods (getHistory, scrapeData, etc.)
 */
export class ExampleWorkflow extends BaseSiteWorkflow {
  constructor(config: SiteConfig, manager: BrowserManager) {
    super(
      {
        ...config,
        baseUrl: config.baseUrl || 'https://example.com',
      },
      manager
    );
  }

  /**
   * Check if user is logged in.
   * Customize this for each site - look for logged-in indicators.
   */
  async isLoggedIn(): Promise<boolean> {
    const page = this.getPage();

    // Example: Check for a logout button or user menu
    // For example.com, we'll just return false since it has no login
    const hasUserMenu = await this.exists('.user-menu');
    const hasLogoutBtn = await this.exists('[data-action="logout"]');

    return hasUserMenu || hasLogoutBtn;
  }

  /**
   * Navigate to login page.
   * Override if login URL differs from base URL.
   */
  protected async navigateToLogin(): Promise<void> {
    const page = this.getPage();
    await page.goto(`${this.config.baseUrl}/login`);
  }

  /**
   * Example: Get some data from the site.
   * This is where you'd add site-specific scraping logic.
   */
  async getData(): Promise<WorkflowResult<{ title: string; content: string } | null>> {
    try {
      const page = this.getPage();

      const title = await page.title();
      const content = await this.getText('body') || '';

      return this.result(true, { title, content });
    } catch (err) {
      return this.result(false, null, (err as Error).message);
    }
  }

  /**
   * Example: Scrape a list of items.
   */
  async scrapeItems(): Promise<WorkflowResult<Array<{ text: string; href: string }> | null>> {
    try {
      const page = this.getPage();

      const items = await page.$$eval('a', (links) =>
        links.map((a) => ({
          text: a.textContent?.trim() || '',
          href: a.href,
        }))
      );

      return this.result(true, items);
    } catch (err) {
      return this.result(false, null, (err as Error).message);
    }
  }
}

/**
 * Template for creating new site workflows.
 * Copy this and customize for each site you need to automate.
 */
export const WORKFLOW_TEMPLATE = `
import { BaseSiteWorkflow } from './BaseSiteWorkflow.js';
import type { BrowserManager } from '../core/BrowserManager.js';
import type { SiteConfig, WorkflowResult } from '../types/index.js';

export class MySiteWorkflow extends BaseSiteWorkflow {
  constructor(config: SiteConfig, manager: BrowserManager) {
    super(
      {
        ...config,
        baseUrl: config.baseUrl || 'https://mysite.com',
      },
      manager
    );
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for logged-in indicators
    // Examples:
    // - await this.exists('.user-avatar')
    // - await this.exists('[data-logged-in="true"]')
    // - Check for specific cookies
    return await this.exists('.logged-in-indicator');
  }

  protected async navigateToLogin(): Promise<void> {
    await this.getPage().goto(\`\${this.config.baseUrl}/login\`);
  }

  // Add your site-specific methods here:

  async getHistory(): Promise<WorkflowResult<unknown[]>> {
    // Navigate to history page
    // Scrape data
    // Return results
    return this.result(true, []);
  }

  async getAccountInfo(): Promise<WorkflowResult<unknown>> {
    // Navigate to account page
    // Extract account info
    return this.result(true, {});
  }
}
`;
