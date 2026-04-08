interface WizardProgressProps {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}

export const WizardProgress = ({ currentStep, onStepClick }: WizardProgressProps) => {
  const steps = [
    { id: 1, label: 'Goal' },
    { id: 2, label: 'Samples' },
    { id: 3, label: 'Review' },
  ] as const;

  return (
    <div className="relative flex justify-between items-start max-w-xs mx-auto mb-12">
      {/* Connecting Lines */}
      <div className="absolute top-4 left-0 w-full h-0.5 bg-border -z-10" />
      <div
        className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500 -z-10"
        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const isFuture = currentStep < step.id;

        return (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <button
              onClick={() => step.id < currentStep && onStepClick?.(step.id)}
              disabled={isFuture}
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                isCompleted ? 'bg-primary text-white' : '',
                isCurrent ? 'bg-primary text-white ring-4 ring-primary/20 ring-offset-2' : '',
                isFuture ? 'bg-border text-text-3' : '',
              ].join(' ')}
            >
              {step.id}
            </button>
            <span
              className={[
                'text-xs font-medium transition-colors duration-300',
                isFuture ? 'text-text-3' : 'text-text-2',
                isCurrent ? 'text-primary font-bold' : '',
              ].join(' ')}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
