/**
 * Reads an Anthropic Messages API server-sent event stream into the message it describes.
 *
 * City generation streams Anthropic requests for two reasons. A streamed response sends its headers at once, so a long
 * request (high reasoning effort, several searches) is not cut off by the HTTP client's 300-second header timeout,
 * which a non-streaming request reaches before the model finishes. And the rebuilt content blocks are byte-for-byte
 * what the API expects back when a `pause_turn` is resumed: thinking text with its signature, server tool inputs and
 * search results, and text with its citations.
 */
export type AnthropicContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
  signature?: string;
  input?: unknown;
  citations?: unknown[];
  [key: string]: unknown;
};

export interface AnthropicMessage {
  model?: string;
  content: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number; [key: string]: unknown };
}

type StreamEvent = {
  type?: string;
  index?: number;
  message?: Partial<AnthropicMessage>;
  content_block?: AnthropicContentBlock;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    signature?: string;
    partial_json?: string;
    citation?: unknown;
    stop_reason?: string | null;
  };
  usage?: Record<string, unknown>;
  error?: { type?: string; message?: string };
};

export class AnthropicStreamError extends Error {
  constructor(message: string, readonly errorType?: string) {
    super(message);
    this.name = 'AnthropicStreamError';
  }
}

function applyEvent(message: AnthropicMessage, partialJson: Map<number, string>, event: StreamEvent) {
  switch (event.type) {
    case 'message_start':
      if (event.message?.model) message.model = event.message.model;
      if (event.message?.usage) message.usage = { ...event.message.usage };
      return;
    case 'content_block_start':
      if (event.index !== undefined && event.content_block) message.content[event.index] = structuredClone(event.content_block);
      return;
    case 'content_block_delta': {
      const block = event.index !== undefined ? message.content[event.index] : undefined;
      const delta = event.delta;
      if (!block || !delta) return;
      if (delta.type === 'text_delta') block.text = (block.text ?? '') + (delta.text ?? '');
      else if (delta.type === 'thinking_delta') block.thinking = (block.thinking ?? '') + (delta.thinking ?? '');
      else if (delta.type === 'signature_delta') block.signature = delta.signature;
      else if (delta.type === 'input_json_delta') partialJson.set(event.index!, (partialJson.get(event.index!) ?? '') + (delta.partial_json ?? ''));
      else if (delta.type === 'citations_delta') (block.citations ??= []).push(delta.citation);
      return;
    }
    case 'content_block_stop': {
      const json = event.index !== undefined ? partialJson.get(event.index) : undefined;
      const block = event.index !== undefined ? message.content[event.index] : undefined;
      if (block && json !== undefined) {
        // An empty input streams no JSON at all; anything else must parse, or the block cannot be sent back.
        block.input = json.trim() ? JSON.parse(json) : {};
        partialJson.delete(event.index!);
      }
      return;
    }
    case 'message_delta':
      if (event.delta && 'stop_reason' in event.delta) message.stop_reason = event.delta.stop_reason;
      if (event.usage) message.usage = { ...message.usage, ...event.usage };
      return;
    case 'error':
      throw new AnthropicStreamError(event.error?.message ?? 'The Anthropic stream reported an error.', event.error?.type);
    default:
      return; // ping, message_stop and event types added later carry nothing this reader needs.
  }
}

/** Consumes the whole stream. Throws if the stream reports an error or ends before `message_stop`. */
export async function readAnthropicMessageStream(body: ReadableStream<Uint8Array>): Promise<AnthropicMessage> {
  const message: AnthropicMessage = { content: [] };
  const partialJson = new Map<number, string>();
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  let stopped = false;

  const handleFrame = (frame: string) => {
    const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    const event = JSON.parse(data) as StreamEvent;
    if (event.type === 'message_stop') stopped = true;
    applyEvent(message, partialJson, event);
  };

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.search(/\r?\n\r?\n/);
    while (boundary !== -1) {
      handleFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(buffer.slice(boundary).match(/^\r?\n\r?\n/)![0].length + boundary);
      boundary = buffer.search(/\r?\n\r?\n/);
    }
    if (done) break;
  }
  if (buffer.trim()) handleFrame(buffer);
  if (!stopped) throw new AnthropicStreamError('The Anthropic stream ended before the answer was complete.');
  message.content = message.content.filter(Boolean);
  return message;
}
