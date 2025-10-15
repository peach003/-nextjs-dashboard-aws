/**
 * Database Migration Runner
 *
 * Simple migration system for managing database schema changes.
 * Tracks applied migrations in a `migrations` table.
 */

import { sql } from '@vercel/postgres';

export interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export class MigrationRunner {
  /**
   * Ensure migrations table exists
   */
  static async init() {
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  /**
   * Get list of applied migrations
   */
  static async getAppliedMigrations(): Promise<string[]> {
    await this.init();
    const result = await sql`SELECT id FROM migrations ORDER BY applied_at`;
    return result.rows.map((row) => row.id);
  }

  /**
   * Run pending migrations
   */
  static async runMigrations(migrations: Migration[]) {
    const applied = await this.getAppliedMigrations();
    const pending = migrations.filter((m) => !applied.includes(m.id));

    if (pending.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }

    console.log(`Running ${pending.length} migration(s)...`);

    for (const migration of pending) {
      try {
        console.log(`  → Running: ${migration.name}`);
        await migration.up();

        // Record migration
        await sql`
          INSERT INTO migrations (id, name)
          VALUES (${migration.id}, ${migration.name})
        `;

        console.log(`  ✓ Completed: ${migration.name}`);
      } catch (error) {
        console.error(`  ✗ Failed: ${migration.name}`, error);
        throw error;
      }
    }

    console.log('✓ All migrations completed');
  }

  /**
   * Rollback last migration
   */
  static async rollback(migrations: Migration[]) {
    const applied = await this.getAppliedMigrations();

    if (applied.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigrationId = applied[applied.length - 1];
    const migration = migrations.find((m) => m.id === lastMigrationId);

    if (!migration) {
      throw new Error(`Migration ${lastMigrationId} not found`);
    }

    try {
      console.log(`Rolling back: ${migration.name}`);
      await migration.down();

      // Remove migration record
      await sql`DELETE FROM migrations WHERE id = ${migration.id}`;

      console.log(`✓ Rolled back: ${migration.name}`);
    } catch (error) {
      console.error(`✗ Rollback failed: ${migration.name}`, error);
      throw error;
    }
  }
}
