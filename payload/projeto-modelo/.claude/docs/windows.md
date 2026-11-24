# Windows: measured pitfalls (inherited from template v19)

Environment: Windows 10, Git Bash and PowerShell 5.1. Do not "improve" anything without measuring.

- **`python3` is fake**: it is the Microsoft Store stub (`command -v` finds it, running it exits with 49). Use `py -3` or prefer Node, which is always installed.
- **Python reads stdin as cp1252**: force UTF-8 (`sys.stdin.reconfigure(encoding='utf-8')`).
- **`jq` is not installed** on this machine. Use Node (`node -e`) for JSON.
- **`/tmp` means two things**: in Git Bash it is `%LOCALAPPDATA%\Temp`; in Node and Python it is `C:\tmp`. Use `os.tmpdir()` or `tempfile.gettempdir()`.
- **A `/c/...` path does not exist for Node**: normalize it to `c:/...`.
- **Spawning costs 40 to 150 ms**: a polling loop with an external process eats CPU. Continuous work goes inside a single process (Node, Mod).
- **No `setsid` or `flock`**: no background processes started from a hook.
- **Everything in LF**, never CRLF. `jq`, when present, writes CRLF; Git Bash's `grep` does not see the CR (use Node to count).
- **Never run a `.sh` as a file**: `.\x.sh`, `start x.sh` and `cmd /c x.sh` open `git-bash.exe` in a loose window and the output does not come back. Run `bash x.sh` through the Bash tool. The `m80-motor` blocks the other forms.
- **Quotes in `node -e` inside Bash** break easily: for scripts with quotes, write a `.js` file and run `node file.js`.
- **Performance counter names are translated** (pt-BR): use the raw WMI classes.
- **Do not use "Reload Window" in VS Code** with a Claude session open: the Claude process is a child of the extension host and dies with it. Open a new window (`code -n`).
