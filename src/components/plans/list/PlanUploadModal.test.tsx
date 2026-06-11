import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanUploadModal } from './PlanUploadModal';

const pdfMocks = vi.hoisted(() => ({
  renderPdfThumbnails: vi.fn(),
  renderPdfPageAsPngFile: vi.fn(),
}));

vi.mock('../../../lib/plans/pdf', () => ({
  renderPdfThumbnails: pdfMocks.renderPdfThumbnails,
  renderPdfPageAsPngFile: pdfMocks.renderPdfPageAsPngFile,
}));

describe('PlanUploadModal', () => {
  beforeEach(() => {
    pdfMocks.renderPdfThumbnails.mockReset();
    pdfMocks.renderPdfPageAsPngFile.mockReset();
  });

  it('uploads every selected PDF page with editable sheet refs and page names', async () => {
    const pdfFile = new File(['pdf'], 'architectural set.pdf', { type: 'application/pdf' });
    const onCreatePlan = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    pdfMocks.renderPdfThumbnails.mockResolvedValue([
      pagePreview(1),
      pagePreview(2),
      pagePreview(3),
    ]);
    pdfMocks.renderPdfPageAsPngFile.mockImplementation(
      ({ pageNumber, filename }: { pageNumber: number; filename: string }) =>
        Promise.resolve({
          file: new File(['png'], filename, { type: 'image/png' }),
          pageNumber,
          pageWidthPt: 100,
          pageHeightPt: 200,
          renderScale: 2,
          renderedWidthPx: 200,
          renderedHeightPx: 400,
          rotation: 0,
        }),
    );

    render(<PlanUploadModal open creating={false} onClose={onClose} onCreatePlan={onCreatePlan} />);

    fireEvent.change(screen.getByLabelText('Plan source'), {
      target: { files: [pdfFile] },
    });

    await waitFor(() => expect(pdfMocks.renderPdfThumbnails).toHaveBeenCalledWith(pdfFile));

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('3/3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByLabelText('Sheet reference for page 1'), {
      target: { value: 'A1-1' },
    });
    fireEvent.change(screen.getByLabelText('Sheet reference for page 2'), {
      target: { value: 'A1-2' },
    });
    fireEvent.change(screen.getByLabelText('Page name for page 2'), {
      target: { value: 'Enlarged furniture plan' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Upload 3 pages' }));

    await waitFor(() => expect(onCreatePlan).toHaveBeenCalledTimes(3));
    expect(onCreatePlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'architectural set page 01',
        sheetReference: 'A1-1',
        sourcePdfFile: pdfFile,
        pdfPageNumber: 1,
      }),
    );
    expect(onCreatePlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Enlarged furniture plan',
        sheetReference: 'A1-2',
        sourcePdfFile: pdfFile,
        pdfPageNumber: 2,
      }),
    );
    expect(onCreatePlan).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        name: 'architectural set page 03',
        sheetReference: '',
        sourcePdfFile: pdfFile,
        pdfPageNumber: 3,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});

function pagePreview(pageNumber: number) {
  return {
    pageNumber,
    widthPt: 100,
    heightPt: 200,
    rotation: 0,
    thumbnailUrl: `data:image/png;base64,page-${pageNumber}`,
  };
}
