import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApiUrl,
  buildLiveVisitorsStreamUrl,
  buildProjectLiveFeedStreamUrl,
} from "./api.ts";

test("browser API and SSE requests remain same-origin with a VPS loopback public variable", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldUrl = process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL;

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL = "http://127.0.0.1:3345";

    assert.equal(
      buildApiUrl("/api/overview?range_key=12h"),
      "/api/overview?range_key=12h",
    );
    assert.equal(
      buildLiveVisitorsStreamUrl({ limit: 25, windowHours: 24 }),
      "/api/live-visitors/stream?limit=25&window_hours=24",
    );
    assert.equal(
      buildProjectLiveFeedStreamUrl("aoe2hdbets", { windowHours: 24 }),
      "/api/projects/aoe2hdbets/live-feed/stream?window_hours=24",
    );
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");

    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL = oldUrl;
  }
});
