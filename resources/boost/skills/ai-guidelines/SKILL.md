---
name: ai-guidelines
description: "MUST USE when creating, updating, or managing AI skills and guidelines. Activates when: creating a new skill, editing existing skills, updating coding guidelines, modifying AI instructions, working with .ai/ directory, or when user mentions: skill, CLAUDE.md, guidelines, AI configuration."
---

# AI Guidelines & Skills Management

## Important: Never Edit AGENTS.md or GEMINI.md Directly

sandermuller/boost-core generates these files. The next sync overwrites any direct edit. Put project guidance in `.ai/guidelines/` instead.

boost-core does not generate `CLAUDE.md`. By default, Claude Code reads `AGENTS.md` only when the project has no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md`. If one of those files exists, it must import `@AGENTS.md` (`@../AGENTS.md` from `.claude/CLAUDE.md`), or Claude Code's "Project instructions" setting must be `claude-md-and-agents-md`. Otherwise the boost guidance does not reach Claude. Do not add guidance to `CLAUDE.md`.

> **Laravel projects with `sandermuller/project-boost-laravel` installed:** substitute `php artisan project-boost:sync` for `vendor/bin/boost sync` everywhere in this skill. The Laravel wrapper boots the application before it runs boost-core's sync. The bare `vendor/bin/boost sync` does not boot the application, so it fails in a Laravel project.

## Project Structure

```
.ai/                              # SOURCE - Edit files here
├── guidelines/                   # Project-wide AI instructions
│   └── *.md                      # Coding conventions
└── skills/                       # Skill definitions
    └── {skill-name}/SKILL.md     # One folder per skill

.claude/skills/                   # AUTO-GENERATED - Do not edit
└── {skill-name}/SKILL.md         # Skills for Claude Code

.agents/skills/                   # AUTO-GENERATED - Do not edit
└── {skill-name}/SKILL.md         # Skills for Codex and GitHub Copilot
```

**Important**: Only edit files in `.ai/`. `vendor/bin/boost sync` generates the `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, etc. directories and overwrites them. boost-core's managed `.gitignore` block (sentinels `# >>> boost (managed) >>>` … `# <<< boost (managed) <<<`) ignores the generated skill and command directories and the `.claude/agents/boost/` subtree, so they never get committed.

## How sandermuller/boost-core Works (in Package Context)

This package uses sandermuller/boost-core (a framework-agnostic Composer library):

1. **Guidelines** in `.ai/guidelines/` define project-wide coding conventions
2. **Skills** in `.ai/skills/` provide domain-specific instructions activated on demand
3. boost-core combines these with installed vendor packages' boost skills/guidelines to generate `AGENTS.md`, `GEMINI.md`, and per-agent `<.agent>/skills/` directories
4. The config lives in `boost.php` at the project root or in `.config/boost.php`, never both. Sync fails when neither exists; `vendor/bin/boost install` creates one.
5. Sync runs when you run `vendor/bin/boost sync`. It also runs on `composer install/update` when the project's root `composer.json` wires `SanderMuller\BoostCore\Scripts\BoostAutoSync::run` into `post-install-cmd` and `post-update-cmd`.

## Updating Guidelines

Guideline files in `.ai/guidelines/` are standard Markdown (`.md`). Keep them concise and scoped to conventions that persist across the project.

### Where content lives

Guidelines are folded into `AGENTS.md` / `GEMINI.md` and load in **every** session, so each line is a context cost paid on every task. Skills load on demand. Four homes, ordered by what each one costs a reader:

- **`.ai/guidelines/<name>.md`** — the enforceable rule, and only the crucial non-obvious *why*, stated tersely. No command sequences, no step-by-step procedure, no long rationale. When a rule has a procedure, name the skill that owns it.
- **`.ai/skills/<name>/SKILL.md`** — the *how*: procedures, commands, checklists, examples.
- **A `references/` file next to the skill** — deep reference the skill pulls in when it needs it.
- **`.ai/subagents/<name>.md`** — a Claude Code subagent definition, for a pass whose value is a context that did not write the change. `boost-core` 1.9.0 and newer emit these; an older engine ignores the directory.

A package that ships skills to consumers keeps its own sources elsewhere. The `sandermuller/boost-skills` package, for example, holds them in `resources/boost/guidelines/`, `resources/boost/skills/` and `resources/boost/subagents/`. The same four homes apply there unchanged, and so does everything below that names `.ai/` — read it as the repository's own source tree. Check where the repository actually keeps its sources before editing.

### The altitude gate

Apply this to the lines a change adds or rewrites. An older guideline that carries a procedure or a table is grandfathered: move it when you are already editing that section, not as a sweep of its own.

