import { useState, useEffect } from 'react';
import type { CampaignDetailDto } from 'api-client';
import { useUploadCoa } from '../../../api/hooks/useCampaigns';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { useToast } from '../../../hooks/useToast';
import { Upload, Paperclip, AlertCircle, FileText } from 'lucide-react';

interface UploadCOASheetProps {
  campaign: CampaignDetailDto;
  preSelectedSampleId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UploadCOASheet = ({
  campaign,
  preSelectedSampleId,
  isOpen,
  onClose,
}: UploadCOASheetProps) => {
  const { mutate: uploadCoa, isPending } = useUploadCoa(campaign.id);
  const toast = useToast();

  const [selectedSampleId, setSelectedSampleId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Filter samples that need a COA (none yet or rejected)
  const eligibleSamples = campaign.samples.filter(
    (s) => !s.coa || s.coa.verification_status === 'rejected'
  );

  useEffect(() => {
    if (isOpen) {
      if (preSelectedSampleId) {
        setSelectedSampleId(preSelectedSampleId);
      } else if (eligibleSamples.length > 0) {
        setSelectedSampleId(eligibleSamples[0].id);
      }
    } else {
      // Reset on close
      setFile(null);
      setUploadProgress(0);
    }
  }, [isOpen, preSelectedSampleId, eligibleSamples]);

  const selectedSample = campaign.samples.find((s) => s.id === selectedSampleId);
  const isRejected = selectedSample?.coa?.verification_status === 'rejected';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else if (selectedFile) {
      toast.error('Please select a PDF file');
    }
  };

  const handleSubmit = () => {
    if (!selectedSampleId || !file) return;

    // Simulate progress since the API hook doesn't expose it yet
    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 10));
    }, 200);

    uploadCoa(
      { sampleId: selectedSampleId, file },
      {
        onSuccess: () => {
          clearInterval(interval);
          setUploadProgress(100);
          toast.success('COA uploaded — pending admin review');
          setTimeout(onClose, 500);
        },
        onError: (err: unknown) => {
          clearInterval(interval);
          setUploadProgress(0);
          const msg =
            typeof err === 'object' && err !== null && 'response' in err
              ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
                'Failed to upload COA')
              : 'Failed to upload COA';
          toast.error(msg);
        },
      }
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Upload COA">
      <div className="space-y-6 pt-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-3 uppercase tracking-wide">
            Select Sample
          </label>
          <Select
            value={selectedSampleId}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            options={eligibleSamples.map((s) => ({
              value: s.id,
              label: `${s.sample_label} (${s.peptide?.name || 'Unknown'})`,
            }))}
          />
        </div>

        {isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-danger font-bold text-sm">
              <AlertCircle size={16} />
              Previous COA Rejected
            </div>
            <p className="text-sm text-text leading-relaxed">
              <span className="font-medium">Reason:</span>{' '}
              {selectedSample?.coa?.verification_notes || 'No reason provided'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <label className="text-xs font-medium text-text-3 uppercase tracking-wide">
            Select PDF File
          </label>

          <div className="relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isPending}
            />
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 bg-surface-a hover:bg-surface transition-colors">
              <Paperclip className="w-8 h-8 text-text-3 mb-2" />
              <span className="text-sm font-medium text-text">
                {file ? 'Change PDF' : 'Choose PDF'}
              </span>
              <span className="text-xs text-text-3 mt-1">Max size 10MB</span>
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-3 p-3 bg-primary-l/20 rounded-lg border border-primary/10">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{file.name}</p>
                <p className="text-xs text-text-3">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}
        </div>

        {isPending && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-text-2">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <ProgressBar percent={uploadProgress} />
          </div>
        )}

        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={!file || !selectedSampleId}
          loading={isPending}
          onClick={handleSubmit}
        >
          <Upload className="w-5 h-5" />
          Upload COA
        </Button>
      </div>
    </Sheet>
  );
};
