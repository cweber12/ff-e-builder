import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportMenu } from './ExportMenu';

describe('ExportMenu', () => {
  it('renders the trigger button with default label', () => {
    render(<ExportMenu onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<ExportMenu label="Export all" onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} />);
    expect(screen.getByRole('button', { name: /export all/i })).toBeInTheDocument();
  });

  it('dropdown is not visible initially', () => {
    render(<ExportMenu onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens dropdown on trigger click', async () => {
    const user = userEvent.setup();
    render(<ExportMenu onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /export excel/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /export pdf/i })).toBeInTheDocument();
  });

  it('calls onCsv and closes when CSV option clicked', async () => {
    const user = userEvent.setup();
    const onCsv = vi.fn();
    render(<ExportMenu onCsv={onCsv} onExcel={vi.fn()} onPdf={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByRole('menuitem', { name: /export csv/i }));
    expect(onCsv).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onExcel and closes when Excel option clicked', async () => {
    const user = userEvent.setup();
    const onExcel = vi.fn();
    render(<ExportMenu onCsv={vi.fn()} onExcel={onExcel} onPdf={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByRole('menuitem', { name: /export excel/i }));
    expect(onExcel).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onPdf and closes when PDF option clicked', async () => {
    const user = userEvent.setup();
    const onPdf = vi.fn();
    render(<ExportMenu onCsv={vi.fn()} onExcel={vi.fn()} onPdf={onPdf} />);
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByRole('menuitem', { name: /export pdf/i }));
    expect(onPdf).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ExportMenu onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('sets aria-expanded on trigger', async () => {
    const user = userEvent.setup();
    render(<ExportMenu onCsv={vi.fn()} onExcel={vi.fn()} onPdf={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /export/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
