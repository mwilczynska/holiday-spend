import { describe, expect, it } from 'vitest';
import { AnthropicStreamError, readAnthropicMessageStream } from '@/lib/anthropic-message-stream';
import { anthropicEventStream } from '@/lib/anthropic-message-stream.fixtures';

const searchTurn = [
  { type: 'message_start', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 900, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Check the RBA ' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'rate first.' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-1' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} } },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"query": "RBA' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: ' USD AUD"}' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'content_block_start', index: 2, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://www.rba.gov.au/' }] } },
  { type: 'content_block_stop', index: 2 },
  { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 3, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://www.rba.gov.au/' } } },
  { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: '{"ok":' } },
  { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: 'true}' } },
  { type: 'content_block_stop', index: 3 },
  { type: 'ping' },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 412 } },
  { type: 'message_stop' },
];

describe('Anthropic message stream reader', () => {
  it('rebuilds thinking with its signature, server tool input, results and cited text', async () => {
    const message = await readAnthropicMessageStream(anthropicEventStream(searchTurn));
    expect(message.model).toBe('claude-haiku-5-5');
    expect(message.stop_reason).toBe('end_turn');
    expect(message.usage).toMatchObject({ input_tokens: 900, output_tokens: 412 });
    expect(message.content).toEqual([
      { type: 'thinking', thinking: 'Check the RBA rate first.', signature: 'sig-1' },
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'RBA USD AUD' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://www.rba.gov.au/' }] },
      { type: 'text', text: '{"ok":true}', citations: [{ type: 'web_search_result_location', url: 'https://www.rba.gov.au/' }] },
    ]);
  });

  it('reads CRLF-delimited frames', async () => {
    const text = searchTurn.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('');
    const body = new Response(text).body!;
    const message = await readAnthropicMessageStream(body);
    expect(message.content.at(-1)).toMatchObject({ type: 'text', text: '{"ok":true}' });
  });

  it('reports a stream error event', async () => {
    const events = [searchTurn[0], { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }];
    await expect(readAnthropicMessageStream(anthropicEventStream(events))).rejects.toThrow(AnthropicStreamError);
  });

  it('refuses a stream that ends before message_stop instead of returning a partial answer', async () => {
    await expect(readAnthropicMessageStream(anthropicEventStream(searchTurn.slice(0, 16))))
      .rejects.toThrow(/ended before the answer was complete/);
  });
});
