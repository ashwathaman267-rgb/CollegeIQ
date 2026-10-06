'use client';

import * as React from 'react';
import { FileUp, Loader2, UploadCloud, X } from 'lucide-react';

import { cn, formatBytes } from '@/lib/utils';

export interface FileDropProps {
  accept: string;
  /** Human-readable summary of the accepted types. */
  acceptLabel: string;
  maxSizeMb: number;
  onFile: (file: File) => void;
  file?: File | null;
  onClear?: () => void;
  disabled?: boolean;
  uploading?: boolean;
  progress?: number;
  error?: string | null;
  className?: string;
  inputId?: string;
}

/**
 * Drag-and-drop upload with real client-side validation (type + size) and an
 * honest progress bar. Nothing is sent until the form is submitted.
 */
export function FileDrop({
  accept,
  acceptLabel,
  maxSizeMb,
  onFile,
  file,
  onClear,
  disabled,
  uploading,
  progress,
  error,
  className,
  inputId,
}: FileDropProps) {
  const [dragging, setDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const id = inputId ?? `file-drop-${React.useId()}`;

  const handle = (next: File | null | undefined) => {
    if (!next) return;
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (next.size > maxBytes) {
      setLocalError(`That file is ${formatBytes(next.size)}. The limit is ${maxSizeMb} MB.`);
      return;
    }
    const accepted = accept
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    const name = next.name.toLowerCase();
    const okType = accepted.some((entry) =>
      entry.startsWith('.') ? name.endsWith(entry) : next.type.toLowerCase() === entry || (entry.endsWith('/*') && next.type.toLowerCase().startsWith(entry.slice(0, -1))),
    );
    if (!okType) {
      setLocalError(`Unsupported file type. Accepted: ${acceptLabel}.`);
      return;
    }
    setLocalError(null);
    onFile(next);
  };

  const message = localError ?? error;

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors',
          dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-raised hover:border-brand/60 hover:bg-brand-soft/40',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
        ) : (
          <UploadCloud className={cn('h-6 w-6', dragging ? 'text-brand' : 'text-subtle')} aria-hidden />
        )}
        <span className="text-sm font-medium text-ink">
          {uploading ? 'Uploading…' : 'Drag a file here, or click to browse'}
        </span>
        <span className="text-xs text-muted">
          {acceptLabel} · up to {maxSizeMb} MB
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </label>

      {typeof progress === 'number' && uploading ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>Uploading</span>
            <span className="tnum font-semibold text-ink">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {file ? (
        <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2">
          <FileUp className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium text-ink">{file.name}</p>
            <p className="text-xs text-muted">{formatBytes(file.size)}</p>
          </div>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="grid h-7 w-7 shrink-0 place-items-center rounded text-subtle transition-colors hover:bg-line/60 hover:text-ink"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="field-error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
