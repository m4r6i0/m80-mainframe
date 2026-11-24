---
name: m80-faxina
description: Memory budget cleanup for the M80 template. Measures the files loaded in every conversation (the project's CLAUDE.md, ~/.claude/CLAUDE.md and RTK.md, the project's MEMORY.md) and the old session records, and PROPOSES a cleanup for the user to approve item by item. Use when the user types /m80-faxina or when the M80 Monitor warns that memory went over the limit.
---

# Memory budget cleanup (M80)

Goal: keep light what is loaded in every conversation, without deleting anything the user wants to keep. **You only propose; nothing is deleted or moved without the user's "yes" for that item.**

## 1. Measure (run it, do not estimate)

Measure and show in a table, with the limit for each one:

| File | Limit |
|---|---|
| The project's `CLAUDE.md` | 6 KB |
| `~/.claude/CLAUDE.md` + `~/.claude/RTK.md` | 4 KB |
| The project's memory `MEMORY.md` (`~/.claude/projects/<folder>/memory/MEMORY.md`, where `<folder>` is the project path with every non-alphanumeric character replaced by `-`) | 50 lines |
| memory files cited in `MEMORY.md` | each up to 40 lines |
| `.sessions/fichas/` | 5 records (m80-motor already rotates them) |

Use real commands (`wc -c`, `wc -l`, `ls`) and mark the result with `VERIFIED:`.

## 2. Propose

For each item above its limit, or that looks like junk, propose **one** concrete, numbered action:

- **Move to on-demand reading**: a long section of `CLAUDE.md` that only matters for one subject goes to `.claude/docs/<subject>.md`, and `CLAUDE.md` keeps a single line "before X, read `.claude/docs/<subject>.md`" (as is already done with `windows.md`).
- **Merge**: repeated rules, or rules that say almost the same thing, become one.
- **Delete a fulfilled reminder**: a reminder-type memory whose subject has already been resolved.
- **Update**: a memory that contradicts the current state of the project (check the code before claiming it).

Show the before and after of each item (a short excerpt) and how much it saves in bytes or lines.

## 3. Apply only what was approved

Ask which numbers the user approves. Apply only those, then measure again and show the final table with `VERIFIED:`. If nothing went over the limit, say so and do not propose changes just for the sake of it.
