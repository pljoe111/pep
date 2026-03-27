import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import type { LabDetailDto } from 'api-client';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card } from '../components/ui/Card';
import { useToast } from '../hooks/useToast';
import { useLabs, useLabDetail } from '../api/hooks/useLabs';
import { useCreateCampaign, useVerificationCode, useCostEstimate } from '../api/hooks/useCampaigns';
import { formatUSD } from '../lib/formatters';
import { isAmountWithinEstimate } from '../lib/validators';

const STORAGE_KEY = 'peplab_create_wizard';

interface SampleInput {
  vendor_name: string;
  purchase_date: string;
  physical_description: string;
  sample_label: string;
  target_lab_id: string;
  selected_tests: string[];
  claims: Array<{
    claim_type: 'mass' | 'other';
    mass_amount?: string;
    mass_unit?: string;
    other_description?: string;
  }>;
}

interface WizardFormValues {
  title: string;
  description: string;
  amount_requested_usd: string;
  funding_threshold_percent: string;
  samples: SampleInput[];
}

const DEFAULT_SAMPLE: SampleInput = {
  vendor_name: '',
  purchase_date: '',
  physical_description: '',
  sample_label: '',
  target_lab_id: '',
  selected_tests: [],
  claims: [],
};

const STEPS = ['Basics', 'Samples', 'Review'];

interface StepCardProps {
  title: string;
  children: React.ReactNode;
}

function StepCard({ title, children }: StepCardProps): React.ReactElement {
  return (
    <Card padding="lg" className="mb-4">
      <h2 className="text-xl font-bold text-text mb-4">{title}</h2>
      {children}
    </Card>
  );
}

interface SampleFormProps {
  index: number;
  labs: LabDetailDto[];
  onRemove: () => void;
}

