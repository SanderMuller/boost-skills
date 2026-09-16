---
name: eloquent-models
description: "Creates and maintains Eloquent models with strict conventions: column/relation constants, comprehensive class docblock with @property and @property-read sections, foreign keys referenced via constants, and casts/fillable/hidden referencing constants. Use when creating a new model, adding columns or properties to an existing model, adding or modifying relations, or updating model docblocks. Triggers on model, eloquent, relation, belongs to, has many, has one, belongs to many, model constants, model properties, eloquent casts."
metadata:
  boost-tags: "laravel"
  boost-requires: "php-generics"
---
# Eloquent Model Development

## When to use this skill

Use this skill when:
- Creating a new Eloquent model
- Adding new columns/properties to an existing model
- Adding or modifying relationships on a model
- Updating model constants or docblocks after schema changes

## Model Structure

Models follow a strict structure with constants for all column names and relation names, plus a comprehensive class docblock. Inspect the table structure (e.g. via `php artisan db:table <table>` or a schema introspection helper) when creating or updating models.

### Class Docblock

The class docblock is organized into labeled sections. Include only sections that apply.

```php
/**
 * @mixin Eloquent
 *
 * Attributes
 * @property int|null $id
 * @property string|null $name
 * @property int|null $parent_id
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 *
 * Appendable attributes
 * @property-read string $formatted_name
 *
 * Pivots
 * @property-read PivotModel|null $pivot
 *
 * n:1 relations
 * @property-read Parent|null $parent
 *
 * 1:n relations
 * @property-read EloquentCollection<int, ChildModel> $children
 *
 * 1:1 relations
 * @property-read RelatedModel|null $related
 *
 * n:n relations
 * @property-read EloquentCollection<int, Tag> $tags
 *
 * Relation counts
 * @property-read int|null $children_count
 */
```

**Docblock rules:**
- Attributes use `@property` with nullable types (`Type|null`) by default
- Relation properties use `@property-read`
- n:1 (BelongsTo) and 1:1 (HasOne) relations: `RelatedModel|null`
- 1:n (HasMany) and n:n (BelongsToMany) relations: `EloquentCollection<int, RelatedModel>`
- Appendable/computed attributes use `@property-read`
- Properties are sorted alphabetically within each section

### Column Constants

Every database column must have a corresponding `final public const` constant. Constants are SCREAMING_SNAKE_CASE and grouped under a `/* Attributes */` comment. Sort alphabetically.

```php
/* Attributes */
final public const
    CREATED_AT = 'created_at',
    DISPLAY_NAME = 'display_name',
    ID = 'id',
    PARENT_ID = 'parent_id',
    STATUS = 'status',
    UPDATED_AT = 'updated_at';
```

### Relation Constants

Every relation method must have a corresponding `final public const` constant. Constants match the camelCase method name and are grouped under a `/* Relations */` comment. Sort alphabetically.

```php
/* Relations */
final public const
    CHILDREN = 'children',
    PARENT = 'parent',
    TAGS = 'tags';
```

### Relation Methods

Every relation method must have:
1. A **PHPDoc `@return` with generic types** specifying the related model
2. **Foreign key specified as a constant** from the appropriate model

```php
/**
 * @return BelongsTo<Parent, $this>
 */
public function parent(): BelongsTo
{
    return $this->belongsTo(Parent::class, self::PARENT_ID);
}

/**
 * @return HasMany<Child, $this>
 */
public function children(): HasMany
{
    return $this->hasMany(Child::class, Child::PARENT_ID);
}

/**
 * @return HasManyThrough<Grandchild, Child, $this>
 */
public function grandchildren(): HasManyThrough
{
    return $this->hasManyThrough(Grandchild::class, Child::class, Child::PARENT_ID);
}

/**
 * @return BelongsToMany<Tag, $this>
 */
public function tags(): BelongsToMany
{
    return $this->belongsToMany(Tag::class, 'item_tags', 'item_id');
}
```

**Foreign key rules:**
- BelongsTo: Use `self::COLUMN_NAME_ID` (the FK lives on this model)
- HasMany/HasOne: Use `RelatedModel::FOREIGN_KEY_COLUMN` (the FK lives on the related model)
- HasManyThrough: Use `IntermediateModel::FOREIGN_KEY_COLUMN` for the first foreign key
- BelongsToMany: Use pivot table name and column name strings (or constants if available)

