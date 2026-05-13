# Research: Existing Kanban UI Patterns

## Overview
This research surveys popular kanban tools (Linear, Trello, Notion, GitHub Projects, Plane, Asana) focusing on UI patterns relevant to our v1 implementation.

## Patterns to Adopt
- **Column Flexibility**: Most tools allow dynamic column creation and reordering; our UI should support adding/removing columns via drag‑drop.
- **Card Density Controls**: Tools like Trello provide compact card previews with optional expansion; adopt a collapsed view with hover details.
- **Keyboard Shortcuts**: Linear and Asana expose shortcuts for navigation and task creation; implement a shortcut palette (`?` for help, `c` for create task, `g p` for project switch).
- **Presence Indicators**: Plane shows avatars of active collaborators on cards; include an agent presence badge.

## Patterns to Avoid
- **Modal‑Only Detail Panels**: Asana’s full‑screen modal disrupts board context; we will use a push‑content side panel.
- **Fixed Column Widths**: Some tools lock column widths, limiting responsive layouts; our columns should be fluid.
- **Heavy Animations**: Excessive motion in drag‑and‑drop can impair performance; keep animations minimal.

## Recommendations
- Implement column addition/removal with drag‑and‑drop and a "+" affordance.
- Provide a compact card view with hover‑triggered detail expansion.
- Expose a side‑panel detail view that slides in, preserving board visibility.
- Show real‑time presence badges on cards for active agents.
- Offer a concise set of keyboard shortcuts for common actions.

## References
- Linear UI guide (internal docs)
- Trello design system
- Asana interaction patterns
