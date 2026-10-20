"use client";

import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

export default function OverviewCards({ stats }) {
  const cards = [
    { label: "Total Requests", value: fmt(stats.totalRequests), title: fmt(stats.totalRequests) },
    { label: "Total Input Tokens", value: fmt(stats.totalPromptTokens), title: fmt(stats.totalPromptTokens) },
    { label: "Cached Tokens", value: fmt(stats.totalCachedTokens), title: fmt(stats.totalCachedTokens) },
    { label: "Output Tokens", value: fmt(stats.totalCompletionTokens), title: fmt(stats.totalCompletionTokens) },
    { label: "Est. Cost", value: `~${fmtCost(stats.totalCost)}`, title: `~${fmtCost(stats.totalCost)}`, delta: "Estimated, not actual billing" },
  ];
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label} className="flex min-w-0 flex-col">
          <span className="text-xs text-text-muted font-medium mb-2">{c.label}</span>
          <span className="w-full truncate font-mono text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]" title={c.title}>{c.value}</span>
          {c.delta && <span className="text-xs text-text-muted mt-[7px]">{c.delta}</span>}
        </Card>
      ))}
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
