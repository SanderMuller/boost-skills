# Humanizer pattern catalogue

Read `SKILL.md` first. It holds the hard rules, the modes, and when a pattern justifies an edit.

Groups A to F follow the upstream skill's order. Groups G and H are this package's own. Within a
group, patterns are listed strongest first. A pattern marked *weak alone* needs other tells in the
same passage before you act on it.

Every example is synthetic. Each "After" uses only the facts in its "Before". Where the "Before"
has no fact to keep, the "After" says so instead of inventing one.

---

## A. Staging instead of stating

The sentence signals importance instead of adding a fact. These are the strongest tells in current
model prose. Act on one sighting.

### A1. Contrast with a claim nobody made

**Watch for:** not X but Y; not just, not only, not merely X, but Y; it's not X, it's Y; the reversed
form "Y rather than X" and "rather than merely"; "less like X and more like Y"; "stops being X and
starts being Y"; "Not because X. Because Y."; the split form "This does not mean X. It means Y.";
a negative list before the reveal ("Not a tool. Not a framework. A mindset."); a clipped negative
tail ("..., no guessing").

**Problem:** The negative half names something no one claimed, so the positive half sounds bigger.
State the point directly. Keep a contrast only when the negative half corrects a belief the reader
really holds, or when both halves carry information.

**Before:**
> The cache isn't just a speed-up — it's a safety net. When the database goes down, it keeps serving the last rendered pages.

**After:**
> When the database goes down, the cache keeps serving the last rendered pages.

**Before (clipped tail):**
> The command reads the token from the config file, no guessing.

**After:**
> The command reads the token from the config file, so the user does not have to guess it.

### A2. One-line closers and staged fragments

**Watch for:** a one-sentence paragraph that restates the paragraph before it; "That's the whole
story."; "That distinction matters."; "Let that sink in."; "Read that again."; "full stop"; a line
after an example that names what the example showed ("This shows the importance of..."); a row of
fragments ("Faster. Smaller. Simpler."); one word in capitals or with periods between words.

**Problem:** The line asks the reader to pause on a claim instead of adding to it. Cut a closer
that repeats. Keep a short sentence that adds a new fact or consequence.

**Before:**
> We cut the migration from forty minutes to six. Six. That's the whole story.

**After:**
> We cut the migration from forty minutes to six.

### A3. Sayings that sound deep

**Watch for:** the real question is, at its core, in reality, what really matters, fundamentally,
the deeper issue, the heart of the matter, "X is the language of Y", "X isn't what you say, it's
what you do", any line that reads like a pull-quote.

**Problem:** An ordinary point is dressed as a hidden truth. Replace the saying with the specific
claim, or cut it.

**Before:**
> The real question is whether the job is idempotent. At its core, a retry is only safe when running the job twice gives the same result.

**After:**
> A retry is only safe when the job is idempotent, so that running it twice gives the same result.

### A4. Staged run-up before the point

**Watch for:** Let's dive in, let's break this down, here's what you need to know, without further
ado, In this section, we'll; Here's the thing, The uncomfortable truth is, It turns out, Make no
mistake; Honestly?, Look,, Real talk, Think about it:, Here's what I mean:.

**Problem:** The writer announces the point instead of making it. Remove the run-up. "Honestly" or
"look" inside a casual sentence is ordinary. The tell is the standalone opener.

**Before:**
> Here's the thing: the nightly build has been red for a week. Let's break down why.

**After:**
> The nightly build has been red for a week.

### A5. Arguing with no one

**Watch for:** To be clear, I'm not saying, Don't get me wrong, This is not to say, A tempting
approach would be, One might be tempted to, You might think... but.

**Problem:** The text answers an objection or rejects an option that nobody raised, often a
leftover from an earlier draft. Remove the defence. Keep an option a reader would really weigh.

**Before:**
> One might be tempted to store the tokens in plain text, but that would be insecure. Tokens are stored as hashes.

**After:**
> Tokens are stored as hashes.

---

## B. Rhythm by rule

Shapes and punctuation used everywhere, whether or not the meaning asks for them.

### B1. Forced triads

**Problem:** Ideas arrive in threes to sound complete. Check that each item adds a distinct idea.
Keep three real items when the meaning has three: a list of supported backends is a fact, not a
tell.

