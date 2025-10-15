/**
 * Migrations Index
 *
 * Exports all database migrations in order.
 * Add new migrations to this array as they are created.
 */

import type { Migration } from './runner';
import { initialSchema } from './001_initial_schema';

export const migrations: Migration[] = [
  initialSchema,
  // Add new migrations here
];

export { MigrationRunner } from './runner';
