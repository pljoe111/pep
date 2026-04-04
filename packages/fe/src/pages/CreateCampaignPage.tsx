import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
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

// Must match the valid_mass_units seed value
const MASS_UNITS = ['mg', 'g', 'kg', 'mcg', 'oz', 'lb', 'IU'] as const;

// 'purity' is a FE-only UI variant — submitted to the API as claim_type 'other'
// with other_description = "<value>%"
interface ClaimInput {
  claim_type: 'mass' | 'other' | 'purity';
  mass_amount?: string;
  mass_unit?: string;
  other_description?: string;
  purity_percent?: string;
}

interface SampleInput {
  vendor_name: string;
  purchase_date: string;
  physical_description: string;
  sample_label: string;
  target_lab_id: string;
  selected_tests: string[];
  claims: ClaimInput[];
}

interface WizardFormValues {
  title: string;
  description: string;
  amount_requested_usd: string;
  funding_threshold_percent: string;
  samples: SampleInput[];
}

const DEFAULT_CLAIM: ClaimInput = { claim_type: 'other', other_description: '' };

const DEFAULT_SAMPLE: SampleInput = {
  vendor_name: '',
  purchase_date: '',
  physical_description: '',
  sample_label: '',
  target_lab_id: '',
  selected_tests: [],
  claims: [{ ...DEFAULT_CLAIM }],
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

// ─── ClaimRow ────────────────────────────────────────────────────────────────

interface ClaimRowProps {
  sampleIndex: number;
  claimIndex: number;
  onRemove: () => void;
}

function ClaimRow({ sampleIndex, claimIndex, onRemove }: ClaimRowProps): React.ReactElement {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormValues>();

  const claimType = watch(`samples.${sampleIndex}.claims.${claimIndex}.claim_type`);
  const claimErrors = errors.samples?.[sampleIndex]?.claims?.[claimIndex];

  return (
    <div className="bg-surface-a border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
          {...register(`samples.${sampleIndex}.claims.${claimIndex}.claim_type`)}
        >
          <option value="other">Description (other)</option>
          <option value="mass">Mass amount</option>
          <option value="purity">Purity (%)</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-danger text-xs font-medium min-h-[36px] px-2 shrink-0"
        >
          Remove
        </button>
      </div>

      {claimType === 'mass' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              step="any"
              placeholder="Amount"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
              {...register(`samples.${sampleIndex}.claims.${claimIndex}.mass_amount`, {
                required: 'Amount required for mass claim',
              })}
            />
            {claimErrors?.mass_amount && (
              <p className="text-xs text-danger mt-1">{claimErrors.mass_amount.message}</p>
            )}
          </div>
          <select
            className="rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
            {...register(`samples.${sampleIndex}.claims.${claimIndex}.mass_unit`, {
              required: 'Unit required',
            })}
          >
            {MASS_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      )}

      {claimType === 'purity' && (
        <div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="e.g. 98"
              className="w-full rounded-xl border border-border px-3 pr-10 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
              {...register(`samples.${sampleIndex}.claims.${claimIndex}.purity_percent`, {
                required: 'Purity % required',
                min: { value: 0, message: 'Must be 0–100' },
                max: { value: 100, message: 'Must be 0–100' },
              })}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 text-sm pointer-events-none">
              %
            </span>
          </div>
          {claimErrors?.purity_percent && (
            <p className="text-xs text-danger mt-1">{claimErrors.purity_percent.message}</p>
          )}
        </div>
      )}

      {claimType === 'other' && (
        <div>
          <input
            type="text"
            placeholder="e.g. Tirzepatide, identity confirmed"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
            {...register(`samples.${sampleIndex}.claims.${claimIndex}.other_description`, {
              required: 'Description required',
            })}
          />
          {claimErrors?.other_description && (
            <p className="text-xs text-danger mt-1">{claimErrors.other_description.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SampleForm ───────────────────────────────────────────────────────────────

interface SampleFormProps {
  index: number;
  labs: LabDetailDto[];
  onRemove: () => void;
}

function SampleForm({ index, labs, onRemove }: SampleFormProps): React.ReactElement {
  const {
    register,
    watch,
    control,
    formState: { errors },
  } = useFormContext<WizardFormValues>();

  const selectedLabId = watch(`samples.${index}.target_lab_id`);
  const { data: labDetail } = useLabDetail(selectedLabId);
  const testOptions = labDetail?.tests ?? [];

  const {
    fields: claimFields,
    append: appendClaim,
    remove: removeClaim,
  } = useFieldArray({
    control,
    name: `samples.${index}.claims`,
  });

  const labOptions = [
    { value: '', label: 'Select a lab' },
    ...labs.map((l) => ({ value: l.id, label: l.name })),
  ];

  const sampleErrors = errors.samples?.[index];

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
          required
          placeholder="e.g. Sample A"
          error={sampleErrors?.sample_label?.message}
          {...register(`samples.${index}.sample_label`, { required: 'Sample label required' })}
        />
        <Input
          label="Vendor Name"
          required
          placeholder="e.g. BulkSupplements"
          error={sampleErrors?.vendor_name?.message}
          {...register(`samples.${index}.vendor_name`, { required: 'Vendor name required' })}
        />
        <Input
          label="Purchase Date"
          type="date"
          required
          error={sampleErrors?.purchase_date?.message}
          {...register(`samples.${index}.purchase_date`, { required: 'Purchase date required' })}
        />
        <Textarea
          label="Physical Description"
          placeholder="e.g. White powder, unflavored"
          rows={2}
          {...register(`samples.${index}.physical_description`)}
        />

        {/* Target lab */}
        <div>
          <label className="text-sm font-medium text-text block mb-2">Target Lab *</label>
          <select
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            {...register(`samples.${index}.target_lab_id`, { required: 'Select a lab' })}
          >
            {labOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {sampleErrors?.target_lab_id && (
            <p className="text-sm text-danger mt-1">{sampleErrors.target_lab_id.message}</p>
          )}
        </div>

        {/* Tests */}
        {selectedLabId !== '' && testOptions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-text block mb-2">Tests</label>
            <div className="space-y-1">
              {testOptions.map((test) => (
                <label
                  key={test.test_id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-a min-h-[44px]"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary"
                    value={test.test_id}
                    {...register(`samples.${index}.selected_tests`)}
                  />
                  <span className="text-sm text-text">{test.test_name}</span>
                  <span className="text-xs text-text-2 ml-auto">{formatUSD(test.price_usd)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Claims — at least 1 required */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text">
              Claims <span className="text-danger">*</span>
              <span className="text-text-3 font-normal ml-1">
                (what are you claiming about this sample?)
              </span>
            </label>
            <button
              type="button"
              onClick={() => appendClaim({ ...DEFAULT_CLAIM })}
              className="text-primary text-xs font-medium min-h-[36px] px-2"
            >
              + Add Claim
            </button>
          </div>
          <div className="space-y-2">
            {claimFields.map((field, ci) => (
              <ClaimRow
                key={field.id}
                sampleIndex={index}
                claimIndex={ci}
                onRemove={() => removeClaim(ci)}
              />
            ))}
          </div>
          {claimFields.length === 0 && (
            <p className="text-xs text-danger mt-1">At least 1 claim required</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── CreateCampaignPage ───────────────────────────────────────────────────────

export function CreateCampaignPage(): React.ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [labsForSamples, setLabsForSamples] = useState<LabDetailDto[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: labsData } = useLabs(true);
  const { data: verificationCodeData } = useVerificationCode();
  const { mutateAsync: createCampaign, isPending } = useCreateCampaign();

  const methods = useForm<WizardFormValues>({
    defaultValues: (() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved) as WizardFormValues;
      } catch {
        // ignore parse errors
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

  const {
    register,
    watch,
    control,
    formState: { errors },
    getValues,
  } = methods;

  const { fields: sampleFields, append, remove } = useFieldArray({ control, name: 'samples' });

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

  // Persist wizard state to localStorage on every field change
  const formValues = watch();
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formValues));
    } catch {
      // ignore
    }
  }, [formValues]);

  // Build the estimate payload from live form values — only samples that have a
  // lab AND at least one test selected contribute to the cost calculation.
  const samplesJson = JSON.stringify(
    (formValues.samples ?? [])
      .filter((s) => s.target_lab_id !== '' && (s.selected_tests ?? []).length > 0)
      .map((s) => ({
        target_lab_id: s.target_lab_id,
        tests: (s.selected_tests ?? []).map((testId) => ({ test_id: testId })),
      }))
  );
  const { data: estimateData } = useCostEstimate(samplesJson, true);

  const verificationCode = verificationCodeData?.code;

  const handleNext = (): void => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = (): void => {
    if (step > 0) setStep((s) => s - 1);
  };

  /** Called by the confirmation modal — form is already validated at this point. */
  const doCreate = async (): Promise<void> => {
    const data = methods.getValues();
    const amountRequested = parseFloat(data.amount_requested_usd);
    const estimatedCost = estimateData?.estimated_usd ?? 0;

    if (estimatedCost > 0 && !isAmountWithinEstimate(amountRequested, estimatedCost)) {
      toast.error(
        `Amount requested must be ≤ 1.5× estimated cost (${formatUSD(estimatedCost * 1.5)} max)`
      );
      setShowConfirm(false);
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
          claims: sample.claims.map((c) => {
            if (c.claim_type === 'mass') {
              return {
                claim_type: 'mass' as const,
                mass_amount: c.mass_amount !== undefined ? parseFloat(c.mass_amount) : undefined,
                mass_unit: c.mass_unit,
              };
            }
            if (c.claim_type === 'purity') {
              // Purity is FE-only; the API stores it as an 'other' claim
              return {
                claim_type: 'other' as const,
                other_description: `Purity: ${c.purity_percent ?? ''}%`,
              };
            }
            return {
              claim_type: 'other' as const,
              other_description: c.other_description,
            };
          }),
          tests: (sample.selected_tests ?? []).map((testId) => ({ test_id: testId })),
        })),
      });
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Campaign created!');
      void navigate(`/campaigns/${result.id}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
    } finally {
      setShowConfirm(false);
    }
  };

  /** Validate the whole form, then open the confirmation modal. */
  const handleReviewConfirm = async (): Promise<void> => {
    const valid = await methods.trigger();
    if (valid) setShowConfirm(true);
  };

  const values = getValues();

  return (
    <AppShell>
      <PageContainer className="py-4">
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

        <FormProvider {...methods}>
          <form onSubmit={(e) => e.preventDefault()}>
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
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => void handleReviewConfirm()}
                >
                  Review & Confirm
                </Button>
              )}
            </div>
          </form>
        </FormProvider>

        {/* Confirmation modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowConfirm(false)}
            />
            <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-xl font-bold text-text">Confirm Campaign</h2>
              <p className="text-sm text-text-2">
                Review your campaign details below. Once created, you cannot edit the samples or
                tests.
              </p>
              <div className="bg-surface-a rounded-xl p-4 space-y-2 text-sm">
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
                <ul className="pl-3 space-y-1">
                  {values.samples?.map((s, i) => (
                    <li key={i} className="text-text-2">
                      <span className="font-medium text-text">{s.sample_label}</span>
                      {' — '}
                      {(s.selected_tests ?? []).length} test
                      {(s.selected_tests ?? []).length !== 1 ? 's' : ''}, {s.claims.length} claim
                      {s.claims.length !== 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
                {estimateData && (
                  <p>
                    <span className="font-medium text-text">Estimated cost: </span>
                    <span className="font-bold text-primary">
                      {formatUSD(estimateData.estimated_usd)}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => setShowConfirm(false)}
                >
                  Go Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={isPending}
                  onClick={() => void doCreate()}
                >
                  Create Campaign
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
