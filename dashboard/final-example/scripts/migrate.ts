/**
 * Database Migration CLI
 *
 * Usage:
 *   npm run db:migrate        # Run pending migrations
 *   npm run db:rollback       # Rollback last migration
 *   npm run db:status         # Show migration status
 */

import { MigrationRunner, migrations } from '../app/lib/migrations';

async function main() {
  const command = process.argv[2] || 'up';

  try {
    switch (command) {
      case 'up':
        await MigrationRunner.runMigrations(migrations);
        break;

      case 'down':
      case 'rollback':
        await MigrationRunner.rollback(migrations);
        break;

      case 'status':
        const applied = await MigrationRunner.getAppliedMigrations();
        console.log('\nMigration Status:');
        console.log('─'.repeat(50));

        migrations.forEach((migration) => {
          const status = applied.includes(migration.id) ? '✓' : '○';
          console.log(`  ${status} ${migration.name} (${migration.id})`);
        });

        console.log('─'.repeat(50));
        console.log(
          `\nApplied: ${applied.length} / ${migrations.length} migrations`,
        );
        break;

      default:
        console.log('Unknown command:', command);
        console.log('Available commands: up, down, status');
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
