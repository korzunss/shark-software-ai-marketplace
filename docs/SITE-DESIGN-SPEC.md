# Design specification: Shark Plugins marketplace site

Status: **v1.0 for design** · 2026-10-17 · scope: MVP + v2

A document for the designer. It describes **what** must be on each screen, in which states, and how it behaves, but it does not prescribe **how** it should look. The functional foundation is described in [`SITE-SPEC.md`](SITE-SPEC.md); references to it look like "Spec §N" and "F1…F9".

Decisions already made that affect the design:
- the interface is **Ukrainian only**, but mockups must withstand English strings that are ~30% longer (EN may appear later);
- marketplace name: **`shark-plugins`**;
- no custom domain; the address looks like `org.github.io/shark-software-ai-marketplace/`;
- **light and dark themes** from day one;
- no third-party resources: fonts and icons are local only (Spec §9.3).

---

## Contents

1. [Audience and purpose](#1-audience-and-purpose)
2. [Principles](#2-principles)
3. [Information architecture](#3-information-architecture)
4. [Page skeleton](#4-page-skeleton)
5. [Visual system](#5-visual-system)
6. [Components](#6-components)
7. [Screens](#7-screens)
8. [Interaction and keyboard](#8-interaction-and-keyboard)
9. [Accessibility](#9-accessibility)
10. [Microcopy](#10-microcopy)
11. [Content edge cases](#11-content-edge-cases)
12. [Mockup data](#12-mockup-data)
13. [Deliverables](#13-deliverables)

---

## 1. Audience and purpose

| Persona | Who they are | What they do on the site | Main screen |
|---|---|---|---|
| **Developer** | An engineer who uses Claude Code every day | Looks for a skill or agent for a task, copies the install command | Search → plugin |
| **Team lead** | Sets up a plugin set for the team | Compares plugins by risk and context cost, assembles `settings.json` for the repo | Configurator |
| **Admin** | Manages managed settings for the whole company | Assembles a managed settings fragment, keeps track of releases | Configurator, What's new |
| **Plugin author** | Writes their own plugin | Creates a scaffold, reads the guidelines | Generator, Documentation |

**The main scenario** that the whole design is optimized for:

> A developer opens the site → types «скіл для рев'ю PR» ("skill for PR review") → sees 3–5 cards → opens one → understands what it does and whether it is safe → copies the command → pastes it into Claude Code.
> Goal: **≤ 60 seconds and ≤ 3 clicks** from opening the site to a copied command.

---

## 2. Principles

1. **Search is the home page.** The search field is visible immediately, without scrolling, on any screen. This is not a landing page with a hero and marketing blocks.
2. **The answer is on the card.** The user should be able to make most decisions without opening the details: what it is, which plugin it comes from, whether it runs code, and there is a copy button.
3. **Honest about risks.** Risk badges are not scare warnings but neutral facts with an explanation. "Runs code" applies to most useful plugins and is not a verdict.
4. **Code as first-class content.** Commands and JSON take a prominent place. The copy button is always nearby, and the monospace font is highly readable.
5. **A quiet tool.** The interface is dense and restrained, like developer documentation, not like a shop window.
6. **Consistent in both themes.** Every color and every state is defined for the light and dark themes.

---

## 3. Information architecture

```text
Home / Search ............................... /                    MVP
├── Plugin ................................... /plugins/<id>/        MVP
│   └── Artifact (skill/agent/command/hook/mcp)  /plugins/<id>/<type>/<name>/   v2
├── Configuration builder .................... /configure/           MVP
├── What's new ............................... /changelog/           v2
├── Documentation ............................ /docs/<slug>/         v2
│   (Setup, Troubleshooting, Guidelines, Security, Releases, Contributing)
└── Create a plugin .......................... /create/              v2

Global: ⌘K palette (v2), favorites / recent (v2), theme switcher
Utility: 404
```

**Main navigation** (left to right): Logo · Catalog · Configurator · What's new · Documentation · [Create a plugin] · ⌘K · Theme · GitHub.
In the MVP, v2 items are absent, not disabled. The menu must look complete even with 2 items (Catalog, Configurator).

**Breadcrumbs** appear on all pages except the home page: `Catalog / team-conventions / code-style`.

---

## 4. Page skeleton

### 4.1 Breakpoints and grid

| Name | Width | Columns | Margins | Navigation |
|---|---|---|---|---|
| S (phone) | 360–639 | 4 | 16 | Hamburger, full-width search |
| M (tablet) | 640–1023 | 8 | 24 | Condensed, the rest under "More" |
| L (laptop) | 1024–1439 | 12 | 32 | Full |
| XL | ≥ 1440 | 12, content ≤ 1280 centered | auto | Full |

Text pages (README, documentation) are limited to a width of ~72 characters (≈ 720 px).

### 4.2 Header

- Height ~56 px. The header is sticky and gets a bottom border on scroll.
- On **pages other than the home page,** the header has a compact search field that acts as the entry point to the ⌘K palette in v2, or leads to the home page with the query in the MVP. It is absent on the home page, because the large search is there.
- Optionally, an environment badge can be added next to the logo if the site becomes private (Spec Q1). Reserve space for it in the mockups, but do not show it.

### 4.3 Footer

Minimal, one line: marketplace name, build commit and date ("Updated 17.10.2026 · a1b2c3d"), links to GitHub, `catalog.json`, and RSS (v2).

---

## 5. Visual system

The designer chooses the specific values. Below are the **semantic tokens** that must be in the mockup, because development will reference exactly these.

### 5.1 Colors

| Group | Tokens |
|---|---|
| Surfaces | `bg`, `surface`, `surface-raised` (cards, popovers), `surface-sunken` (code blocks), `overlay` |
| Text | `text`, `text-muted`, `text-subtle`, `text-on-accent` |
| Borders | `border`, `border-strong`, `focus-ring` |
| Accent | `accent`, `accent-hover`, `accent-subtle` (selected chip background) |
| Statuses | `success`, `warning`, `danger`, `info` + `*-subtle` backgrounds |
| **Artifact types** | `type-plugin`, `type-skill`, `type-agent`, `type-command`, `type-hook`, `type-mcp`, `type-lsp`, `type-doc`: 8 colors that are distinguishable from each other in both themes |
| Match highlight | `highlight-bg` for matches in results |
| Code | Syntax highlighting palette for Shiki in the light and dark themes |

Requirements:
- A type is never indicated by color **alone**: always together with an icon and a text label.
- Risk color is not tied to type color. Risk badges are neutral (see §6.5), and `danger` is **not** used for them.

### 5.2 Typography

Roles: `display` (home page heading), `h1`–`h3`, `body`, `body-sm`, `caption`, `mono`, `mono-sm`.
- The main font must support Cyrillic, including `ґ`, `є`, `ї`, `і` and the apostrophe `ʼ`.
- The monospace font must clearly distinguish `0/O`, `1/l/I` and be comfortable for JSON.
- Both fonts ship as local files (woff2), with a total size of ≤ 150 KB.

### 5.3 Icons

A set in a thin line style, from a single source, local. The following icons are needed:
- **8 types:** plugin, skill, agent, command, hook, mcp, lsp, doc;
- **risks:** "runs code", "network", "secret", "external source", "disabled by default";
- **actions:** copy, copied, add, remove, open, external link, GitHub, download, filter, close, search, theme, RSS, star (favorites), clock (recent), arrows.

### 5.4 Other

- Radii: 3 levels (chip, card, modal).
- Shadows: 2 levels (card on hover, popover and modal). In the dark theme they are replaced by borders and surface elevation.
- Motion: 120–200 ms, only for state transitions. Support for `prefers-reduced-motion` is mandatory.
- Spacing: a scale based on 4 px.

---

## 6. Components

For each component, the mockup needs **all the listed states** and both themes.

### 6.1 Search field (large)

- Magnifier icon, placeholder, a `/` key hint on the right, a "clear" button when there is text.
- **Intent chips inside or below the field:** when the query contains «скіл» ("skill"), a `Type: Skill ✕` chip appears (Spec §6.3), and the word itself stays in the field.
- Below the field — 3–4 example query links, visible only when the field is empty.
- States: empty, focus, typing, with an intent chip, index loading (a thin indicator in the field), index load error.

### 6.2 Chip

Variants: filter (selected / not selected, with a counter), intent (with a ✕), tag (display only, clickable → filter).
States: default, hover, focus, selected, disabled (counter 0).

### 6.3 Artifact card

The main component. Here is its anatomy:

```text
┌──────────────────────────────────────────────────────────┐
│ [◆ Skill]                         team-conventions 1.2.0 │  ← type label; plugin + version
│ code-style                                               │  ← name (h3)
│ team-conventions:code-style                              │  ← full id, mono-sm, muted
│ Checks code against the team's style rules and suggests  │  ← description, ≤ 2 lines, matches
│ fixes during ▓review▓…                                   │     highlighted
│                                                          │
│ [⚙ Runs code] [≈ 240 tok.]              [☆] [+] [⧉ Copy] │  ← badges | actions
└──────────────────────────────────────────────────────────┘
```

- The whole card is clickable (leads to the artifact page in v2, or the plugin page in the MVP). Action buttons have their own targets and do not open the card.
- "Copy" copies the **plugin** install command and shows a toast "Copied: /plugin install team-conventions@shark-plugins".
- "+" adds the plugin to the configurator. After that, the button shows the "✓ In configuration" state.
- ☆ "Favorite" appears in v2.
- **"Plugin" variant:** instead of the "plugin + version" line, it shows the contents ("3 skills · 1 agent · hooks"), and "Copy" becomes the primary action.
- **"Document" variant** (v2): no risk badges and no copy, with the section name.
- States: default, hover, focus-visible (outline around the whole card), "in configuration", skeleton.
- Density: on L, **at least 4 cards** are visible in the results below the search field without scrolling.

### 6.4 Type label

Icon + text ("Skill", "Agent", "Command", "Hook", "MCP", "LSP", "Plugin", "Doc") + type color. Type names are **not translated**, because they are Claude Code terms.

### 6.5 Risk badge

| Badge | Show when | Hint (tooltip / popover) |
|---|---|---|
| ⚙ Runs code | `risk.executesCode` | List of `risk.reasons`: "hooks: PostToolUse", "MCP: deploy-api (stdio)" |
| 🌐 Network | `risk.network` | "Connects to: https://…" |
| 🔑 Needs a secret | `risk.needsSecrets` | "Will ask for during installation: API token" |
| ↗ External source | source is not relative | "The plugin's code is in another repository" |
| ◌ Disabled by default | `defaultEnabled: false` | "Must be enabled manually after installation" |

- Visually the badges are neutral (`surface` + `border` + icon). The popover opens on hover as well as on focus or tap, so it works on mobile.
- A card shows at most 2 badges + "+N"; the plugin page shows all of them.

### 6.6 Context cost indicator

`≈ 240 tok.` with a three-level scale (low / medium / high, Spec §5.2). It is needed in two sizes: a compact badge on the card and an expanded block on the plugin page with the explanation "This is how much the plugin adds to every session: names and descriptions of skills, agents, commands. Full texts are loaded only when used."

### 6.7 Code block with copy

- Variants: a single-line command (with a `$` or `/` prefix in a muted color that is **not** copied), multi-line JSON with highlighting, a shell script.
- The copy button is always visible (not only on hover) and changes to "✓ Copied" for 2 s.
- Long lines scroll horizontally inside the block instead of wrapping.
- An optional "Download" button for files.

### 6.8 Tabs

Used in the install block and in the configurator. On S, tabs scroll horizontally instead of turning into a select.

### 6.9 Facets

- On L — a left column (~240 px); on S and M — a "Filters (2)" button that opens a bottom sheet with "Reset" and "Show 12" buttons.
- Groups: Type (with counters), Plugin, Tag, Owner, Risks ("No code execution" checkbox).
- Groups with more than 6 values collapse into "Show all (14)".
- Active filters are duplicated as chips above the results, together with a "Reset all" button.

### 6.10 Toast

Bottom center on S, bottom right on L. Variants: success (copy, added to configuration with an "Open configurator" action) and error. The toast disappears automatically after 3 s and is announced via `aria-live`.

### 6.11 Empty states and errors

| State | Content |
|---|---|
| No results | Illustration or icon, "No results for "…"", "Did you mean: …", popular tags, a **"Request this plugin"** button (opens GitHub) |
| Partial results | Banner above the results: "No exact matches — showing similar results" |
| Index failed to load | "Search is temporarily unavailable", a "Try again" button, and the full catalog below without search |
| Configurator empty | "Select plugins on the left — your ready-made configuration will appear here" |
| Invalid pasted JSON | Inline error with the line number below the field |
| 404 | "Page not found" + search field + "The plugin may have been renamed" |

### 6.12 Skeleton

For cards and search results. Pages are static, so a skeleton appears only in places that load additional data (results, configurator).

### 6.13 v2 components

- **⌘K palette:** a modal with a field, result groups (Plugins / Artifacts / Documents / Actions: "Go to configurator", "Switch theme"), key hints at the bottom, and recent items in the empty state.
- **Event feed item:** date, event type (new plugin / release), plugin and version, collapsed change notes with "Expand".
- **Frontmatter table, hooks table, MCP server card** (see §7.4).
- **Generator form fields:** a text field with live inline validation (✓ / error with an explanation), a tag field (keywords), a group of component checkboxes with a nested name field.

---

## 7. Screens

Each screen needs **L and S** mockups, both themes for the key screens (§13), and all the listed states.

### 7.1 Home / Search (MVP)

```text
L ─────────────────────────────────────────────────────────────────────
[Shark Plugins]   Catalog  Configurator (2)              [◐] [GitHub]
───────────────────────────────────────────────────────────────────────
        Find a plugin, skill, or agent for Claude Code
   ┌─────────────────────────────────────────────────────────────┐
   │ 🔍  скіл для рев'ю PR                              ✕    /   │
   └─────────────────────────────────────────────────────────────┘
     [Type: Skill ✕]
     Try: DB migration agent · formatting hook · MCP for Jira

┌ Filters ──────┐  12 results · [Group by plugin ◻]
│ Type          │  [Type: Skill ✕] [No code execution ✕]  Reset all
│ ◼ Skill    8  │  ┌ card ───────────────┐ ┌ card ───────────────┐
│ ◻ Agent    3  │  └─────────────────────┘ └─────────────────────┘
│ ◻ Command  1  │  ┌ card ───────────────┐ ┌ card ───────────────┐
│ Plugin        │  └─────────────────────┘ └─────────────────────┘
│ Tag           │
│ Owner         │
│ Risks         │
│ ◼ No code     │
└───────────────┘
───────────────────────────────────────────────────────────────────────
shark-plugins · Updated 17.10.2026 · a1b2c3d · GitHub
```

- **No query:** below the search, a "Recently updated" block (v2, 5 events), then "All plugins" — plugin cards sorted by update date. Counter: "14 plugins · 63 artifacts".
- **With a query:** artifact and plugin cards mixed together, sorted by relevance. Results in 2 columns on L/XL and in 1 column on S/M.
- **Group by plugin:** the group header is a compact plugin card, with the nested artifacts below it.
- Required states: empty query, typing (skeleton), results, intent chip, partial results, nothing found, index error, open filter sheet on S.

### 7.2 Plugin page (MVP)

```text
Catalog / team-conventions
┌─────────────────────────────────────────────┬────────────────────────┐
│ [▣ Plugin]                                  │ INSTALLATION           │
│ Team Conventions                v1.2.0      │ [In session][CLI][settings]│
│ Team code style and review rules            │ ┌────────────────────┐ │
│ @org/platform · Proprietary · updated 10.10 │ │/plugin marketplace…│⧉│
│ [Code on GitHub ↗] [Report a bug ↗]         │ │/plugin install …   │⧉│
│                                             │ └────────────────────┘ │
│ [⚙ Runs code ▾] [🔑 Needs a secret ▾]       │ [+ Add to configuration]│
│ Context cost  ▮▮▯  ≈ 240 tokens  ⓘ          │ Private repository?    │
│                                             │ → How to set up access │
├─────────────────────────────────────────────┴────────────────────────┤
│ CONTENTS (5)                                                         │
│ ◆ Skill  code-style          Checks code against the team's…         │
│ ◆ Skill  commit-message      …                                       │
│ ● Agent  style-reviewer      …                                       │
│ ⚡ Hook   PostToolUse · Edit|Write                                    │
│ ⬡ MCP    lint-server (stdio)                                         │
├──────────────────────────────────────────────────────────────────────┤
│ DEPENDENCIES  base-tools →                                           │
├──────────────────────────────────────────────────────────────────────┤
│ [README] [Changes]                                                   │
│ …rendered README, width ≤ 720…                                       │
└──────────────────────────────────────────────────────────────────────┘
```

- On L, the install block is pinned on the right (sticky). On S, it comes right after the plugin header, **before** the contents: copying is the primary action.
- The "settings.json" tab shows a JSON snippet (Spec F4).
- "Contents" is a compact list, not cards. Rows are clickable: in v2 they lead to the artifact page, in the MVP to GitHub with a ↗ icon.
- The "Changes" tab shows the last 5 versions, and the rest under "Show older".
- States: normal, no README ("The author has not added a description"), external source (contents unavailable, an explanation in its place), disabled by default, in configuration (button "✓ In configuration · Open"), many components (25+, grouped by type with collapsing).

### 7.3 Configuration builder (MVP)

```text
Configuration builder
Select plugins — get a ready-made settings.json or commands.

┌ Plugins ──────────────────────┐ ┌ Result ────────────────────────────┐
│ 🔍 Filter…                    │ │ [Project][User][Managed][CLI]      │
│ ☑ team-conventions  1.2.0 ⚙   │ │ File: .claude/settings.json        │
│ ☑ base-tools  ⓘ dependency    │ │ ┌────────────────────────────────┐ │
│ ☐ db-migrations    0.4.0 ⚙🌐  │ │ │{                               │ │
│ ☐ jira-bridge      2.0.1 🔑   │ │ │  "extraKnownMarketplaces": …   │ │
│ …                             │ │ └────────────────────────────────┘ │
│ Selected: 2 · ≈ 520 tok.      │ │ [⧉ Copy] [⤓ Download]              │
└───────────────────────────────┘ │ ▸ Merge with existing settings.json│
                                  │ ⚠ Good to know (3) ▾               │
                                  └────────────────────────────────────┘
```

- Below the list there is a summary: the number selected and the **total context cost**. This is the key metric for the team lead.
- An automatically added dependency is labeled "dependency of team-conventions". If the main plugin is deselected, an offer to remove the dependency as well appears.
- "Merge with existing" expands a textarea for pasting JSON. The result on the right updates, and **changed lines are highlighted** like in a diff (added — green background).
- "Good to know" — 3 items with links: trust dialog, auto-update disabled by default, access to a private repo.
- On S, the list and the result are stacked one below the other, and a "Selected: 2 · Show result ↓" bar is pinned above the result.
- States: nothing selected, several selected, with a dependency, merge mode (valid or invalid JSON), Managed tab with a "for administrators" note.

### 7.4 Artifact page (v2)

Shared header: type label, name, full id with copy, "from plugin team-conventions v1.2.0 →", a "Code on GitHub ↗" button, plugin badges.

| Type | Body |
|---|---|
| Skill / Agent / Command | Frontmatter table (key → value, long values collapse) → tabs [Description][Raw text]. "Description" is rendered Markdown, "Raw text" is a code block with copy |
| Hook | Table: Event · Matcher · Type · Command (mono, with copy). Above the table — the explanation "Hooks run automatically on Claude Code events" |
| MCP | A card for each server: name, transport (stdio / http / sse), command or URL, environment variable **names** as chips ("JIRA_TOKEN"), the note "Values are set during installation" |

On the right on L (or at the bottom on S): "Other artifacts in this plugin", up to 5.

### 7.5 What's new (v2)

- A feed grouped by month. Each item is an event (§6.13).
- Above the feed: a plugin filter (select with search), a "New plugins only" toggle, an RSS link with an icon and a button to copy the feed URL.

### 7.6 Documentation (v2)

- Left navigation with 6 documents (on S it is a select at the top), and on the right an "On this page" table of contents with heading anchors (XL only).
- Prose styles: headings with anchors on hover, tables with horizontal scroll, code blocks (§6.7), "Warning" / "Tip" callouts (in the documents they are marked as `> ⚠` and `> 💡`).

### 7.7 Create a plugin (v2)

```text
Create a plugin
┌ Form ───────────────────────────────┐ ┌ Preview ──────────────────────┐
│ Name *  [db-helper        ] ✓       │ │ plugins/db-helper/            │
│         kebab-case, no claude-…     │ │ ├─ .claude-plugin/plugin.json │
│ Title   [DB Helper        ]         │ │ ├─ skills/                    │
│ Description * [           ] 0/300   │ │ │  └─ query-review/SKILL.md   │
│ Author  [                 ]         │ │ ├─ README.md                  │
│ Keywords [sql ✕][бази даних ✕]      │ │ └─ CHANGELOG.md               │
│   ⓘ add words in Ukrainian and EN   │ │                               │
│ Components                          │ │ Entry for marketplace.json ⧉  │
│ ☑ Skill  [query-review] [+ more]    │ └───────────────────────────────┘
│ ☐ Agent  ☐ Command  ☐ Hooks  ☐ MCP  │
│ [⤓ Download zip]                    │
└─────────────────────────────────────┘
Next: 1 Unpack into the repo root → 2 claude plugin validate --strict → 3 PR
```

- Name validation is instant, with specific messages (§10). The zip button is disabled while there are errors, and next to it there is an explanation of what is missing.
- The file tree on the right updates live. On S, it sits below the form and is collapsed.
- Keywords: if all the words are in one language, a warning (not an error) appears: "Add at least one word in Ukrainian and one in English — otherwise the plugin will be harder to find".

### 7.8 ⌘K palette (v2)

A centered modal, ~640 px on L and full screen on S. Described in §6.13.

---

## 8. Interaction and keyboard

| Key | Action | Stage |
|---|---|---|
| `/` | Focus the search (on the home page) | MVP |
| `↑` `↓` | Move through results while focus is in the field | MVP |
| `Enter` | Open the highlighted result | MVP |
| `Esc` | Clear the field, close the sheet, popover, or modal | MVP |
| `c` | Copy the install command of the highlighted result | MVP |
| `⌘K` / `Ctrl+K` | Command palette | v2 |

- Key hints are shown in the interface (in the search field, at the bottom of the palette) only on devices with a physical keyboard.
- Results update while typing, with no "Search" button. Focus does not jump during updates.
- Search and filter state is kept in the URL, so "Back" returns to the previous results with the same scroll position.
- The copy action always gives feedback: the button changes state and a toast appears.

---

## 9. Accessibility

- **WCAG 2.2 AA** in both themes: text contrast ≥ 4.5:1, UI elements and field borders ≥ 3:1. This also applies to type colors on card backgrounds and to `highlight-bg` under text.
- A visible `focus-visible` on every interactive element that does not blend in with the accent color.
- Minimum touch target of 44×44 px on S, including the action buttons on the card.
- Information is not conveyed by color alone: type is shown by icon + text, the context cost level by a scale + a number.
- The number of results is announced via `aria-live="polite"` ("12 results").
- Badge popovers open from the keyboard and close with `Esc`.
- Zooming to 200% does not break the layout, and at 400% it becomes single-column.

---

## 10. Microcopy

Tone: formal "you" («ви»), short, technically precise, no emoji in interface text. Technical terms (skill, agent, hook, MCP, settings.json) are not translated.

| Key | Text |
|---|---|
| Home heading | Find a plugin, skill, or agent for Claude Code |
| Search placeholder | Describe your task: "skill for PR review" |
| Counter | 12 results / 1 result / 3 results / No results |
| Partial match | No exact matches — showing similar results |
| Empty results | No results for "{q}" |
| Request button | Request this plugin |
| Copy / done | Copy / Copied |
| Copy toast | Copied: {command} |
| Add to configuration | Add to configuration / In configuration |
| Add toast | Added {plugin}. Selected: {n} · Open configurator |
| Badges | Runs code · Network · Needs a secret · External source · Disabled by default |
| Cost | ≈ {n} tokens in every session |
| Dependency | Dependency of {plugin} |
| Trust warning | Claude Code will apply these settings only after you trust the project folder. |
| Auto-update warning | Auto-update is disabled by default for our marketplace. Turn it on in /plugin → Marketplaces. |
| Private repo | Git access to the repository is required. How to set it up → |
| Name error: case | Only lowercase Latin letters, digits, and hyphens: db-helper |
| Name error: prefix | Names starting with claude-, anthropic-, cc-plugin- are reserved |
| Name error: taken | A plugin with this name already exists |
| Invalid JSON | Couldn't read JSON: line {line}, {reason} |
| Index error | Search is temporarily unavailable. Try again |
| Configurator privacy | The pasted file is processed only in your browser and is never sent anywhere. |

Plurals: the interface must support the three Ukrainian forms (1 результат / 2–4 результати / 5+ результатів; i.e. 1 result / 2–4 results / 5+ results).

---

## 11. Content edge cases

Mockups must show what happens with:

| Case | Expected behavior |
|---|---|
| Long name without spaces (`enterprise-database-migration-assistant-pro`) | Wraps at hyphens, no truncation on the card. In a single list row — truncation with `…` and a tooltip |
| Long full id | Mono-sm, truncated in the middle: `enterprise-data…:schema-diff` |
| 300-character description | 2 lines on the card with `…`, in full on the page |
| English description in the UA interface | Normal, nothing changes |
| Plugin without a README | Placeholder (§7.2) |
| Plugin with 30 components | Grouped by type, each group shows the first 5 and "Show 12 more" |
| Hooks with 10 events | Table with horizontal scroll on S |
| 0 risk badges | The badge row takes less space, and the context cost remains |
| All 5 badges | 2 + "+3" on the card, all of them with wrapping on the plugin page |
| 1 plugin in the catalog (launch) | The home page looks complete, without empty grids |
| 200+ artifacts | Results with "Show 20 more" loading, no infinite scroll |
| Very long line in a code block | Horizontal scroll inside the block |

---

## 12. Mockup data

Use this set instead of lorem ipsum. It covers all types, risks, and edge cases.

| Plugin | Version | Contents | Risks | ≈ tokens | Keywords |
|---|---|---|---|---|---|
| `team-conventions` | 1.2.0 | 2 skills, 1 agent, hooks | Runs code | 240 | code style, стиль коду, review, рев'ю |
| `base-tools` | 3.0.1 | 4 commands | — | 120 | utilities, утиліти |
| `db-migrations` | 0.4.0 | 1 skill, 1 agent, MCP (stdio) | Runs code | 410 | database, міграції, sql |
| `jira-bridge` | 2.0.1 | 1 skill, MCP (http) | Network, Needs a secret | 180 | jira, задачі, tickets |
| `release-notes` | 1.0.0 | 1 skill | — | 60 | changelog, реліз, release notes |
| `security-audit` | 0.9.2 | 3 skills, 2 agents, hooks | Runs code, disabled by default | 1 150 | security, безпека, audit |
| `enterprise-database-migration-assistant-pro` | 0.1.0 | 28 components | All 5 | 2 400 | — (edge case) |
| `figma-sync` | — | external source | External source | — | design, дизайн |

Example artifacts for cards:
- `team-conventions:code-style` (Skill) — "Checks code against the team's style rules and suggests fixes during review."
- `team-conventions:style-reviewer` (Agent) — "A subagent that reviews PRs with a focus on readability and naming."
- `db-migrations:migration-planner` (Agent) — "Plans a safe schema migration with rollback steps."
- `jira-bridge:jira` (MCP, http) — `https://jira.example.com/mcp`, variable `JIRA_TOKEN`.
- `base-tools:changelog` (Command, invoked as `/base-tools:changelog`) — "Generates a CHANGELOG entry from commits since the last tag."

Query for the search scenario in the mockups: **«скіл для рев'ю PR»** ("skill for PR review") → chip `Type: Skill`, results: `code-style`, `security-audit:pr-check`, `release-notes:summarize-pr`.

---

## 13. Deliverables

### 13.1 Mockups

| # | Screen / state | S | L | Dark | Stage |
|---|---|---|---|---|---|
| 1 | Home with no query | ✓ | ✓ | ✓ | MVP |
| 2 | Home with results and an intent chip | ✓ | ✓ | ✓ | MVP |
| 3 | Nothing found / partial / index error | ✓ | ✓ | | MVP |
| 4 | Filter sheet | ✓ | | | MVP |
| 5 | Group by plugin | | ✓ | | MVP |
| 6 | Plugin page (normal) | ✓ | ✓ | ✓ | MVP |
| 7 | Plugin page: external source, no README, 28 components | | ✓ | | MVP |
| 8 | Risk badge popover | ✓ | ✓ | | MVP |
| 9 | Configurator: empty, 2 selected + dependency | ✓ | ✓ | ✓ | MVP |
| 10 | Configurator: merge mode (valid and invalid JSON) | | ✓ | | MVP |
| 11 | 404 | ✓ | ✓ | | MVP |
| 12 | Artifact page: skill, hook, MCP | ✓ | ✓ | | v2 |
| 13 | What's new | ✓ | ✓ | | v2 |
| 14 | Documentation | ✓ | ✓ | | v2 |
| 15 | Create a plugin: empty, with errors, valid | ✓ | ✓ | | v2 |
| 16 | ⌘K palette: empty and with results | ✓ | ✓ | ✓ | v2 |

### 13.2 Component library

All components from §6 with all states in both themes, plus a table of semantic tokens (§5.1) with values for the light and dark themes and the contrast check results.

### 13.3 Prototype

A clickable prototype of the main scenario (§1): search → card → plugin page → copy → toast. Separately — the configurator scenario: add 2 plugins from a card → open the configurator → copy the JSON.

### 13.4 Design acceptance criteria

- The main scenario takes ≤ 3 clicks from the home page to a copied command (verified on the prototype).
- On L, ≥ 4 cards are visible below the search field without scrolling.
- All text/background pairs and type colors pass AA in both themes (check report attached).
- Every component has default, hover, focus-visible, disabled (where relevant), and loading (where relevant) states.
- Every interface string in the mockups is taken from §10 or added there, with no placeholder text.
