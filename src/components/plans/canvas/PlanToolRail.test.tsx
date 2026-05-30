import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanToolRail } from './PlanToolRail';

describe('PlanToolRail', () => {
  it('disables downstream tools until the Measured Plan is calibrated', () => {
    render(<PlanToolRail activeTool="calibrate" isCalibrated={false} onToolChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Calibrate' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pan' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Length Line' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeDisabled();
  });

  it('enables measurement tools for calibrated Measured Plans', () => {
    const onToolChange = vi.fn();

    render(<PlanToolRail activeTool="calibrate" isCalibrated onToolChange={onToolChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Length Line' }));

    expect(screen.getByRole('button', { name: 'Length Line' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeEnabled();
    expect(onToolChange).toHaveBeenCalledWith('length');
  });
});
