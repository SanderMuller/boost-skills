---
name: promptimize
description: "Turns a rough, vague prompt into one optimized, model-agnostic prompt — closes gaps and ambiguities, fact-checks referenced material against the codebase, then rewrites using durable prompt-engineering principles and returns only the final prompt. Activates when: optimizing a prompt, improving a prompt, making a prompt clearer, tightening an instruction, prompt-engineering help, or when user mentions: promptimize, optimize prompt, improve prompt, better prompt, rewrite prompt, prompt engineering."
argument-hint: "<your rough prompt>"
metadata:
  boost-requires: "clarify"
  inspired-by: "https://github.com/dimitritholen"
---

# Promptimize

Transform a rough prompt into a single, optimized prompt that lets the target model do its best work. Close the gaps first, then rewrite — and the deliverable is the prompt itself, nothing else.

## Workflow

### 1. Analyze

Read the raw prompt and identify ambiguities, gaps, unstated assumptions, and anything that would make the model guess. Rate its clarity to yourself (do not show the user).

### 2. Clarify (only if needed)

If the prompt is already sharp and complete, skip this step. Otherwise, work from the `clarify` skill — **read it first**; it is the source of truth for the questioning disciplines. Apply them to close the gaps; the ones that matter most for a prompt are:

- **Fact-check referenced material against the codebase** — if the prompt names files, symbols, or behaviour, read them (Code-First) instead of guessing, and surface any contradiction.
- **Sharpen fuzzy terms** and **grill gaps one at a time** via `AskUserQuestion` — recommendation first, never batch.
- **Assumptions audit** — anything you'd otherwise infer for the prompt (a default, a name, a fact), confirm rather than bake a guess into the rewrite. `clarify` carries the full checklist.

Keep it to a few rounds and stop as soon as intent is clear. Ask only what changes the output — never interrogate over trivia.

### 3. Critical review

With intent clear, examine the request critically:

- **Gaps & wrong assumptions** — what is missing or quietly assumed that would derail the output?
- **Useful additions** — context, constraints, or examples that measurably improve the result.
- **External material** — if the user referenced screenshots, documents, files, or URLs, actually inspect them now (Read / WebFetch / image tools) and fold what you learn into the prompt.

### 4. Rewrite

Rewrite the raw prompt into one optimized prompt that incorporates everything gathered, applying the principles below.

### 5. Output

Display **only** the optimized prompt, inside a single fenced code block, so the user can copy it directly. Make the outer fence longer than any code fence inside the prompt — use four or more backticks when the prompt itself contains a ``` block — so nothing closes the block early.

## Prompt-engineering principles

Durable and model-agnostic — these hold across model families and releases:

- **Be clear, direct, and specific.** Write for a capable new colleague who lacks your context, not a mind-reader. If a stranger would be confused, the model will be too.
- **State the objective and bounded scope up front** — what the output is for, and where it stops.
- **Structure with consistent delimiters.** Pick one — Markdown headings or XML tags — and use it throughout, so instructions, data, examples, and the output spec stay distinct. For the portable prompt this skill outputs, prefer Markdown headings (see Hard rules).
- **Define an explicit output contract** — format, length, sections in order, and what to do when a field is missing. This is the highest-leverage block in most prompts.
- **Frame constraints positively.** "Use only data from the provided context" beats "don't hallucinate" — naming what to avoid forces the model to represent it first. Reserve scoped negatives for genuine limits ("do not invent URLs").
- **Place long source material below the instruction**, with the ask near the end — models recall the start and end of a long context better than the middle.
- **Show, don't gesture.** Add 1-3 concrete, diverse examples only when format, style, or tone is non-obvious. Never leave empty `<example>` placeholders — fill them, or mark them clearly as illustrative. For "avoid jargon", name the actual words; for a tone, show a one-line example next to a counter-example.
- **Don't over-prompt reasoning models.** They reason internally, so "think step by step" is at best redundant. Tune the model's effort/thinking setting before adding scaffolding.
- **Right-size the length.** There's no virtue in brevity for its own sake, but padding dilutes attention. If the optimized prompt is much longer than the original without adding value, compress.

## Hard rules

- **No preamble, no epilogue.** Steps 2-3 may produce questions and analysis, but the **final message is the code block and nothing else** — no "Here is your prompt", no summary of changes, no follow-up offer.
- **Preserve intent.** Add structure and clarity; never invent facts.
- **Placeholders over fabrication.** For a missing specific (name, date, number, file), insert `[INSERT X]` rather than guessing.
- **Match the user's language.** A Dutch raw prompt yields a Dutch optimized prompt.
- **Stay model-agnostic.** Use Markdown headings, not vendor-specific tags, so the prompt ports across agents.

## Final output format

Steps 1-4 may surface questions and analysis. The last message — the deliverable — is the optimized prompt inside **one** fenced code block, and nothing else: no text before or after the fence. The prompt body goes **directly** inside the fence, not nested in a second code block. Use a fence whose backtick run is longer than any code fence inside the prompt — three backticks normally, four or more when the prompt itself contains a ``` block — so the block can't close early.

---

*Inspired by Dimitri Tholen's `/promptimize` ([dimitritholen](https://github.com/dimitritholen)); rebuilt as an original, self-contained skill for this catalog.*
