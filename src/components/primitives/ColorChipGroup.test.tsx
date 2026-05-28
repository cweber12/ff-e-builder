import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorChipGroup } from './ColorChipGroup';

describe('ColorChipGroup', () => {
  it('clicking a chip calls onChange with the matching token', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ColorChipGroup
        value="ink-950"
        ariaLabel="Title color token"
        options={[
          { token: 'ink-950', hex: '#0a0a0a' },
          { token: 'ink-800', hex: '#262626' },
          { token: 'slate-700', hex: '#374151' },
        ]}
        onChange={onChange}
      />,
    );

    const chips = screen.getAllByRole('radio');
    await user.click(chips[1]);

    expect(onChange).toHaveBeenCalledWith('ink-800');
  });
});
