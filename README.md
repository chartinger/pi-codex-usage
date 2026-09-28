# @chartinger/pi-codex-usage

A [Pi](https://pi.dev) extension showing **remaining** OpenAI Codex 5-hour and weekly quota in the TUI footer. `/codex-usage` shows both limits, relative reset times (e.g. `resets in 4d 3h 2m`), and calendar reset times in German date/time format. The footer refreshes at session start, after agent runs, and every five minutes.

## Install from GitHub

```sh
pi install git:github.com/chartinger/pi-codex-usage
```

Run `/reload` in an already-running Pi session (or start a new one). Sign in with `/login openai-codex` if you haven't already, then run `/codex-usage`.

The extension reuses Pi's Codex OAuth credential; it does not store a separate token. It sends the bearer token only to `https://chatgpt.com/backend-api/wham/usage`. This is an **undocumented** ChatGPT endpoint and its response may change. These percentages are quota remaining, **not** API billing limits.

## Tests

`npm test` (Node.js 22.19+).

MIT licensed; see [LICENSE](LICENSE).
