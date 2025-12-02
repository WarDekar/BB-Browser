import { EventEmitter } from 'events';
import { BrowserInstance } from './BrowserInstance.js';
import { SessionManager } from '../session/SessionManager.js';
import type { BrowserInstanceConfig, BrowserInfo, SessionData } from '../types/index.js';

export class BrowserManager extends EventEmitter {
  private instances: Map<string, BrowserInstance> = new Map();
  private sessionManager: SessionManager;

  constructor(sessionsDir?: string) {
    super();
    this.sessionManager = new SessionManager(sessionsDir);
  }

  /** Create and launch a new browser instance */
  async create(config: BrowserInstanceConfig): Promise<BrowserInstance> {
    if (this.instances.has(config.name)) {
      throw new Error(`Browser instance "${config.name}" already exists`);
    }

    const instance = new BrowserInstance(config);

    // Forward events
    instance.on('page:created', (data) => this.emit('page:created', { browser: config.name, ...data }));
    instance.on('page:closed', (data) => this.emit('page:closed', { browser: config.name, ...data }));
    instance.on('page:navigated', (data) => this.emit('page:navigated', { browser: config.name, ...data }));

    await instance.launch();
    this.instances.set(config.name, instance);

    this.emit('browser:created', { name: config.name });
    return instance;
  }

  /** Get a browser instance by name */
  get(name: string): BrowserInstance | undefined {
    return this.instances.get(name);
  }

  /** Get a browser instance, throw if not found */
  getOrThrow(name: string): BrowserInstance {
    const instance = this.instances.get(name);
    if (!instance) {
      throw new Error(`Browser instance "${name}" not found`);
    }
    return instance;
  }

  /** List all browser instances */
  list(): BrowserInfo[] {
    return Array.from(this.instances.values()).map((instance) => instance.getInfo());
  }

  /** Get all instance names */
  getNames(): string[] {
    return Array.from(this.instances.keys());
  }

  /** Check if a browser instance exists */
  has(name: string): boolean {
    return this.instances.has(name);
  }

  /** Close a specific browser instance */
  async close(name: string): Promise<void> {
    const instance = this.instances.get(name);
    if (!instance) {
      throw new Error(`Browser instance "${name}" not found`);
    }

    await instance.close();
    this.instances.delete(name);
    this.emit('browser:closed', { name });
  }

  /** Close all browser instances */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.instances.entries()).map(async ([name, instance]) => {
      await instance.close();
      this.emit('browser:closed', { name });
    });

    await Promise.all(closePromises);
    this.instances.clear();
  }

  /** Save session for a browser instance */
  async saveSession(browserName: string, sessionName: string): Promise<void> {
    const instance = this.getOrThrow(browserName);
    const sessionData = await instance.extractSession();

    await this.sessionManager.save({
      ...sessionData,
      name: sessionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.emit('session:saved', { browserName, sessionName });
  }

  /** Load session into a browser instance */
  async loadSession(browserName: string, sessionName: string): Promise<void> {
    const instance = this.getOrThrow(browserName);
    const session = await this.sessionManager.load(sessionName);

    if (!session) {
      throw new Error(`Session "${sessionName}" not found`);
    }

    await instance.injectSession(session);
    this.emit('session:loaded', { browserName, sessionName });
  }

  /** List all saved sessions */
  async listSessions(): Promise<string[]> {
    return await this.sessionManager.list();
  }

  /** Delete a saved session */
  async deleteSession(sessionName: string): Promise<void> {
    await this.sessionManager.delete(sessionName);
    this.emit('session:deleted', { sessionName });
  }

  /** Create browser and load existing session in one call */
  async createWithSession(
    config: BrowserInstanceConfig,
    sessionName: string
  ): Promise<BrowserInstance> {
    const instance = await this.create(config);

    const session = await this.sessionManager.load(sessionName);
    if (session) {
      await instance.injectSession(session);
    }

    return instance;
  }
}
