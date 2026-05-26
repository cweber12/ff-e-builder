import {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
} from 'react';
import { cn } from '../../lib/utils';

type SegmentedControlVariant = 'segmented' | 'toolbar';
type SegmentedControlSize = 'sm' | 'md';
type SegmentedControlTone = 'default' | 'quiet' | 'rail' | 'status';

type SegmentedControlProps<T extends string> = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: SegmentedControlVariant;
  size?: SegmentedControlSize;
  tone?: SegmentedControlTone;
  disabled?: boolean;
};

type SegmentedControlOptionProps<T extends string> = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange'
> & {
  value: T;
};

type SegmentedControlContextValue = {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

const SegmentedControlContext = createContext<SegmentedControlContextValue | null>(null);

function useSegmentedControlContext() {
  const context = useContext(SegmentedControlContext);
  if (!context) {
    throw new Error('SegmentedControl.Option must be used within SegmentedControl.');
  }
  return context;
}

function SegmentedControlRoot<T extends string>({
  value,
  onChange,
  ariaLabel,
  variant = 'segmented',
  size = 'sm',
  tone = 'default',
  disabled = false,
  className,
  children,
  ...props
}: SegmentedControlProps<T>) {
  const variantClass = variant === 'toolbar' ? 'toolbar-segmented' : 'segmented';
  const toneClass =
    tone === 'quiet'
      ? 'segmented--quiet'
      : tone === 'rail'
        ? 'segmented--rail'
        : tone === 'status'
          ? 'toolbar-segmented--status'
          : '';
  const sizeClass =
    variant === 'toolbar'
      ? size === 'sm'
        ? '[&>button]:h-7 [&>button]:px-2.5 [&>button]:text-[10px]'
        : ''
      : size === 'md'
        ? '[&>button]:h-8 [&>button]:px-3.5 [&>button]:text-sm'
        : '';

  return (
    <SegmentedControlContext.Provider
      value={{
        value,
        onChange: (next) => onChange(next as T),
        disabled,
      }}
    >
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn(variantClass, toneClass, sizeClass, className)}
        {...props}
      >
        {children}
      </div>
    </SegmentedControlContext.Provider>
  );
}

function SegmentedControlOption<T extends string>({
  value,
  className,
  onClick,
  disabled,
  children,
  ...props
}: SegmentedControlOptionProps<T>) {
  const context = useSegmentedControlContext();
  const active = context.value === value;
  const optionDisabled = context.disabled || !!disabled;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-pressed={active}
      data-active={active || undefined}
      disabled={optionDisabled}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !optionDisabled) {
          context.onChange(value);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

type SegmentedControlComponent = (<T extends string>(
  props: SegmentedControlProps<T>,
) => ReactElement) & {
  Option: <T extends string>(props: SegmentedControlOptionProps<T>) => ReactElement;
};

export const SegmentedControl = SegmentedControlRoot as SegmentedControlComponent;
SegmentedControl.Option = SegmentedControlOption;

export type {
  SegmentedControlVariant,
  SegmentedControlSize,
  SegmentedControlTone,
  SegmentedControlProps,
  SegmentedControlOptionProps,
};
