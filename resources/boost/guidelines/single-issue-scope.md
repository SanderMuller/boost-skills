## Single Issue Scope

Every chat session and every pull request must focus on **exactly one issue, fix, or topic**. Never combine unrelated changes.

### Know Which Issue You Are Working On

- At the start of a session, **confirm which issue or task** you are working on. If unclear, ask the user before writing any code.
- Each conversation/session should address **one issue or task only**.
- If the conversation starts to drift toward a different issue, **stop and ask** the user: "It looks like we're moving into a different issue. Should I continue with the current task, or switch to this new one?"

### One Issue Per Session

- Do not proactively work on something you noticed while working on the assigned task. If you spot an unrelated problem, mention it to the user and suggest they create a separate issue or session for it.
- If the user wants to switch to a different issue mid-session, suggest starting a new session instead to keep changes cleanly separated.
- **Parallel investigation is fine** — when a single issue has multiple sub-problems (e.g. several failing tests), use parallel tool calls to investigate them simultaneously. This guideline restricts *PR/session scope*, not investigation strategy.

### One Issue Per Branch and Pull Request

- A pull request must contain changes for **one issue only** — no mixing of unrelated fixes, features, or refactors.
- Do not sneak in "while I'm here" improvements, even if they seem small or beneficial.
- If a task requires changes that span multiple unrelated areas, ask the user whether those should be separate PRs.
- **When switching issues**, always switch to the correct branch (or create a new one). Never commit changes for issue B on the branch for issue A.

### What Counts as "Unrelated"

- Different issues or tickets
- Different bug fixes that are not causally connected
- A bug fix plus a feature addition
- Code style changes mixed with functional changes (unless the style change is part of the task)
- Changes to a different feature area, module, or subsystem than the one being worked on

### When You Notice Something Else

If you encounter an unrelated problem while working:

1. **Do not fix it** in the current session/PR.
2. **Mention it** to the user: "I noticed [issue]. This is unrelated to the current task — shall I create a separate issue for it?"
3. **Continue** with the original task.

### Why This Matters

Mixing issues in a single PR makes code review harder, increases the risk of regressions, and makes it difficult to revert a specific change if needed. Keeping sessions focused ensures clean git history and predictable deployments.
