import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageContainer } from '../../components/layout/PageContainer';
import { WizardProgress } from './components/WizardProgress';
import { Step1Basics } from './steps/Step1Basics';
import { Step2Samples } from './steps/Step2Samples';
import { useDraftStorage } from './useDraftStorage';
import { WizardFormState, DEFAULT_FORM_STATE } from './types';
import { Button } from '../../components/ui/Button';
import { AlertCircle } from 'lucide-react';

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const { loadDraft, saveDraft, clearDraft } = useDraftStorage();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formState, setFormState] = useState<WizardFormState>(DEFAULT_FORM_STATE);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [estimatedLabCost, setEstimatedLabCost] = useState(0);

  // On mount: check for existing draft
  useEffect(() => {
    const draft = loadDraft();
    if (draft && (draft.title || draft.samples.length > 0)) {
      setShowDraftBanner(true);
    }
  }, []);

  // Save on every state change
  useEffect(() => {
    saveDraft(formState);
  }, [formState]);

  const continueDraft = () => {
    const draft = loadDraft();
    if (draft) setFormState(draft);
    setShowDraftBanner(false);
  };

  const startFresh = () => {
    clearDraft();
    setFormState(DEFAULT_FORM_STATE);
    setShowDraftBanner(false);
  };

  const updateForm = (partial: Partial<WizardFormState>) => {
    setFormState((prev) => ({ ...prev, ...partial }));
  };

  return (
    <AppShell hideBottomNav>
      <PageContainer>
        <div className="max-w-2xl mx-auto py-8 space-y-8">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-text">Create Campaign</h1>
            <p className="text-text-2">Follow the steps to set up your testing campaign</p>
          </div>

          {/* Draft Banner */}
          {showDraftBanner && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-warning shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  You have an unfinished campaign draft.
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={continueDraft}
                  className="flex-1 sm:flex-none"
                >
                  Continue
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startFresh}
                  className="flex-1 sm:flex-none text-danger hover:text-danger"
                >
                  Start Fresh
                </Button>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          <WizardProgress currentStep={step} onStepClick={(s) => s < step && setStep(s)} />

          {/* Step Content */}
          <div className="bg-surface rounded-2xl border border-border p-6 md:p-8 shadow-sm">
            {step === 1 && (
              <Step1Basics
                formState={formState}
                estimatedLabCost={estimatedLabCost}
                onUpdate={updateForm}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <Step2Samples
                formState={formState}
                onUpdate={updateForm}
                onEstimatedCostChange={setEstimatedLabCost}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <div className="py-12 text-center space-y-4">
                <p className="text-text-2 italic text-lg">Step 3: Review coming in S09</p>
                <Button variant="secondary" onClick={() => setStep(2)}>
                  ← Back to Samples
                </Button>
              </div>
            )}
          </div>

          {/* Cancel Link */}
          <div className="text-center">
            <button
              onClick={() => {
                void navigate('/');
              }}
              className="text-sm text-text-3 hover:text-text transition-colors"
            >
              Cancel and return home
            </button>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
