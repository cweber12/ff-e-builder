import { api } from './api';
import { reportError } from './utils';
import type { Project } from '../types';

type SeedProjectOptions = {
  projectName: string;
  clientName?: string;
  companyName?: string;
  projectLocation?: string;
};

type PlaceholderImageSpec = {
  label: string;
  width: number;
  height: number;
  filename: string;
  palette: {
    base: string;
    panel: string;
    accent: string;
    text: string;
  };
  subtitle?: string;
};

type ProposalRowSeed = {
  productTag: string;
  plan: string;
  drawings: string;
  location: string;
  description: string;
  sizeLabel: string;
  sizeMode: 'imperial' | 'metric';
  sizeW: string;
  sizeD: string;
  sizeH: string;
  sizeUnit: string;
  cbm: number;
  quantity: number;
  quantityUnit: string;
  unitCostCents: number;
  renderingLabel: string;
  swatchLabels: string[];
};

const ffAndERoomSeeds = [
  {
    name: 'Lobby',
    items: [
      {
        itemName: 'Reception Desk',
        category: 'Millwork',
        itemIdTag: 'LB-001',
        dimensions: `14'0" W x 3'6" D x 3'6" H`,
        qty: 1,
        unitCostCents: 840000,
        status: 'approved' as const,
        notes: 'Coordinate stone reveal and cable grommet layout.',
        imageLabel: 'Lobby Reception Desk',
        materialNames: ['Walnut Veneer', 'Calacatta Stone'],
      },
      {
        itemName: 'Lounge Chair',
        category: 'Seating',
        itemIdTag: 'LB-002',
        dimensions: `32" W x 34" D x 30" H`,
        qty: 4,
        unitCostCents: 185000,
        status: 'ordered' as const,
        notes: 'Use performance upholstery on all public-facing chairs.',
        imageLabel: 'Lobby Lounge Chair',
        materialNames: ['Ivory Boucle', 'Smoked Bronze'],
      },
      {
        itemName: 'Coffee Table',
        category: 'Tables',
        itemIdTag: 'LB-003',
        dimensions: `48" W x 30" D x 16" H`,
        qty: 2,
        unitCostCents: 126000,
        status: 'pending' as const,
        notes: 'Confirm rounded edge profile matches rendering.',
        imageLabel: 'Lobby Coffee Table',
        materialNames: ['Travertine', 'Walnut Veneer'],
      },
      {
        itemName: 'Feature Pendant',
        category: 'Lighting',
        itemIdTag: 'LB-004',
        dimensions: `54" Dia x 18" H`,
        qty: 1,
        unitCostCents: 212000,
        status: 'received' as const,
        notes: 'Final drop height per reflected ceiling plan.',
        imageLabel: 'Lobby Feature Pendant',
        materialNames: ['Linen Oak', 'Smoked Bronze'],
      },
    ],
  },
  {
    name: 'Guest Lounge',
    items: [
      {
        itemName: 'Sectional Sofa',
        category: 'Seating',
        itemIdTag: 'GL-001',
        dimensions: `126" W x 84" D x 31" H`,
        qty: 1,
        unitCostCents: 495000,
        status: 'approved' as const,
        notes: 'Split COM and contrast welt on seat deck.',
        imageLabel: 'Guest Lounge Sectional',
        materialNames: ['Moss Velvet', 'Walnut Veneer'],
      },
      {
        itemName: 'Side Table',
        category: 'Tables',
        itemIdTag: 'GL-002',
        dimensions: `20" Dia x 22" H`,
        qty: 3,
        unitCostCents: 58000,
        status: 'ordered' as const,
        notes: 'Top finish to align with public lounge palette.',
        imageLabel: 'Guest Lounge Side Table',
        materialNames: ['Smoked Bronze', 'Calacatta Stone'],
      },
      {
        itemName: 'Area Rug',
        category: 'Flooring',
        itemIdTag: 'GL-003',
        dimensions: `12'0" W x 15'0" D`,
        qty: 1,
        unitCostCents: 264000,
        status: 'pending' as const,
        notes: 'Reserve final dye lot from strike-off approval.',
        imageLabel: 'Guest Lounge Area Rug',
        materialNames: ['Sand Weave'],
      },
      {
        itemName: 'Floor Lamp',
        category: 'Lighting',
        itemIdTag: 'GL-004',
        dimensions: `18" W x 18" D x 68" H`,
        qty: 2,
        unitCostCents: 97000,
        status: 'approved' as const,
        notes: 'Confirm dimmer compatibility with outlet spec.',
        imageLabel: 'Guest Lounge Floor Lamp',
        materialNames: ['Linen Oak', 'Smoked Bronze'],
      },
    ],
  },
] as const;

