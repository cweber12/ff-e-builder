import { InlineNumberEdit } from '../../primitives/InlineNumberEdit';

type GeneratedItemEditableNumberControlProps = {
  value: number;
  onSave: (value: number) => Promise<void> | void;
  formatter: (value: number) => string;
  parser?: (raw: string) => number | undefined;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
};

export function GeneratedItemEditableNumberControl({
  value,
  onSave,
  formatter,
  parser,
  min,
  max,
  placeholder,
  className,
  inputClassName,
  ariaLabel,
}: GeneratedItemEditableNumberControlProps) {
  return (
    <InlineNumberEdit
      value={value}
      onSave={onSave}
      formatter={formatter}
      {...(parser !== undefined ? { parser } : {})}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(placeholder !== undefined ? { placeholder } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(inputClassName !== undefined ? { inputClassName } : {})}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
    />
  );
}
