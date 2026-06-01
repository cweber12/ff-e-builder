import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { SlotPortal } from './SlotPortal';

function SlotPortalHarness({ showSlot, text }: { showSlot: boolean; text: string }) {
  return (
    <>
      {showSlot ? <div id="test-slot" data-testid="test-slot" /> : null}
      <SlotPortal slotId="test-slot">
        <span>{text}</span>
      </SlotPortal>
    </>
  );
}

describe('SlotPortal', () => {
  it('reattaches content when a slot node is removed and recreated', async () => {
    const { rerender } = render(<SlotPortalHarness showSlot={true} text="first" />);
    await waitFor(() =>
      expect(within(screen.getByTestId('test-slot')).getByText('first')).toBeInTheDocument(),
    );

    rerender(<SlotPortalHarness showSlot={false} text="second" />);
    expect(screen.queryByText('second')).not.toBeInTheDocument();

    rerender(<SlotPortalHarness showSlot={true} text="third" />);
    await waitFor(() =>
      expect(within(screen.getByTestId('test-slot')).getByText('third')).toBeInTheDocument(),
    );
  });
});
