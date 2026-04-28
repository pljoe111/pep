import type { CoaDto } from 'api-client';
import { Button } from '../../../components/ui/Button';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Upload,
} from 'lucide-react';

interface COAStateDisplayProps {
  coa: CoaDto | null;
  isCreator: boolean;
  sampleId: string;
  onReplaceClick: (sampleId: string) => void;
}

export const COAStateDisplay = ({
  coa,
  isCreator,
  sampleId,
  onReplaceClick,
}: COAStateDisplayProps) => {
  if (!coa) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-a rounded-xl border border-border/50 text-text-2">
        <div className="flex items-center gap-3">
          <Clock size={18} className="shrink-0 text-text-3" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">COA not yet uploaded</span>
            <span className="text-xs opacity-70">
              The creator has not yet provided testing results for this sample.
            </span>
          </div>
        </div>
        {isCreator && (
          <Button variant="secondary" size="sm" onClick={() => onReplaceClick(sampleId)}>
            <Upload size={14} />
            Upload
          </Button>
        )}
      </div>
    );
  }

  const { verification_status: status } = coa;

  if (status === 'pending') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50/30 rounded-xl border border-blue-100 text-blue-800">
        <div className="flex items-center gap-3">
          <Clock size={18} className="shrink-0 text-blue-400" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">COA waiting for approval</span>
            <span className="text-xs opacity-80">
              The document has been uploaded and is currently being reviewed by an admin.
            </span>
          </div>
        </div>
        {isCreator && (
          <Button variant="secondary" size="sm" onClick={() => onReplaceClick(sampleId)}>
            <Upload size={14} />
            Replace
          </Button>
        )}
      </div>
    );
  }

  if (status === 'code_found') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-teal-50/30 rounded-xl border border-teal-100 text-teal-800">
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="shrink-0 text-teal-500" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">COA processing</span>
            <span className="text-xs opacity-80">
              Verification code found via OCR. Awaiting final admin confirmation.
            </span>
          </div>
        </div>
        {isCreator && (
          <Button variant="secondary" size="sm" onClick={() => onReplaceClick(sampleId)}>
            <Upload size={14} />
            Replace
          </Button>
        )}
      </div>
    );
  }

  if (status === 'code_not_found') {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50/30 rounded-xl border border-amber-100 text-amber-800">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-amber-500" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">COA awaiting manual review</span>
            <span className="text-xs opacity-80">
              OCR could not find a verification code. An admin will verify the document manually.
            </span>
          </div>
        </div>
        {isCreator && (
          <Button variant="secondary" size="sm" onClick={() => onReplaceClick(sampleId)}>
            <Upload size={14} />
            Replace
          </Button>
        )}
      </div>
    );
  }

  if (status === 'manually_approved') {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-success font-medium">
            <CheckCircle size={18} className="shrink-0" />
            <span className="text-sm">Approved ✓</span>
          </div>
          <a
            href={coa.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <ExternalLink size={14} />
            Open in New Tab
          </a>
        </div>

        <div className="relative w-full aspect-[3/4] bg-surface-a rounded-xl border border-border overflow-hidden">
          <iframe
            src={`${coa.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full"
            title={`COA for ${coa.file_name}`}
          />
          <div className="absolute bottom-3 right-3">
            <a
              href={coa.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface/90 backdrop-blur shadow-sm border border-border rounded-lg px-3 py-1.5 text-xs font-medium text-text hover:bg-surface transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={12} />
              Full Screen
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    // Note: rejectionCount is not in the current DTO, but we'll use it if it exists or default to 1
    // Based on the plan, we should show escalation at 2/3
    const rejectionCount =
      ((coa as unknown as Record<string, unknown>).rejection_count as number | undefined) ?? 1;

    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <XCircle size={18} className="text-danger flex-shrink-0" />
          <span className="text-sm font-semibold text-danger">COA Rejected</span>
        </div>

        {coa.verification_notes && (
          <p className="text-sm text-text">
            <span className="font-medium">Reason: </span>
            {coa.verification_notes}
          </p>
        )}

        <p
          className={`text-xs font-medium ${rejectionCount >= 2 ? 'text-warning' : 'text-text-3'}`}
        >
          Rejection {rejectionCount} of 3
        </p>

        {rejectionCount >= 2 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              One more rejection will automatically refund all contributors.
            </p>
          </div>
        )}

        {isCreator && (
          <Button variant="secondary" size="sm" fullWidth onClick={() => onReplaceClick(sampleId)}>
            <Upload size={14} />
            Replace COA
          </Button>
        )}
      </div>
    );
  }

  return null;
};
