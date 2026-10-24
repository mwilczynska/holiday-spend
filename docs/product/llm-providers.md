# LLM providers

The app calls thirteen providers. Each is described as data in `src/lib/llm-provider-registry.ts`: endpoint,
request transport, web search mechanism, how reasoning effort is sent, aggregator sources for model suggestions,
and its server key variable. Production refuses every server key; users enter keys in the browser (Settings →
Provider API Keys, or any generation dialog).

## Providers

| Provider | Transport | Web search | Effort sent as |
| --- | --- | --- | --- |
| OpenAI | Responses API | `web_search` tool | `reasoning.effort` |
| Anthropic | Messages API | `web_search_20260209` (Opus/Sonnet 4.6+), else `web_search_20250305` | adaptive thinking + `output_config.effort` (4.6+), else `thinking.budget_tokens` |
| Google Gemini | generateContent | Google Search grounding | `thinkingLevel` (Gemini 3+), else `thinkingBudget` |
| xAI Grok | Responses API (`api.x.ai`) | `web_search` tool | `reasoning.effort` |
| OpenRouter | Chat Completions | `web` plugin (any model) | `reasoning.effort` |
| Groq | Chat Completions | `browser_search` tool, gpt-oss models only | `reasoning_effort` |
| Perplexity Sonar | `/v1/sonar` | always searches | not configurable |
| Mistral | Conversations API | `web_search` tool | not configurable |
| Z.ai GLM | Chat Completions | `web_search` tool | not configurable |
| DeepSeek | Chat Completions | none | `thinking` + `reasoning_effort` |
| Together AI | Chat Completions | none | `reasoning_effort` (gpt-oss) |
| Fireworks AI | Chat Completions | none | `reasoning_effort` (gpt-oss) |
| Cerebras | Chat Completions | none | `reasoning_effort` (gpt-oss) |

City generation (v1.1 and v1.2) requires a live FX lookup, so its pickers list only providers with web search and
the server rejects an answer that shows no search evidence. Transport estimates on a provider without web search
fall back to the existing labelled ungrounded answer. Qwen (Alibaba Model Studio) and Moonshot Kimi were left out:
Qwen's international endpoint now needs a per-workspace URL, and Kimi's search needs a client-side tool loop.

## Default models

Each provider defaults to its cheap, fast, recent model. `npm run models:refresh` chooses it from models.dev release
dates and prices using the family rules in `src/lib/model-default-selection.ts`, writes it to
`src/lib/data/curated-models.generated.json`, and records the default it replaced under `retiredDefaults` so saved
selections of it migrate. OpenRouter mirrors the OpenAI default. On 23 October 2026 the refresh chose:

| Provider | Default | Rule |
| --- | --- | --- |
| OpenAI | `gpt-6-luna` | newest Luna |
| Anthropic | `claude-haiku-5-5` | newest Haiku |
| Google Gemini | `gemini-3.5-flash-lite` | newest Flash-Lite |
| xAI | `grok-4.3` | cheapest Grok |
| OpenRouter | `openai/gpt-6-luna` | mirrors OpenAI |
| Groq | `openai/gpt-oss-20b` | cheapest gpt-oss (web search) |
| Perplexity | `sonar` | Sonar |
| Mistral | `mistral-small-2603` | newest Mistral Small |
| Z.ai | `glm-5.3-flash` | newest GLM Flash |
| DeepSeek | `deepseek-flash` | current Flash alias |
| Together | `deepseek-ai/DeepSeek-V4.1-Flash` | newest DeepSeek Flash |
| Fireworks | `accounts/fireworks/models/deepseek-v4p1-flash` | newest DeepSeek Flash |
| Cerebras | `gpt-oss-120b` | cheapest gpt-oss |

The v1.2 accuracy figures were measured with `gpt-6-luna`; other defaults are unmeasured for city costs.

## Reasoning effort

`npm run models:refresh` writes `src/lib/data/model-reasoning-efforts.generated.json` from OpenRouter's public
model list, which publishes each model's supported efforts. `getModelReasoningEfforts` uses that table, falls back
to family rules for models it does not list, and removes efforts the provider's request format cannot express.
The server sends an effort only when the selected model accepts it.

## Evidence (23 October 2026)

No provider was called with a real key. What was checked:

- Request shapes and response parsing for every transport are unit-tested against documented responses
  (`src/lib/llm-provider-transports.test.ts`).
- Unauthenticated requests reached every endpoint and returned an authentication error (401/403), confirming the
  URLs. xAI validates the body before authentication, and accepted the exact Responses body the app sends
  (`web_search` tool, `tool_choice`, `reasoning`). Fireworks validates the model before authentication and found
  `accounts/fireworks/models/gpt-oss-120b`.
- Model suggestions for every provider load without a key from OpenRouter or models.dev.
- Search-evidence detection for the new providers follows their documentation and is unverified against live
  responses: xAI output items or citations, OpenRouter `url_citation` annotations, Groq `executed_tools`,
  Perplexity `search_results`, Mistral `tool.execution` entries, and Z.ai's top-level `web_search` array. If a
  detector is wrong, city generation fails closed with "did not perform the required live FX lookup".

Sources: OpenAI GPT-6 guide (developers.openai.com/api/docs/guides/latest-model), xAI search tools and reasoning
guides (docs.x.ai), Groq browser search (console.groq.com/docs/browser-search), OpenRouter web search and reasoning
tokens guides (openrouter.ai/docs), Perplexity Sonar reference (docs.perplexity.ai), Mistral web search and
Conversations API (docs.mistral.ai), Z.ai web search (docs.z.ai), DeepSeek API docs (api-docs.deepseek.com),
Gemini thinking (ai.google.dev/gemini-api/docs/thinking), Anthropic Claude API reference.

## Testing with little or no spend

Free or trial tiers can exercise some providers end to end; terms change, so check each before relying on it.
Google AI Studio keys have a free tier that includes limited Search grounding. Groq offers a free tier. OpenRouter
lists `:free` models, but its web plugin is billed even on free models. Mistral and Z.ai offer free plans or models
for experimentation. A one-city generation is a few cents on most paid providers.
