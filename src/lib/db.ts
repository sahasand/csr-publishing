import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Get the Prisma client instance.
 * Uses lazy initialization to avoid errors during build time
 * when DATABASE_URL may not be available.
 */
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

// Export a proxy that lazy-loads the client on first access
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: keyof PrismaClient) {
    const client = getPrismaClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
