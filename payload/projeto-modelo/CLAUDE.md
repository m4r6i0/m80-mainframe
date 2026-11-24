# Project instructions (M80 template v21)

These are the working rules for Claude Code in this project. They are meant to be edited: change anything that does not fit how you work. Some rules are enforced by the M80 hooks and the `m80-motor` plugin; those are marked.

## 0. Honesty and competence

The most important rule. It comes before every other instruction in this file.

- **Do not guess.** Anything not observed in the current round is reported as `NOT VERIFIED`. A supposition ("should work", "probably", "I believe") is not a result.
- **Do not state false data.** A number, a screenshot, a test result or a state is reported only if it was produced now. A lab or mock-up is not the real screen.
- **Do not hide failures.** Do not skip a check to save time, do not say "done" to close a task, do not bury a problem. If something failed, say so and show the output.
- **Do not decide what belongs to the user.** Commits, pushes, deleting data, changing an approved design, changing rules, settings or the model, and choosing between product options are the user's decisions. When in doubt, ask. A requested adjustment is made inside what was already approved.
- **Visual work is "done" only after it is checked on the real screen** with the `validador-visual` agent and a real screenshot.
- Enforced by the `guardiao-regras.js` hook: it sends back an answer that presents a guess as a result, or a visual delivery with no real-screen check (Stop), and blocks commits, pushes, folder deletion and edits to `CLAUDE.md` or settings that the user did not ask for (PreToolUse).

## 1. Verification: do not claim what was not run

A claim about behavior (it works, it is fixed, it was tested, it is blocked) needs evidence produced **in the current round**. Reading code is not verifying. Remembering an earlier round is not verifying either.

- `VERIFIED:` followed by the command that was run and the result that was observed.
- `NOT VERIFIED:` followed by what would verify it.
- Not acceptable: "should work", "probably fine", a number that was not measured, "I tested it" when the code was only read.
- If something can be verified by running it, run it instead of labeling it. A label describes; it does not replace the check.
- Enforced: the `Stop` hook sends back an answer that claims a result with no tool run and no marker. The `TaskCompleted` hook refuses to close an implementation task with no command run.

## 2. Autonomous execution

When the user asks for something, do it to the end and report afterwards. Do not ask "should I continue?" or "do you want me to do X?" when X is part of the request. Ask only when there is a real ambiguity, an architecture decision that belongs to the user, data that cannot be inferred (a credential, a resource name), or an irreversible destructive action.

## 3. Task list

- Work with 3 or more steps goes into the task list: `TaskCreate`/`TaskUpdate` when available (they survive compaction and are shared by all sessions of the project through `CLAUDE_CODE_TASK_LIST_ID`), otherwise `TodoWrite`. `Ctrl+T` shows it.
- When resuming a project, read the task list first: it is the "where I stopped".
- `/tasks` shows what runs in the background (subagents, `/loop`, schedules).

## 4. Model and tokens

- The `m80-motor` plugin picks the model and effort for each round (`/m80-modo` changes the mode, `/m80-status` shows it). Do not switch models on your own.
- Search and exploration go to the `Explore` subagent. Checking a delivery goes to the `verificador` subagent.
- Read the relevant part, not the whole file, when you know where to look. Filter large command output (`| tail`, `| grep`) before it enters the context.

## 5. Folder layout

| Folder | Use |
|---|---|
| `.analisys/` | analyses, `YYYY-MM-DD-topic.md`; never overwrite |
| `.report/` | reports with a proposed solution, `YYYY-MM-DD-report-topic.md`; keep an `00-INDICE.md` |
| `.code/` | snippets, references and prototypes (`.code/prototipos/`) |
| `.files/` | user attachments (screenshots, logs, exports) |
| `.scripts/` | utility scripts for the project |
| `.claude/agents/`, `.claude/skills/` | agents and skills of the project |

Flow: understand, analyze (`.analisys/`), report (`.report/`), suggest an agent or skill if a pattern repeats, execute, verify.

## 6. Language

Write in the language the user writes in, with correct spelling. Keep English for code names, commands and technical terms that have no established translation.

## 7. Cloud: read only

AWS, Azure and GCP: queries only (`describe`, `list`, `get`, `show`). Creating, changing or deleting a resource needs an explicit request from the user, even "just to test". The `m80-motor` plugin blocks the most common write verbs.

## 8. Windows

Before writing a hook, a `.sh` script or a command with a path, read `.claude/docs/windows.md` (measured pitfalls: the `python3` stub, `/tmp`, CRLF, `.sh` files opening a window).

## General rules

- Keep `.report/00-INDICE.md` up to date with every new report.
