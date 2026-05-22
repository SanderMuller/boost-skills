## JavaScript & TypeScript

### Control Structures

- Always use curly braces for control structures, even for a single statement.
- Never use single-line `if/return`, `if/break`, or `if/continue` statements.
- Each control-structure statement goes on its own line.

```js
// ❌ WRONG — single-line control structures
if (index === -1) break;
if (! element) return 0;
if (query === '') return;

// ✅ CORRECT — curly braces, each statement on its own line
if (index === -1) {
    break;
}

if (! element) {
    return 0;
}

if (query === '') {
    return;
}
```
