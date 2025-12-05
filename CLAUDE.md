# BB-Betting

Chrome-based browser automation for logging into betting sites and downloading bet histories.

## Permissions

- **BB-CBB**: Claude may READ from `/Volumes/MiniSSD/Dev/BB-CBB/` for reference. NEVER modify files in that directory.

## Project Purpose

This tool automates logging into betting sites (Pinnacle, Bovada, DraftKings, etc.) to download bet histories for analysis. Related to BB-Odds and BB-CBB projects for sports betting analysis.

## Quick Start

```bash
npm run serve        # Start API server + Web UI on http://127.0.0.1:3000
npm run cli          # Run CLI commands
npm run build        # Compile TypeScript
```

## Architecture

```
src/
├── core/
│   ├── BrowserManager.ts    # Manages multiple browser instances
│   └── BrowserInstance.ts   # Playwright wrapper for single browser
├── session/
│   └── SessionManager.ts    # Saves/loads cookies & localStorage to ./sessions/
├── workflows/
│   ├── BaseSiteWorkflow.ts  # Abstract base class for site workflows
│   ├── WorkflowManager.ts   # Registry for site workflows
│   └── ExampleWorkflow.ts   # Template for new workflows
├── api/
│   └── server.ts            # Express REST API
├── web/
│   └── public/index.html    # Web UI (dark theme, site management)
├── cli/
│   └── index.ts             # Commander.js CLI
├── types/
│   └── index.ts             # TypeScript interfaces
└── index.ts                 # Main exports
```

## Key Concepts

### Site Workflows
Each betting site gets its own workflow class extending `BaseSiteWorkflow`:
- `isLoggedIn()` - Detect if user is logged in (check for user menu, balance, etc.)
- `login()` - Navigate to login, optionally auto-fill credentials
- `getBetHistory()` - Scrape bet history data
- `saveSession()` / `loadSession()` - Persist login sessions

### Site/Proxy Storage (Server-Side)
Sites and proxies are stored on the server (not localStorage):
- `./config/sites.json` - Site configs with credentials
- `./config/proxies.json` - Proxy configs
- Loaded on server startup via `SiteConfigManager`

Each site config:
```typescript
{
  id: string,           // e.g., "pinnacle"
  name: string,         // e.g., "Pinnacle Sports"
  baseUrl: string,      // e.g., "https://www.pinnacle.com"
  proxy?: string,       // Proxy name from saved proxies
  username?: string,    // Login username
  password?: string,    // Login password
  workflowImplemented: boolean  // Has workflow class been built?
}
```

### Browser Features
- Multiple simultaneous browser instances
- HTTP/HTTPS proxy support per browser
- Session persistence (cookies, localStorage, sessionStorage)
- Headed mode (headless=false) for manual login
- Viewport uses natural window size (not fixed 1920x1080)

## Current State

### Completed
- Core browser management (BrowserManager, BrowserInstance)
- Session save/load to ./sessions/ directory
- REST API with endpoints for browsers, sessions, sites
- Web UI redesigned for betting site management
- Proxy saving/selection in Web UI
- Site configuration with credentials storage
- **PinnacleWorkflow** - Login and bet history navigation working
- Web UI Login/Get History buttons in Betting Sites section
- Site configs sync from localStorage to server on page load

### Pinnacle (probet42) Details
- **Mirror Site**: probet42.com (Pinnacle affiliate)
- **Login Selectors**: `#loginId` (username), `#pass` (password), `button:has-text("SIGN IN")`
- **Logged-in Detection**: "Welcome back" text present, "SIGN IN" absent
- **My Bets URL**: `/en/account/my-bets-full`
- **My Bets Flow**:
  1. Click `li[data=SETTLED] a` to switch to Settled bets
  2. Set `input[name=fromDate]` and `input[name=toDate]` (DD/MM/YYYY format)
  3. Click Search button
- **My Bets Columns**: #, Product, Detail (betId, sport, timestamps), Selection (team, spread, matchup, league), Odds, Stake, Win/Loss, Commission, Status (scores)
- **Browser Config**: Uses system Chrome with `--disable-blink-features=AutomationControlled` to avoid detection

### Sports411 Details
- **Site URL**: sports411.ag
- **Login Selectors**: `#account` (username), `#password` (password), `input.btn.login`
- **Logged-in Detection**: Account number visible in header, balance dropdown present
- **History URL**: `/en/history` (Angular SPA - navigate via History link)
- **History Flow**:
  1. Click "History" link in top nav
  2. Use time range buttons: "This week", "Last week", "This month", "Last month", "Custom Range"
  3. Custom dates via `#start` and `#end` (HTML date inputs, YYYY-MM-DD format)
