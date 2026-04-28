import { AlertTriangle } from 'lucide-react';
import type { WizardFormState } from '../types';
import { Card } from '../../../components/ui/Card';
import { useTests } from '../../../api/hooks/useLabs';

interface ReviewSummaryProps {
  formState: WizardFormState;
  estimatedLabCost: number;
  platformFeePercent: number;
}

export function ReviewSummary({
  formState,
  estimatedLabCost,
  platformFeePercent,
}: ReviewSummaryProps) {
  const { data: tests } = useTests();
  const amountRequested = parseFloat(formState.amountRequested) || 0;
  const ratio = estimatedLabCost > 0 ? amountRequested / estimatedLabCost : 0;
  const isRatioTooHigh = ratio > 1.5;

  const fundingThresholdUsd = amountRequested * (formState.fundingThresholdPercent / 100);
  const platformFeeUsd = fundingThresholdUsd * (platformFeePercent / 100);
  const creatorPayoutUsd = fundingThresholdUsd - platformFeeUsd;

  return (
    <div className="space-y-6">
      {/* Campaign Goal */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider">Campaign Goal</h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">Title</dt>
            <dd className="text-sm font-medium text-text">{formState.title}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-text-2 shrink-0">Description</dt>
            <dd className="text-sm font-medium text-text text-right line-clamp-2">
              {formState.description}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">Amount Requested</dt>
            <dd className="text-sm font-medium text-text">${amountRequested.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">Lock Threshold</dt>
            <dd className="text-sm font-medium text-text">{formState.fundingThresholdPercent}%</dd>
          </div>
        </dl>
      </Card>

      {/* Estimated Costs & Ratio */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
          Estimated Costs
        </h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">Estimated lab cost</dt>
            <dd className="text-sm font-medium text-text">${estimatedLabCost.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">Your ask</dt>
            <dd className="text-sm font-medium text-text">${amountRequested.toFixed(2)}</dd>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <dt className="text-sm font-semibold text-text">Ratio</dt>
            <dd className={`text-sm font-bold ${isRatioTooHigh ? 'text-warning' : 'text-text'}`}>
              {ratio.toFixed(1)}× lab cost
            </dd>
          </div>
        </dl>

        {isRatioTooHigh && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Ratio exceeds 1.5×. This may delay admin approval. Consider revising your ask or
              explaining the gap in your description.
            </p>
          </div>
        )}
      </Card>

      {/* Payout Estimate */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
          Payout Estimate
        </h3>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">
              Goal amount ({formState.fundingThresholdPercent}%)
            </dt>
            <dd className="text-sm font-medium text-text">${fundingThresholdUsd.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-text-2">Platform fee ({platformFeePercent}%)</dt>
            <dd className="text-sm font-medium text-danger">− ${platformFeeUsd.toFixed(2)}</dd>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <dt className="text-sm font-semibold text-text">You receive</dt>
            <dd className="text-sm font-bold text-primary">${creatorPayoutUsd.toFixed(2)}</dd>
          </div>
        </dl>
      </Card>

      {/* Samples */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider px-1">Samples</h3>
        {formState.samples.map((sample, idx) => (
          <Card key={sample.id} className="p-4 space-y-2">
            <div className="text-sm font-semibold text-text">
              Sample {idx + 1}: {sample.peptideName} from {sample.vendorName}
            </div>
            <div className="text-sm text-text-2">Lab: {sample.targetLabName}</div>
            <div className="text-sm text-text-2">
              Tests:{' '}
              {sample.selectedTestIds
                .map((id) => tests?.find((t) => t.id === id)?.name || id)
                .join(', ')}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