const materialSeeds = [
  {
    name: 'Walnut Veneer',
    materialId: 'MAT-001',
    description: 'Quarter-cut walnut veneer.',
    color: '#8b5e3c',
  },
  {
    name: 'Calacatta Stone',
    materialId: 'MAT-002',
    description: 'Warm white stone with gray veining.',
    color: '#ddd7cf',
  },
  {
    name: 'Ivory Boucle',
    materialId: 'MAT-003',
    description: 'Performance boucle upholstery.',
    color: '#ece5d8',
  },
  {
    name: 'Smoked Bronze',
    materialId: 'MAT-004',
    description: 'PVD smoked bronze metal finish.',
    color: '#5a4a42',
  },
  {
    name: 'Travertine',
    materialId: 'MAT-005',
    description: 'Honed warm travertine slab.',
    color: '#cfbe9f',
  },
  {
    name: 'Linen Oak',
    materialId: 'MAT-006',
    description: 'Light oak with matte sealer.',
    color: '#d0b48f',
  },
  {
    name: 'Moss Velvet',
    materialId: 'MAT-007',
    description: 'Deep green velvet upholstery.',
    color: '#6a7453',
  },
  {
    name: 'Sand Weave',
    materialId: 'MAT-008',
    description: 'Flat woven neutral rug texture.',
    color: '#cdbda2',
  },
] as const;

