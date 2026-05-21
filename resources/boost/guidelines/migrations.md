## Migrations

Conventions for schema migration files, whatever the migration tool. Examples use a schema-builder DSL for illustration; the principles apply to raw-SQL migrations too.

### Self-Contained Migrations

- Migrations must be fully self-contained. Never reference application code — model constants, enums, config values, or helper functions.
- Use plain string and scalar literals for column names, table names, and other identifiers directly in the migration file.
- This keeps migrations stable and runnable regardless of future application code changes — a migration written today must still run years later, even if the code it once referenced has been renamed or deleted.
- Legacy migrations may still reference application code; only update them to follow this guideline when you are otherwise modifying those migrations.

```php
// ❌ WRONG — references an application constant
$table->boolean(Feature::FLAG_ENABLED)->nullable();

// ✅ CORRECT — plain string literal
$table->boolean('flag_enabled')->nullable();
```

### Column Ordering

- Add new columns at the **end** of the table — do not insert one into the middle of an existing table.
- On MySQL/MariaDB, positioning a column mid-table (an `AFTER` clause) can disable instant/online DDL and force a full table copy — a significant hit on large tables. Other engines such as PostgreSQL have no column-position concept at all, so a position clause is meaningless there. Appending is safe and portable everywhere.

```php
// ❌ WRONG — mid-table positioning can force a full table rebuild on MySQL/MariaDB
$table->string('description')->after('name');

// ✅ CORRECT — just append the column
$table->string('description');
```
