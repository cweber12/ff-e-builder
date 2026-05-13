import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryView } from './SummaryView';
import { catalogProjectFixture, catalogRoomsFixture } from '../../../data/catalogFixture';
import { cents, formatMoney } from '../../../types';
import { projectTotalCents, roomSubtotalCents } from '../../../lib/money';

describe('SummaryView', () => {
  it('renders room subtotals, grand total, and status cards', () => {
    render(<SummaryView project={catalogProjectFixture} roomsWithItems={catalogRoomsFixture} />);

    expect(screen.getByRole('heading', { name: 'Budget vs actual' })).toBeInTheDocument();
    expect(
      screen.getAllByText(formatMoney(cents(projectTotalCents(catalogRoomsFixture)))).length,
    ).toBeGreaterThan(0);

    for (const room of catalogRoomsFixture) {
      expect(screen.getByText(room.name)).toBeInTheDocument();
      expect(
        screen.getAllByText(formatMoney(cents(roomSubtotalCents(room.items)))).length,
      ).toBeGreaterThan(0);
    }

    expect(screen.getByLabelText('Status: Pending')).toBeInTheDocument();
    expect(screen.getByLabelText('Status: Approved')).toBeInTheDocument();
  });
});
