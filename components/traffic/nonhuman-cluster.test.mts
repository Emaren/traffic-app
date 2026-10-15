import assert from "node:assert/strict";
import test from "node:test";
import { isNonhumanCluster } from "./nonhuman-cluster.ts";
import type { SessionRecord } from "./types";

const swarm = {
  classification_state: "browser_script",
  is_burst_cluster: true,
  burst_member_count: 200,
  known_visitor_confirmed: false,
  authenticated: false,
  human_confirmed: false,
} as SessionRecord;

test("the distributed nonhuman fleet renders as a compact group", () => {
  assert.equal(isNonhumanCluster(swarm), true);
});

test("human or authenticated sessions never disappear into a group", () => {
  for (const override of [
    { classification_state: "human_confirmed" },
    { classification_state: "likely_human" },
    { authenticated: true },
    { human_confirmed: true },
    { known_visitor_confirmed: true, known_visitor_kind: "known_player" },
  ]) {
    assert.equal(isNonhumanCluster({ ...swarm, ...override } as SessionRecord), false);
  }
});

test("explicitly known crawlers can still be grouped", () => {
  assert.equal(isNonhumanCluster({
    ...swarm,
    classification_state: "bot",
    known_visitor_confirmed: true,
    known_visitor_kind: "crawler",
  }), true);
});

test("one-off visitors, empty clusters and ambiguous candidates stay separate", () => {
  assert.equal(isNonhumanCluster({ ...swarm, burst_member_count: 1 }), false);
  assert.equal(isNonhumanCluster({ ...swarm, is_burst_cluster: false }), false);
  assert.equal(isNonhumanCluster({ ...swarm, classification_state: "candidate" }), false);
});
