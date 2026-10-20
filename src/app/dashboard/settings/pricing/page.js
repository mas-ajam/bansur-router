"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/shared/components/Card";
import PricingModal from "@/shared/components/PricingModal";

export default function PricingSettingsPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [currentPricing, setCurrentPricing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/pricing");
      if (response.ok) {
        const data = await response.json();
        setCurrentPricing(data);
      }
    } catch (error) {
      console.error("Failed to load pricing:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePricingUpdated = () => {
    loadPricing();
  };

  // Count total models with pricing
  const getModelCount = () => {
    if (!currentPricing) return 0;
    let count = 0;
    for (const provider in currentPricing) {
      count += Object.keys(currentPricing[provider]).length;
    }
    return count;
  };

  // Get providers list
  const getProviders = () => {
    if (!currentPricing) return [];
    return Object.keys(currentPricing).sort();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 px-3.5 py-[18px] lg:p-[26px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Pricing Settings</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Configure pricing rates for cost tracking and calculations
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex h-8 items-center justify-center gap-[7px] rounded-md bg-brand-500 px-[13px] text-[13px] font-medium text-on-brand transition-opacity hover:opacity-90"
        >
          Edit Pricing
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Card>
          <div className="text-xs text-text-muted">
            Total Models
          </div>
          <div className="font-mono text-[26px] font-semibold leading-none text-text-main mt-2">
            {loading ? "..." : getModelCount()}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-text-muted">
            Providers
          </div>
          <div className="font-mono text-[26px] font-semibold leading-none text-text-main mt-2">
            {loading ? "..." : getProviders().length}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-text-muted">
            Status
          </div>
          <div className="font-mono text-[26px] font-semibold leading-none text-text-main mt-2">
            {loading ? "..." : "Active"}
          </div>
        </Card>
      </div>

      {/* Info Section */}
      <Card>
        <h2 className="text-[13.5px] font-semibold mb-3">How Pricing Works</h2>
        <div className="space-y-3 text-[13.5px] leading-relaxed text-text-muted">
          <p>
            <strong>Cost Calculation:</strong> Costs are calculated based on token usage and pricing rates.
            Each request&apos;s cost is determined by: (input_tokens × input_rate) + (output_tokens × output_rate) + (cached_tokens × cached_rate)
          </p>
          <p>
            <strong>Pricing Format:</strong> All rates are in <strong>dollars per million tokens</strong> ($/1M tokens).
            Example: An input rate of 2.50 means $2.50 per 1,000,000 input tokens.
          </p>
          <p>
            <strong>Token Types:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Input:</strong> Standard prompt tokens</li>
            <li><strong>Output:</strong> Completion/response tokens</li>
            <li><strong>Cached:</strong> Cached input tokens (typically 50% of input rate)</li>
            <li><strong>Reasoning:</strong> Special reasoning/thinking tokens (fallback to output rate)</li>
            <li><strong>Cache Creation:</strong> Tokens used to create cache entries (fallback to input rate)</li>
          </ul>
          <p>
            <strong>Custom Pricing:</strong> You can override default pricing for specific models.
            Reset to defaults anytime to restore standard rates.
          </p>
        </div>
      </Card>

      {/* Current Pricing Preview */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13.5px] font-semibold">Current Pricing Overview</h2>
          <button
            onClick={() => setShowModal(true)}
            className="text-text-main hover:underline text-[13px] font-medium"
          >
            View Full Details
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4 text-text-muted">Loading pricing data...</div>
        ) : currentPricing ? (
          <div className="space-y-3">
            {Object.keys(currentPricing).slice(0, 5).map(provider => (
              <div key={provider} className="flex items-baseline justify-between border-b border-border-subtle py-2 text-[13px] last:border-b-0">
                <span className="font-semibold">{provider.toUpperCase()}:</span>{" "}
                <span className="text-text-muted">
                  {Object.keys(currentPricing[provider]).length} models
                </span>
              </div>
            ))}
            {Object.keys(currentPricing).length > 5 && (
              <div className="text-sm text-text-muted">
                + {Object.keys(currentPricing).length - 5} more providers
              </div>
            )}
          </div>
        ) : (
          <div className="text-text-muted">No pricing data available</div>
        )}
      </Card>

      {/* Pricing Modal */}
      {showModal && (
        <PricingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handlePricingUpdated}
        />
      )}
    </div>
  );
}