const proposalCategorySeeds: Array<{ name: string; rows: ProposalRowSeed[] }> = [
  {
    name: 'Millwork',
    rows: [
      makeProposalRow(
        'MIL',
        1,
        'Reception Base Cabinet',
        'LB-101.1',
        'Lobby North Wall',
        `14'-0" W x 3'-6" D x 3'-6" H`,
        18.4,
        1,
        'unit',
        198000,
        1,
      ),
      makeProposalRow(
        'MIL',
        2,
        'Banquette Millwork',
        'LB-104.2',
        'Guest Lounge South Wall',
        `11'-6" W x 2'-4" D x 2'-10" H`,
        12.2,
        1,
        'unit',
        164000,
        2,
      ),
      makeProposalRow(
        'MIL',
        3,
        'Display Shelving',
        'LB-107.3',
        'Lobby East Alcove',
        `9'-0" W x 1'-6" D x 8'-0" H`,
        7.8,
        1,
        'unit',
        132000,
        3,
      ),
      makeProposalRow(
        'MIL',
        4,
        'Bar Back Cabinet',
        'LB-111.4',
        'Lounge Service Niche',
        `10'-0" W x 2'-0" D x 7'-6" H`,
        10.6,
        1,
        'unit',
        176000,
        4,
      ),
    ],
  },
  {
    name: 'Ceiling',
    rows: [
      makeProposalRow(
        'CLG',
        1,
        'Wood Slat Ceiling',
        'RCP-201',
        'Lobby Main Field',
        `24'-0" W x 18'-0" D x 1'-0" H`,
        23.1,
        432,
        'sq ft',
        2800,
        1,
      ),
      makeProposalRow(
        'CLG',
        2,
        'Feature Cove',
        'RCP-202',
        'Reception Perimeter',
        `16'-0" W x 1'-6" D x 1'-4" H`,
        6.8,
        48,
        'ln ft',
        3400,
        2,
      ),
      makeProposalRow(
        'CLG',
        3,
        'Cloud Panel',
        'RCP-203',
        'Guest Lounge Seating',
        `12'-0" W x 8'-0" D x 0'-8" H`,
        8.4,
        96,
        'sq ft',
        2600,
        3,
      ),
      makeProposalRow(
        'CLG',
        4,
        'Gypsum Ceiling Drop',
        'RCP-204',
        'Corridor Threshold',
        `20'-0" W x 3'-0" D x 1'-0" H`,
        5.2,
        60,
        'sq ft',
        1900,
        4,
      ),
    ],
  },
  {
    name: 'Flooring',
    rows: [
      makeProposalRow(
        'FLR',
        1,
        'Large Format Stone',
        'FIN-301',
        'Lobby Entry',
        `24" x 24"`,
        14.5,
        380,
        'sq ft',
        2200,
        1,
      ),
      makeProposalRow(
        'FLR',
        2,
        'Inset Carpet Field',
        'FIN-302',
        'Guest Lounge Seating',
        `18'-0" W x 14'-0" D`,
        9.8,
        252,
        'sq ft',
        1600,
        2,
      ),
      makeProposalRow(
        'FLR',
        3,
        'Wood Threshold',
        'FIN-303',
        'Lounge Transition',
        `8'-0" W x 0'-6" D`,
        0.7,
        8,
        'ln ft',
        1800,
        3,
      ),
      makeProposalRow(
        'FLR',
        4,
        'Stone Base Border',
        'FIN-304',
        'Reception Perimeter',
        `26'-0" W x 0'-4" D`,
        1.1,
        26,
        'ln ft',
        1450,
        4,
      ),
    ],
  },
  {
    name: 'Walls',
    rows: [
      makeProposalRow(
        'WAL',
        1,
        'Wood Veneer Cladding',
        'INT-401',
        'Lobby Feature Wall',
        `18'-0" W x 10'-0" H`,
        11.2,
        180,
        'sq ft',
        3100,
        1,
      ),
      makeProposalRow(
        'WAL',
        2,
        'Upholstered Panel',
        'INT-402',
        'Guest Lounge Banquette',
        `14'-0" W x 5'-0" H`,
        5.3,
        70,
        'sq ft',
        2650,
        2,
      ),
      makeProposalRow(
        'WAL',
        3,
        'Stone Slab Surround',
        'INT-403',
        'Reception Portal',
        `10'-0" W x 9'-0" H`,
        7.9,
        90,
        'sq ft',
        4200,
        3,
      ),
      makeProposalRow(
        'WAL',
        4,
        'Mirror Panel System',
        'INT-404',
        'Bar Back Display',
        `12'-0" W x 8'-0" H`,
        6.4,
        96,
        'sq ft',
        2800,
        4,
      ),
    ],
  },
];

function makeProposalRow(
  prefix: string,
  index: number,
  description: string,
  drawingId: string,
  location: string,
  sizeLabel: string,
  cbm: number,
  quantity: number,
  quantityUnit: string,
  unitCostCents: number,
  swatchCount: number,
): ProposalRowSeed {
  return {
    productTag: `${prefix}-${String(index).padStart(3, '0')}`,
    plan: `P-${200 + index}`,
    drawings: drawingId,
    location,
    description,
    sizeLabel,
    sizeMode: 'imperial',
    sizeW: `${12 + index}`,
    sizeD: `${2 + index}`,
    sizeH: `${3 + index}`,
    sizeUnit: 'ft/in',
    cbm,
    quantity,
    quantityUnit,
    unitCostCents,
    renderingLabel: description,
    swatchLabels: Array.from(
      { length: swatchCount },
      (_, offset) => `${description} Swatch ${offset + 1}`,
    ),
  };
}

export async function createProjectWithSampleContent(input: {
  name: string;
  clientName?: string;
  companyName?: string;
  projectLocation?: string;
  budgetCents?: number;
}): Promise<Project> {
  const project = await api.projects.create(input);
  try {
    await seedProjectSampleContent(project, {
      projectName: project.name,
      clientName: project.clientName,
      ...(project.companyName ? { companyName: project.companyName } : {}),
      ...(project.projectLocation ? { projectLocation: project.projectLocation } : {}),
    });
  } catch (err) {
    reportError(err, { source: 'createProjectWithSampleContent', projectId: project.id });
    throw err;
  }
  return project;
}

