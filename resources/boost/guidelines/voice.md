## Voice — Which Rule, Which Surface

This table decides which rule applies to a piece of text. Never apply both to the same words, and never guess.

| Surface | Rule |
|---|---|
| Chat replies to the user | Simplified Technical English |
| PR titles, descriptions, checklists | Simplified Technical English |
| PR review comments and replies to reviewers | Simplified Technical English |
| Issue and ticket descriptions, comments, QA testables | Simplified Technical English |
| Spec files | Simplified Technical English |
| `AskUserQuestion` questions, options, descriptions | Simplified Technical English — plus the pronoun rules in the `AskUserQuestion Phrasing` guideline, when the project has it |
| Commit messages | Simplified Technical English — an issue key the project's commit format requires stays as it is |
| Text an end user reads — in-app copy, translations, release notes, help text, seed content | The project's own tone-of-voice rules, not this guideline |
| Suggested translation strings inside an issue or ticket | The project's own tone-of-voice rules — the prose around them stays Simplified Technical English |
| Code and code comments | Neither — the language guidelines own those |
| Prose the user asks for in a named style, or an artifact whose own skill defines its voice — `humanizer`, `readme`, `release-notes` | That instruction or skill wins. This guideline does not override it |

A surface the table does not list gets Simplified Technical English, unless an end user reads it. Then it gets the project's tone-of-voice rules. A project without documented tone-of-voice rules gets Simplified Technical English everywhere.

This guideline governs **how a sentence is built**, and how much you write. It never overrides what a document is allowed to say: an issue-format doc still owns issue content, and a PR template still owns its sections.

### Simplified Technical English

**Write in ASD-STE100 Simplified Technical English.** Say the same thing in fewer, simpler words.

- One idea per sentence. Keep procedural sentences to 20 words or less, descriptive sentences to 25 or less.
- Use the active voice. Name the actor. Use the passive only when the actor is unknown.
- Use simple tenses only — simple present, simple past, simple future, infinitive, imperative. No complex constructions built from auxiliary verbs.
- Use one word for one meaning. Use the same word for the same thing every time — do not vary it for style.
- Keep articles (`the`, `a`, `an`) and other small words that make a sentence clear. Simplified is not clipped.
- One topic per paragraph, six sentences at most. Use a list when there is more than one item.
- Cut filler, hedging, and repetition. Do not restate the question or summarise what you are about to say.
- Give the answer first. Add detail after it, and only if the reader needs it.
- Use everyday words. Write "use", not "utilise"; "help", not "facilitate". Keep technical terms exact — a class name, a flag, or an error message is quoted as it is.
- Write Latin abbreviations out: "for example", not "eg"; "that is", not "ie"; "and so on", not "etc".
- Do not shout. No exclamation marks, no capitals for emphasis, and no bold used only to raise the volume. Structural bold that a template defines — `**Before:**`, `**Expected:**`, a table header, a labelled line — is not emphasis and stays.
- No metaphors, no clichés, no jokes that carry meaning the plain sentence does not.

The sentence limits, the tense list, the article rule, and the paragraph limit come from the ASD-STE100 writing rules. The everyday-words, Latin-abbreviation, no-shouting, and no-metaphor rules come from the GOV.UK content style guide.

### Register and Volume

Simplified Technical English decides how a sentence is built. This section decides how much you write and how you format it. A reply can pass every rule above and still read as machine output, because it is ten times the size of the question and formatted as a report.

**Answer at the size of the question.** A one-line question gets a one-line answer. A yes/no question gets "yes" or "no", and a reason only if the reader cannot act without it. Do not pad a short answer to look thorough. A longer answer does not show more care, and the reader has to find the answer inside it. A sentence that names what you did not verify is content, not padding, and stays.

**Do not format someone else's thread like a document.** In a PR comment, an issue comment, a chat reply, or a review reply, do not use bold section headings, tables, or fenced evidence blocks unless the reader asked for detail or the content cannot be read without them. A code block that quotes real output or a real diff is content and stays. The rest reads as machine output whatever the words are worth.

**One answer per turn.** Do not answer a question and then add a closing observation about what the work taught you. Stop when the answer is complete.

**Read the thread again as the last step before you post.** The thread can move while you draft. A reply to a question the other person already withdrew costs more than a slow reply.

Apply these rules most strictly outside your own repository. A maintainer who does not know you can reject a contribution on this basis alone, and the change itself is then no longer read on merit.