Before a line lands in a guideline, ask: *does this line enforce, or explain?*

A line that carries a command, a multi-step procedure, a paragraph of rationale, or a code example beyond a short convention snippet **fails**. Move it to the owning skill and leave behind the rule and a pointer. The test: *would this line earn its context cost on a task unrelated to this rule?* A "no" means move it.

Terse is not enough to pass. A sentence that is true, interesting, and **changes nothing an agent does** still fails. That covers a benefit of the rule, a mechanism behind it, and a consequence nobody acts on. Keep the rule, and keep only the fact whose absence would lead a competent reader to the wrong conclusion. The rest belongs in the pull-request body or the owning skill.

Length is not the signal. A pointer can be long and pass, and packed skill-owned detail fails however short. Judge it per line, every time. A skill or a reference file has no altitude limit.

### Say What a Fallback Loses

A skill that offers a lesser path when something is unavailable — a review agent the session may not have, a tool the project may not install, a check that needs a second context — states what the fallback gives up, not only that it exists.

The failure this prevents is a pass that keeps a rule and quietly drops the property the rule depended on. An adversarial review run by the author of the change applies the same questions with none of the distance the questions were written for. A reader who is told only "run it inline instead" assumes parity, and the weaker result is reported as if it were the stronger one.

Write the loss where the fallback is offered, and require the run to name it in its own report.

### The consistency gate

Every skill name, file path, tag, and document a change references must resolve, and the change must contradict no sibling guideline or skill. Check the sibling files before you ship, not after a consumer syncs.

## Creating/Updating Skills

Skills live in `.ai/skills/{skill-name}/SKILL.md` with frontmatter:

```markdown
---
name: skill-name
description: When this skill activates. Include trigger words and scenarios.
---

# Skill Title

## When to use this skill

- Scenario 1
- Scenario 2

## Instructions

Detailed instructions for the skill...
```

### Skill Naming

- Use kebab-case for directory names: `my-new-skill/`
- The `name` in frontmatter should match the directory name
- Write clear `description` with activation triggers

### Documenting External Tools in Skills

When a skill interacts with external services (issue trackers, CI, CLIs, MCP servers), document the exact tool invocation the skill should use. Prefer slim, machine-readable responses over full payloads — e.g. for GitHub, document the exact `gh` command including the `--json <fields>` field list and/or `--jq` filter rather than fetching the entire payload.

## Regenerating Generated Files

Sync runs on `composer install/update` only when the project wires boost-core's `BoostAutoSync` script (see above). To sync manually:

```bash
vendor/bin/boost sync
```

This syncs `.ai/` changes to per-agent locations:

| Generated File/Directory          | Purpose                            |
|-----------------------------------|------------------------------------|
| `AGENTS.md`                       | Shared context for Claude Code / Codex / Copilot / Cursor / Amp / Junie / Kiro / OpenCode / etc. |
| `GEMINI.md`                       | Main context file for Gemini       |
| `.claude/skills/`                 | Skills loaded by Claude Code       |
| `.cursor/skills/`                 | Skills loaded by Cursor            |
| `.agents/skills/`                 | Skills shared by Codex, GitHub Copilot and Antigravity |
| `.amp/skills/`, `.gemini/skills/`, `.junie/skills/`, `.kiro/skills/`, `.opencode/skills/` | Per-agent skill dirs |

**The generated skill and command directories and the `.claude/agents/boost/` subtree are gitignored** via boost-core's managed `.gitignore` block, so they never get committed. `AGENTS.md` and `GEMINI.md` stay tracked, so a diff shows what the agents read. Commit them with the `.ai/` sources after each sync.

## Checklist for Changes

- [ ] Edit the repository's own sources — `.ai/guidelines/`, `.ai/skills/`, `.ai/subagents/`, or the `resources/boost/…` equivalents in a package — never a generated file
- [ ] **Altitude gate** — each guideline line you add carries the rule and the crucial why; procedures, commands, and long rationale live in the owning skill
- [ ] **Consistency gate** — every referenced skill name, path, and tag resolves, and no sibling file contradicts the change
- [ ] Every fallback path that is *lesser* than the primary one states what it loses
- [ ] Include clear activation triggers in skill descriptions
- [ ] **Run `vendor/bin/boost sync`**
- [ ] **Verify `git status`** shows changes in the source tree and `AGENTS.md` / `GEMINI.md` only — the generated skill and command directories and the `.claude/agents/boost/` subtree are gitignored
- [ ] **Commit the source files** — `.ai/…` or a package's `resources/boost/…`, plus the regenerated `AGENTS.md` / `GEMINI.md`; a package's changes reach consumers on their next sync
