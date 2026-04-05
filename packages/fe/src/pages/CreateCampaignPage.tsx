import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
  useWatch,
  Controller,
} from 'react-hook-form';
import type {
  LabDetailDto,
  LabTestDto,
  PeptideSummaryDto,
  TestDto,
  VendorSummaryDto,
} from 'api-client';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card } from '../components/ui/Card';
import { useToast } from '../hooks/useToast';
import { useLabs, useLabDetail } from '../api/hooks/useLabs';
import { useCreateCampaign, useVerificationCode, useCostEstimate } from '../api/hooks/useCampaigns';
import { useTests } from '../api/hooks/useLabs';
import { PeptideCombobox } from '../components/wizard/PeptideCombobox';
import { VendorCombobox } from '../components/wizard/VendorCombobox';
import { formatUSD } from '../lib/formatters';
import { isAmountWithinEstimate } from '../lib/validators';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'peplab_create_wizard';
const MASS_UNITS = ['mg', 'g', 'kg', 'mcg', 'oz', 'lb', 'IU'] as const;
const STEPS = ['Basics', 'Samples', 'Review'] as const;

// ─── Form types ───────────────────────────────────────────────────────────────

type ClaimKind = 'mass' | 'other' | 'purity' | 'identity' | 'endotoxins' | 'sterility';

interface ClaimInput {
  claim_kind: ClaimKind;
  label: string;
  is_required: boolean;
  sort_order: number;
  // mass
  mass_amount?: string;
  mass_unit?: string;
  // other
  other_description?: string;
  // purity
  purity_percent?: string;
  // endotoxins (mode from lab config)
  endotoxin_value?: string;
  endotoxin_pass?: boolean;
  // sterility
  sterility_pass?: boolean;
  // identity is auto-filled — no field needed
}

