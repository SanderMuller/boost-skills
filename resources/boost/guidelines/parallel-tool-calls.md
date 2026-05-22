## Parallel Tool Calls for Independent Problems

When facing 2+ unrelated problems (different test files failing, multiple unrelated subsystems broken), investigate each problem domain at once with parallel tool calls — multiple tool calls in a single message run concurrently.

### When to Use

- 2+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from the others
- No shared state between the investigations

### When NOT to Use

- The failures are related — fixing one may fix the others
- You need to understand full system state first
- The investigations would edit the same files
- **The user pointed to specific files** — use parallel read calls on those instead

### How to Scope Each Investigation

- **Specific scope** — one test file or subsystem per investigation
- **Context** — carry the error messages, test names, and relevant files
- **Constraints** — avoid modifying tests unless necessary; focus on the code under test
- **Expected output** — a root cause and a targeted change

After investigating, review the findings together, verify the fixes don't conflict, and run the full test suite.