export async function seedProjectSampleContent(
  project: Pick<Project, 'id' | 'name' | 'clientName' | 'companyName' | 'projectLocation'>,
  options: SeedProjectOptions,
): Promise<void> {
  const createdFfeItems: Array<{
    itemId: string;
    roomName: string;
    imageLabel: string;
    imageFilename: string;
    paletteIndex: number;
    materialNames: readonly string[];
  }> = [];

  for (const [roomIndex, roomSeed] of ffAndERoomSeeds.entries()) {
    const room = await api.rooms.create(project.id, {
      name: roomSeed.name,
      sortOrder: roomIndex,
    });
    for (const [itemIndex, itemSeed] of roomSeed.items.entries()) {
      const item = await api.items.create(room.id, {
        itemName: itemSeed.itemName,
        category: itemSeed.category,
        itemIdTag: itemSeed.itemIdTag,
        dimensions: itemSeed.dimensions,
        notes: itemSeed.notes,
        qty: itemSeed.qty,
        unitCostCents: itemSeed.unitCostCents,
        status: itemSeed.status,
        sortOrder: itemIndex,
      });
      createdFfeItems.push({
        itemId: item.id,
        roomName: roomSeed.name,
        imageLabel: itemSeed.imageLabel,
        imageFilename: `${itemSeed.itemIdTag?.toLowerCase() ?? `item-${itemIndex + 1}`}.png`,
        paletteIndex: itemIndex + roomIndex + 1,
        materialNames: itemSeed.materialNames,
      });
    }
  }

  const proposalCategories = await api.proposal.categories(project.id);
  const proposalCategoryMap = new Map(
    proposalCategories.map((category) => [category.name, category.id]),
  );

  const createdProposalItems: Array<{
    itemId: string;
    categoryName: string;
    rowSeed: ProposalRowSeed;
    paletteIndex: number;
  }> = [];

  for (const categorySeed of proposalCategorySeeds) {
    const categoryId = proposalCategoryMap.get(categorySeed.name);
    if (!categoryId) continue;
    for (const [rowIndex, rowSeed] of categorySeed.rows.entries()) {
      const item = await api.proposal.createItem(categoryId, {
        productTag: rowSeed.productTag,
        plan: rowSeed.plan,
        drawings: rowSeed.drawings,
        location: rowSeed.location,
        description: rowSeed.description,
        sizeLabel: rowSeed.sizeLabel,
        sizeMode: rowSeed.sizeMode,
        sizeW: rowSeed.sizeW,
        sizeD: rowSeed.sizeD,
        sizeH: rowSeed.sizeH,
        sizeUnit: rowSeed.sizeUnit,
        cbm: rowSeed.cbm,
        quantity: rowSeed.quantity,
        quantityUnit: rowSeed.quantityUnit,
        unitCostCents: rowSeed.unitCostCents,
        sortOrder: rowIndex,
      });
      createdProposalItems.push({
        itemId: item.id,
        categoryName: categorySeed.name,
        rowSeed,
        paletteIndex: rowIndex + 2,
      });
    }
  }

  const materialMap = await createSampleMaterials(project.id);

  await Promise.all(
    createdFfeItems.map(async (item) => {
      await Promise.all(
        item.materialNames.map(async (materialName) => {
          const material = materialMap.get(materialName as (typeof materialSeeds)[number]['name']);
          if (material) {
            await safeSampleStep(`assign material ${materialName}`, () =>
              api.materials.assignToItem(item.itemId, material.id),
            );
          }
        }),
      );
    }),
  );

  await Promise.all([
    ...[1, 2, 3].map((slot) =>
      safeSampleStep(`project image ${slot}`, async () => {
        const file = await createPlaceholderImageFile({
          label: options.projectName,
          subtitle: `Project image ${slot}`,
          width: 1600,
          height: 900,
          filename: `project-image-${slot}.png`,
          palette: paletteByIndex(slot),
        });
        await api.images.upload({
          entityType: 'project',
          entityId: project.id,
          file,
          altText: `${options.projectName} project image ${slot}`,
        });
      }),
    ),
    ...createdFfeItems.map((item) =>
      safeSampleStep(`FF&E image ${item.imageLabel}`, async () => {
        const file = await createPlaceholderImageFile({
          label: item.imageLabel,
          subtitle: item.roomName,
          width: 1200,
          height: 900,
          filename: item.imageFilename,
          palette: paletteByIndex(item.paletteIndex),
        });
        await api.images.upload({
          entityType: 'item',
          entityId: item.itemId,
          file,
          altText: item.imageLabel,
        });
      }),
    ),
    ...createdProposalItems.map((item) =>
      safeSampleStep(`proposal rendering ${item.rowSeed.productTag}`, async () => {
        const file = await createPlaceholderImageFile({
          label: item.rowSeed.renderingLabel,
          subtitle: item.categoryName,
          width: 1200,
          height: 900,
          filename: `${item.rowSeed.productTag.toLowerCase()}-rendering.png`,
          palette: paletteByIndex(item.paletteIndex),
        });
        await api.images.upload({
          entityType: 'proposal_item',
          entityId: item.itemId,
          file,
          altText: `${item.rowSeed.description} rendering`,
        });
      }),
    ),
    ...createdProposalItems.flatMap((item) =>
      item.rowSeed.swatchLabels.map((swatchLabel, swatchIndex) =>
        safeSampleStep(
          `proposal swatch ${item.rowSeed.productTag}-${swatchIndex + 1}`,
          async () => {
            const material = await api.materials.createAndAssignToProposalItem(item.itemId, {
              name: swatchLabel,
              materialId: '',
            });
            const file = await createPlaceholderImageFile({
              label: swatchLabel,
              subtitle: `Swatch ${swatchIndex + 1}`,
              width: 420,
              height: 420,
              filename: `${item.rowSeed.productTag.toLowerCase()}-swatch-${swatchIndex + 1}.png`,
              palette: paletteByIndex(item.paletteIndex + swatchIndex + 1),
            });
            await api.images.upload({
              entityType: 'material',
              entityId: material.id,
              file,
              altText: swatchLabel,
            });
          },
        ),
      ),
    ),
  ]);
}

