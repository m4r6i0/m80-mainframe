# m80-motor

The engine of the M80 template v21 for Claude Code.

- **Model and effort router**: classifies each request (local shortcuts and, if needed, Haiku) and chooses once per round: sonnet/low for simple work, sonnet/medium for normal work, opus/high for complex work. Continuations ("go ahead") keep the previous choice. In a long conversation it does not downgrade the model, only the effort, so the cache is not rewritten.
- **Guard**: denies destructive commands in Bash and PowerShell (recursive rm/Remove-Item at the drive root, git push --force, git reset --hard, cloud write commands) and a `.sh` opened as a file.
- **Status bar**: state, model, effort, context, estimated cost and time, above the message box. The text form is `M80 AUTO | opus/high | ctx 42% | US$ 1.23 est.` (the cost is a client-side estimate).
- **Compaction**: asks the summary to preserve tasks, decisions, files and verifications.
- **Continuity**: writes a continuity note at 60, 75 and 85% of the context so a new conversation can resume the work.
- **Commands**: `/m80-modo auto|economico|normal|maximo|fixo`, `/m80-status`, `/m80-ficha`, `/m80-continuar` and `/m80-barra`.

## Install

```
claude plugin marketplace add %USERPROFILE%\.claude\m80\marketplace
/plugin install m80-motor@m80
```

The M80 Mainframe VS Code extension installs this plugin for you.
