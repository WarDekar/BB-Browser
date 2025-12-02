// Core exports
export { BrowserManager } from './core/BrowserManager.js';
export { BrowserInstance } from './core/BrowserInstance.js';
export { SessionManager } from './session/SessionManager.js';

// Workflow exports
export { BaseSiteWorkflow, WorkflowManager, ExampleWorkflow } from './workflows/index.js';

// API exports
export { ApiServer } from './api/server.js';

// Type exports
export type {
  ProxyConfig,
  BrowserInstanceConfig,
  SessionData,
  BrowserStatus,
  BrowserInfo,
  ScrapeResult,
  BrowserEventType,
  BrowserEvent,
  SiteConfig,
  WorkflowResult,
  ISiteWorkflow,
  ScrapedItem,
} from './types/index.js';
