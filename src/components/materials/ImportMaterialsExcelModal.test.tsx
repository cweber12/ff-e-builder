import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MaterialImportColumnMap,
  MaterialParsedRow,
  ParsedMaterialSpreadsheet,
} from '../../lib/import';
import type { Finish } from '../../types';
import { ImportMaterialsExcelModal } from './ImportMaterialsExcelModal';

const mocks = vi.hoisted(() => ({
  parseMaterialSpreadsheet: vi.fn(),
  autoMapMaterialColumns: vi.fn(),
  createMaterialMutateAsync: vi.fn(),
}));

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks')>();
  return {
    ...actual,
    useCreateMaterial: () => ({ mutateAsync: mocks.createMaterialMutateAsync }),
  };
});

vi.mock('../../lib/import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/import')>();
  return {
    ...actual,
    parseMaterialSpreadsheet: mocks.parseMaterialSpreadsheet,
    autoMapMaterialColumns: mocks.autoMapMaterialColumns,
  };
});

const emptyMap: MaterialImportColumnMap = {
  name: null,
  code: null,
  finish: null,
  materialType: null,
  manufacturerRef: null,
  materialId: null,
  description: null,
};

function makeParsedSpreadsheet(
  overrides: Partial<ParsedMaterialSpreadsheet> = {},
): ParsedMaterialSpreadsheet {
  return {
    filename: 'materials.csv',
    sheetName: 'Sheet1',
    fileType: 'csv',
    columns: [],
    rows: [],
    warnings: [],
    ...overrides,
  };
}

function makeRow(overrides: Partial<MaterialParsedRow> = {}): MaterialParsedRow {
  return {
    id: 'row-1',
    rowNumber: 2,
    values: {},
    ...overrides,
  };
}

