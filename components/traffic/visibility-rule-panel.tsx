"use client";

import type { VisibilityRule } from "@/components/traffic/types";
import {
  visibilityRuleClassName,
  visibilityRuleLabel,
} from "@/components/traffic/visibility-client";

type Props = {
  rules: VisibilityRule[];
  localOnlyHiddenIps?: string[];
  onRemoveRule: (rule: VisibilityRule) => void;
  onRemoveLocalIp?: (ip: string) => void;
  title?: string;
  description?: string;
};

export default function VisibilityRulePanel({
  rules,
  localOnlyHiddenIps = [],
  onRemoveRule,
  onRemoveLocalIp,
  title = "Shared observatory hides",
  description = "These hides apply across Traffic surfaces when an admin session is present.",
}: Props) {
  const total = rules.length + localOnlyHiddenIps.length;

  if (total === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-amber-200/80">{title}</div>
          <div className="mt-1 text-sm text-amber-100/80">{description}</div>
        </div>
        <div className="rounded-full border border-amber-400/30 bg-black/20 px-3 py-1 text-xs font-medium text-amber-100">
          {total} active
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {rules.map((rule) => (
          <button
            key={`rule-${rule.id}`}
            type="button"
            onClick={() => onRemoveRule(rule)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-85 ${visibilityRuleClassName(
              rule.rule_type,
            )}`}
          >
            {visibilityRuleLabel(rule)} x
          </button>
        ))}

        {localOnlyHiddenIps.map((ip) => (
          <button
            key={`local-${ip}`}
            type="button"
            onClick={() => onRemoveLocalIp?.(ip)}
            className="cursor-pointer rounded-full border border-amber-400/30 bg-black/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-black/30"
          >
            Local IP {ip} x
          </button>
        ))}
      </div>
    </div>
  );
}
