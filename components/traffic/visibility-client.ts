"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createVisibilityRule,
  deleteVisibilityRule,
  fetchVisibilityRules,
} from "@/components/traffic/api";
import type { SessionRecord, VisibilityRule } from "@/components/traffic/types";
import {
  TRAFFIC_HIDDEN_IPS_KEY,
  loadStoredStringArray,
  storeStringArray,
} from "@/components/traffic/view-preferences";

const DEFAULT_VISIBILITY_REASON = "Hidden from Traffic observatory surfaces";

export function visibilityRuleLabel(rule: VisibilityRule): string {
  switch (rule.rule_type) {
    case "ip":
      return `IP ${rule.label || rule.match_value}`;
    case "path":
      return `Path ${rule.label || rule.match_value}`;
    case "project_slug":
      return `Project ${rule.label || rule.match_value}`;
    case "host":
      return `Host ${rule.label || rule.match_value}`;
    default:
      return rule.label || rule.match_value;
  }
}

export function visibilityRuleClassName(ruleType: VisibilityRule["rule_type"]): string {
  switch (ruleType) {
    case "ip":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    case "path":
      return "border-rose-400/30 bg-rose-400/10 text-rose-100";
    case "project_slug":
      return "border-sky-400/30 bg-sky-400/10 text-sky-100";
    case "host":
      return "border-slate-400/30 bg-slate-400/10 text-slate-100";
    default:
      return "border-white/10 bg-black/20 text-white/75";
  }
}

export function sessionMatchesVisibilityRule(
  session: SessionRecord,
  rule: VisibilityRule,
): boolean {
  switch (rule.rule_type) {
    case "ip":
      return session.ip === rule.match_value;
    case "project_slug":
      return session.project_slug === rule.match_value;
    case "host":
      return session.host === rule.match_value;
    case "path":
      return (
        session.entry_page === rule.match_value ||
        session.current_page === rule.match_value ||
        session.exit_page === rule.match_value ||
        session.page_sequence.includes(rule.match_value)
      );
    default:
      return false;
  }
}

export function sessionHiddenByVisibilityRules(
  session: SessionRecord,
  rules: VisibilityRule[],
  hiddenIps: string[],
): boolean {
  if (hiddenIps.includes(session.ip)) {
    return true;
  }

  return rules.some(
    (rule) => rule.rule_type !== "ip" && sessionMatchesVisibilityRule(session, rule),
  );
}

export function useTrafficVisibilityRules() {
  const [visibilityRules, setVisibilityRules] = useState<VisibilityRule[] | null>(null);
  const [hiddenIps, setHiddenIps] = useState<string[]>(() =>
    loadStoredStringArray(TRAFFIC_HIDDEN_IPS_KEY),
  );

  useEffect(() => {
    let mounted = true;

    void fetchVisibilityRules()
      .then((response) => {
        if (!mounted) return;
        setVisibilityRules(response.rules.filter((rule) => rule.active));
      })
      .catch(() => {
        if (!mounted) return;
        setVisibilityRules(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    storeStringArray(TRAFFIC_HIDDEN_IPS_KEY, hiddenIps);
  }, [hiddenIps]);

  const activeVisibilityRules = useMemo(
    () => (visibilityRules ?? []).filter((rule) => rule.active),
    [visibilityRules],
  );
  const serverHiddenIps = useMemo(
    () =>
      activeVisibilityRules
        .filter((rule) => rule.rule_type === "ip")
        .map((rule) => rule.match_value),
    [activeVisibilityRules],
  );
  const serverHiddenIpSet = useMemo(() => new Set(serverHiddenIps), [serverHiddenIps]);
  const effectiveHiddenIps = useMemo(
    () => [...new Set([...serverHiddenIps, ...hiddenIps])],
    [hiddenIps, serverHiddenIps],
  );
  const localOnlyHiddenIps = useMemo(
    () => hiddenIps.filter((ip) => !serverHiddenIpSet.has(ip)),
    [hiddenIps, serverHiddenIpSet],
  );

  const upsertVisibilityRule = async (payload: {
    rule_type: VisibilityRule["rule_type"];
    match_value: string;
    label?: string;
    reason?: string;
  }): Promise<VisibilityRule | null> => {
    const matchValue = payload.match_value.trim();
    if (!matchValue) {
      return null;
    }

    if (payload.rule_type === "ip") {
      setHiddenIps((current) => (current.includes(matchValue) ? current : [...current, matchValue]));
    }

    const existingRule = activeVisibilityRules.find(
      (rule) => rule.rule_type === payload.rule_type && rule.match_value === matchValue,
    );
    if (existingRule) {
      return existingRule;
    }

    if (visibilityRules === null) {
      return null;
    }

    try {
      const response = await createVisibilityRule({
        rule_type: payload.rule_type,
        match_value: matchValue,
        label: payload.label?.trim() || matchValue,
        reason: payload.reason?.trim() || DEFAULT_VISIBILITY_REASON,
      });
      setVisibilityRules((current) => [
        response.rule,
        ...(current ?? []).filter((rule) => rule.id !== response.rule.id),
      ]);
      return response.rule;
    } catch {
      return null;
    }
  };

  const removeVisibilityRule = async (rule: VisibilityRule) => {
    if (rule.rule_type === "ip") {
      setHiddenIps((current) => current.filter((ip) => ip !== rule.match_value));
    }

    if (visibilityRules === null) {
      return;
    }

    try {
      await deleteVisibilityRule(rule.id);
      setVisibilityRules((current) => (current ?? []).filter((item) => item.id !== rule.id));
    } catch {}
  };

  const unhideIp = async (ip: string) => {
    setHiddenIps((current) => current.filter((value) => value !== ip));

    const matchingRule = activeVisibilityRules.find(
      (rule) => rule.rule_type === "ip" && rule.match_value === ip,
    );
    if (!matchingRule) {
      return;
    }

    await removeVisibilityRule(matchingRule);
  };

  return {
    supportsSharedRules: visibilityRules !== null,
    activeVisibilityRules,
    effectiveHiddenIps,
    localOnlyHiddenIps,
    upsertVisibilityRule,
    removeVisibilityRule,
    unhideIp,
  };
}
