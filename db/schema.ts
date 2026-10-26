import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// A single versioned document makes joins and votes compare-and-swap atomic.
export const sessions = sqliteTable('parallaxe_sessions', {
  code: text('code').primaryKey(),
  version: integer('version').notNull().default(0),
  data: text('data').notNull(),
  updatedAt: integer('updated_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
},table=>[index('parallaxe_sessions_expiry').on(table.expiresAt)]);