- **History Data Structure**:
  - `app-history-ticket .ticket` - Each bet row
  - `.bet-type` - Bet type (Straight Bet, Parlay, etc.)
  - `.game` - Selection details (sport, spread, matchup)
  - `.date-data` - Ticket # and date/time
  - `.col-2 .amount` (1st) - Risk/Win
  - `.col-2 .amount` (2nd) - Win/Loss result
- **Date Format**: MM/DD/YYYY (displayed), YYYY-MM-DD (inputs)
- **Weekly Summary**: Shows daily Win/Loss, Cash In/Out, Balance breakdown
- **Pagination**: 30 bets per page, uses `#nextBtn a` to navigate pages
- **Scraper**: Web UI `fetchHistorySports411()` handles pagination automatically

### BetOnline Details
- **Site URL**: betonline.ag
- **Login Flow**: Click LOGIN button -> fill `#username`, `#password` -> click `#kc-login`
- **Dismiss Popups**: Click "GOT IT" for promotional popups (Same Game Parlays, etc.)
- **Logged-in Detection**: Balance visible in header, account dropdown available
- **History Flow**:
  1. Click balance to open account dropdown
  2. Click "Bet History"
  3. Use Date Range filter with presets (7 days, 15 days, 30 days) or custom From/To
- **History Data Structure**:
  - `.bet-history__table__body__rows` - Each bet row
  - Columns: Ticket #, Date, Description, Type, Status, Amount, To Win
- **Date Format**: MM/DD/YYYY
- **Loading**: Infinite scroll - page loads more bets as you scroll down
- **Known Issue**: Angular app doesn't respond to programmatic date filter changes
- **Scraper Workaround**: User must manually set date range in browser first, then run Get History to scrape displayed data

### TODO
- Create `bet_history.db` SQLite database with normalized bet records
- Add ESPN game ID matching for cross-referencing with BB-CBB
- Export bet history to CSV/JSON file
- Add more betting sites (Bovada, DraftKings, etc.)

## Adding a New Site Workflow

1. Create `src/workflows/{SiteName}Workflow.ts`:
```typescript
import { BaseSiteWorkflow } from './BaseSiteWorkflow.js';
import type { BrowserManager } from '../core/BrowserManager.js';
import type { SiteConfig, WorkflowResult } from '../types/index.js';

export class SiteNameWorkflow extends BaseSiteWorkflow {
  constructor(config: SiteConfig, manager: BrowserManager) {
    super({ ...config, baseUrl: config.baseUrl || 'https://site.com' }, manager);
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for logged-in indicators
    return await this.exists('.user-menu') || await this.exists('.balance');
  }

  async getBetHistory(): Promise<WorkflowResult<BetHistoryItem[]>> {
    // Navigate to history page, scrape data
    const page = this.getPage();
    await page.goto(`${this.config.baseUrl}/account/history`);
    // ... scrape logic
    return this.result(true, items);
  }
}
```

2. Export from `src/workflows/index.ts`
3. Register in WorkflowManager if using workflow system
4. Update Web UI site's `workflowImplemented: true`

## API Endpoints

### Browsers
- `GET /browsers` - List all browsers
- `POST /browsers` - Create browser `{name, proxy?, headless?}`
- `GET /browsers/:name` - Get browser info
- `POST /browsers/:name/goto` - Navigate `{url}`
- `GET /browsers/:name/content` - Get page text
- `GET /browsers/:name/screenshot` - Get PNG screenshot
- `POST /browsers/:name/eval` - Evaluate JS `{script}` - returns `{result}`
- `POST /browsers/:name/fill` - Fill input `{selector, value}`
- `POST /browsers/:name/click` - Click element `{selector}`
- `DELETE /browsers/:name` - Close browser

### Sessions
- `GET /sessions` - List saved sessions
- `POST /browsers/:name/session` - Save session `{sessionName}`
- `POST /browsers/:name/session/load` - Load session `{sessionName}`
- `DELETE /sessions/:name` - Delete session

### Sites (workflow system)
- `GET /sites` - List configured sites
- `POST /sites` - Add site config
- `POST /sites/:id/init` - Initialize site workflow
- `POST /sites/:id/login` - Trigger login
- `GET /sites/:id/status` - Check login status
- `POST /sites/:id/history` - Save bet history to cache `{bets, fromDate, toDate}`
- `GET /sites/:id/history` - Get cached bet history

