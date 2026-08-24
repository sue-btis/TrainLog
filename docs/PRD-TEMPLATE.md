# PRD — <Product Name>

> **How to use this template**
> Derived from `docs/PRD.md`. Replace every `<placeholder>`. Delete sections
> that do not apply — an empty section is worse than no section. Keep the
> numbering stable so requirement IDs (FR-xx, NFR-xx) stay referenceable.
> Prose style: short declarative sentences, one idea per paragraph, fenced
> `text` blocks for literal values, schemas and flows.

---

## 1. Product Overview

### Product Name
**Working name:** <name>

### Product Type
<One paragraph: platform, primary device target, and the bullet list of what
the product lets a user do.>

- <capability 1>
- <capability 2>

### Product Philosophy

<The one conceptual distinction the whole product rests on. State it as a
pair of quoted definitions if there is a duality.>

> **<Concept A>** → <meaning>

> **<Concept B>** → <meaning>

<Why this distinction drives the data model, history and derived features.>

---

# 2. Purpose

## General Purpose

Build an application that is:

- <quality 1>
- <quality 2>

<One paragraph on the division of responsibility between the user's inputs and
what the system does with them.>

---

# 3. Product Goals

## Primary Goals

### G1. <Goal name>

<One-sentence goal.>

<Constraints, formats or scope for this goal.>

### G2. <Goal name>

<Repeat. Aim for 3–6 primary goals; more than that means they are features,
not goals.>

---

# 4. Non-Goals — MVP

<Explicit list of what will NOT be built. Each entry is a temptation you are
naming so it does not creep in.>

- <non-goal 1>
- <non-goal 2>

---

# 5. Target User

## Primary User

<Who they are, their expertise level, what they already do today.>

## Primary Usage Context

<Where and under what physical/network conditions the product is used. This
section justifies the UX principles later.>

---

# 6. Core User Journey

<The end-to-end happy path, numbered, from first launch to recurring use.>

```text
1. <step>
2. <step>
3. <step>
```

---

# 7. Product Architecture

## High-Level Architecture

<Diagram or text block of the layers and how data flows between them.>

```text
<layer>
   ↓
<layer>
```

---

# 8. Technical Architecture

## Frontend
<Framework, language, build tool, state management. Name versions only where
they constrain the design.>

## UI styles and components
<Styling approach, component library, design token strategy.>

## <Platform capability, e.g. PWA / Native shell>
<Manifest, service worker, install requirements.>

## Local Database
<Engine, schema ownership, migration strategy.>

## Routing
<Router, route list, deep-link rules.>

## <Other subsystems: charts, i18n, analytics>

## Hosting
<Where it is deployed, build output, cost model.>

---

# 9. <Defining Architectural Constraint>

<e.g. Offline-First Architecture. The rule that everything else must respect,
plus what it implies for reads, writes and conflict handling.>

## Data Availability <under constraint>

<Which entities must be locally available and which may be lazy.>

---

# 10. Information Architecture

<Top-level navigation model.>

## <Primary navigation>

```text
<tab 1>
<tab 2>
```

## Under `<secondary entry point>`

```text
<item>
<item>
```

---

# 11. Core Features

# 11.1 <Feature name>

<What it does, in a sentence.>

<Flow, steps, states. Use `## Step 1 — <name>` subsections when the feature is
a wizard.>

## Validation

### Structural — blocks the operation
<Errors that make the input unusable.>

### Semantic — corrected inside the flow
<Errors the user can fix without restarting.>

# 11.2 <Feature name>

<Repeat one numbered subsection per core feature. Each should stand alone:
purpose, inputs, states, edge cases.>

---

# 12. <Input Format / Template>

## Structure

```text
<schema outline>
```

## Example

```yaml
<realistic, complete example>
```

## Field Notes

### `<field>`
<Semantics, allowed values, defaults.>

### Fields absent by design
<What is deliberately not in the format, and why.>

---

# 13. <Format> Design Principles

### Human-readable
<Rationale.>

### Declarative
<Rationale.>

### Versioned
<Version field, compatibility policy.>

---

# 14. Core Data Model

<One numbered subsection per entity. Keep field lists flat and free of
implementation types.>

# 14.1 <Entity>

<What it represents.>

```text
<Entity>

id
<field>
<field>
```

Example:

```text
<concrete instance>
```

