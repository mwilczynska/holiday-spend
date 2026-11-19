/** Test helper: an Anthropic SSE body from events, split into awkward chunks so frame reassembly is exercised. */
export function anthropicEventStream(events: unknown[], chunkSize = 37) {
  const text = events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  });
}
