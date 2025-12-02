import { BrowserManager } from '../core/BrowserManager.js';
import type { ISiteWorkflow, SiteConfig, WorkflowResult } from '../types/index.js';

type WorkflowConstructor = new (config: SiteConfig, manager: BrowserManager) => ISiteWorkflow;

/**
 * Manages site workflows - registration, instantiation, and execution.
 */
export class WorkflowManager {
  private manager: BrowserManager;
  private registry: Map<string, WorkflowConstructor> = new Map();
  private instances: Map<string, ISiteWorkflow> = new Map();
  private configs: Map<string, SiteConfig> = new Map();

  constructor(manager?: BrowserManager) {
    this.manager = manager ?? new BrowserManager();
  }

  /** Get the underlying BrowserManager */
  getBrowserManager(): BrowserManager {
    return this.manager;
  }

  /**
   * Register a workflow class for a site type.
   * @param siteType - Unique identifier for this site type (e.g., "amazon", "ebay")
   * @param WorkflowClass - The workflow class constructor
   */
  register(siteType: string, WorkflowClass: WorkflowConstructor): void {
    this.registry.set(siteType, WorkflowClass);
  }

  /**
   * Add a site configuration.
   * @param config - Site configuration
   */
  addSite(config: SiteConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Get or create a workflow instance for a site.
   * @param siteId - The site ID (from config)
   */
  async getWorkflow(siteId: string): Promise<ISiteWorkflow> {
    // Return existing instance if available
    let instance = this.instances.get(siteId);
    if (instance) return instance;

    // Get config
    const config = this.configs.get(siteId);
    if (!config) {
      throw new Error(`No configuration found for site "${siteId}". Call addSite() first.`);
    }

    // Find workflow class - look for exact match or use site type from config
    let WorkflowClass = this.registry.get(siteId);
    if (!WorkflowClass) {
      // Try to find by checking if siteId contains a registered type
      for (const [type, cls] of this.registry) {
        if (siteId.includes(type)) {
          WorkflowClass = cls;
          break;
        }
      }
    }

    if (!WorkflowClass) {
      throw new Error(
        `No workflow registered for site "${siteId}". ` +
        `Registered types: ${Array.from(this.registry.keys()).join(', ')}`
      );
    }

    // Create instance
    instance = new WorkflowClass(config, this.manager);
    this.instances.set(siteId, instance);

    return instance;
  }

  /**
   * Initialize a workflow (launch browser, load session).
   */
  async init(siteId: string): Promise<ISiteWorkflow> {
    const workflow = await this.getWorkflow(siteId);
    await workflow.init();
    return workflow;
  }

  /**
   * Run login for a site.
   */
  async login(siteId: string): Promise<WorkflowResult<void>> {
    const workflow = await this.init(siteId);
    return await workflow.login();
  }

  /**
   * Check if a site is logged in.
   */
  async isLoggedIn(siteId: string): Promise<boolean> {
    const workflow = await this.getWorkflow(siteId);
    return await workflow.isLoggedIn();
  }

  /**
   * Close a specific site's browser.
   */
  async close(siteId: string): Promise<void> {
    const instance = this.instances.get(siteId);
    if (instance) {
      await instance.close();
      this.instances.delete(siteId);
    }
  }

  /**
   * Close all browsers.
   */
  async closeAll(): Promise<void> {
    await this.manager.closeAll();
    this.instances.clear();
  }

  /**
   * List all registered site types.
   */
  listRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List all configured sites.
   */
  listSites(): SiteConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * List active (initialized) workflows.
   */
  listActive(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Get a site configuration by ID.
   */
  getSiteConfig(siteId: string): SiteConfig | undefined {
    return this.configs.get(siteId);
  }

  /**
   * Remove a site configuration.
   */
  removeSite(siteId: string): void {
    this.configs.delete(siteId);
    const instance = this.instances.get(siteId);
    if (instance) {
      instance.close();
      this.instances.delete(siteId);
    }
  }
}
