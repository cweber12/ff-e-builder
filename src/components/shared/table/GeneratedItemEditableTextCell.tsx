import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

type GeneratedItemEditableTextCellProps = {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  indicator?: ReactNode;
  inputClassName: string;
};

export function GeneratedItemEditableTextCell({
  value,
  onSave,
  className,
  indicator,
  inputClassName,
}: GeneratedItemEditableTextCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    const isEmpty = !value;
    return (
      <td className={cn('px-3 py-2', className)} onClick={(event) => event.stopPropagation()}>
        {indicator && <span className="float-right ml-1 mt-0.5">{indicator}</span>}
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'block w-full cursor-pointer rounded px-2 py-1 text-sm',
            isEmpty
              ? 'border border-gray-300 text-gray-400 hover:border-brand-500'
              : 'text-gray-700 hover:bg-brand-50',
          )}
        >
          {isEmpty ? '-' : value}
        </span>
      </td>
    );
  }

  return (
    <td className={cn('px-3 py-2', className)} onClick={(event) => event.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn('w-full', inputClassName)}
      />
    </td>
  );
}