## Common Patterns

### Taking Screenshots
```typescript
const browser = browserMgr.get('pinnacle');
const screenshot = await browser.screenshot({ fullPage: false });
// screenshot is Buffer (PNG)
```

### Checking Element Exists
```typescript
// In workflow class
const hasBalance = await this.exists('.account-balance');
const menuText = await this.getText('.user-menu');
```

### Waiting for Navigation
```typescript
const page = this.getPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.content-loaded');
```

## Notes

- Proxies must be HTTP/HTTPS format: `http://host:port` or `http://user:pass@host:port`
- Sessions are stored as JSON in `./sessions/{name}.json`
- Web UI auto-refreshes browser list every 5 seconds
- Server runs on `127.0.0.1:3000` by default

## BB-CBB Integration (PostgreSQL)

BB-Betting bet histories will be stored in the same PostgreSQL database as BB-CBB, using a new `bb_betting` schema.

### PostgreSQL Database: `bb_cbb`

**Connection:**
```
postgresql://bbrando@localhost:5432/bb_cbb
```

**For TypeScript (BB-Betting):**
```typescript
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://bbrando@localhost:5432/bb_cbb'
});
```

**For Python (BB-CBB):**
```python
import psycopg2
conn = psycopg2.connect("postgresql://bbrando@localhost:5432/bb_cbb")
```

### Existing Schemas (READ-ONLY Reference)

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| `hoopr` | hoopR/ESPN game data | teams, games, players, player_box, team_box, pbp_box |
| `sportsoptions` | DonBest betting lines | games, teams, team_mappings, bb_predictions |
| `bb_stats` | Advanced basketball stats | final_2h_spreads, team_season_stats, routed_2h |

**Cross-references:** All schemas link via ESPN game IDs:
- `hoopr.games.id` = `sportsoptions.games.espn_id` = `bb_stats.*.espn_id`
- `hoopr.games.donbest_id` → `sportsoptions.games.rotation`

### New Schema: `bb_betting`

The `bb_betting` schema will store scraped bet histories from BB-Betting with:
- Normalized bet records from all sportsbooks (Pinnacle, Sports411, BetOnline, etc.)
- Cross-references to ESPN game IDs for matching with BB-CBB data

**Planned Tables:**
```sql
-- bb_betting.bets - Individual bet records
CREATE TABLE bb_betting.bets (
    id SERIAL PRIMARY KEY,
    site VARCHAR(50) NOT NULL,           -- 'pinnacle', 'sports411', 'betonline'
    site_bet_id VARCHAR(100),            -- Bet ID from the sportsbook
    sport VARCHAR(50),                   -- 'basketball', 'football', etc.
    league VARCHAR(50),                  -- 'ncaab', 'nba', 'nfl', etc.
    bet_type VARCHAR(50),                -- 'spread', 'moneyline', 'total', 'parlay'
    selection TEXT,                      -- Team/selection picked
    matchup TEXT,                        -- Full matchup description
    espn_id INTEGER,                     -- Cross-reference to hoopr.games.id
    odds DECIMAL(8,3),                   -- American or decimal odds
    stake DECIMAL(10,2),                 -- Amount wagered
    to_win DECIMAL(10,2),                -- Potential payout
    result VARCHAR(20),                  -- 'win', 'loss', 'push', 'pending'
    profit_loss DECIMAL(10,2),           -- Actual P/L
    placed_at TIMESTAMP WITH TIME ZONE,  -- When bet was placed
    settled_at TIMESTAMP WITH TIME ZONE, -- When bet was settled
    raw_data JSONB,                      -- Original scraped data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(site, site_bet_id)
);

-- bb_betting.scrape_runs - Track when we scraped each site
CREATE TABLE bb_betting.scrape_runs (
    id SERIAL PRIMARY KEY,
    site VARCHAR(50) NOT NULL,
    from_date DATE,
    to_date DATE,
    bets_count INTEGER,
    scraped_at TIMESTAMP DEFAULT NOW()
);
```

This enables:
- P/L analysis across books
- Comparison of actual bets vs historical odds (theOddsAPI in `betting_data`)
- Correlation with game statistics and shooting surplus data from BB-CBB
- Query example: `SELECT b.*, g.home_team, g.away_team FROM bb_betting.bets b JOIN hoopr.games g ON b.espn_id = g.id`
