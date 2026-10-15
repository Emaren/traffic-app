import type { SessionRecord } from "./types";

/**
 * Never collapse authenticated, confirmed, or known-human visitor sessions.
 * Only classifier-confirmed nonhuman clusters can use the compact fleet card.
 */
export function isNonhumanCluster(session: SessionRecord): boolean {
  const trustedKnownHuman =
    session.known_visitor_confirmed &&
    !["known_automation", "crawler"].includes(String(session.known_visitor_kind ?? ""));

  return (
    (session.is_burst_cluster === true || session.is_network_actor_cluster === true) &&
    (session.burst_member_count ?? session.network_actor_member_count ?? 0) > 1 &&
    !session.authenticated &&
    !session.human_confirmed &&
    !trustedKnownHuman &&
    ["bot", "browser_script", "script_burst", "suspicious"].includes(session.classification_state)
  );
}
