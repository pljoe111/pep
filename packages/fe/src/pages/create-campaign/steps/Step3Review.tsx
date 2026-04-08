import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { CreateCampaignDto, SampleInputDto, SampleClaimInputDto, ClaimKind } from 'api-client';
import type { WizardFormState } from '../types';
import { ReviewSummary } from '../components/ReviewSummary';
import { VerificationCodeBox } from '../components/VerificationCodeBox';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useCreateCampaign, useVerificationCode } from '../../../api/hooks/useCampaigns';
import { useAppInfo } from '../../../api/hooks/useAppInfo';
import { useToast } from '../../../hooks/useToast';

interface Step3ReviewProps {
  formState: WizardFormState;
  estimatedLabCost: number;
  onBack: () => void;
  onSuccess: (campaignId: string) => void;
}

export function Step3Review({ formState, estimatedLabCost, onBack, onSuccess }: Step3ReviewProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const { data: verificationData, isLoading: isLoadingCode } = useVerificationCode();
  const createCampaign = useCreateCampaign();
  const toast = useToast();
  const { data: appInfo } = useAppInfo();
  const platformFeePercent = appInfo?.platform_fee_percent ?? 5;

  const amountRequested = parseFloat(formState.amountRequested) || 0;
  const ratio = estimatedLabCost > 0 ? amountRequested / estimatedLabCost : 0;
  const isRatioTooHigh = ratio > 1.5;

  const handleSubmit = () => {
    const payload: CreateCampaignDto = {
      title: formState.title,
      description: formState.description,
      amount_requested_usd: amountRequested,
      funding_threshold_percent: formState.fundingThresholdPercent,
      samples: formState.samples.map(
        (s): SampleInputDto => ({
          vendor_name: s.vendorName,
          vendor_id: s.vendorId || undefined,
          peptide_id: s.peptideId || undefined,
          purchase_date: s.purchaseDate,
          physical_description: s.physicalDescription,
          sample_label: s.label,
          target_lab_id: s.targetLabId,
          tests: s.selectedTestIds.map((id) => ({ test_id: id })),
          claims: s.claims.map(
            (c): SampleClaimInputDto => ({
              claim_type: c.type as ClaimKind,
              // Map values based on type if needed, but for now we follow the DTO
              // Note: The common DTO has specific fields for each type.
              // Our ClaimForm seems to have a generic value string.
              // We might need to refine this mapping if the backend expects specific fields.
              // For now, we'll try to match the DTO as best as we can.
              ...(c.type === 'purity' ? { purity_percent: parseFloat(c.value) } : {}),
              ...(c.type === 'mass' ? { mass_amount: parseFloat(c.value), mass_unit: 'mg' } : {}),
              ...(c.type === 'other' ? { other_description: c.value } : {}),
            })
          ),
        })
      ),
    };

    createCampaign.mutate(payload, {
      onSuccess: (data) => {
        toast.success('Campaign created successfully!');
        onSuccess(data.id);
      },
      onError: (error: unknown) => {
        setIsConfirmModalOpen(false);
        let message = 'Failed to create campaign';
        if (error && typeof error === 'object' && 'response' in error) {
          const response = (error as { response: { data?: { message?: string } } }).response;
          if (response?.data?.message) {
            message = response.data.message;
          }
        } else if (error instanceof Error) {
          message = error.message;
        }
        toast.error(message);
      },
    });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-text">Review & Confirm</h2>
        <p className="text-text-2">
          Please review your campaign details carefully. Once created, samples and tests cannot be
          changed.
        </p>
      </div>

      <ReviewSummary
        formState={formState}
        estimatedLabCost={estimatedLabCost}
        platformFeePercent={platformFeePercent}
      />

      {verificationData?.code && <VerificationCodeBox code={verificationData.code.toString()} />}

      <div className="space-y-3 pt-4">
        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={isRatioTooHigh || isLoadingCode || createCampaign.isPending}
          loading={createCampaign.isPending}
          onClick={() => setIsConfirmModalOpen(true)}
        >
          Create Campaign
        </Button>

        <Button
          variant="ghost"
          fullWidth
          size="lg"
          onClick={onBack}
          disabled={createCampaign.isPending}
          className="flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Samples
        </Button>
      </div>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !createCampaign.isPending && setIsConfirmModalOpen(false)}
        title={`Create "${formState.title}"?`}
      >
        <div className="space-y-6">
          <div className="p-4 bg-primary-l/30 rounded-xl flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-text leading-relaxed">
              Samples and tests cannot be changed after creation. Ensure all details are correct.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-text uppercase tracking-wider">Summary</h4>
            <ul className="space-y-2">
              <li className="text-sm text-text-2 flex justify-between">
                <span>Samples</span>
                <span className="font-medium text-text">{formState.samples.length} samples</span>
              </li>
              <li className="text-sm text-text-2 flex justify-between">
                <span>Target Labs</span>
                <span className="font-medium text-text">
                  {new Set(formState.samples.map((s) => s.targetLabId)).size} lab(s)
                </span>
              </li>
              <li className="text-sm text-text-2 flex justify-between">
                <span>Unlock Goal</span>
                <span className="font-medium text-text">
                  ${(amountRequested * (formState.fundingThresholdPercent / 100)).toFixed(2)}
                </span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={createCampaign.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleSubmit}
              loading={createCampaign.isPending}
            >
              Create Campaign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
