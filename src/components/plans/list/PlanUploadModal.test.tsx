import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatePlanDocumentInput } from '../../../lib/api';
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

  it('uploads selected PDF pages as one plan document with editable sheet refs and page names', async () => {
    const pdfFile = new File(['pdf'], 'architectural set.pdf', { type: 'application/pdf' });
    const onCreateDocument = vi
      .fn<(input: CreatePlanDocumentInput) => Promise<void>>()
      .mockResolvedValue(undefined);
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

    render(
      <PlanUploadModal
        open
        creating={false}
        onClose={onClose}
        onCreateDocument={onCreateDocument}
      />,
    );

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

    fireEvent.change(screen.getByLabelText('Document name'), {
      target: { value: 'Architectural Set - Rev 3' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    await waitFor(() => expect(onCreateDocument).toHaveBeenCalledTimes(1));
    expect(onCreateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentName: 'Architectural Set - Rev 3',
        sourceFile: pdfFile,
        sheets: [
          expect.objectContaining({
            clientSheetId: 'page-1',
            sheetIndex: 1,
            name: 'architectural set page 01',
            sheetReference: 'A1-1',
            pdfPageNumber: 1,
          }),
          expect.objectContaining({
            clientSheetId: 'page-2',
            sheetIndex: 2,
            name: 'Enlarged furniture plan',
            sheetReference: 'A1-2',
            pdfPageNumber: 2,
          }),
          expect.objectContaining({
            clientSheetId: 'page-3',
            sheetIndex: 3,
            name: 'architectural set page 03',
            sheetReference: '',
            pdfPageNumber: 3,
          }),
        ],
      }),
    );
    const createdDocument = onCreateDocument.mock.calls[0]?.[0];
    expect(createdDocument?.sheets[0]?.name).toBe('architectural set page 01');
    expect(createdDocument?.sheets[0]?.renderFile).toBeInstanceOf(File);
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