### Casts, Fillable, Hidden

Always reference column constants instead of raw strings. Use the Laravel 11+ `casts()` method form for casts:

```php
protected function casts(): array
{
    return [
        self::STATUS => Status::class,
        self::PARENT_ID => 'int',
        self::CREATED_AT => 'immutable_datetime',
    ];
}

protected $fillable = [
    self::DISPLAY_NAME,
    self::STATUS,
];

protected $hidden = [
    self::SECRET_KEY,
];
```

## Generics on the Model's Companions

A model's factory, query builder and collection are generic classes. Bind the type parameter, or every caller gets the unbound base back and the analyser stops following the chain. The language-level rules behind this — binding a base, naming a shape, `class-string` — live in the `php-generics` skill.

**On the model**, pair each generic trait with its binding:

```php
final class Article extends Model
{
    /** @use HasBuilder<ArticleQueryBuilder> */
    use HasBuilder;

    /** @use HasFactory<ArticleFactory> */
    use HasFactory;
}
```

**One docblock per `use` statement.** A docblock carrying both tags binds only the trait it sits directly above; the second trait stays unbound and PHPStan reports `missingType.generics` on the class.

**On a custom query builder**, bind the model:

```php
/**
 * @extends Builder<Article>
 */
final class ArticleQueryBuilder extends Builder
{
    public function whichArePublished(): self { /* ... */ }
}
```

A fluent constraint method that declares `self` needs no docblock.

**The binding is the analysis half; the model still has to select the class at run time.** `Model::$builder` defaults to Eloquent's own `Builder`, and `newEloquentBuilder()` instantiates whatever that property names — so a model that declares `@use HasBuilder<ArticleQueryBuilder>` and sets nothing gets the default builder at run time while analysis believes otherwise, and a call to a custom constraint fails only when it runs:

```php
final class Article extends Model
{
    /** @use HasBuilder<ArticleQueryBuilder> */
    use HasBuilder;

    protected static string $builder = ArticleQueryBuilder::class;
}
```

**On a factory**, bind the model on the class docblock:

```php
/**
 * @extends Factory<Article>
 */
final class ArticleFactory extends Factory { /* ... */ }
```

Then delete the legacy `@method Article create(...)` / `@method Article make(...)` / `@method Article newModel(...)` trio: `@extends` already says it, and the overrides go stale on their own. A state method returning `$this->state(...)` keeps its `static` return type and needs no docblock.

A factory extending an abstract base that is already bound to a concrete model inherits that binding and rebinds nothing. Rebind only where the subclass builds a different model, or where the abstract base is itself templated.

**On a custom collection**, bind key and value: `@extends EloquentCollection<int, Article>` for a collection of models a relation returns, or `array-key` as the key elsewhere. The same two halves apply — the model selects the class and binds it with `@use HasCollection<ArticleCollection>`, selecting either through `$collectionClass` or the `#[CollectedBy(ArticleCollection::class)]` attribute. Bind without selecting and every query still returns the base collection.

These helpers have version floors: `HasBuilder` and the `$builder` property arrived in Laravel 11.15, `HasCollection` in 11.17, and `#[CollectedBy]` in 11.28. Below a floor, override `newEloquentBuilder()` or `newCollection()` on the model instead and keep the generic docblock on the override.

## Checklist

When creating or modifying a model:

- [ ] All database columns have a `final public const` constant
- [ ] All relation methods have a `final public const` constant
- [ ] Class docblock has `@property` entries for all columns (sorted alphabetically per section)
- [ ] Class docblock has `@property-read` entries for all relations (sorted alphabetically per section)
- [ ] Relation methods have `@return` PHPDoc with generic types
- [ ] Relation foreign keys use constants (`self::COLUMN_ID` or `RelatedModel::COLUMN_ID`)
- [ ] `casts()` method, `$fillable`, `$hidden` reference constants, not raw strings
- [ ] Constants are sorted alphabetically within their group
- [ ] Each generic trait the model uses carries its own `@use ...<>` docblock, one per `use` statement
- [ ] Where the model has a factory, a custom query builder, or a custom collection, each binds its type parameter
