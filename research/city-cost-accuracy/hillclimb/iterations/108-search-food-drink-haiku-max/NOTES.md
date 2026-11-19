# 108 Haiku 5.5 Max on Luna's 102 prompts (stopped)

Lane copy of 102 (v1.2 food/drink-search prompt) for an owner-requested comparison with GPT-6 Luna Max. Each worker
received the exact Luna worker message (`lib.mjs` `workerMessage`, the same builder `codex-task-message.mjs` uses) as
its request and the app system prompt, through `claude -p` on the owner's subscription: model `claude-haiku-5-5`,
effort max, WebSearch only, `--setting-sources ""` (no user or project instructions), ten concurrent workers
(`dispatch.mjs --message luna --clean-context`).

Stopped by the owner on 19 November 2026 at 96 of 333 cities (alphabetical, Aarhus to Gold Coast); not ingested and
not assessed. Early read on the first 67 cities, paired with 102: raw loss 0.351 vs Luna 0.341 (Luna better by 0.011,
95% CI -0.016 to 0.036, Luna better in 44 cities); with a per-anchor leave-one-out correction fitted on these cities
0.192 vs 0.180. Median 232k output tokens and 8.7 minutes per city; every answer exceeded the 128k output ceiling of
one API request, so this setting cannot run unchanged as the app's single provider call. At most six search calls.

An earlier attempt with in-session general-purpose Claude Code agents was stopped and discarded: they had WebFetch,
Grep and Read, ran over ten minutes per city and received the project's AGENTS.md. Nothing from it was saved.
