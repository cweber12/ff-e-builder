import { useRef } from 'react';
import { cn } from '../../lib/utils';
import { type CatalogColorToken } from '../../lib/export/ffe/catalogTokens';

interface ColorChipGroupProps {
  value: CatalogColorToken;
  options: Array<{ token: CatalogColorToken; hex: string; label: string }>;
  onChange: (token: CatalogColorToken) => void;
  ariaLabel: string;
}

export function ColorChipGroup({ value, options, onChange, ariaLabel }: ColorChipGroupProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex items-center gap-2">
      {options.map((option, index) => {
        const isSelected = option.token === value;

        return (
          <button
            key={option.token}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            title={option.label}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              'h-5 w-5 rounded-full border border-black/15 ring-offset-1',
              isSelected ? 'ring-2 ring-brand-600' : '',
            )}
            style={{ backgroundColor: option.hex }}
            onClick={() => onChange(option.token)}
            onKeyDown={(event) => {
              if (
                event.key !== 'ArrowRight' &&
                event.key !== 'ArrowLeft' &&
                event.key !== 'ArrowDown' &&
                event.key !== 'ArrowUp'
              ) {
                return;
              }
              event.preventDefault();
              const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
              const nextIndex = (index + direction + options.length) % options.length;
              const nextToken = options[nextIndex]?.token;
              if (nextToken) {
                onChange(nextToken);
                buttonRefs.current[nextIndex]?.focus();
              }
            }}
          />
        );
      })}
    </div>
  );
}
