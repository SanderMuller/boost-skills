## Exploration Budget

Scale research effort to task complexity. This budget governs exploration that *precedes implementation* — it does not apply to review, audit, or analysis tasks, where reading the files in scope **is** the work; for those, read everything the task covers. For implementation: simple tasks should start quickly; complex features deserve proper research and interactive planning.

### Simple Tasks (bug fixes, applying review feedback, small changes)

- **Read 3-5 representative files max**, then start implementing.
- **Use parallel reads** — never read files one at a time when you can read them together.
- **If unsure, implement and iterate** — let test failures guide your understanding rather than trying to fully understand the codebase upfront.
- **Never spend an entire session exploring** — if you have read more than 10 files without writing any code, stop and start implementing.

### Complex Features (new systems, multi-phase work, architectural changes)

Research is expected and encouraged, but it must be **structured and interactive**:

1. **Initial assessment** — a quick scan of the relevant area (a few file reads) to gauge complexity.
2. **Check with the user** — if deep research is needed, say what you want to investigate and why, and ask whether they want a thorough exploration first or prefer to guide you directly.
3. **Research phase** (if approved) — explore the relevant code to understand existing patterns and constraints. Communicate what you are learning as you go.
4. **Ask questions** — use the `interview` skill or ask clarifying questions; do not silently assume answers to design decisions.
5. **Plan, then implement** — once you understand the scope and have answers, move to implementation without further open-ended exploration.

Even for complex features, avoid **silent exploration spirals** — if you have been reading files for several minutes without producing output or asking questions, something is wrong. Communicate what you are learning and what you need.

### General Rules

- **Always use parallel reads** when reading multiple files.
- **Communicate during research** — say what you are investigating and why.
- **Research should produce questions or code**, never just silence.
