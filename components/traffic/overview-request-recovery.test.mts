import assert from "node:assert/strict";
import test from "node:test";

import { fetchOverviewRange } from "./api.ts";

test("concurrent browser overview loads use one request and errors are not cached", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  let requests = 0;
  let finish: ((response: Response) => void) | undefined;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requests += 1;
      assert.equal(String(input), "/api/overview?range_key=12h");
      if (requests === 1) {
        return await new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return new Response(JSON.stringify({ ok: true, range_key: "12h" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const first = fetchOverviewRange("12h");
    const second = fetchOverviewRange("12h");
    assert.equal(requests, 1, "overlapping homepage and graph requests share a fetch");

    assert.ok(finish);
    finish(new Response("upstream unavailable", { status: 502 }));
    await assert.rejects(first, /API request failed: 502/);
    await assert.rejects(second, /API request failed: 502/);

    const recovered = await fetchOverviewRange("12h");
    assert.equal(recovered.ok, true);
    assert.equal(requests, 2, "failed fetch must not poison the next attempt");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