describe('ImportMaterialsExcelModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.autoMapMaterialColumns.mockReturnValue(emptyMap);
    mocks.createMaterialMutateAsync.mockResolvedValue({ id: 'material-1' });
  });

  it('rejects unsupported file types with a clear error', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    await user.upload(
      input as HTMLInputElement,
      new File(['x'], 'materials.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported file type. Upload a .xlsx, .xls, or .csv file.',
    );
    expect(mocks.parseMaterialSpreadsheet).not.toHaveBeenCalled();
  });

  it('shows confirm details with detected columns and parse warnings', async () => {
    const user = userEvent.setup();
    const columns = [
      { key: 'name__1', label: 'Name', columnNumber: 1 },
      { key: 'finish__2', label: 'Finish', columnNumber: 2 },
      { key: 'type__3', label: 'Type', columnNumber: 3 },
    ];
    mocks.parseMaterialSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [makeRow({ values: { name__1: 'Door Pull' } })],
        warnings: ['Sheet has merged cells; values were normalized.'],
      }),
    );
    mocks.autoMapMaterialColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
      finish: 'finish__2',
      materialType: 'type__3',
    });

    const { container } = render(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={[]}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'materials.csv', { type: 'text/csv' }),
    );

    expect(await screen.findByText('Detected columns (3)')).toBeInTheDocument();
    expect(screen.getByText('Name: Name')).toBeInTheDocument();
    expect(screen.getByText('Finish: Finish')).toBeInTheDocument();
    expect(screen.getByText('Type: Type')).toBeInTheDocument();
    expect(screen.getByText('Sheet has merged cells; values were normalized.')).toBeInTheDocument();
  });

  it('supports drag-drop upload through confirm and import', async () => {
    const user = userEvent.setup();
    const columns = [{ key: 'name__1', label: 'Name', columnNumber: 1 }];
    mocks.parseMaterialSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [makeRow({ values: { name__1: 'Door Pull' } })],
      }),
    );
    mocks.autoMapMaterialColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
    });

    const onSuccess = vi.fn();
    render(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={[]}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    const file = new File(['csv'], 'materials.csv', { type: 'text/csv' });
    const dropTarget = screen.getByText('Drop file here or click to browse');
    fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });

    expect(await screen.findByText('Detected columns (1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import 1 row' }));

    expect(await screen.findByText('Import complete: 1 material created.')).toBeInTheDocument();
    expect(mocks.parseMaterialSpreadsheet).toHaveBeenCalledWith(file);
    expect(mocks.createMaterialMutateAsync).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('imports rows with finish resolution by name then code and reports unresolved warnings', async () => {
    const user = userEvent.setup();
    const columns = [
      { key: 'name__1', label: 'Name', columnNumber: 1 },
      { key: 'code__2', label: 'Code', columnNumber: 2 },
      { key: 'finish__3', label: 'Finish', columnNumber: 3 },
      { key: 'type__4', label: 'Type', columnNumber: 4 },
      { key: 'material_id__5', label: 'Material ID', columnNumber: 5 },
      { key: 'description__6', label: 'Description', columnNumber: 6 },
    ];
    mocks.parseMaterialSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [
          makeRow({
            id: 'row-1',
            rowNumber: 2,
            values: {
              name__1: 'Handle',
              code__2: 'HD-1',
              finish__3: 'oak-22',
              type__4: 'Powder Coat',
              material_id__5: 'M-1',
            },
          }),
          makeRow({
            id: 'row-2',
            rowNumber: 3,
            values: {
              name__1: 'Shelf',
              code__2: 'SH-1',
              finish__3: 'OAK-100',
              type__4: 'Glass',
              material_id__5: 'M-2',
            },
          }),
          makeRow({
            id: 'row-3',
            rowNumber: 4,
            values: {
              name__1: 'Counter',
              code__2: 'CT-1',
              finish__3: 'Unknown Finish',
              material_id__5: 'M-3',
            },
          }),
        ],
      }),
    );
    mocks.autoMapMaterialColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
      code: 'code__2',
      finish: 'finish__3',
      materialType: 'type__4',
      materialId: 'material_id__5',
      description: 'description__6',
    });

    const finishes: Finish[] = [
      {
        id: 'finish-name-priority',
        projectId: 'project-1',
        code: 'X-1',
        name: 'Oak-22',
        category: null,
        subCategory: '',
        description: '',
        manufacturer: '',
        sourceUrl: '',
        swatchHex: '#D9D4C8',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'finish-code-priority',
        projectId: 'project-1',
        code: 'OAK-100',
        name: 'Walnut',
        category: null,
        subCategory: '',
        description: '',
        manufacturer: '',
        sourceUrl: '',
        swatchHex: '#D9D4C8',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'finish-code-conflict',
        projectId: 'project-1',
        code: 'oak-22',
        name: 'Other',
        category: null,
        subCategory: '',
        description: '',
        manufacturer: '',
        sourceUrl: '',
        swatchHex: '#D9D4C8',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const onSuccess = vi.fn();
    const { container } = render(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={finishes}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'materials.csv', { type: 'text/csv' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Import 3 rows' }));

    expect(await screen.findByText('Import complete: 3 materials created.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Row 4: finish "Unknown Finish" not found by name or code; imported without finish link.',
      ),
    ).toBeInTheDocument();
    expect(mocks.createMaterialMutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'Handle', finishId: 'finish-name-priority' }),
    );
    expect(mocks.createMaterialMutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Shelf', finishId: 'finish-code-priority' }),
    );
    expect(mocks.createMaterialMutateAsync).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ name: 'Counter', finishId: null }),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('uses exact normalized finish-name matching and does not collapse internal whitespace', async () => {
    const user = userEvent.setup();
    const columns = [
      { key: 'name__1', label: 'Name', columnNumber: 1 },
      { key: 'finish__2', label: 'Finish', columnNumber: 2 },
    ];
    mocks.parseMaterialSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [
          makeRow({
            id: 'row-1',
            rowNumber: 2,
            values: {
              name__1: 'Handle',
              finish__2: 'Walnut  A',
            },
          }),
        ],
      }),
    );
    mocks.autoMapMaterialColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
      finish: 'finish__2',
    });

    const finishes: Finish[] = [
      {
        id: 'finish-1',
        projectId: 'project-1',
        code: 'W-1',
        name: 'Walnut A',
        category: null,
        subCategory: '',
        description: '',
        manufacturer: '',
        sourceUrl: '',
        swatchHex: '#D9D4C8',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const { container } = render(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={finishes}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'materials.csv', { type: 'text/csv' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Import 1 row' }));

    expect(await screen.findByText('Import complete: 1 material created.')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Row 2: finish "Walnut\s+A" not found by name or code; imported without finish link\./,
      ),
    ).toBeInTheDocument();
    expect(mocks.createMaterialMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Handle',
        finishId: null,
      }),
    );
  });

  it('resets state when closed and re-opened', async () => {
    const user = userEvent.setup();
    const columns = [{ key: 'name__1', label: 'Name', columnNumber: 1 }];
    mocks.parseMaterialSpreadsheet.mockResolvedValue(
      makeParsedSpreadsheet({
        columns,
        rows: [makeRow({ values: { name__1: 'Walnut' } })],
      }),
    );
    mocks.autoMapMaterialColumns.mockReturnValue({
      ...emptyMap,
      name: 'name__1',
    });

    const onClose = vi.fn();
    const { container, rerender } = render(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={[]}
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    );

    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['csv'], 'materials.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText('Detected columns (1)')).toBeInTheDocument();

    rerender(
      <ImportMaterialsExcelModal
        open={false}
        projectId="project-1"
        finishes={[]}
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    );
    rerender(
      <ImportMaterialsExcelModal
        open
        projectId="project-1"
        finishes={[]}
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Upload an Excel (.xlsx, .xls) or CSV file to bulk-create project materials.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Detected columns (1)')).not.toBeInTheDocument();
  });
});
