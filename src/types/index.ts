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
