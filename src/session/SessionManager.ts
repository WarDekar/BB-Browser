import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { SessionData } from '../types/index.js';

const DEFAULT_SESSIONS_DIR = './sessions';

export class SessionManager {
  private sessionsDir: string;

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir ?? DEFAULT_SESSIONS_DIR;
  }

  /** Ensure sessions directory exists */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.sessionsDir)) {
      await mkdir(this.sessionsDir, { recursive: true });
    }
  }

  /** Get file path for a session */
  private getSessionPath(name: string): string {
    // Sanitize session name for filesystem
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.sessionsDir, `${safeName}.json`);
  }

  /** Save session data to disk */
  async save(session: SessionData): Promise<void> {
    await this.ensureDir();

    const filePath = this.getSessionPath(session.name);
    const data = JSON.stringify(session, null, 2);

    await writeFile(filePath, data, 'utf-8');
  }

  /** Load session data from disk */
  async load(name: string): Promise<SessionData | null> {
    const filePath = this.getSessionPath(name);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as SessionData;
    } catch {
      return null;
    }
  }

  /** Check if a session exists */
  async exists(name: string): Promise<boolean> {
    const filePath = this.getSessionPath(name);
    return existsSync(filePath);
  }

  /** List all saved sessions */
  async list(): Promise<string[]> {
    await this.ensureDir();

    try {
      const files = await readdir(this.sessionsDir);
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /** Delete a session */
  async delete(name: string): Promise<void> {
    const filePath = this.getSessionPath(name);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  /** Get session metadata without full data */
  async getMetadata(name: string): Promise<{
    name: string;
    browserName: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    cookieCount: number;
  } | null> {
    const session = await this.load(name);
    if (!session) return null;

    return {
      name: session.name,
      browserName: session.browserName,
      url: session.url,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cookieCount: session.cookies.length,
    };
  }

  /** List all sessions with metadata */
  async listWithMetadata(): Promise<Array<{
    name: string;
    browserName: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    cookieCount: number;
  }>> {
    const names = await this.list();
    const results = await Promise.all(
      names.map(async (name) => {
        const meta = await this.getMetadata(name);
        return meta;
      })
    );

    return results.filter((meta): meta is NonNullable<typeof meta> => meta !== null);
  }
}