interface SampleInput {
  peptide: PeptideSummaryDto | null;
  peptide_id: string;
  vendor: VendorSummaryDto | null;
  vendor_id: string;
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

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SAMPLE: SampleInput = {
  peptide: null,
  peptide_id: '',
  vendor: null,
  vendor_id: '',
  vendor_name: '',
  purchase_date: '',
  physical_description: '',
  sample_label: '',
  target_lab_id: '',
  selected_tests: [],
  claims: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives claim list from a set of selected test IDs and the test catalog.
 * Required claims are locked; identity claims show the peptide name, no input.
 */
function deriveClaimsFromTests(selectedTestIds: string[], testCatalog: TestDto[]): ClaimInput[] {
  const templateMap = new Map<
    ClaimKind,
    { label: string; is_required: boolean; sort_order: number }
  >();

  for (const testId of selectedTestIds) {
    const test = testCatalog.find((t) => t.id === testId);
    if (!test) continue;
    for (const tpl of test.claim_templates) {
      const kind = tpl.claim_kind as ClaimKind;
      const existing = templateMap.get(kind);
      if (!existing) {
        templateMap.set(kind, {
          label: tpl.label,
          is_required: tpl.is_required,
          sort_order: tpl.sort_order,
        });
      } else if (tpl.is_required && !existing.is_required) {
        templateMap.set(kind, { ...existing, is_required: true });
      }
    }
  }

  return Array.from(templateMap.entries())
    .sort(([, a], [, b]) => a.sort_order - b.sort_order)
    .map(([kind, { label, is_required, sort_order }]) => ({
      claim_kind: kind,
      label,
      is_required,
      sort_order,
    }));
}

/** Auto-label for a sample based on peptide + vendor selection */
function autoLabel(peptideName: string, vendorName: string): string {
  if (peptideName && vendorName) return `${peptideName} from ${vendorName}`;
  if (peptideName) return peptideName;
  if (vendorName) return `Sample from ${vendorName}`;
  return '';
}

// ─── ClaimRow ────────────────────────────────────────────────────────────────

interface ClaimRowProps {
  sampleIndex: number;
  claimIndex: number;
  peptideName: string;
  endotoxinMode?: string;
  onRemove: () => void;
}

function ClaimRow({
  sampleIndex,
  claimIndex,
  peptideName,
  endotoxinMode,
  onRemove,
}: ClaimRowProps): React.ReactElement {
  const { register, watch } = useFormContext<WizardFormValues>();
  const claim = watch(`samples.${sampleIndex}.claims.${claimIndex}`);
  const kind = claim.claim_kind;
  const isRequired = claim.is_required;

  return (
    <div className="bg-surface-a border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">{claim.label}</span>
        {isRequired ? (
          <span className="text-text-3 text-xs flex items-center gap-1" title="Required claim">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a1 1 0 011 1v5h5a1 1 0 010 2H9v5a1 1 0 01-2 0V9H2a1 1 0 010-2h5V2a1 1 0 011-1z" />
            </svg>
            Required
          </span>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="text-danger text-xs font-medium min-h-[36px] px-2"
          >
            Remove
          </button>
        )}
      </div>

      {/* identity — read-only pill */}
      {kind === 'identity' && (
        <div className="rounded-lg bg-primary-l px-3 py-2 text-sm text-primary font-medium">
          {peptideName || '(select a peptide above)'}
        </div>
      )}

      {/* mass */}
      {kind === 'mass' && (
        <div className="flex gap-2">
          <input
            type="number"
            step="any"
            placeholder="Amount"
            className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
            {...register(`samples.${sampleIndex}.claims.${claimIndex}.mass_amount`)}
          />
          <select
            className="rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
            {...register(`samples.${sampleIndex}.claims.${claimIndex}.mass_unit`)}
          >
            {MASS_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* purity */}
      {kind === 'purity' && (
        <div className="relative">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="e.g. 98"
            className="w-full rounded-xl border border-border px-3 pr-10 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
            {...register(`samples.${sampleIndex}.claims.${claimIndex}.purity_percent`)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 text-sm pointer-events-none">
            %
          </span>
        </div>
      )}

      {/* endotoxins */}
      {kind === 'endotoxins' && (
        <>
          {endotoxinMode === 'exact_value' ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Value"
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
                {...register(`samples.${sampleIndex}.claims.${claimIndex}.endotoxin_value`)}
              />
              <span className="text-sm text-text-2 shrink-0">EU/mL</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Controller
                name={`samples.${sampleIndex}.claims.${claimIndex}.endotoxin_pass`}
                render={({ field }) => (
                  <>
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      className={[
                        'flex-1 rounded-xl border py-2 text-sm font-medium min-h-[36px]',
                        field.value === true
                          ? 'border-success bg-emerald-50 text-success'
                          : 'border-border text-text-2',
                      ].join(' ')}
                    >
                      Pass ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      className={[
                        'flex-1 rounded-xl border py-2 text-sm font-medium min-h-[36px]',
                        field.value === false
                          ? 'border-danger bg-red-50 text-danger'
                          : 'border-border text-text-2',
                      ].join(' ')}
                    >
                      Fail ✗
                    </button>
                  </>
                )}
              />
            </div>
          )}
        </>
      )}

      {/* sterility */}
      {kind === 'sterility' && (
        <div className="flex gap-2">
          <Controller
            name={`samples.${sampleIndex}.claims.${claimIndex}.sterility_pass`}
            render={({ field }) => (
              <>
                <button
                  type="button"
                  onClick={() => field.onChange(true)}
                  className={[
                    'flex-1 rounded-xl border py-2 text-sm font-medium min-h-[36px]',
                    field.value === true
                      ? 'border-success bg-emerald-50 text-success'
                      : 'border-border text-text-2',
                  ].join(' ')}
                >
                  Pass ✓
                </button>
                <button
                  type="button"
                  onClick={() => field.onChange(false)}
                  className={[
                    'flex-1 rounded-xl border py-2 text-sm font-medium min-h-[36px]',
                    field.value === false
                      ? 'border-danger bg-red-50 text-danger'
                      : 'border-border text-text-2',
                  ].join(' ')}
                >
                  Fail ✗
                </button>
              </>
            )}
          />
        </div>
      )}

      {/* other */}
      {kind === 'other' && (
        <input
          type="text"
          placeholder="Description"
          className="w-full rounded-xl border border-border px-3 py-2 text-sm text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]"
          {...register(`samples.${sampleIndex}.claims.${claimIndex}.other_description`)}
        />
      )}
    </div>
  );
}

// ─── SampleCard ───────────────────────────────────────────────────────────────

interface SampleCardProps {
  index: number;
  labs: Pick<LabDetailDto, 'id' | 'name'>[];
  testCatalog: TestDto[];
  onRemove: () => void;
  canRemove: boolean;
}

function SampleCard({
  index,
  labs,
  testCatalog,
  onRemove,
  canRemove,
}: SampleCardProps): React.ReactElement {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<WizardFormValues>();
  const sampleErrors = errors.samples?.[index];

  const peptide = useWatch({ control, name: `samples.${index}.peptide` });
  const vendor = useWatch({ control, name: `samples.${index}.vendor` });
  const selectedLabId = useWatch({ control, name: `samples.${index}.target_lab_id` });
  const selectedTests = useWatch({ control, name: `samples.${index}.selected_tests` });

  const { data: labDetail } = useLabDetail(selectedLabId);
  const testOptions: LabTestDto[] = labDetail?.tests.filter((t) => t.is_active) ?? [];

  const {
    fields: claimFields,
    replace: replaceClaims,
    append: appendClaim,
    remove: removeClaim,
  } = useFieldArray({ control, name: `samples.${index}.claims` });

  // Auto-derive claims when tests change
  useEffect(() => {
    if (selectedTests.length === 0) {
      replaceClaims([]);
      return;
    }
    const derived = deriveClaimsFromTests(selectedTests, testCatalog);
    // Preserve existing values when re-deriving (only add/remove structure changes)
    replaceClaims(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedTests)]);

  // Auto-fill sample label when peptide or vendor changes
  useEffect(() => {
    const peptideName = peptide?.name ?? '';
    const vendorName = vendor?.name ?? '';
    const label = autoLabel(peptideName, vendorName);
    if (label) setValue(`samples.${index}.sample_label`, label);
  }, [peptide, vendor, index, setValue]);

  // Find endotoxin mode for a test (from lab test config)
  const getEndotoxinMode = (testId: string): string => {
    return testOptions.find((t) => t.test_id === testId)?.endotoxin_mode ?? 'pass_fail';
  };

  // Total vials needed
  const totalVials = selectedTests.reduce((sum, testId) => {
    const lt = testOptions.find((t) => t.test_id === testId);
    return sum + (lt?.vials_required ?? 1);
  }, 0);

  const peptideName = peptide?.name ?? '';
  const endotoxinTestId = selectedTests.find((tid) => {
    const test = testCatalog.find((t) => t.id === tid);
    return test?.claim_templates.some((tpl) => tpl.claim_kind === 'endotoxins');
  });
  const endotoxinMode = endotoxinTestId ? getEndotoxinMode(endotoxinTestId) : 'pass_fail';

  return (
    <Card padding="md" className="mb-4 border-l-4 border-l-primary">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-bold text-base text-text">Sample {index + 1}</h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-danger text-sm font-medium min-h-[44px] px-2"
          >
            Remove
          </button>
        )}
      </div>

      {/* Section A — What did you buy? */}
      <div className="space-y-3 mb-5">
        <p className="text-xs font-semibold text-text-2 uppercase tracking-wide">
          A — What did you buy?
        </p>

        <Controller
          control={control}
          name={`samples.${index}.peptide`}
          rules={{ required: 'Select a peptide' }}
          render={({ field, fieldState }) => (
            <PeptideCombobox
              value={field.value ?? null}
              onChange={(p) => {
                field.onChange(p);
                setValue(`samples.${index}.peptide_id`, p.id);
              }}
              error={fieldState.error?.message}
              required
            />
          )}
        />

        <Controller
          control={control}
          name={`samples.${index}.vendor`}
          rules={{ required: 'Select a vendor' }}
          render={({ field, fieldState }) => (
            <VendorCombobox
              value={field.value ?? null}
              onChange={(v) => {
                field.onChange(v);
                setValue(`samples.${index}.vendor_id`, v.id);
                setValue(`samples.${index}.vendor_name`, v.name);
              }}
              error={fieldState.error?.message}
              required
            />
          )}
        />

        <Input
          label="Purchase Date"
          type="date"
          required
          max={new Date().toISOString().split('T')[0]}
          min={`${new Date().getFullYear() - 10}-01-01`}
          error={sampleErrors?.purchase_date?.message}
          {...register(`samples.${index}.purchase_date`, {
            required: 'Purchase date required',
            validate: (v) => {
              const d = new Date(v);
              return !Number.isNaN(d.getTime()) || 'Invalid date';
            },
          })}
        />

        <Textarea
          label="Physical Description"
          placeholder="e.g. White powder, unflavored, gray caps"
          rows={2}
          {...register(`samples.${index}.physical_description`)}
        />

        <Input
          label="Sample Label"
          required
          error={sampleErrors?.sample_label?.message}
          {...register(`samples.${index}.sample_label`, { required: 'Sample label required' })}
        />
      </div>

      {/* Section B — Where is it going? */}
      <div className="space-y-3 mb-5">
        <p className="text-xs font-semibold text-text-2 uppercase tracking-wide">
          B — Where is it going?
        </p>

        <div>
          <label className="text-sm font-medium text-text block mb-2">
            Target Lab <span className="text-danger">*</span>
          </label>
          <select
            className="w-full rounded-xl border border-border px-4 py-3 text-base text-text bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            {...register(`samples.${index}.target_lab_id`, { required: 'Select a lab' })}
            onChange={(e) => {
              // Reset selected tests when lab changes
              setValue(`samples.${index}.selected_tests`, []);
              void register(`samples.${index}.target_lab_id`).onChange(e);
            }}
          >
            <option value="">Select a lab</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {sampleErrors?.target_lab_id && (
            <p className="text-sm text-danger mt-1">{sampleErrors.target_lab_id.message}</p>
          )}
        </div>

        {selectedLabId && testOptions.length > 0 && (
          <div>
            <label className="text-sm font-medium text-text block mb-2">Tests</label>
            <div className="space-y-0.5">
              {testOptions.map((test) => (
                <label
                  key={test.test_id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-a min-h-[44px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary shrink-0"
                    value={test.test_id}
                    {...register(`samples.${index}.selected_tests`)}
                  />
                  <span className="text-sm text-text flex-1">{test.test_name}</span>
                  <span className="text-xs text-text-3 px-2 py-0.5 bg-surface-a rounded-full border border-border">
                    {test.vials_required}v
                  </span>
                  <span className="text-sm text-text-2 shrink-0">{formatUSD(test.price_usd)}</span>
                </label>
              ))}
            </div>
            {totalVials > 0 && (
              <p className="text-xs text-primary mt-2 px-3">
                Total vials needed: <span className="font-semibold">{totalVials}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Section C — Claims */}
      {claimFields.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-2 uppercase tracking-wide">
            C — What are you claiming?{' '}
            <span className="font-normal lowercase">(for contributor context)</span>
          </p>

          {/* Informational banner */}
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-3">
            <span className="text-info text-sm shrink-0" aria-hidden="true">
              ℹ️
            </span>
            <p className="text-xs text-text-2">
              <strong className="font-medium">Claims are for contributor context only.</strong> They
              do not affect campaign resolution. The submitted COA is the source of truth —
              contributors should interpret results directly from the lab report.
            </p>
          </div>

          <p className="text-xs text-text-2">
            Pre-filled from your test selection. Adjust as needed.
          </p>

          <div className="space-y-2">
            {claimFields.map((field, ci) => (
              <ClaimRow
                key={field.id}
                sampleIndex={index}
                claimIndex={ci}
                peptideName={peptideName}
                endotoxinMode={endotoxinMode}
                onRemove={() => removeClaim(ci)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              appendClaim({
                claim_kind: 'other',
                label: 'Additional Claim',
                is_required: false,
                sort_order: claimFields.length,
                other_description: '',
              })
            }
            className="text-primary text-sm font-medium min-h-[44px] px-3"
          >
            + Add Custom Claim
          </button>
        </div>
      )}

      {/* Hidden inputs for derived IDs */}
      <input type="hidden" {...register(`samples.${index}.peptide_id`)} />
      <input type="hidden" {...register(`samples.${index}.vendor_id`)} />
      <input type="hidden" {...register(`samples.${index}.vendor_name`)} />
    </Card>
  );
}

// ─── Split Campaign Banner ────────────────────────────────────────────────────

interface SplitBannerProps {
  onKeepTogether: () => void;
  onSplit: () => void;
}

function SplitBanner({ onKeepTogether, onSplit }: SplitBannerProps): React.ReactElement {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex gap-2 mb-3">
        <span className="text-warning text-base">⚡</span>
        <div>
          <p className="text-sm font-medium text-text mb-1">
            Your samples are going to different labs.
          </p>
          <p className="text-sm text-text-2">
            Keep them in one campaign or split them into separate campaigns for cleaner tracking.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onKeepTogether}
          className="flex-1 rounded-xl border border-border bg-surface py-2 text-sm font-medium text-text min-h-[44px]"
        >
          Keep Together
        </button>
        <button
          type="button"
          onClick={onSplit}
          className="flex-1 rounded-xl bg-warning text-white py-2 text-sm font-medium min-h-[44px]"
        >
          Split into Separate Campaigns
        </button>
      </div>
    </div>
  );
}

// ─── CreateCampaignPage ───────────────────────────────────────────────────────

export function CreateCampaignPage(): React.ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [splitDismissed, setSplitDismissed] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  const { data: labsData } = useLabs(true, true);
  const { data: testCatalogData } = useTests(false);
  const { data: verificationCodeData } = useVerificationCode();
  const { mutateAsync: createCampaign, isPending } = useCreateCampaign();

  const activeLabs = useMemo(
    () => (labsData?.data ?? []).map((l) => ({ id: l.id, name: l.name })),
    [labsData]
  );
  const testCatalog: TestDto[] = useMemo(() => testCatalogData ?? [], [testCatalogData]);

  const methods = useForm<WizardFormValues>({
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

  const {
    register,
    watch,
    control,
    formState: { errors },
    getValues,
  } = methods;
  const { fields: sampleFields, append, remove } = useFieldArray({ control, name: 'samples' });

  const formValues = watch();

  // Auto-persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formValues));
    } catch {
      /* ignore */
    }
  }, [formValues]);

  // Detect multiple labs for split prompt
  const uniqueLabIds = useMemo(() => {
    const ids = new Set((formValues.samples ?? []).map((s) => s.target_lab_id).filter(Boolean));
    return ids;
  }, [formValues.samples]);
  const hasMultipleLabs = uniqueLabIds.size > 1;

  // Cost estimate
  const samplesJson = useMemo(
    () =>
      JSON.stringify(
        (formValues.samples ?? [])
          .filter((s) => s.target_lab_id && s.selected_tests.length > 0)
          .map((s) => ({
            target_lab_id: s.target_lab_id,
            tests: s.selected_tests.map((tid) => ({ test_id: tid })),
          }))
      ),
    [formValues.samples]
  );
  const { data: estimateData } = useCostEstimate(samplesJson, step > 0 || samplesJson !== '[]');

  const verificationCode = verificationCodeData?.code;
  const values = getValues();

  // ─── Navigation ───────────────────────────────────────────────────────────

  const handleNext = useCallback(async (): Promise<void> => {
    let fieldsToValidate: string[] = [];
    if (step === 0) {
      fieldsToValidate = [
        'title',
        'description',
        'amount_requested_usd',
        'funding_threshold_percent',
      ];
    } else if (step === 1) {
      const count = values.samples?.length ?? 0;
      for (let i = 0; i < count; i++) {
        fieldsToValidate.push(
          `samples.${i}.peptide`,
          `samples.${i}.vendor`,
          `samples.${i}.purchase_date`,
          `samples.${i}.sample_label`,
          `samples.${i}.target_lab_id`
        );
      }
    }
    if (fieldsToValidate.length > 0) {
      const valid = await methods.trigger(fieldsToValidate as never[]);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  }, [step, values.samples, methods]);

  const handleBack = (): void => setStep((s) => s - 1);

  // ─── Submit ───────────────────────────────────────────────────────────────

  const doCreate = useCallback(async (): Promise<void> => {
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
          vendor_name: sample.vendor_name || sample.vendor?.name || '',
          vendor_id: sample.vendor_id || undefined,
          peptide_id: sample.peptide_id || undefined,
          purchase_date: sample.purchase_date,
          physical_description: sample.physical_description,
          sample_label: sample.sample_label,
          target_lab_id: sample.target_lab_id,
          order_index: idx,
          claims: sample.claims.map((c) => {
            const base = {
              claim_type: c.claim_kind as
                | 'mass'
                | 'other'
                | 'purity'
                | 'identity'
                | 'endotoxins'
                | 'sterility',
            };
            if (c.claim_kind === 'mass')
              return {
                ...base,
                mass_amount: c.mass_amount ? parseFloat(c.mass_amount) : undefined,
                mass_unit: c.mass_unit,
              };
            if (c.claim_kind === 'purity')
              return {
                ...base,
                purity_percent: c.purity_percent ? parseFloat(c.purity_percent) : undefined,
              };
            if (c.claim_kind === 'endotoxins')
              return {
                ...base,
                endotoxin_value: c.endotoxin_value ? parseFloat(c.endotoxin_value) : undefined,
                endotoxin_pass: c.endotoxin_pass,
              };
            if (c.claim_kind === 'sterility') return { ...base, sterility_pass: c.sterility_pass };
            if (c.claim_kind === 'identity')
              return { ...base, identity_peptide_id: sample.peptide_id };
            return { ...base, other_description: c.other_description };
          }),
          tests: sample.selected_tests.map((testId) => ({ test_id: testId })),
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
  }, [createCampaign, estimateData, methods, navigate, toast]);

  const handleReviewConfirm = async (): Promise<void> => {
    const valid = await methods.trigger();
    if (valid) setShowConfirm(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageContainer className="py-4">
        {/* Header */}
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
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0',
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
            {/* ── Step 1 — Basics ─────────────────────────────────────────── */}
            {step === 0 && (
              <Card padding="lg" className="mb-4">
                <h2 className="text-xl font-bold text-text mb-4">Campaign Basics</h2>
                <div className="space-y-4">
                  <Input
                    label="Title"
                    required
                    placeholder="e.g. Test My Protein Powder"
                    error={errors.title?.message}
                    valid={!!watch('title')?.trim()}
                    {...register('title', { required: 'Title is required' })}
                  />
                  <Textarea
                    label="Description"
                    required
                    rows={5}
                    placeholder="Describe what you want tested and why..."
                    error={errors.description?.message}
                    valid={!!watch('description')?.trim()}
                    {...register('description', { required: 'Description is required' })}
                  />
                  <Input
                    label="Amount Requested (USD)"
                    type="number"
                    inputMode="decimal"
                    required
                    placeholder="500.00"
                    error={errors.amount_requested_usd?.message}
                    valid={
                      !!watch('amount_requested_usd') &&
                      parseFloat(watch('amount_requested_usd')) > 0
                    }
                    {...register('amount_requested_usd', {
                      required: 'Amount is required',
                      min: { value: 0.01, message: 'Must be at least $0.01' },
                    })}
                  />
                  <div>
                    <label className="text-sm font-medium text-text block mb-2">
                      Lock at {watch('funding_threshold_percent')}% funded
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
              </Card>
            )}

            {/* ── Step 2 — Samples & Tests ─────────────────────────────────── */}
            {step === 1 && (
              <>
                {/* Split campaign banner */}
                {hasMultipleLabs && !splitDismissed && (
                  <SplitBanner
                    onKeepTogether={() => setSplitDismissed(true)}
                    onSplit={() => setShowSplitModal(true)}
                  />
                )}

                {/* Split info modal (simplified: just shows warning) */}
                {showSplitModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                      onClick={() => setShowSplitModal(false)}
                    />
                    <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                      <h2 className="text-xl font-bold text-text">Split into Separate Campaigns</h2>
                      <p className="text-sm text-text-2">
                        To split campaigns by lab, finish creating this campaign first, then create
                        separate campaigns for each additional lab. Each campaign is tracked
                        independently.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        fullWidth
                        onClick={() => {
                          setShowSplitModal(false);
                          setSplitDismissed(true);
                        }}
                      >
                        Got it
                      </Button>
                    </div>
                  </div>
                )}

                {sampleFields.map((field, index) => (
                  <SampleCard
                    key={field.id}
                    index={index}
                    labs={activeLabs}
                    testCatalog={testCatalog}
                    onRemove={() => remove(index)}
                    canRemove={sampleFields.length > 1}
                  />
                ))}

                {/* Add sample button — only if first sample has a peptide */}
                {(formValues.samples?.[0]?.peptide_id || formValues.samples?.[0]?.peptide) && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => append({ ...DEFAULT_SAMPLE })}
                    fullWidth
                  >
                    + Add Sample
                  </Button>
                )}
              </>
            )}

            {/* ── Step 3 — Review ─────────────────────────────────────────── */}
            {step === 2 && (
              <Card padding="lg" className="mb-4">
                <h2 className="text-xl font-bold text-text mb-4">Review & Submit</h2>
                {verificationCode !== undefined && (
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
                <div className="space-y-3">
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
                    <span className="font-medium text-text">Lock at: </span>
                    <span className="text-text-2">{values.funding_threshold_percent}% funded</span>
                  </p>
                  <p>
                    <span className="font-medium text-text">Samples: </span>
                    <span className="text-text-2">{sampleFields.length}</span>
                  </p>
                  <ul className="pl-3 space-y-1">
                    {values.samples?.map((s, i) => (
                      <li key={i} className="text-text-2 text-sm">
                        <span className="font-medium text-text">{s.sample_label}</span>
                        {' — '}
                        {s.selected_tests.length} test{s.selected_tests.length !== 1 ? 's' : ''}
                        {s.peptide ? `, ${s.peptide.name}` : ''}
                        {s.vendor ? ` from ${s.vendor.name}` : ''}
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
              </Card>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-4">
              {step > 0 && (
                <Button type="button" variant="secondary" size="lg" fullWidth onClick={handleBack}>
                  Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => void handleNext()}
                >
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
                Once created, you cannot edit the samples or tests.
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
