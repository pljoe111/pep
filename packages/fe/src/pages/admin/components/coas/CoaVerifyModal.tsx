import React, { useState, type ChangeEvent } from 'react';
import type { AdminCoaDto } from 'api-client';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Textarea } from '../../../../components/ui/Textarea';

interface CoaVerifyModalProps {
  coa: AdminCoaDto;
  onClose: () => void;
  onConfirm: (status: 'approved' | 'rejected', notes: string) => void;
  isPending: boolean;
}

export function CoaVerifyModal({
  coa,
  onClose,
  onConfirm,
  isPending,
}: CoaVerifyModalProps): React.ReactElement {
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');

  const handleSubmit = (): void => {
    onConfirm(status, notes.trim());
  };

  const handleNotesChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setNotes(e.target.value);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Verify COA" size="lg">
      <div className="space-y-6">
        {coa.rejection_count >= 2 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-danger">
            ⚠ This sample&apos;s COA has {coa.rejection_count}/3 rejections. One more rejection will
            auto-refund the entire campaign and refund all contributors.
          </div>
        )}
        {coa.rejection_count === 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-warning">
            This sample&apos;s COA has 1/3 rejections.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="text-text-2">Campaign</p>
            <p className="font-medium text-text">{coa.campaign_title}</p>
          </div>
          <div className="space-y-2">
            <p className="text-text-2">Verification Code</p>
            <p className="font-mono font-bold text-primary text-lg">
              {coa.campaign_verification_code}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-text-2">Sample Label</p>
            <p className="font-medium text-text">{coa.sample_label}</p>
          </div>
          <div className="space-y-2">
            <p className="text-text-2">File</p>
            <a
              href={coa.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              View PDF
            </a>
          </div>
        </div>

        {coa.ocr_text && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text">OCR Text Excerpt</p>
            <div className="bg-surface-a border border-border rounded-xl p-3 max-h-40 overflow-y-auto text-xs font-mono text-text-2 whitespace-pre-wrap">
              {coa.ocr_text}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text block mb-2">Decision</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('approved')}
                className={[
                  'flex-1 py-3 rounded-xl border font-medium transition-colors min-h-[44px]',
                  status === 'approved'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'border-border text-text-2 hover:border-text-3',
                ].join(' ')}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={[
                  'flex-1 py-3 rounded-xl border font-medium transition-colors min-h-[44px]',
                  status === 'rejected'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'border-border text-text-2 hover:border-text-3',
                ].join(' ')}
              >
                Reject
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text block mb-1">
              Notes {status === 'rejected' && <span className="text-danger">*</span>}
            </label>
            <Textarea
              value={notes}
              onChange={handleNotesChange}
              rows={3}
              placeholder={
                status === 'approved'
                  ? 'Optional approval notes...'
                  : 'Required: Why is this COA being rejected?'
              }
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant={status === 'approved' ? 'primary' : 'danger'}
            fullWidth
            loading={isPending}
            onClick={handleSubmit}
            disabled={status === 'rejected' && !notes.trim()}
          >
            Confirm {status === 'approved' ? 'Approval' : 'Rejection'}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
