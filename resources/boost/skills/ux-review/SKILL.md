---
name: ux-review
description: "UX/UI expert review for new features and novel UI — evaluates the current state, explores options, then recommends and documents a chosen approach. Activates when: designing a new user-facing feature, adding a novel interaction pattern, redesigning an interface or user flow, or when user mentions: UX, UI, user experience, interface design, user flow, interaction design, usability, ux-review."
argument-hint: "[feature description]"
---

# UX/UI Expert Review

Before implementing UI changes, evaluate the current state and design an approach that delivers great user experience. Consider multiple options, choose the best, and document the decision.

## When to Use This Skill

**USE for:**
- New features with user-facing components
- Novel UI additions (patterns not already in the app)
- Redesigning or significantly changing existing interfaces
- New user flows or interactions
- Features where UX decisions impact usability

**DO NOT use for:**
- Bug fixes (use `bug-fixing` skill instead)
- Adding settings similar to existing ones
- Repetitive additions following established patterns
- Backend-only changes
- Copy/text changes without interaction changes

### Examples

| Task                                 | Use this skill? | Reason                       |
|---------------------------------------|-----------------|------------------------------|
| Add bulk tagging to a list            | Yes             | New interaction pattern      |
| Add a "notify on comment" setting     | No              | Similar to existing settings |
| Redesign the editor toolbar           | Yes             | Significant UI change        |
| Fix a button not responding           | No              | Bug fix                      |
| Add keyboard shortcuts to the editor  | Yes             | New interaction paradigm     |
| Add another export-format option      | No              | Extending existing pattern   |
| New onboarding wizard                 | Yes             | New user flow                |

## Workflow

### Phase 1: Understand the Context

1. **Fetch requirements**
   - If the work is tracked in an issue tracker, fetch the issue for the full requirements
   - Understand what the user is trying to accomplish
   - Identify the user personas affected

2. **Analyze current state**
   - Find the relevant UI components/pages
   - Understand existing patterns in the area
   - Note any existing UX pain points

3. **Define success criteria**
   - What does a good UX outcome look like?
   - What are the constraints (technical, brand, consistency)?

### Phase 2: UX/UI Expert Evaluation

Think like a UX expert. Consider:

#### User Goals
- What is the user trying to achieve?
- What's the fastest path to their goal?
- What might confuse or frustrate them?

#### Discoverability
- How will users find this feature?
- Is the entry point intuitive?
- Should it be prominent or tucked away?

#### Interaction Patterns
- What existing patterns can we leverage?
- Does this need a new pattern? Why?
- How does this compare to industry standards?

#### Feedback & Confirmation
- How will users know their action succeeded?
- What feedback during loading/processing?
- How are errors communicated?

#### Edge Cases
- Empty states - what if there's no data?
- Error states - what if something fails?
- Partial states - what if data is incomplete?

#### Accessibility
- Keyboard navigable?
- Screen reader friendly?
- Color contrast sufficient?

### Phase 3: Explore Options

Generate 2-4 UX/UI approaches:

```markdown
## Option A: Modal Dialog
- User clicks button → modal opens → fills form → submits
- Pros: Focused attention, clear action boundary
- Cons: Interrupts flow, can't see context

## Option B: Inline Expansion
- User clicks button → section expands inline → fills form → submits
- Pros: Maintains context, feels lighter
- Cons: May push content down, less focused

## Option C: Slide-out Panel
- User clicks button → panel slides from right → fills form → submits
- Pros: Maintains page context, spacious form area
- Cons: Covers some content, another pattern to learn
```

### Phase 4: Recommend & Justify

Choose the best option based on:

1. **Consistency** - Does it match existing patterns?
2. **Simplicity** - Is it the simplest solution that works?
3. **User mental model** - Does it match user expectations?
4. **Technical feasibility** - Can it be implemented well?
5. **Accessibility** - Is it accessible to all users?

```markdown
## Recommendation: Option B (Inline Expansion)

**Why:**
- Matches an existing settings pattern already in the app
- Users can see the list while making selections
- No new UI patterns to learn
- Simpler to implement and test

**Trade-offs accepted:**
- Less focused than a modal, but acceptable for this quick action
```

### Phase 5: Implementation Plan

Create a concrete implementation plan:

```markdown
## Implementation Plan

### UI Components Needed
- [ ] BulkActionBar (new)
- [ ] TagSelector (exists, reuse)
- [ ] Inline form expansion (exists, extend)

### User Flow
1. User selects multiple items (existing checkbox pattern)
2. Bulk action bar appears at bottom (new — similar to Gmail's)
3. User clicks "Add Tags"
4. Tag selector expands inline
5. User selects tags and clicks "Apply"
6. Success toast confirms the action

### States to Handle
- No items selected → bar hidden
- 1+ items selected → bar visible
- Applying → show spinner, disable button
- Success → toast notification, clear selection
- Error → inline error message, keep selection

### Existing Patterns to Follow
- Notifications: the project's existing toast/notification utility
- Loading states: the project's existing loading-button component
- Selection: the project's existing checkbox/multi-select pattern
```

### Phase 6: Document the Decision

If the work is tracked in an issue tracker, add a comment documenting the UX decision:

```markdown
## UX/UI Review

### Options Considered

**Option A: Modal Dialog**
Opens a modal for bulk tagging. Focused but interrupts workflow.

**Option B: Inline Expansion** ✓ Chosen
Expands form inline below the selection. Maintains context.

**Option C: Slide-out Panel**
Panel from right side. Spacious but adds visual complexity.

### Chosen Approach

**Inline Expansion** was selected because:
- Matches an existing settings pattern in the app
- Users maintain context while tagging
- No new UI paradigm to learn
- Consistent with how similar bulk actions work in the app

### Key UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry point | Bulk action bar | Appears on selection, similar to Gmail |
| Feedback | Toast notification | Consistent with other actions |
| Error handling | Inline message | Keeps context, allows retry |
| Empty state | Disabled button | Clear affordance |

### Wireframe/Mockup

[If applicable, describe the visual layout or link to mockup]
```

## UX Principles

When designing, follow these principles:

### 1. Progressive Disclosure
Show only what's needed at each step. Advanced options can be hidden until needed.

### 2. Consistency Over Novelty
Use existing patterns unless there's a compelling reason not to. Users shouldn't have to learn new interactions for similar tasks.

### 3. Immediate Feedback
Every action should have visible feedback. Loading states, success messages, error handling - nothing should leave users wondering.

### 4. Forgiving Design
Allow undo where possible. Confirm destructive actions. Make it hard to lose work.

### 5. Context Preservation
Keep users oriented. Avoid full-page transitions for quick actions. Use modals/panels sparingly.

## Common UI Patterns

Prefer an established pattern over inventing a new one — and check how the project already implements it before adding your own:

| Pattern             | Used For                     |
|---------------------|------------------------------|
| Data tables         | Lists with sorting/filtering |
| Modal dialogs       | Focused forms, confirmations |
| Slide-out panels    | Detail views, editing        |
| Inline editing      | Quick field updates          |
| Toast notifications | Success/error feedback       |
| Dropdown menus      | Actions, options             |
| Tabs                | Content organization         |
| Accordion           | Collapsible sections         |

## Questions to Ask

If requirements are unclear, ask about:

1. **User context**: "Where will users be when they need this?"
2. **Frequency**: "How often will users do this action?"
3. **Importance**: "Is this a primary or secondary action?"
4. **Existing patterns**: "Should this match the pattern used for X?"
5. **Edge cases**: "What happens when there are 0 items? 1000 items?"
