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