async function createSampleMaterials(projectId: string) {
  const materials = await Promise.all(
    materialSeeds.map(async (seed) => {
      const material = await api.materials.create(projectId, {
        name: seed.name,
        materialId: seed.materialId,
        description: seed.description,
      });
      await safeSampleStep(`material image ${seed.name}`, async () => {
        const swatchImage = await createPlaceholderImageFile({
          label: seed.name,
          subtitle: seed.materialId,
          width: 420,
          height: 420,
          filename: `${seed.materialId.toLowerCase()}.png`,
          palette: {
            base: seed.color,
            panel: lighten(seed.color, 0.16),
            accent: darken(seed.color, 0.18),
            text: '#ffffff',
          },
        });
        await api.images.upload({
          entityType: 'material',
          entityId: material.id,
          file: swatchImage,
          altText: seed.name,
        });
      });
      return [seed.name, material] as const;
    }),
  );
  return new Map(materials);
}

async function safeSampleStep(label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    reportError(error, { source: 'seedProjectSampleContent', step: label });
  }
}

async function createPlaceholderImageFile(spec: PlaceholderImageSpec): Promise<File> {
  const svg = buildPlaceholderSvg(spec);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () =>
        reject(new Error(`Unable to render placeholder image ${spec.filename}`));
      nextImage.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare placeholder image canvas.');
    context.drawImage(image, 0, 0, spec.width, spec.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error(`Unable to encode placeholder image ${spec.filename}`));
      }, 'image/png');
    });

    return new File([blob], spec.filename, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function buildPlaceholderSvg(spec: PlaceholderImageSpec) {
  const { width, height, label, subtitle, palette } = spec;
  const safeLabel = escapeXml(label);
  const safeSubtitle = escapeXml(subtitle ?? '');
  const radius = Math.round(Math.min(width, height) * 0.035);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.base}" />
      <stop offset="100%" stop-color="${palette.panel}" />
    </linearGradient>
    <pattern id="grid" width="${Math.max(18, Math.round(width * 0.06))}" height="${Math.max(18, Math.round(height * 0.06))}" patternUnits="userSpaceOnUse">
      <path d="M 0 ${Math.max(18, Math.round(height * 0.06))} L ${Math.max(18, Math.round(width * 0.06))} 0" stroke="${palette.accent}" stroke-opacity="0.16" stroke-width="2" />
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" rx="${radius}" fill="url(#bg)" />
  <rect x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.08)}" width="${Math.round(width * 0.88)}" height="${Math.round(height * 0.84)}" rx="${Math.round(radius * 0.75)}" fill="rgba(255,255,255,0.16)" />
  <rect x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.08)}" width="${Math.round(width * 0.88)}" height="${Math.round(height * 0.84)}" rx="${Math.round(radius * 0.75)}" fill="url(#grid)" />
  <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.18)}" width="${Math.round(width * 0.5)}" height="${Math.round(height * 0.3)}" rx="${Math.round(radius * 0.5)}" fill="${palette.accent}" fill-opacity="0.22" />
  <rect x="${Math.round(width * 0.46)}" y="${Math.round(height * 0.34)}" width="${Math.round(width * 0.28)}" height="${Math.round(height * 0.18)}" rx="${Math.round(radius * 0.45)}" fill="${palette.accent}" fill-opacity="0.3" />
  <rect x="${Math.round(width * 0.16)}" y="${Math.round(height * 0.58)}" width="${Math.round(width * 0.68)}" height="${Math.round(height * 0.07)}" rx="${Math.round(radius * 0.25)}" fill="rgba(255,255,255,0.34)" />
  <rect x="${Math.round(width * 0.16)}" y="${Math.round(height * 0.69)}" width="${Math.round(width * 0.52)}" height="${Math.round(height * 0.05)}" rx="${Math.round(radius * 0.2)}" fill="rgba(255,255,255,0.24)" />
  <text x="50%" y="${Math.round(height * 0.82)}" text-anchor="middle" fill="${palette.text}" font-size="${Math.max(24, Math.round(width * 0.04))}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${safeLabel}</text>
  ${
    safeSubtitle
      ? `<text x="50%" y="${Math.round(height * 0.89)}" text-anchor="middle" fill="${palette.text}" fill-opacity="0.82" font-size="${Math.max(16, Math.round(width * 0.024))}" font-family="Arial, Helvetica, sans-serif">${safeSubtitle}</text>`
      : ''
  }
