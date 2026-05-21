## Database Safety

### Never Run Destructive Database Commands

**Do not run commands that drop, wipe, reset, or recreate a database or its tables** — regardless of flags or environment arguments. Destructive operations include, whatever the stack:

- Framework commands that drop and rebuild the schema (a "fresh", "reset", "refresh", or "wipe" migration command).
- Raw SQL `DROP` or `TRUNCATE` against any database.
- Restoring or re-importing a database over an existing one.

These destroy data. An environment flag (`--env=...`, an alternate connection name) is **not** a safety net — it only helps if a separate, correctly configured environment actually exists. If you are unsure which database a destructive command targets, do not run it.

### Test Database

- The test database is owned by the project's test runner. Let the test suite create, migrate, and tear it down — never migrate or refresh it by hand.
- If the test database gets into a broken state, ask the user to fix it rather than running destructive commands.

### Safe Operations

Safe — these advance or add to the schema without destroying data:

- Running pending migrations **forward** on a non-test database — *after* checking that the pending files only add or alter columns. A forward migration is not automatically safe: it can still drop a column or table, or delete data in a backfill. Read it first.
- Running the test suite (it manages its own database lifecycle).
- Seeding additional data without truncating existing tables.

### When a Destructive Operation Is Genuinely Needed

Stop and ask the user to run it themselves, or to confirm it explicitly. Never decide on your own that data loss is acceptable.
