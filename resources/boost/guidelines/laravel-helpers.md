## Laravel Helpers

### Diagnostic Context

Attach diagnostic context with Laravel's `Context` facade, not Sentry's `configureScope()` or `$scope->setContext()`. One `Context::add()` reaches both the logs and Sentry: Laravel adds the context to every log entry, and sentry-laravel (4.4 and later, on Laravel 11 and later) registers `LaravelContextIntegration` by default, which copies the context onto every Sentry event.

### Non-Latin Text

Some string helpers rewrite non-Latin text silently. Where the project stores or shows user content in other scripts, test any string helper with that input, because an English test case proves nothing here.

- **`Str::slug()` returns an empty string for CJK text.** It transliterates through `Str::ascii()` first, so `Str::slug('日本語のタイトル')` is `''`. Two different titles then both become `''` and compare equal. Pass `language: null` to keep the characters.
- **`Str::squish()` rewrites the ideographic space.** `\s` under the `u` modifier matches U+3000, so a full-width space becomes an ASCII space. Squish a value for comparison, not text that you store or show.

```php
Str::slug($post->title, language: null); // ✅ keeps 日本語
Str::slug($post->title);                 // ❌ '' for CJK
```

### Reading Config Values Without the Environment File

Read one leaf with `config:show`, not the `.env` line. It shows the config as the application loads it, so after `config:cache` it shows the cached value.

```bash
php artisan config:show app.url --no-ansi                              # ✅ not grep '^APP_URL=' .env
php artisan config:show database.connections.mysql.database --no-ansi  # ✅ not grep '^DB_DATABASE=' .env
```

- **Never show a whole section.** `config:show app` prints `APP_KEY`, and `config:show database.connections.mysql` prints the password.
- **Never print `env()`, `getenv()`, `$_ENV` or a credential `config()` value** through `tinker`, the Boost `tinker` tool, or `php -r`.
- **Never run `env:encrypt` in the session.** It prints the encryption key.

To check a credential, print only whether it is set. The `has()` check tells a wrong key path from an empty value:

```bash
php artisan tinker --execute="echo config()->has('services.postmark.token') ? (filled(config('services.postmark.token')) ? 'set' : 'missing') : 'no such key';"
```
