import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ColorChipGroup } from './ColorChipGroup';
import { type CatalogColorToken } from '../../lib/export/ffe/catalogTokens';

const COLOR_OPTIONS = [
  { token: 'ink-950', hex: '#0a0a0a', label: 'Ink 950' },
  { token: 'ink-800', hex: '#262626', label: 'Ink 800' },
  { token: 'slate-700', hex: '#374151', label: 'Slate 700' },
] as const;

function StatefulColorChipGroup({
  initialValue = 'ink-950',
}: {
  initialValue?: CatalogColorToken;
}) {
  const [value, setValue] = useState<CatalogColorToken>(initialValue);
  return (
    <ColorChipGroup
      value={value}
      ariaLabel="Title color token"
      options={[...COLOR_OPTIONS]}
      onChange={setValue}
    />
  );
}

describe('ColorChipGroup', () => {
  it('clicking a chip calls onChange with the matching token', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ColorChipGroup
        value="ink-950"
        ariaLabel="Title color token"
        options={[...COLOR_OPTIONS]}
        onChange={onChange}
      />,
    );

    const [, secondChip] = screen.getAllByRole('radio') as [HTMLElement, HTMLElement, HTMLElement];
    await user.click(secondChip);

    expect(onChange).toHaveBeenCalledWith('ink-800');
  });

  it('arrow keys move selection and update aria-checked state', async () => {
    const user = userEvent.setup();
    render(<StatefulColorChipGroup initialValue="ink-950" />);

    const [firstChip, secondChip, thirdChip] = screen.getAllByRole('radio') as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    firstChip.focus();

    await user.keyboard('{ArrowRight}');
    expect(secondChip).toHaveAttribute('aria-checked', 'true');
    expect(secondChip).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(thirdChip).toHaveAttribute('aria-checked', 'true');
    expect(thirdChip).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(secondChip).toHaveAttribute('aria-checked', 'true');
    expect(secondChip).toHaveFocus();
  });

  it('exposes a single tab stop via roving tabindex', () => {
    render(<StatefulColorChipGroup initialValue="ink-800" />);

    const [firstChip, secondChip, thirdChip] = screen.getAllByRole('radio') as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    const chips = [firstChip, secondChip, thirdChip];
    const selectedTabStops = chips.filter((chip) => chip.getAttribute('tabindex') === '0');

    expect(selectedTabStops).toHaveLength(1);
    expect(secondChip).toHaveAttribute('tabindex', '0');
    expect(firstChip).toHaveAttribute('tabindex', '-1');
    expect(thirdChip).toHaveAttribute('tabindex', '-1');
  });
});
