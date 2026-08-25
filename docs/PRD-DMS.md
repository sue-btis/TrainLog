# PRD — <Product Name — pending PO>

> **Status of this document**
> Sections **1**, **2** and **8** are written. Everything else keeps the
> skeleton of `docs/PRD-TEMPLATE.md` so the PO can continue without breaking
> the numbering or the requirement IDs.
> Section **8** is a **developer proposal**, not an approved decision. Its
> closing subsection lists every decision still pending PO review.

---

## 1. Product Overview

### Product Name
**Working name:** `<pending — to be defined with PO>`

Internal reference throughout this document: **the DMS**.

### Product Type

Web application implementing a **Document Management System (DMS)** for a
**single organization's own internal documentation**. Primary target is the
desktop browser; mobile is for consulting and approving, not for authoring.

The application lets a user:

- register a document as an **entity with a stable identity**, independent of any file;
- upload successive **immutable versions** of that document;
- govern the lifecycle through **explicit states** and valid transitions;
- route **approvals** and record who authorized which version, and when;
- keep an **audit trail** of every action, with no exceptions and no deletion;
- **classify** documents — governed attributes that drive access, plain fields and free tags that do not;
- control access through **permissions** evaluated per document and per action;
- **ask questions about the corpus** and get answers grounded in documents the asker is allowed to read.

### Product Philosophy

The application rests on a single conceptual distinction:

> **Document** → the governed entity. It has a stable identity, an owner, a
> lifecycle, permissions and history. It exists before any file is uploaded,
> and it outlives every file it ever holds.

> **File** → the content of **one** version. It is immutable, replaceable and
> disposable. It is an attachment of the version, never the entity.

This distinction is why the system is **not** a file CRUD. In a CRUD, uploading
a new file overwrites the previous one and the history is lost. Here,
uploading a new file **creates a version**, and the history is the main
product.

The centerpiece is the chain, not the file:

```text
Document         → stable identity
  └── Version    → immutable content
      └── State  → where that version sits in its lifecycle
          └── Approval → who authorized that version, and when
              └── Audit → append-only record of everything above

Attributes  → the few properties that take part in access decisions
Fields      → structured metadata that describes but does not govern
Tags        → free labels for humans and for search relevance; no access effect
Permissions → cut across every layer: role + attributes + explicit grants
AI          → consumes content and metadata; produces answers, never states
```

Direct consequences on the data model:

- No version is ever overwritten or deleted.
- The "current document" is a **derived value** — the latest approved version —
  not a row that gets edited.
- The audit trail is **append-only**: it has no update and no delete operation.
- A permission is not a property of the file. It is a decision computed from
  the actor role, the document attributes, and any explicit grant on that
  document.
- **A tag never grants or removes access.** Anything that changes who can see a
  document is a governed attribute or an explicit grant, and is audited as
  such. This separation is deliberate: a label anyone can edit must never be a
  security boundary.
- **A field is not an attribute.** If no access rule reads it, it describes the
  document; it does not govern it, and it does not belong in the authorization
  path.
- The AI never writes governance state. It answers, suggests and classifies;
  a human accepts.

---

# 2. Purpose

## General Purpose

Build an application that is:

- **governed** — every document has a state, an owner, and explicit valid transitions;
- **auditable** — every action can be reconstructed afterwards;
- **versioned** — the full history is immutable and queryable;
- **controlled** — access denied by default, computed from role, attributes and explicit grants;
- **searchable** — finding a document stays fast as the corpus grows;
- **AI-assisted** — the AI removes manual work without acquiring authority;
- **defensible** — under external audit, the system can prove who approved what, and when.

The division of responsibility is explicit. **The organization supplies the
content and the decisions** — which document exists, which version is uploaded,
who approves it, which policy applies. **The system supplies the memory and the
discipline** — it keeps every version, refuses invalid transitions, evaluates
permissions before every action, records everything, and offers the AI as an
assistant over that material. The system never decides on the user's behalf; it
guarantees that the user's decision is recorded, attributed, and impossible to
dispute.

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

