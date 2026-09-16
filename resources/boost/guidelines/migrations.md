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

### Guard Each Statement On an Engine Without Transactional DDL

A migration runner records a migration only after its whole `up()` returns, and it wraps the run in a transaction only for engines it treats as supporting transactional DDL. Laravel does that for PostgreSQL and SQL Server, and not for MySQL, MariaDB or SQLite. Without that transaction, a run that dies halfway leaves the applied statements in place with nothing recorded, and the retry fails on the first statement it already applied, blocking every later migration. Check which side your engine and runner fall on before assuming a failed migration rolled back.

Make each statement in a multi-statement migration skippable when it is already applied, using the runner's own column and index checks.

```php
// ❌ WRONG — a retry after a half-applied run dies on "Duplicate column name"
Schema::table('orders', function (Blueprint $table) {
    $table->string('reference');
    $table->index('reference');
});

// ✅ CORRECT — each statement checks for itself first
if (! Schema::hasColumn('orders', 'reference')) {
    Schema::table('orders', fn (Blueprint $table) => $table->string('reference'));
}

if (! Schema::hasIndex('orders', 'orders_reference_index')) {
    Schema::table('orders', fn (Blueprint $table) => $table->index('reference'));
}
```

Keep slow work out of the migration on a large table: build an index, backfill a column, or add a foreign key as a separate job or an out-of-band task, not inside the deploy step.