</svg>`.trim();
}

function paletteByIndex(index: number) {
  const palettes = [
    { base: '#8d6d4a', panel: '#d2b48f', accent: '#4b5a68', text: '#ffffff' },
    { base: '#5f7b6f', panel: '#c9d5c8', accent: '#a56a43', text: '#ffffff' },
    { base: '#6d5f78', panel: '#d9d0e1', accent: '#8b6f47', text: '#ffffff' },
    { base: '#6f6a60', panel: '#ddd6ca', accent: '#5b7a76', text: '#ffffff' },
    { base: '#74634c', panel: '#d8c6a4', accent: '#455b73', text: '#ffffff' },
  ];
  return palettes[index % palettes.length] || palettes[0]!;
}

function lighten(hex: string, amount: number) {
  return shiftHex(hex, amount);
}

function darken(hex: string, amount: number) {
  return shiftHex(hex, -amount);
}

function shiftHex(hex: string, amount: number) {
  const normalized = hex.replace('#', '');
  const parts = normalized.match(/.{1,2}/g) ?? ['88', '88', '88'];
  const shifted = parts.map((part) => {
    const value = Number.parseInt(part, 16);
    const delta = Math.round(255 * amount);
    const next = Math.max(0, Math.min(255, value + delta));
    return next.toString(16).padStart(2, '0');
  });
  return `#${shifted.join('')}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