> **NOTE FOR THE AI AND FOR THE PO — READ BEFORE USING THIS SECTION**
>
> All of section 8 is a **developer proposal**, written so the PO has a
> concrete technical starting point and can continue the rest of the PRD.
> **It is not an approved decision.**
>
> Rules of use:
> - No statement in this section is a requirement until the PO validates it.
> - Do not derive functional (FR-xx) or non-functional (NFR-xx) requirements from here.
> - Items marked **open** have no answer yet. Do not invent one — ask.
> - If a product decision contradicts this section, **product wins** and this
>   section gets rewritten.
>
> Two closing subsections carry the rest of the context: **Deliberately not
> built** lists what was cut and the condition that would bring it back, and
> the **Decision log** states which choices are settled and which await the PO.

## Operating assumptions

```text
Tenancy      single organization, single instance
Corpus       the organization's OWN internal documentation
Documents    office files uploaded by users (PDF, DOCX, XLSX, ...)
             the app governs them; it does not author them
Users        fewer than 100
Volume       UNKNOWN. No estimate exists. See D-14.
Identity     managed in-app — admins create users and grant access
Access       RBAC + ABAC + ACL; tags are semantic, never a security boundary
Cloud        Azure for blob storage and for the AI agent
Regulatory   OPEN — pending PO. See D-04.
Scope        OPEN — the attribute ABAC binds to is undetermined. See D-18.
```

Volume is genuinely unknown, so nothing here is sized for a number. The design
below holds from a few thousand documents upward, and only two thresholds would
change it:

```text
under ~10,000 documents   the separate search service may be unnecessary;
                          vector support inside the database could replace it
over ~5,000,000           ingestion throughput becomes a project of its own
```

Ask the PO for the real figure before either threshold is used to justify
anything.

## Frontend

**Next.js** (App Router) with **React** and **TypeScript**, running as a
**BFF** — Next holds the session and calls ASP.NET server-to-server. The API is
not addressed directly by the browser.

Rationale: the DMS is mostly list, detail and form views over data the server
already knows and already filters by permission. Rendering on the server avoids
shipping documents the user may not see.

Session handling under the BFF model:

- The session lives in an `HttpOnly`, `Secure`, `SameSite` cookie. No token
  ever reaches client-side JavaScript.
- No CORS surface to misconfigure, because there is no cross-origin call.

Server state through fetching in server components; client state only where
there is real interaction — metadata editor, file upload, approval inbox, the
AI chat panel.

## UI styles and components

**Tailwind CSS** for styling, **shadcn/ui** as the component base.

Rationale: shadcn/ui is copied into the repository rather than installed as a
closed dependency, and it is built on accessible primitives. A DMS lives on
tables, confirmation dialogs, menus and long forms — exactly the components
shadcn/ui already gets right on focus, keyboard and screen readers.

Design tokens as Tailwind CSS variables. No additional component library: any
new component is composed from the existing ones.

## Charts

**Recharts** is the intended library **when charts exist**. No metric has been
defined yet, so the dependency is not installed and no charting layer is
designed. Add it when section 22 names a metric someone will act on.

## Backend

