import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeneratedItemEditableTextControl } from './GeneratedItemEditableTextCell';

describe('GeneratedItemEditableTextControl', () => {
  it('does not show row-hover affordance classes by default', () => {
    render(
      <GeneratedItemEditableTextControl value="Desk" onSave={vi.fn()} ariaLabel="Edit item name" />,
    );

    const trigger = screen.getByRole('button', { name: 'Edit item name' });
    expect(trigger.className).not.toContain('group-hover:decoration-brand-200');
  });

  it('adds row-hover affordance classes when affordance is hover', () => {
    render(
      <GeneratedItemEditableTextControl
        value="Desk"
        onSave={vi.fn()}
        ariaLabel="Edit item name"
        affordance="hover"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Edit item name' });
    expect(trigger.className).toContain('group-hover:decoration-brand-200');
  });
});
