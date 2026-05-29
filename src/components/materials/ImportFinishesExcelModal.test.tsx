import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FinishImportColumnMap,
  FinishImportImage,
  FinishParsedRow,
  ParsedFinishSpreadsheet,
} from '../../lib/import';
import { ImportFinishesExcelModal } from './ImportFinishesExcelModal';

const mocks = vi.hoisted(() => ({
  parseFinishSpreadsheet: vi.fn(),
  autoMapFinishColumns: vi.fn(),
  createFinishMutateAsync: vi.fn(),
  uploadImageMutateAsync: vi.fn(),
}));

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useCreateFinish: () => ({ mutateAsync: mocks.createFinishMutateAsync }),
    useUploadImage: () => ({ mutateAsync: mocks.uploadImageMutateAsync }),
  };
});

vi.mock('../../lib/import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/import')>();
  return {
    ...actual,
    parseFinishSpreadsheet: mocks.parseFinishSpreadsheet,
    autoMapFinishColumns: mocks.autoMapFinishColumns,
  };
});

const emptyMap: FinishImportColumnMap = {
  name: null,
  code: null,
  category: null,
  subCategory: null,
  manufacturer: null,
  sourceUrl: null,
  swatchHex: null,
  description: null,
  image: null,
};

function makeParsedSpreadsheet(
  overrides: Partial<ParsedFinishSpreadsheet> = {},
): ParsedFinishSpreadsheet {
  return {
    filename: 'finishes.csv',
    sheetName: 'Sheet1',
    fileType: 'csv',
    columns: [],
    rows: [],
    warnings: [],
    ...overrides,
  };
}

function makeRow(overrides: Partial<FinishParsedRow> = {}): FinishParsedRow {
  return {
    id: 'row-1',
    rowNumber: 2,
    values: {},
    imagesByColumn: {},
    images: { image: [] },
    ...overrides,
  };
}

describe('ImportFinishesExcelModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.autoMapFinishColumns.mockReturnValue(emptyMap);
    mocks.createFinishMutateAsync.mockResolvedValue({
      id: 'finish-1',
      name: 'Walnut',
    });
    mocks.uploadImageMutateAsync.mockResolvedValue({
      id: 'img-1',
    });
  });

  it('rejects unsupported file types with a clear error', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(
      <ImportFinishesExcelModal open projectId="project-1" onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    await user.upload(
      input as HTMLInputElement,
      new File(['x'], 'finishes.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported file type. Upload a .xlsx, .xls, or .csv file.',
    );
    expect(mocks.parseFinishSpreadsheet).not.toHaveBeenCalled();
  });

  it('blocks confirm when no recognizable header row is found', async () => {
    const user = userEvent.setup();
    mocks.parseFinishSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns: [],
        rows: [],
        warnings: ['No recognizable header row was detected (expected at least 3 column labels).'],
      }),
    );

    const { container } = render(
      <ImportFinishesExcelModal open projectId="project-1" onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'bad.csv', { type: 'text/csv' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/header row/i);
    expect(screen.queryByText('Detected columns')).not.toBeInTheDocument();
  });

  it('shows confirm details with detected columns and parse warnings', async () => {
    const user = userEvent.setup();
    const columns = [
      { key: 'name__1', label: 'Name', columnNumber: 1 },
      { key: 'category__2', label: 'Category', columnNumber: 2 },
      { key: 'image__3', label: 'Swatch', columnNumber: 3 },
    ];
    mocks.parseFinishSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [
          makeRow({
            values: { name__1: 'Walnut' },
          }),
        ],
        warnings: ['Sheet has merged cells; values were normalized.'],
      }),
    );
    mocks.autoMapFinishColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
      category: 'category__2',
      image: 'image__3',
    });

    const { container } = render(
      <ImportFinishesExcelModal open projectId="project-1" onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'finishes.csv', { type: 'text/csv' }),
    );

    expect(await screen.findByText('Detected columns (3)')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Swatch')).toBeInTheDocument();
    expect(screen.getByText('Name: Name')).toBeInTheDocument();
    expect(screen.getByText('Category: Category')).toBeInTheDocument();
    expect(screen.getByText('Image: Swatch')).toBeInTheDocument();
    expect(screen.getByText('Sheet has merged cells; values were normalized.')).toBeInTheDocument();
  });

  it('imports rows, uploads swatch images, and reports summary warnings', async () => {
    const user = userEvent.setup();
    const image: FinishImportImage = {
      id: 'img-1',
      filename: 'swatch.png',
      contentType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71]),
      row: 2,
      column: 3,
      rowEnd: 2,
      columnEnd: 3,
    };
    const columns = [
      { key: 'name__1', label: 'Name', columnNumber: 1 },
      { key: 'category__2', label: 'Category', columnNumber: 2 },
      { key: 'image__3', label: 'Swatch', columnNumber: 3 },
    ];
    mocks.parseFinishSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [
          makeRow({
            id: 'row-1',
            rowNumber: 2,
            values: { name__1: 'Walnut', category__2: 'Wood' },
            imagesByColumn: { image__3: [image] },
          }),
          makeRow({
            id: 'row-2',
            rowNumber: 3,
            values: { name__1: 'Oak', category__2: 'Wood' },
          }),
        ],
      }),
    );
    mocks.autoMapFinishColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
      category: 'category__2',
      image: 'image__3',
    });
    mocks.createFinishMutateAsync
      .mockResolvedValueOnce({ id: 'finish-1', name: 'Walnut' })
      .mockRejectedValueOnce(new Error('create failed'));

    const onSuccess = vi.fn();
    const { container } = render(
      <ImportFinishesExcelModal
        open
        projectId="project-1"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'finishes.csv', { type: 'text/csv' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Import 2 rows' }));

    expect(
      await screen.findByText('Import complete: 1 finish created, 1 image imported.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Row 3: finish create failed.')).toBeInTheDocument();
    expect(mocks.createFinishMutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.uploadImageMutateAsync).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('resets state when closed and re-opened', async () => {
    const user = userEvent.setup();
    const columns = [{ key: 'name__1', label: 'Name', columnNumber: 1 }];
    mocks.parseFinishSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [makeRow({ values: { name__1: 'Walnut' } })],
      }),
    );
    mocks.autoMapFinishColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
    });

    const onClose = vi.fn();
    const { container, rerender } = render(
      <ImportFinishesExcelModal open projectId="project-1" onClose={onClose} onSuccess={vi.fn()} />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'finishes.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText('Detected columns (1)')).toBeInTheDocument();

    rerender(
      <ImportFinishesExcelModal
        open={false}
        projectId="project-1"
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    );
    rerender(
      <ImportFinishesExcelModal open projectId="project-1" onClose={onClose} onSuccess={vi.fn()} />,
    );

    expect(
      screen.getByText(
        'Upload an Excel (.xlsx, .xls) or CSV file to bulk-create finish library entries.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Detected columns (1)')).not.toBeInTheDocument();
  });
});