**Before:**
> The release brings speed, stability, and simplicity: the importer runs in half the time, and the config file is gone.

**After:**
> The importer runs in half the time, and the config file is gone.

### B2. Repeated sentence openings

**Problem:** Several sentences in a row start with the same subject. Merge them, or begin with the
action. A deliberate repeat for rhythm stays.

**Before:**
> The command reads the file. The command validates it. The command writes the cache.

**After:**
> The command reads and validates the file, then writes the cache.

### B3. Dashes as the universal connector

*Weak alone.* One dash proves nothing. A text full of them is a tell.

**Problem:** A dash lets the writer skip choosing how two clauses relate. Replace each one by its
role:

- an aside: commas, or parentheses for a real aside
- an explanation or a list: a colon
- two full statements: a period, not a comma (see H2)

Swapping every dash for another mark keeps the hesitation. Rewrite the sentence when it could not
decide where to stop. Leave dashes inside code, commands, paths, URLs and number ranges ("pages
10–12") alone. A writer's sample that uses dashes overrides this pattern.

**Before:**
> The flag — added in 2.4 — skips the write step — which makes it safe for CI.

**After:**
> The flag, added in 2.4, skips the write step. That makes it safe for CI.

### B4. Colons as mid-sentence hinges

*Weak alone.*

**Problem:** A colon that introduces a list or an example is fine. A colon that hinges a sentence
promises a reveal the second half does not deliver. Two in one paragraph is a reason to reread
both.

**Before:**
> If you come from manual deploys: instead of copying files yourself, you describe the target state.

**After:**
> You describe the target state instead of copying files yourself.

### B5. Stacked qualifiers

*Weak alone.*

**Watch for:** could potentially, might arguably, it's also possible that, in some cases it may.

**Problem:** One qualifier after another makes every claim sound unsure. Keep a qualifier the
source supports. "Perhaps", "probably" and "tends to" are human habits, not tells.

**Before:**
> This could potentially possibly cause some issues in certain edge cases.

**After:**
> This can fail in edge cases.

### B6. Hyphenated pairs everywhere

*Weak alone.*

**Problem:** A compound modifier keeps its hyphen in every position. Keep the hyphen before a noun
("a real-time sync", "a well-documented API") and drop it after the noun ("the sync is real time").
Words the dictionary always hyphenates, such as third-party, keep the hyphen everywhere. Never
remove a hyphen before a noun.

**Before:**
> The sync is real-time, and the API is well-documented.

**After:**
> The sync is real time, and the API is well documented.

### B7. Passive voice and missing subjects

*Weak alone.*

**Problem:** The text hides who acts, or drops the subject. Use the active voice when it makes the
actor clearer. Imperative commit subjects and terse reference lines ("Optional. Defaults to
`false`.") follow their own conventions and stay.

**Before:**
> No configuration file needed. The results are cached automatically by the CLI.

**After:**
> You do not need a configuration file. The CLI caches the results.

---

## C. Inflation and borrowed authority

The fact underneath is usually sound. Keep it and remove the dressing.

### C1. Overused AI words

**Watch for:** additionally (opening a sentence), align with, bolstered, crucial, delve, enduring,
enhance, fostering, garner, highlight (verb), interplay, intricate, key (adjective), landscape
(abstract), meticulous, pivotal, robust (figurative), showcase, tapestry, testament, underscore
(verb), valuable, vibrant.

**Hype words:** battle-tested, table stakes, north star, game-changer, blazing-fast.

**Check the context first:** byte-identical, load-bearing, first-class, non-trivial, step change.
Each is a real technical term. Flag one only where it adds weight the fact does not carry.

**Problem:** Models use these words far more than people do, especially in groups. The list
changes with each model version, so treat it as a sample. A synonym of a listed word is not a
tell, and one listed word alone may be a coincidence.

**Before:**
> The retry wrapper is load-bearing — every failure path goes through it — and the parser is battle-tested after two years in production, so a byte-identical rewrite is table stakes.

**After:**
> Every failure path goes through the retry wrapper, and the parser has run in production for two years. The rewrite must produce byte-for-byte identical output.

### C2. Inflated significance

**Watch for:** marks a pivotal moment, plays a key role, setting the stage for, a new era,
reflects a broader, evolving landscape, underscores the importance; "the distinction matters
because"; importance claimed after admitting the thing is minor; a stock "Despite these
challenges..." section; a send-off ("The future looks bright.", "Exciting times ahead.").

**Problem:** An ordinary detail is said to mark a change, prove a legacy, or promise a future.
Keep the fact and drop the significance. End on the last concrete fact.

**Before:**
> Version 3.0, which adds a plugin API, marks a pivotal moment in the project's evolution and sets the stage for a new era of extensibility. The future looks bright.

**After:**
> Version 3.0 adds a plugin API.

### C3. Vague connection

**Watch for:** associated with, in connection with, linked to, tied to.

**Problem:** The text says two things are connected without saying how. Name the relation the
source gives. If the source does not give one, keep the vague wording rather than invent one.

**Before:**
> The maintainer is associated with the CLI, which she wrote and still reviews.

**After:**
> The maintainer wrote the CLI and still reviews changes to it.

### C4. Shallow -ing riders

**Watch for:** highlighting, underscoring, ensuring, reflecting, contributing to, fostering,
showcasing, tacked onto the end of a sentence.

**Problem:** An -ing phrase makes a plain fact sound deeper. Keep the fact. Keep the rider only
when it states a real consequence, and then make it a clause.

**Before:**
> The command exits with code 2 on a validation error, ensuring that the CI job stops and highlighting the importance of early checks.

**After:**
> The command exits with code 2 on a validation error, so the CI job stops.

### C5. Sales language

**Watch for:** groundbreaking, stunning, rich (figurative), boasts, nestled, in the heart of,
renowned, a diverse array of, seamless. Newer models are more subtly positive, so also watch for
praise that names no property.

**Problem:** The text reads like an advertisement. State what the thing is and what it does.

**Before:**
> This stunning CLI boasts a rich set of 12 commands for managing releases.

**After:**
> The CLI has 12 commands for managing releases.

### C6. Borrowed authority

**Watch for:** experts agree, observers note, industry reports, several sources, featured in [a
list of outlets], trusted by teams worldwide, "such as" before a list the source does not support.

**Problem:** An unnamed authority or a list of names stands in for what was said. When the source
names who said what, use that. Otherwise cut the claim. A missing citation alone is not a tell.

**Before:**
> Experts agree the approach is sound, and it has been featured in several popular newsletters.

**After:**
> (Cut both claims, or name the source and what it said.)

### C7. Avoiding is, are and has

**Watch for:** serves as, stands as, functions as, acts as, represents, boasts, features, offers,
maintains, refers to.

**Before:**
> The `Config` class serves as the entry point and boasts three loaders.

**After:**
> The `Config` class is the entry point and has three loaders.

### C8. Adverbs propping up weak verbs

**Watch for:** significantly, dramatically, considerably, substantially, seamlessly, effortlessly.

**Problem:** The adverb stands where a number belongs. Give the number the source has. If it has
none, use the plain verb and drop the adverb. Never supply a number.

**Before:**
> The new index significantly improves query time, from 1.8 s to 40 ms.

**After:**
> The new index cuts query time from 1.8 s to 40 ms.

### C9. Trade-offs waved away

**Watch for:** without sacrificing, without compromising, without losing, the best of both worlds.

**Problem:** The sentence claims a gain with no cost, and the text never shows the check. Keep the
"without" clause only when the text says how the cost was avoided.

**Before:**
> The cache speeds up builds without sacrificing correctness.

**After:**
> The cache speeds up builds. (Keep the correctness claim only if the text says how it is checked.)

### C10. Lazy extremes

*Weak alone.*

**Watch for:** every, always, never, everyone, nobody, as a sweeping claim.

**Problem:** An absolute claims authority the writer has not earned. A definitive statement that
is true and checkable ("the only place that swallows the error", "works with every option") is
not this pattern.

**Before:**
> Every developer knows that nobody reads the changelog.

**After:**
> (Cut it, or state the scope the source supports.)

### C11. Feelings instead of mechanisms

**Watch for:** effortless, intuitive, just works, stays out of your way, feels fast.

**Problem:** The sentence says how the tool feels where the reader needed what it does. State the
behaviour. The other-project test: a sentence that could appear unchanged in another project's
docs says nothing about this one. If the text has no mechanism to state, cut the sentence.

**Before:**
> Validation feels effortless: `validate()` returns one error per field, keyed by the field name.

**After:**
> `validate()` returns one error per field, keyed by the field name.

---

## D. Formatting by rule

Templates and editors also produce clean formatting. The tell is decoration on every item.

### D1. Bold as decoration

**Problem:** Words are bolded for no reason, and every list item gets a bold label and a colon.
Remove the bold. Turn a labelled list into prose when the labels only restate the line.

A bold lead-in that ends in a period, names the item, and is followed by new detail is a normal
reference form, and it stays:

> **Sentence case in headings.** The rule covers every heading level, including generated ones.

**Before:**
> - **Performance:** Performance is improved through caching.
> - **Security:** Security is strengthened with signed tokens.

**After:**
> The update adds caching and signs the tokens.

### D2. Decorative headings

**Problem:** Title case on every heading, emojis or arrows (→) as decoration, a horizontal rule
between every section, an H1 that repeats the title, skipped heading levels, or a heading written
for effect ("The decision, on one screen"). Use sentence case, and let a heading name what its
section holds.

**Before:**
> ## 🚀 Getting Started With The CLI

**After:**
> ## Getting started with the CLI

### D3. Document formatting in a reply

**Problem:** A reply on a thread, or a short answer, carries headings, a table, or a fenced
evidence block that the content does not need. A small table that two sentences can carry is the
same tell. A code block that quotes real output or a real diff is content, and it stays.

**Before:**
> ## Summary
>
> | Component | Affected |
> |---|---|
> | HTTP client | Yes |
> | CLI | No |

**After:**
> Only the HTTP client. The CLI is not affected.

### D4. Curly quotation marks

*Weak alone.* Most editors curl quotes by themselves. Change them only where the target format
uses straight quotes, for example in Markdown source that other tools parse.

---

## E. Leftovers from the chat and the draft

Remove these outright.

### E1. Chatbot residue and clerk tone

**Watch for:** Great question!, Certainly!, You're absolutely right, I hope this helps, Let me
know if you'd like..., Would you like me to...; in comments: I have carefully reviewed, I
apologize for any inconvenience this may have caused, I'm happy to, I remain committed to, If
there are specific areas that..., I welcome any further feedback.

**Problem:** A chatbot's greeting, praise, offer or service-desk tone is left in text that should
stand alone. Remove the wrapper and keep the content. An ordinary greeting or sign-off on a
letter or a comment is not this pattern.

**Before:**
> Great question! I have carefully reviewed the logs. The job fails because the token expired. I hope this helps, and let me know if there are specific areas you'd like me to expand on.

**After:**
> The job fails because the token expired.

### E2. Source disclaimers and gap-filling guesses

**Watch for:** while specific details are limited, based on available information, not widely
documented; "[claim] should be treated as X rather than Y"; "this does not by itself establish";
a guess after admitting there is no source ("likely", "it is believed that").

**Problem:** The text talks about the limits of its sources, or fills a gap with a plausible guess.
State what is not known, once, or remove the sentence.

**Before:**
> While specific details are limited, the benchmark, which ran once, should be treated as indicative rather than definitive, and it does not by itself establish that the new parser is faster.

**After:**
> The benchmark ran once, so it does not show that the new parser is faster.

### E3. A heading repeated in the first sentence

**Before:**
> ## Performance
>
> Performance matters.
>
> The importer streams the file instead of loading it into memory.

**After:**
> ## Performance
>
> The importer streams the file instead of loading it into memory.

### E4. Placeholders, template text and markup leaks

**Watch for:** `[Project name]`, `(add link here)`, `2026-xx-xx`, "Delete this section before
submitting", and chat-tool markup such as `:contentReference[oaicite:0]{index=0}`, `turn0search0`,
`[cite: 1]`.

**Problem:** Template text or a tool's internal markup is left in. Markup leaks are a certain sign.
Remove them. A placeholder the user must fill: in gate mode, stop and report it (see `SKILL.md`).

---

## F. Writing about the work instead of for the reader

### F1. Writing about the document instead of its subject

**Watch for:** what the text replaced ("was added to replace"); how it was assembled ("compiled
from", "anything unconfirmed is flagged rather than guessed"); a layout the reader can see ("the
table below compares").

**Problem:** The text describes itself instead of its subject. A previous version belongs in a
changelog, a release note, a migration guide, or a commit message, which are about change. A
caveat that changes what the reader does stays.

**Before:**
> This function was added to replace the previous approach of scanning every row: it looks rows up by key.

**After:**
> This function looks rows up by key instead of scanning every row.

### F2. Edit-summary tells in commit messages and PR bodies

**Watch for:** ensured, preserved, retained, avoided, aimed to; quality verbs such as improve,
enhance, refine, streamline, optimize, clean up; "to improve clarity and maintainability", "clarity
and flow"; "Addressed review feedback by...".

**Problem:** The summary lists qualities of the edit, and what the writer did not change, instead
of what changed. Each stacked assurance makes the sign stronger. State the change. One plain
sentence that the behaviour or the public API does not change is real information for a
reviewer, and it stays when it is true.

A quality verb claims the result is better without saying how. Use the concrete change the text
gives ("split", "rename", "add a retry"). When the text gives none, use a neutral verb that names
the action without grading it ("change", "rework", "reword") and claim no improvement. This is not
an invented fact, so it is safe in gate mode.

**Before:**
> Refined the error messages to enhance clarity, ensuring consistency while preserving existing behavior. Avoided changes to the parser.

**After:**
> Reword the error messages. Behaviour does not change.

**Before (no concrete change given):**
> Streamlined the import logic and enhanced the logging while retaining compatibility.

**After:**
> Rework the import logic and the logging. Compatibility does not change.

### F3. Re-explaining what the reader knows

Act on this pattern when the text is plainly a reply, or the thread is visible.

**Watch for:** a reply that restates the question, walks through the diagnosis, and gives the
evidence before it reaches the answer; background the other person wrote; the answer in the last
line.

**Problem:** The reader already has the context. Lead with the answer. Keep only the fact they
lack and anything they need to act. A reply does one job: answer, ask for one thing, or report a
change of state.

**Context:** the reviewer wrote: "This fails near midnight because the date rolls over between the
two assertions, right? Can we freeze the clock?"

**Before:**
> You're right that the test is flaky. I looked into it, and the test depends on the system clock, so when CI runs near midnight the date rolls over between the two assertions. I reproduced it by setting the clock to 23:59:59. So I'd suggest we freeze the clock in the test.

**After:**
> Yes. I reproduced it at 23:59:59, and I'll freeze the clock in the test.

### F4. Design defence instead of reader guidance

**Watch for:** "honest" applied to the tool or its output, falsely reassuring, the wrong direction
to fail in, worse than silence, would be X dressed up as Y.

**Problem:** Documentation argues for its own design where the reader wanted to know what to do.
State the behaviour and what the reader should do. A short reason stays when it names a trade-off
or explains a constraint that would otherwise look like a bug. A design-rationale page is the
right home for the full argument.

**Before:**
> Severity levels are not configurable. A project that could re-rate a finding would be grading its own code, which would be noise dressed up as rigour. Silence a finding with `ignore`.

**After:**
> Severity levels are fixed. To silence a finding, use `ignore`, or turn the rule off.

---

## G. Plain words

### G1. Filler and the fancier word

| Avoid | Use |
|---|---|
| in order to (in a stack of filler) | to |
| due to the fact that | because |
| at this point in time | now |
| has the ability to | can |
| it is important to note that | (cut) |
| utilize, leverage (verb) | use |
| facilitate | help |
| prior to | before |

An isolated "in order to" is a human habit. Act on it only with other tells nearby.

### G2. Business jargon

| Avoid | Use |
|---|---|
| navigate (a problem) | handle |
| unpack | explain |
| lean into | commit to |
| deep dive | close look |
| circle back | return to |
| move the needle | make a difference |
| moving forward | from now on, next |

### G3. Metaphor nouns and mannered prose

**Watch for:** substrate, nexus, flywheel, bedrock, endgame, vector (meaning "a way"), wedge in;
figurative verbs ("the plan holds it", "rides along"); a flourish where a literal phrase exists
("a dial worth turning" for "a parameter worth varying").

**Check the context first:** surface ("API surface"), primitive, harness, scaffolding. These are
real terms of art.

**Problem:** The metaphor reads as technical but hides which part of the system the sentence
means. Use the literal word.

**Before:**
> The cache is the substrate for the whole flywheel, so we wedge the adapter in at the storage nexus.

**After:**
> The adapter goes in the storage layer.

### G4. False agency

**Watch for:** the complaint becomes a fix, the culture shifts, the market rewards, the decision
emerges, the code wants to.

**Problem:** An abstraction gets a human verb, which hides who acted. Name the actor if the source
gives one. If it does not, write the sentence without an actor rather than invent one. "The test
fails", "the function returns" and "the benchmark shows" are precise, not false agency.

**Before:**
> Once the support team read it, the bug report became a fix within a day.

**After:**
> The support team fixed the bug within a day of reading the report.

### G5. Wh- openers as a crutch

**Before:**
> What makes this hard is that nobody owns the test suite.

**After:**
> Nobody owns the test suite, which makes this hard.

### G6. Narrator from a distance

Only in essays, posts and opinion pieces. Reference docs stay neutral and third person.

**Watch for:** People tend to, Nobody sets out to, This is why, We as an industry.

**Problem:** The writer lectures from above the scene. Put the reader in it with "you" and a
concrete case from the source.

---

## H. Over-correction

These are tells the rewrite itself creates. Check for them after every pass.

### H1. Over-compression

**Problem:** Dropped articles, verbless fragments, arrows and symbols make the reader decode
instead of read. Simplified is not clipped.

**Bad rewrite:**
> Bad date → exit 2, no write.

**Good rewrite:**
> A bad date makes the command exit with code 2 and write nothing.

### H2. Comma splices from dash swaps

**Original:**
> The flag is optional — the default is off.

**Bad rewrite:**
> The flag is optional, the default is off.

**Good rewrite:**
> The flag is optional. The default is off.

### H3. Lost connectors and scope words

**Problem:** A cut removes "because", "only", "unless", "at most" or "still", and the claim
changes. Check every cut sentence for these words.

**Original:**
> Crucially, the cache is only cleared on deploy, which underscores the need for manual purges.

**Bad rewrite:**
> The cache is cleared on deploy.

**Good rewrite:**
> The cache is cleared only on deploy. Between deploys, purge it by hand.

### H4. Flattened human voice

**Problem:** A human writer's hedge, aside, opinion or odd detail is removed because it looks like
a pattern. Keep a specific, unusual detail, mixed feelings, a first-person choice the writer can
explain, and a real aside or self-correction.

---

## Worked example: a PR description in gate mode

**Before:**
> ## Summary
>
> This PR introduces a robust retry mechanism that seamlessly handles transient failures — ensuring the import job stays reliable. It's not just a retry; it's a safety net.
>
> - **Retries:** The job now retries up to 3 times.
> - **Backoff:** Backoff has been added between attempts, doubling each time.
> - **Logging:** Logging has been enhanced.
>
> I hope this helps! Let me know if you'd like any changes.

**Tells:** A1 (contrast), B3 (dash), C1 and C5 ("robust", "seamlessly"), C4 ("ensuring"), D1 (bold
labels), E1 (chatbot residue), F2 ("enhanced"). The heading stays if the project's PR template
asks for it.

**After (gate mode returns only this):**
> The import job now retries a transient failure up to 3 times, and the wait between attempts doubles each time. The logging also changes.

"The logging also changes" is as specific as the source allows. In chat mode, the change list
would say that the source does not state what changed in the logging.

---

## Historical indicators

These marked older models. Remove them where they appear, but do not hunt for them, and do not
treat them as evidence on their own:

- synonym cycling (a repetition habit of older models)
- false ranges ("from X to Y" on no real scale)
- "as of my last training update", "as an AI language model"
- "it's important to note", "In summary", "In conclusion"
- em dashes as a standalone sign (see B3)
