import { useState, useEffect } from 'react';
import { Key, Copy, Check } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface VerificationCodeBoxProps {
  code: string;
}

export function VerificationCodeBox({ code }: VerificationCodeBoxProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
      })
      .catch((err) => {
        console.error('Failed to copy code:', err);
      });
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <Key className="w-4 h-4" />
        <span>Your Verification Code</span>
      </div>

      <div className="text-4xl font-extrabold text-text tracking-widest text-center py-4">
        {code.split('').join(' ')}
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="secondary"
          size="md"
          onClick={handleCopy}
          className="flex items-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy code'}
        </Button>
      </div>

      <p className="text-sm text-amber-800 text-center">
        Make sure your COAs contain this code. It can be added as part of the batch number, client,
        or memo depending on the lab.
      </p>
    </div>
  );
}
