import { describe, expect, it } from 'vitest';
import {
  autoMapFinishColumns,
  autoMapMaterialColumns,
  parseFinishSpreadsheet,
  parseMaterialSpreadsheet,
} from './materials';
import type { ImportColumn } from '../engine';

function cols(...labels: string[]): ImportColumn[] {
  return labels.map((label, index) => ({
    key: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}__${index + 1}`,
    label,
    columnNumber: index + 1,
  }));
}

function makeCsvFile(contents: string, name: string): File {
  const bytes = new TextEncoder().encode(contents);
  return {
    name,
    type: 'text/csv',
    arrayBuffer() {
      return Promise.resolve(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
    },
  } as unknown as File;
}

describe('autoMapFinishColumns', () => {
  it('maps finish synonyms including mfr, hex color, and swatch image', () => {
    const mapping = autoMapFinishColumns(
      cols('Finish Name', 'Code', 'Mfr', 'Hex Color', 'Swatch', 'Description'),
    );

    expect(mapping.name).toBe('finish_name__1');
    expect(mapping.code).toBe('code__2');
    expect(mapping.manufacturer).toBe('mfr__3');
    expect(mapping.swatchHex).toBe('hex_color__4');
    expect(mapping.image).toBe('swatch__5');
    expect(mapping.description).toBe('description__6');
  });
});

describe('autoMapMaterialColumns', () => {
  it('maps material synonyms including Part # and Base Finish', () => {
    const mapping = autoMapMaterialColumns(
      cols('Name', 'Part #', 'Base Finish', 'Type', 'Manufacturer Ref'),
    );

    expect(mapping.name).toBe('name__1');
    expect(mapping.materialId).toBe('part___2');
    expect(mapping.finish).toBe('base_finish__3');
    expect(mapping.materialType).toBe('type__4');
    expect(mapping.manufacturerRef).toBe('manufacturer_ref__5');
  });
});

describe('parseFinishSpreadsheet', () => {
  it('parses finish rows and preserves hex color strings unchanged', async () => {
    const csv = [
      'Name,Code,Category,Hex Color,Manufacturer,Description',
      'Walnut,WAL-100,Wood,#A57C52,Acme,Dark walnut veneer',
    ].join('\n');
    const file = makeCsvFile(csv, 'finishes.csv');

    const parsed = await parseFinishSpreadsheet(file);
    const hexColumn = parsed.columns.find((column) => column.label === 'Hex Color');
    const nameColumn = parsed.columns.find((column) => column.label === 'Name');

    expect(parsed.fileType).toBe('csv');
    expect(parsed.rows).toHaveLength(1);
    expect(hexColumn).toBeDefined();
    expect(nameColumn).toBeDefined();
    expect(parsed.rows[0]!.values[hexColumn!.key]).toBe('#A57C52');
    expect(parsed.rows[0]!.values[nameColumn!.key]).toBe('Walnut');
  });

  it('returns a warning when no recognizable header row is found', async () => {
    const csv = ['Name,Code', 'Walnut,WAL-100'].join('\n');
    const file = makeCsvFile(csv, 'bad-finishes.csv');

    const parsed = await parseFinishSpreadsheet(file);
    expect(parsed.columns).toHaveLength(0);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.warnings[0]).toMatch(/at least 3 column labels/i);
  });
});

describe('parseMaterialSpreadsheet', () => {
  it('parses material rows with values', async () => {
    const csv = [
      'Name,Code,Part #,Base Finish,Type,Manufacturer Ref,Description',
      'Door Pull,DP-10,445-AX,Walnut,Hardware,MFR-778,Solid brass pull',
    ].join('\n');
    const file = makeCsvFile(csv, 'materials.csv');

    const parsed = await parseMaterialSpreadsheet(file);
    const partColumn = parsed.columns.find((column) => column.label === 'Part #');
    const finishColumn = parsed.columns.find((column) => column.label === 'Base Finish');

    expect(parsed.rows).toHaveLength(1);
    expect(partColumn).toBeDefined();
    expect(finishColumn).toBeDefined();
    expect(parsed.rows[0]!.values[partColumn!.key]).toBe('445-AX');
    expect(parsed.rows[0]!.values[finishColumn!.key]).toBe('Walnut');
  });
});