# 14.2 <Entity>

<Repeat.>

---

# 15. Data Relationships

```text
<Entity A> 1 ── n <Entity B>
```

<Ownership and cascade rules.>

---

# 16. <Core Invariant, e.g. Planned vs Actual>

<The rules that must never be violated, stated as invariants.>

---

# 17. Backup Architecture

## Export
<Format, contents, trigger, file naming.>

---

# 18. Restore

## Scope
<What restore replaces vs merges.>

## Versions
<Backward compatibility policy.>

---

# 19. <Secondary Export, e.g. CSV Export>

<Columns, encoding, use case.>

---

# 20. <Platform> UX Principles

## <Principle name>
<Concrete rule, not an aspiration. e.g. "All primary actions reachable within
the bottom third of the screen.">

## <Principle name>
<...>

---

# 21. UX Principle — <Named Mode>

<A usage mode with its own constraints (e.g. hands busy, gloves, bright sun).
List what the UI must do differently in this mode.>

---

# 22. Functional Requirements

<One requirement per subsection, atomic and testable. Never merge two
requirements into one ID.>

## FR-01

<The user can ...>

## FR-02

<The system ...>

---

# 23. Non-Functional Requirements

## NFR-01 — <Quality attribute>

<Measurable target.>

## NFR-02 — Performance

<Concrete budgets: cold start, interaction latency, bundle size.>

## NFR-03 — Reliability

<Data loss tolerance, crash recovery.>

---

# 24. Data Integrity Requirements

<ID strategy, uniqueness, what must never be used as a primary key.>

```text
UUID
```

---

# 25. <Domain Rules, e.g. Import Rules>

<Rules applied at the system boundary.>

---

# 26. <Identity Resolution>

<How entities are matched across imports/sources.>

## Resolution
<Matching order and fallbacks.>

---

# 27. <Derived Logic Architecture>

<Where derived values are computed, and the rule that they are derived, never
stored — or the opposite, stated explicitly.>

---

# 28. <Algorithm variant A>

<Inputs, rule, output.>

---

# 29. <Algorithm variant B>

<Inputs, rule, output.>

## <Edge case section>
<What happens when reality does not match the plan.>

---

# 30. <Domain considerations>

<Nuances a naive implementation would get wrong.>

---

# 31. Initial Screens

## Screen 1 — <name>
<Purpose, key elements, primary action.>

## Screen 2 — <name>
<...>

---

# 32. Settings

<Every setting, its default, and its effect.>

```text
<setting> — default: <value>
```

---

# 33. <Platform> Requirements

<Manifest fields, icons, install criteria, permissions.>

---

# 34. Local Storage Strategy

## <Store 1>
<What lives here.>

## <Store 2>
<What lives here.>

---

# 35. Error Recovery

<Failure modes and the recovery path for each.>

---

# 36. Session State

<What in-flight state exists, where it is persisted, and how it survives a
reload or crash.>

---

# 37. Data Safety

<Destructive-action guards, confirmations, retention.>

---

# 38. MVP Scope

## MVP 0.1

<Exhaustive in/out list. This is the contract for the first release.>

```text
In:
- <item>

Out:
- <item>
```

---

# 39. V1.0

<What the next version adds, grouped by theme.>

## A — <theme>
## B — <theme>
## D — Invariants to be revoked
<Which MVP invariants V1 intentionally breaks, and why.>

---

# 40. Future Architecture

<Changes deferred until scale or need justifies them.>

---

# 41. Future Optional <Capability>

<e.g. cloud sync. Kept optional, with the constraint it must not become
mandatory.>

---

# 42. Future <Capability>

<...>

---

# 43. Product Principles

## Principle 1
<Short, memorable, decidable. A principle you cannot lose an argument with is
not a principle.>

## Principle 2
<...>

---

# 44. Success Criteria for MVP

The MVP is functional when this flow completes end to end under
<the defining constraint>:

```text
1. <step>
2. <step>
...
```

---

# 45. Suggested Project Structure

```text
src/
  <folder>/
  <folder>/
```

---

# 46. Recommended Development Order

```text
1. <milestone>
2. <milestone>
```

---

# 47. First Architectural Milestone

<The smallest slice that proves the architecture works end to end.>

---

# 48. Product Summary

<Three to five sentences. If someone reads only this section, they should know
what the product is, who it is for, and what makes it different.>
