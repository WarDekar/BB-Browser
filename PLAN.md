# BB-Browser Project Plan

## Overview
BB-Browser is a Chrome-based browser automation tool for authenticated web scraping with proxy support. It provides CLI, REST API, and Web Interface access.

## Core Features

### 1. Multi-Instance Browser Management
- Run multiple Chromium instances simultaneously
- Each instance can have its own HTTP/HTTPS proxy configuration
- Support for both headless and headed (visible) modes
- Persistent browser sessions for maintaining login state

### 2. Proxy Management
- Configure different HTTP/HTTPS proxies per browser instance
- Proxy authentication support (username/password)
- Bypass list for specific domains

### 3. Session Management
- Save and restore browser sessions (cookies, localStorage)
- Named session profiles for different sites/accounts
- Session persistence across restarts

### 4. Interface Options
- **CLI** - Command-line interface for scripting and automation
- **REST API** - HTTP API server for programmatic control
- **Web Interface** - Browser-based UI for manual control and monitoring

### 5. Data Pipeline (Future)
- Scraped data logged to PostgreSQL database
- Integration with existing BB-CBB infrastructure

---

## Technical Architecture

```
bb-browser/
├── src/
│   ├── core/                      # Browser engine
│   │   ├── BrowserManager.ts      # Manages browser instances
│   │   ├── BrowserInstance.ts     # Single browser wrapper
│   │   └── ProxyConfig.ts         # Proxy configuration
│   ├── session/                   # Session persistence
│   │   └── SessionManager.ts
│   ├── cli/                       # CLI interface
│   │   └── index.ts
│   ├── api/                       # REST API server
│   │   ├── server.ts
│   │   └── routes/
│   ├── web/                       # Web interface (future)
│   │   └── ...
│   ├── types/                     # TypeScript types
│   │   └── index.ts
│   └── index.ts                   # Library entry point
├── sessions/                      # Stored session data
├── package.json
├── tsconfig.json
└── .env
```

## Technology Stack
- **Runtime**: Node.js (v18+)
- **Language**: TypeScript
- **Browser Automation**: Playwright
- **API Server**: Express or Fastify (TBD)
- **Web Interface**: React or simple HTML (TBD)
- **Database**: PostgreSQL (future integration)

---

## Implementation Phases

### Phase 1: Core Browser Infrastructure ← START HERE
- [x] Project setup (TypeScript, Playwright)
- [ ] BrowserManager class - create/manage multiple browser instances
- [ ] BrowserInstance class - wrapper with proxy support
- [ ] Session save/restore functionality
- [ ] Basic test script to verify it works

### Phase 2: CLI Interface
- [ ] Command parser (using commander.js or similar)
- [ ] Commands: `launch`, `list`, `close`, `save-session`, `load-session`
- [ ] Interactive mode for manual browser control

### Phase 3: REST API
- [ ] HTTP server setup
- [ ] Endpoints: `/browsers`, `/sessions`, `/scrape`
- [ ] WebSocket for real-time status (optional)

### Phase 4: Web Interface
- [ ] Simple dashboard to view running browsers
- [ ] Controls to launch/close instances
- [ ] Session management UI

### Phase 5: Database Integration
- [ ] PostgreSQL connection
- [ ] Scraped data storage
- [ ] Integration with BB-CBB

---

## Key Interfaces

```typescript
// Proxy configuration (HTTP/HTTPS only)
interface ProxyConfig {
  server: string;       // e.g., "http://proxy.example.com:8080"
  username?: string;
  password?: string;
  bypass?: string[];    // Domains to bypass proxy
}

// Browser instance configuration
interface BrowserInstanceConfig {
  name: string;
  proxy?: ProxyConfig;
  headless?: boolean;   // default: false (show browser)
  viewport?: { width: number; height: number };
}

// Session data
interface SessionData {
  name: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  createdAt: Date;
  url: string;          // Last URL when saved
}
```

---

## Usage Examples

### CLI (Phase 2)
```bash
# Launch a browser with proxy
bb-browser launch --name "site-a" --proxy "http://user:pass@proxy.com:8080"

# Save session after manual login
bb-browser save-session --name "site-a" --session "my-session"

# Later: restore and use session
bb-browser launch --name "site-a" --session "my-session"
```

### API (Phase 3)
```bash
# Launch browser
curl -X POST http://localhost:3000/browsers \
  -H "Content-Type: application/json" \
  -d '{"name": "site-a", "proxy": {"server": "http://proxy:8080"}}'

# List running browsers
curl http://localhost:3000/browsers
```

### Library (Phase 1)
```typescript
import { BrowserManager } from 'bb-browser';

const manager = new BrowserManager();

// Create browser with proxy
const browser = await manager.create({
  name: 'site-a',
  proxy: { server: 'http://proxy:8080' },
  headless: false
});

// Get a page and navigate
const page = await browser.newPage();
await page.goto('https://example.com');

// Save session for later
await manager.saveSession('site-a', 'my-session');
```

---

## Approval Checklist

Please confirm before I proceed:

- [?] **Phase 1 scope** - Core browser infrastructure first
- [?] **TypeScript + Playwright** - Tech stack OK?
- [?] **HTTP/HTTPS proxies only** - No SOCKS5 needed?
- [?] **Headed mode default** - `headless: false` as default?

---

## Next Immediate Steps (Phase 1)

1. ~~Initialize npm project~~ ✓
2. ~~Install Playwright + TypeScript~~ ✓
3. Install Playwright browsers (Chromium)
4. Create TypeScript config
5. Create BrowserManager class
6. Create BrowserInstance class
7. Create SessionManager class
8. Create test script
9. Set up Git repo and push to GitHub (user: WarDekar)
