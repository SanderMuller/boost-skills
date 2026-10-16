Context: on a pull request in a third-party open-source project, the maintainer asked: "Does this change affect the CLI too, or only the HTTP client?" The agent drafted the reply below and must now run the humanizer skill over it before posting.

## Summary

Great question! **Short answer: only the HTTP client.**

| Component | Affected |
|-----------|----------|
| HTTP client | ✅ Yes |
| CLI | ❌ No |

The CLI uses its own transport layer — it never touches `HttpClient::send()` — so this change is fully isolated. This is a crucial distinction that underscores the importance of the separation of concerns in the codebase.

Let me know if you'd like me to expand on any section!