**ASP.NET Core** (Web API, C#).

Rationale: the core of the product is domain logic with hard invariants — state
transitions, version immutability, permission evaluation, append-only audit.
That core belongs in a strongly typed backend with transactions and tests, not
in the client.

Explicit boundary: **every** governance decision — create a version, change
state, approve, resolve permissions, write audit — happens in the backend. The
frontend never computes whether a transition is legal; it requests it and obeys
the answer.

## Identity

Identity is **managed inside the application**, not delegated to an external
provider. An administrator creates users and grants them access.

Proposal: **ASP.NET Core Identity** for the user store, password hashing,
lockout and reset flows. It is the framework-native option and it removes an
entire category of code that must not be hand-written.

MVP ships **password authentication only**. MFA is deferred by decision — see
*Deliberately not built*.

## Authorization — RBAC + ABAC + ACL

Three mechanisms, each answering a different question. They compose; none of
them replaces the others.

```text
RBAC   What kind of action may this person perform at all?
       administrator | editor | reader | approver
       Coarse. Says nothing about which documents.

ABAC   Does this person's context match this document's context?
       The mechanism is decided. The ATTRIBUTE it reads is not — see D-18.

ACL    Is there an explicit grant on this one document, for someone the
       rule above did not reach?
       Rare by design. Every entry is an admission the rule did not fit.
```

### The undetermined attribute

ABAC needs something to compare. For a corpus of internal company
documentation, there are two plausible shapes and they cost very differently:

```text
SHAPE A — the organization has areas whose documents are not mutually visible
          (HR files, finance, legal, management)
          ABAC binds to an `area` attribute on the document, matched against
          the person's area membership. Full three-layer model as designed.

SHAPE B — everyone in the company may read everything, with a short list of
          exceptions
          ABAC has nothing to bind to. The model collapses to RBAC + ACL,
          which is materially simpler and entirely legitimate.
```

This is not a detail to settle during implementation. Under Shape B, half the
authorization design below is machinery guarding a rule that does not exist.
**Ask before building.** See D-18.

Everything that follows holds under either shape; only the filter predicate
changes.

### Principles

- Denied by default.
- Authorization is checked in the backend, every time. The UI hides actions for
  convenience, never as a security mechanism.
- A role does not grant universal document access on its own.
- **One decision point.** A single authorization service answers both "may this
  person perform this action on this document?" and "which documents may this
  person see in a list or a search?" Those two must never be implemented twice
  — a list filter that drifts from the per-document check is the classic way a
  DMS leaks.
- The same calculation that guards the document list guards AI retrieval.

Implementation proposal: ASP.NET Core **resource-based authorization** —
`IAuthorizationService.AuthorizeAsync(user, document, requirement)` with
`AuthorizationHandler<TRequirement, Document>` for the attribute rules. This is
the framework's own model for exactly this problem.

Actions checked per request against the `(document, action)` pair:

```text
read | download | create_version | submit | approve | reject
change_state | manage_metadata | manage_acl | read_audit
```

`read` and `download` are separate actions by decision — a person may be
allowed to open a document without being allowed to take the file.

ACL administration: **administrators, plus the responsible person for whatever
scope D-18 settles on**. A metric worth having from day one is the count of
documents carrying a non-empty ACL. If it grows steadily, the ABAC rule is
wrong and that number says so before the complaints do.

## Attributes, fields and tags

Three tiers, and the difference between them is not cosmetic.

```text
ATTRIBUTES — take part in access decisions
             changing one is a privileged action and is always audited
             Today: owner, state — plus whatever D-18 settles on.
             Nothing enters this tier without a rule that reads it.

FIELDS     — structured metadata with a controlled vocabulary
             describes the document; no access effect
             type: contract | policy | procedure | minutes | ...

TAGS       — free text, no vocabulary, no access effect
             editable by anyone with edit rights on the document
             used for human browsing, faceted search, and AI relevance
```

Two rules keep the tiers honest:

- **If a label can change who sees a document, it is an attribute, not a tag.**
  Tags stay free precisely because they carry no authority.
- **If no access rule reads it, it is a field, not an attribute.** `type` sits
  here: it describes the document and drives nothing. Should D-12 make the
  approval route depend on document type, `type` is promoted to an attribute
  and that promotion is a deliberate change, not a rename.

Tags still matter to the AI, but as **relevance narrowing**, not as a security
boundary. A tag makes an answer better; only attributes and ACL make it safe.

## Database

**Relational.** Proposal: **Azure SQL Database**, given that the rest of the
infrastructure is Azure and the backend is ASP.NET Core.

Rationale for relational over document stores: the product *is* relationships
and transactional guarantees — a version belongs to a document, an approval to a
version, an audit entry to an actor and an instant. Foreign keys and
transactions are the feature, not an implementation detail.

Data access through **EF Core**. Audit entries are written in the same
transaction as the operation that caused them: if the operation commits, its
trace commits with it.

Two cheap habits that avoid an expensive retrofit: indexes designed on purpose
rather than discovered later, and **cursor-based pagination** in every list a
user can reach. Neither costs anything today.

## Document storage

Files are **not** stored in the database. They go to **Azure Blob Storage**;
the version row stores the reference, the content hash, the size and the
declared content type.

Rationale: blobs inflate backups, restores and query times while contributing
nothing to the domain. The hash additionally makes immutability verifiable
rather than merely promised.

Access to a blob is never a public URL. The backend authorizes the request and
streams the file, or issues a short-lived single-file SAS. A leaked link must
expire on its own.

Because `download` is a right distinct from `read`, the read path streams
through the backend rather than handing out a blob URL — otherwise the
distinction would not survive contact with the browser.

## Search and retrieval

Conversational Q&A over the corpus requires vector retrieval, and every
retrieval must be filtered by the asking user's permissions. That combination
— not corpus size — is what selects the search infrastructure.

Proposal: **Azure AI Search** as the single index serving both

- keyword and faceted search in the UI — filtered by state, type, date, tag;
- vector retrieval for the AI agent.

One index, one filter model, one permission calculation. Keyword search in SQL
plus vector search elsewhere would mean two access-control paths, and the
second one always leaks.

> Worth revisiting once the real corpus size is known: Azure SQL has been
> gaining native vector search, which could remove this service entirely for a
> small corpus. Verify current capability and GA status before deciding.

### Security trimming

The index cannot be queried unfiltered, so authorization has to be expressible
as an index filter. Each indexed document carries its governed attributes plus
its explicit grants:

```text
owner, state, <the D-18 scope attribute, if any>
aclAllow[]   principals explicitly granted access
```

At query time the backend builds the filter from the **caller's own identity**,
resolved server-side. The client never supplies it, and never sees it.

```text
Shape A   filter = (scope ∈ caller.scopes) ∨ (aclAllow ∩ caller.principals ≠ ∅)
Shape B   filter = true ∨ (aclAllow ∩ caller.principals ≠ ∅)
          — i.e. only restricted documents need filtering at all
```

Illustrative shape only — validate the concrete expression against Azure AI
Search filter syntax before implementation.

Building the filter per query, rather than precomputing an access list per
document, means **changing a person's scope assignments takes effect on their
next query with no reindexing at all**. Only a change to a document's own
attributes or ACL reindexes, and that is one document.

Propagation is asymmetric by decision:

```text
revoking access   synchronous — the reindex is part of the operation
granting access   asynchronous — queued, visible within seconds
```

Removing access is a security operation and waits for the index. Granting it is
a convenience and does not. The window on a grant exposes nothing; the window
on a revocation would expose title, snippet and existence.

### Ingestion

Ingestion is **asynchronous**. Uploading a version returns as soon as the blob
and the row are committed; text extraction, chunking, embedding and indexing
run in the background, and the version carries an explicit indexing state. A
document that is not yet indexed is visible and downloadable, just not yet
searchable.

## AI subsystem

Proposal: **Azure AI Foundry Agent Service** (Azure AI Agents) as the agent
runtime, consuming Azure AI Search as its knowledge source.

> Verify the current product name, SKU and API surface against Microsoft
> documentation before implementation. This service has been renamed more than
> once, and nothing here should be treated as an API contract.

The AI is a **service the backend consults**, never an actor with its own
permissions:

- The AI does not change states, does not approve, and does not grant permissions.
- Every retrieval carries the security trimming filter above, derived from the
  asking user. The agent never sees more of the corpus than the person asking.
- Tags narrow *relevance*. Attributes and ACL enforce *security*. The agent may
  use tags to answer better; it may never rely on them to stay legal.
- Every answer cites the documents it used. An answer with no citation the user
  can open is treated as a defect.
- AI use over a document is audited like any other action.

The known hard problem, stated plainly: **conversational Q&A over a corpus can
leak content through an answer even when the source document is never opened.**
The mitigation is the permission-derived retrieval filter, plus the citation
requirement, which turns any leak into something visible and reportable. This
is a risk to manage explicitly, not a solved problem.

## Routing

Next App Router. Proposed structure:

```text
/                      -> the personal work inbox
/documents             -> list and search
/documents/[id]        -> document: current version and metadata
/documents/[id]/versions
/documents/[id]/audit
/approvals             -> awaiting my approval
/ask                   -> AI questions over the corpus
/admin/users
/admin/roles
```

Every link to a document is deep and stable: `/documents/[id]` must survive
being pasted into an email. Permissions are checked on the server while
resolving the route; a URL that is valid for one person returns 403 for
another.

## Hosting

**Azure**, consistent with Blob Storage and the agent service. The concrete
compute choice (App Service, Container Apps) is **open** and low-risk to defer
— it does not constrain the design.

## Deliberately not built

Each of these was considered and cut. The condition that brings it back is
stated, so nobody has to re-derive the reasoning later.

```text
MFA                     Deferred by decision. ASP.NET Core Identity ships TOTP
                        and recovery codes; enabling it later is configuration,
                        not migration. Add when the PO answers D-04 with a
                        regulatory framework, or before any external access.
                        RISK, stated once: administrator and approver accounts
                        are password-only, and those are the accounts that can
                        grant permissions and approve in someone else's name.

Confidentiality levels  No public/internal/restricted/secret scale. Whatever
                        D-18 settles on, plus per-document ACL, covers the
                        known cases. Add when a real document must be hidden
                        from someone the scope rule already admits.

ACL deny entries        Grants only, no explicit denials.
                        ponytail: allow-only ACL. Retrofitting deny changes the
                        evaluation order for every existing rule, so add it as
                        a deliberate migration, not as a field.

Tag namespaces          Tags are plain strings. Namespaces were structure for
                        governance tags, and governance moved to attributes.

In-app document viewer  `download` is a distinct right, but MVP grants it
                        together with `read`. The viewer is what makes
                        view-without-download real. Add when someone actually
                        requires it — and note that it stops downloads, not
                        screenshots or phone cameras. It is a friction and
                        audit control, not confidentiality.

Charting layer          No metric is defined. See Charts above.

External policy engine  No OPA, Casbin, or rule DSL. The policy set fits in
                        typed C# handlers, and a second source of truth for
                        authorization is a liability. Add only if non-developers
                        must edit policy at runtime.

Client / project scope  Considered and discarded. "Project" is the internal
                        name for a client, and this product governs the
                        organization's own documentation, not client
                        deliverables. Revisit only if the corpus turns out to
                        include client-owned material.
```

## Decision log

### Settled in the developer working session

```text
D-01  Tenancy: single organization, single instance.
D-02  Cloud: Azure. Blob storage and AI agent are Azure services.
D-03  Document nature: office files uploaded by users. No in-app authoring.
D-05  AI scope: conversational Q&A over the corpus (RAG).
D-06  Next topology: BFF with HttpOnly session cookie.
D-07  Authorization: RBAC + ABAC + ACL. Tags are semantic only.
D-08  Identity: managed in-app, ASP.NET Core Identity.
D-09  Database: relational, Azure SQL Database.
D-17  MFA: not in MVP. Password authentication only.
D-19  read and download are distinct rights, granted together in MVP.
D-20  ACL granted by administrators and by the scope's responsible person.
      Revocations propagate to the index synchronously, grants asynchronously.
D-21  Document type is a FIELD, not a governance attribute. It describes;
      it does not decide. Promoted only if D-12 makes approval depend on it.
```

### Developer position, pending PO confirmation

```text
D-13  Versioning: anyone with edit rights in scope may create a version.
      No check-out lock; optimistic conflict detection on upload.
      Simple incremental numbering (v1, v2, v3), no major/minor.
D-16  Governance attributes: owner, state, plus the D-18 scope attribute.
      Nothing else enters this tier without a rule that reads it.
```

### Open — no answer yet, pending PO

```text
D-04  Regulatory framework: ISO 9001, 21 CFR Part 11, SOX or none.
      Decides electronic signature, read-logging, retention — and reopens
      D-17 if the answer is anything but "none".
D-05b Whether metadata auto-extraction on upload is in MVP scope
      alongside conversational Q&A.
D-11  Lifecycle state machine: the actual states and legal transitions.
D-12  Approval model: single approver, sequential chain, or parallel quorum.
      Also decides whether D-21 promotes `type` to an attribute.
D-14  Corpus size and origin: how many documents exist, where they live now,
      and with what metadata. No estimate exists today.
D-15  Retention and expiry: whether documents expire and what happens then.
D-18  THE SCOPE QUESTION. Shape A (areas with mutually invisible documents,
      ABAC binds to an area attribute) or Shape B (everyone reads everything
      except a short exception list, RBAC + ACL only).
      Highest-impact open item. Under Shape B a large part of this section
      is machinery for a rule that does not exist.
D-22  What this documentation actually is: process and quality manuals,
      technical documentation, administrative records, or a mix.
      Drives sections 11, 14 and 16.
```

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
