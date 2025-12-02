import type { Cookie } from 'playwright';

/** HTTP/HTTPS proxy configuration */
export interface ProxyConfig {
  /** Proxy server URL (e.g., "http://proxy.example.com:8080") */
  server: string;
  /** Proxy authentication username */
  username?: string;
  /** Proxy authentication password */
  password?: string;
  /** Domains to bypass proxy (e.g., ["localhost", "*.internal.com"]) */
  bypass?: string[];
}

/** Configuration for creating a browser instance */
export interface BrowserInstanceConfig {
  /** Unique name for this browser instance */
  name: string;
  /** HTTP/HTTPS proxy configuration */
  proxy?: ProxyConfig;
  /** Run in headless mode (default: false - show browser) */
  headless?: boolean;
  /** Viewport dimensions */
  viewport?: {
    width: number;
    height: number;
  };
  /** User data directory for persistent profile */
  userDataDir?: string;
}

/** Stored session data for persistence */
export interface SessionData {
  /** Session name/identifier */
  name: string;
  /** Browser instance name this session belongs to */
  browserName: string;
  /** Stored cookies */
  cookies: Cookie[];
  /** localStorage data */
  localStorage: Record<string, string>;
  /** sessionStorage data */
  sessionStorage: Record<string, string>;
  /** URL when session was saved */
  url: string;
  /** Timestamp when session was created */
  createdAt: string;
  /** Timestamp when session was last updated */
  updatedAt: string;
}

/** Browser instance status */
export type BrowserStatus = 'launching' | 'ready' | 'busy' | 'closed' | 'error';

/** Information about a running browser instance */
export interface BrowserInfo {
  name: string;
  status: BrowserStatus;
  proxy?: ProxyConfig;
  headless: boolean;
  pageCount: number;
  createdAt: Date;
}

/** Result of a scrape operation */
export interface ScrapeResult {
  url: string;
  title: string;
  content?: string;
  html?: string;
  screenshot?: Buffer;
  timestamp: Date;
  success: boolean;
  error?: string;
}

/** Event types emitted by browser instances */
export type BrowserEventType =
  | 'page:created'
  | 'page:closed'
  | 'page:navigated'
  | 'session:saved'
  | 'session:loaded'
  | 'error';

export interface BrowserEvent {
  type: BrowserEventType;
  browserName: string;
  data?: unknown;
  timestamp: Date;
}

// ============================================
// Workflow Types
// ============================================

/** Configuration for a site workflow */
export interface SiteConfig {
  /** Unique site identifier */
  id: string;
  /** Human-readable site name */
  name: string;
  /** Base URL for the site */
  baseUrl: string;
  /** Proxy to use for this site (optional) */
  proxy?: ProxyConfig;
  /** Session name to use/create for this site */
  sessionName?: string;
  /** Run headless (default: false) */
  headless?: boolean;
}

/** Result from a workflow action */
export interface WorkflowResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

/** Base interface that all site workflows must implement */
export interface ISiteWorkflow {
  /** Site configuration */
  readonly config: SiteConfig;

  /** Initialize the browser for this site */
  init(): Promise<void>;

  /** Check if currently logged in */
  isLoggedIn(): Promise<boolean>;

  /**
   * Perform login - opens browser for manual login if needed
   * Returns true if login successful
   */
  login(): Promise<WorkflowResult<void>>;

  /** Save current session for future use */
  saveSession(): Promise<void>;

  /** Load previously saved session */
  loadSession(): Promise<boolean>;

  /** Close the browser */
  close(): Promise<void>;
}

/** Generic data item scraped from a site */
export interface ScrapedItem {
  /** Unique ID from the source site */
  sourceId: string;
  /** Type of item (site-specific) */
  type: string;
  /** Raw data */
  data: Record<string, unknown>;
  /** When this was scraped */
  scrapedAt: Date;
  /** Source site ID */
  siteId: string;
}