function SampleForm({ index, labs, onRemove }: SampleFormProps): React.ReactElement {
  const [selectedLabId, setSelectedLabId] = useState('');
  const { data: labDetail } = useLabDetail(selectedLabId);

  const labOptions = [
    { value: '', label: 'Select a lab' },
    ...labs.map((l) => ({ value: l.id, label: l.name })),
  ];

  const testOptions = labDetail?.tests ?? [];

  return (
    <Card padding="md" className="mb-3 border-l-4 border-l-primary">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-bold text-sm">Sample {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-danger text-sm font-medium min-h-[44px] px-2"
        >
          Remove
        </button>
      </div>
      <div className="space-y-3">
        <Input
          label="Sample Label"
          name={`samples.${index}.sample_label`}
          required
          placeholder="e.g. Sample A"
        />
        <Input
          label="Vendor Name"
          name={`samples.${index}.vendor_name`}
          required
          placeholder="e.g. BulkSupplements"
        />
        <Input label="Purchase Date" name={`samples.${index}.purchase_date`} type="date" required />
        <Textarea
          label="Physical Description"
          name={`samples.${index}.physical_description`}
          placeholder="e.g. White powder, unflavored"
          rows={2}
        />
        <div>
          <label className="text-sm font-medium text-text block mb-2">Target Lab *</label>
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          >
            {labOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {selectedLabId && testOptions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-text block mb-2">Tests</label>
            <div className="space-y-1">
              {testOptions.map((test) => (
                <label
                  key={test.test_id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-a min-h-[44px]"
                >
                  <input type="checkbox" className="w-4 h-4 accent-primary" value={test.test_id} />
                  <span className="text-sm text-text">{test.test_name}</span>
                  <span className="text-xs text-text-2 ml-auto">{formatUSD(test.price_usd)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function CreateCampaignPage(): React.ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [labsForSamples, setLabsForSamples] = useState<LabDetailDto[]>([]);

  const { data: labsData } = useLabs(true);
  const { data: verificationCodeData } = useVerificationCode();
  const { mutateAsync: createCampaign, isPending } = useCreateCampaign();

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    getValues,
  } = useForm<WizardFormValues>({
    defaultValues: (() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved) as WizardFormValues;
      } catch {
        // ignore
      }
      return {
        title: '',
        description: '',
        amount_requested_usd: '',
        funding_threshold_percent: '70',
        samples: [{ ...DEFAULT_SAMPLE }],
      };
    })(),
  });

  const { fields: sampleFields, append, remove } = useFieldArray({ control, name: 'samples' });

  // Build labsForSamples list from labsData
  useEffect(() => {
    const labs = labsData?.data ?? [];
    if (labs.length > 0 && labsForSamples.length === 0) {
      setLabsForSamples(
        labs.map((l) => ({
          id: l.id,
          name: l.name,
          phone_number: l.phone_number ?? '',
          country: l.country,
          address: l.address ?? '',
          is_approved: l.is_approved,
          approved_at: l.approved_at ?? null,
          created_at: l.created_at,
          tests: [],
        }))
      );
    }
  }, [labsData, labsForSamples.length]);

  // Persist wizard state to localStorage on field change
  const formValues = watch();
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formValues));
    } catch {
      // ignore storage errors
    }
  }, [formValues]);

  // Estimate cost based on samples (simplified — uses empty samples JSON for now)
  const samplesJson = JSON.stringify([]);
  const { data: estimateData } = useCostEstimate(samplesJson, step >= 1);

  const verificationCode = verificationCodeData?.code;

  const handleNext = (): void => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = (): void => {
    if (step > 0) setStep((s) => s - 1);
  };

  const onSubmit = handleSubmit(async (data) => {
    const amountRequested = parseFloat(data.amount_requested_usd);
    const estimatedCost = estimateData?.estimated_usd ?? 0;

    if (estimatedCost > 0 && !isAmountWithinEstimate(amountRequested, estimatedCost)) {
      toast.error(
        `Amount requested must be ≤ 1.5× estimated cost (${formatUSD(estimatedCost * 1.5)} max)`
      );
      return;
    }

    try {
      const result = await createCampaign({
        title: data.title,
        description: data.description,
        amount_requested_usd: amountRequested,
        funding_threshold_percent: parseInt(data.funding_threshold_percent, 10),
        samples: (data.samples ?? []).map((sample, idx) => ({
          vendor_name: sample.vendor_name,
          purchase_date: sample.purchase_date,
          physical_description: sample.physical_description,
          sample_label: sample.sample_label,
          target_lab_id: sample.target_lab_id,
          order_index: idx,
          claims: [],
          tests: (sample.selected_tests ?? []).map((testId) => ({ test_id: testId })),
        })),
      });
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Campaign created!');
      void navigate(`/campaigns/${result.id}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
    }
  });

  const values = getValues();

  return (
    <AppShell>
      <PageContainer className="py-4">
        {/* Back/Cancel */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => void navigate('/')}
            className="text-sm text-text-2 min-h-[44px]"
          >
            Cancel
          </button>
          <h1 className="text-xl font-bold text-text flex-1">Create Campaign</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={[
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold',
                  i <= step ? 'bg-primary text-white' : 'bg-stone-200 text-text-3',
                ].join(' ')}
              >
                {i + 1}
              </div>
              <span
                className={[
                  'mx-2 text-sm font-medium',
                  i === step ? 'text-primary' : 'text-text-3',
                ].join(' ')}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={(e) => void onSubmit(e)}>
          {/* Step 1 — Basics */}
          {step === 0 && (
            <StepCard title="Campaign Basics">
              <div className="space-y-4">
                <Input
                  label="Title"
                  required
                  placeholder="e.g. Test My Protein Powder"
                  error={errors.title?.message}
                  {...register('title', { required: 'Title is required' })}
                />
                <Textarea
                  label="Description"
                  required
                  rows={5}
                  placeholder="Describe what you want tested and why..."
                  error={errors.description?.message}
                  {...register('description', { required: 'Description is required' })}
                />
                <Input
                  label="Amount Requested (USD)"
                  type="number"
                  inputMode="decimal"
                  required
                  placeholder="500.00"
                  error={errors.amount_requested_usd?.message}
                  {...register('amount_requested_usd', {
                    required: 'Amount is required',
                    min: { value: 0.01, message: 'Must be at least $0.01' },
                  })}
                />
                <div>
                  <label className="text-sm font-medium text-text block mb-2">
                    Funding Threshold: {values.funding_threshold_percent}%{' '}
                    <span className="text-text-3">(campaign locks when this % is reached)</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    className="w-full accent-primary"
                    {...register('funding_threshold_percent')}
                  />
                  <div className="flex justify-between text-xs text-text-3 mt-1">
                    <span>5%</span>
                    <span>100%</span>
                  </div>
                </div>
                {estimateData && (
                  <div className="bg-primary-l rounded-xl p-3 text-sm">
                    <span className="text-text-2">Estimated lab cost: </span>
                    <span className="font-bold text-primary">
                      {formatUSD(estimateData.estimated_usd)}
                    </span>
                  </div>
                )}
              </div>
            </StepCard>
          )}

          {/* Step 2 — Samples */}
          {step === 1 && (
            <StepCard title="Samples & Tests">
              {sampleFields.map((field, index) => (
                <SampleForm
                  key={field.id}
                  index={index}
                  labs={labsForSamples}
                  onRemove={() => remove(index)}
                />
              ))}
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => append({ ...DEFAULT_SAMPLE })}
                fullWidth
              >
                + Add Sample
              </Button>
            </StepCard>
          )}

          {/* Step 3 — Review */}
          {step === 2 && (
            <StepCard title="Review & Submit">
              {/* Verification code */}
              {verificationCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-medium text-warning mb-1">Your Verification Code</p>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-extrabold text-text tracking-widest">
                      {verificationCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(verificationCode));
                        toast.info('Code copied!');
                      }}
                      className="text-sm text-primary font-medium min-h-[44px] px-3"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-text-2 mt-2">
                    Add this code to your product listing to prove ownership.
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-3 mb-4">
                <p>
                  <span className="font-medium text-text">Title: </span>
                  <span className="text-text-2">{values.title}</span>
                </p>
                <p>
                  <span className="font-medium text-text">Amount: </span>
                  <span className="text-text-2">
                    {formatUSD(parseFloat(values.amount_requested_usd || '0'))}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-text">Threshold: </span>
                  <span className="text-text-2">{values.funding_threshold_percent}%</span>
                </p>
                <p>
                  <span className="font-medium text-text">Samples: </span>
                  <span className="text-text-2">{sampleFields.length}</span>
                </p>
                {estimateData && (
                  <p>
                    <span className="font-medium text-text">Estimated cost: </span>
                    <span className="font-bold text-primary">
                      {formatUSD(estimateData.estimated_usd)}
                    </span>
                  </p>
                )}
              </div>
            </StepCard>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-4">
            {step > 0 && (
              <Button type="button" variant="secondary" size="lg" fullWidth onClick={handleBack}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" size="lg" fullWidth onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="lg" fullWidth loading={isPending}>
                Submit Campaign
              </Button>
            )}
          </div>
        </form>
      </PageContainer>
    </AppShell>
  );
}
