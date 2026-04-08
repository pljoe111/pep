import type { CampaignDetailDto } from 'api-client';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatUSD } from '../../../lib/formatters';

interface OverviewTabProps {
  campaign: CampaignDetailDto;
}

interface CostItem {
  label: string;
  amount: number;
}

export const OverviewTab = ({ campaign }: OverviewTabProps) => {
  const hasDescription = !!campaign.description?.trim();

  // In the current DTO, itemization_data is unknown.
  // Based on the plan, we expect it to be an array of { label, amount } if it exists.
  const costBreakdown = Array.isArray(campaign.itemization_data)
    ? (campaign.itemization_data as CostItem[])
    : [];

  const hasCostBreakdown = campaign.is_itemized && costBreakdown.length > 0;

  if (!hasDescription && !hasCostBreakdown) {
    return <EmptyState heading="No description provided" />;
  }

  return (
    <div className="space-y-8">
      {hasDescription && (
        <div className="text-base text-text whitespace-pre-wrap leading-relaxed">
          {campaign.description}
        </div>
      )}

      {hasCostBreakdown && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-3 uppercase tracking-wide">
            Cost Breakdown
          </h3>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {costBreakdown.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-text-2">{item.label}</td>
                    <td className="px-4 py-3 text-right font-medium text-text">
                      {formatUSD(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-a">
                  <td className="px-4 py-3 font-semibold text-text">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-text">
                    {formatUSD(costBreakdown.reduce((sum, item) => sum + Number(item.amount), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
