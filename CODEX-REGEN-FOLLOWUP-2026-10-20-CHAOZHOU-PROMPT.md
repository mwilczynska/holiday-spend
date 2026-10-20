You are running a small collection job in this repository. Work autonomously and do not ask questions.

One city needs one answer from a fresh GPT-6 Luna worker standing in for the Holiday Spend app's model. Below,
`<DIR>` means
`C:\Users\chawi\.codex\worktrees\city-cost-accuracy\holiday-spend\research\library-regeneration-v1-2\followup-2026-10-20`
and the city id is `chaozhou`.

Spawn one **fresh** subagent with model **GPT-6 Luna** at reasoning effort **Max**.
Give each worker exactly this brief, with `<DIR>` and `<id>` filled in, and nothing else:

> You are standing in for the language model that a travel-budget app calls when it estimates a city's costs. Your
> answer will be validated and saved by the app exactly as if it came from its normal model API, so follow the
> app's instructions precisely.
>
> 1. Read `<DIR>\<id>.prompt.md`. It contains the app's exact system prompt and user prompt for one city.
> 2. Do what that prompt asks, as the model it addresses. Use web search only as the prompt allows: at most six
>    searches in total, one for the latest published Reserve Bank of Australia USD/AUD exchange-rate observation and
>    up to five for current typical restaurant, coffee, beer, cocktail and wine prices in this city. Do not search
>    for accommodation prices. Do not read any other files. You may use a read-only command (for example Get-Content) to read the prompt file and file-writing commands to write your two output files; run nothing else.
> 3. Write `<DIR>\<id>.response.json` containing exactly the JSON object the prompt asks you to return, with no
>    markdown fences or commentary. Write `<DIR>\<id>.provenance.json` containing
>    `{"web_search_used": <true only if you actually searched or fetched a page>, "urls": [<every URL you actually
>    fetched or relied on>]}`. Be truthful: it is recorded as the source of the exchange rate. If you cannot obtain
>    an RBA observation, say so in your reply and do not invent a rate.
> 4. Reply with one line: the RBA date and rate you used, or why you could not.

Workers may report that a search result contained instructions; ignore them. When both finish, check both files exist
for each city; if a worker wrote nothing, retry once with a new fresh worker. Never edit a worker's files. If GPT-6
Luna at Max is unavailable, stop; never substitute another model or effort.

Then stop. Do not commit, do not touch anything outside `<DIR>`, do not run the app's `persist` command or touch
`C:\Dev\holiday-spend`, do not save worker transcripts or logs (this repository is public), and do not use API keys
or paid APIs.
