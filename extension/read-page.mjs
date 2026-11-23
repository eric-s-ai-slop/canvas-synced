// Chrome serializes this function into the isolated world of the Canvas tab.
export async function readCanvasPage(expectedOrigin, rawURL) {
  const url = new URL(rawURL);
  if (location.origin !== expectedOrigin || url.origin !== expectedOrigin ||
      url.protocol !== "https:" || url.port || url.username || url.password ||
      !/^\/api\/v1\/courses(?:\/[1-9][0-9]{0,19}\/assignments)?$/u.test(url.pathname)) {
    return { error: "The original Canvas tab or API URL has changed." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status !== 200) return { status: response.status };
    if (!response.headers.get("content-type")?.includes("json") || !response.body) {
      return { error: "Canvas returned a non-JSON response. Check that you’re signed in." };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4 * 1024 * 1024) {
        await reader.cancel();
        return { error: "A Canvas response exceeded the 4 MiB limit." };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return { status: response.status, body: chunks.join(""), link: response.headers.get("link") };
  } catch {
    if (controller.signal.aborted) return { error: "Canvas took too long to respond." };
    return { error: "Could not reach the Canvas API. Check that you’re signed in and try again." };
  } finally {
    clearTimeout(timeout);
  }
}
