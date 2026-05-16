import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const productAreaOrder = [
  'ffe',
  'proposal',
  'plans',
  'finish-library',
  'project-shell',
  'shared-ui',
  'shared-lib',
  'api-worker',
  'types',
  'tests',
  'tooling',
  'unknown',
] as const;

type ProductArea = (typeof productAreaOrder)[number];
type OwnershipConfidence = 'high' | 'medium' | 'low';

type ProjectConfig = {
  name: string;
  tsconfigPath: string;
  extraFiles?: string[];
};

type ImportKind = 'import' | 'export' | 'dynamic-import' | 'require' | 'import-type';
type ReviewSignalSection =
  | 'Review Targets'
  | 'Route/Shell Composition'
  | 'Facade/Barrel Aggregation'
  | 'Expected Shared Dependencies'
  | 'Unknown / Ambiguous Dependencies'
  | 'Test Dependencies';

type ProductClassification = {
  area: ProductArea;
  confidence: OwnershipConfidence;
  reason: string;
  ownerPath: string;
};

type ImportRecord = {
  importer: string;
  specifier: string;
  kind: ImportKind;
  resolved: string | null;
  externalPackage: string | null;
  asset: boolean;
};

type FileRecord = {
  path: string;
  project: string;
  module: string;
  productArea: ProductArea;
  ownershipConfidence: OwnershipConfidence;
  ownershipReason: string;
  ownerPath: string;
  imports: ImportRecord[];
};

type ModuleRecord = {
  path: string;
  files: number;
  importsIn: number;
  importsOut: number;
  internalDependencies: string[];
  externalDependencies: string[];
};

type ProjectRecord = {
  name: string;
  tsconfig: string;
  files: number;
  internalImports: number;
  externalImports: number;
  unresolvedImports: number;
};

type ProductAreaRecord = {
  area: ProductArea;
  files: number;
  importsIn: number;
  importsOut: number;
  dependsOn: ProductArea[];
  importedBy: ProductArea[];
};

type ProductCrossAreaImport = {
  importer: string;
  importerArea: ProductArea;
  specifier: string;
  resolved: string;
  resolvedArea: ProductArea;
  kind: ImportKind;
  reviewNote: string;
  reviewSection: ReviewSignalSection;
};

type ProductCrossAreaImportGroup = {
  section: ReviewSignalSection;
  from: ProductArea;
  to: ProductArea;
  imports: number;
  reviewNote: string;
  examples: ProductCrossAreaImport[];
};

type ProductPathSummary = {
  area: ProductArea;
  paths: Array<{ path: string; files: number }>;
};

const repoRoot = process.cwd();
const generatedDir = path.join(repoRoot, 'docs', 'generated');
const outputJsonPath = path.join(generatedDir, 'architecture-map.json');
const outputMdPath = path.join(generatedDir, 'architecture-map.md');

const projectConfigs: ProjectConfig[] = [
  { name: 'React client', tsconfigPath: 'tsconfig.app.json' },
  {
    name: 'Root tooling config',
    tsconfigPath: 'tsconfig.node.json',
    extraFiles: ['scripts/architecture-map.ts'],
  },
  { name: 'Cloudflare Workers API', tsconfigPath: 'api/tsconfig.json' },
];

const classifierRules: Array<{
  area: ProductArea;
  confidence: OwnershipConfidence;
  ownerPath: string;
  reason: string;
  match: (repoPath: string) => boolean;
}> = [
  {
    area: 'tests',
    confidence: 'high',
    ownerPath: 'tests/**/*, **/*.test.*, **/*.spec.*, **/__snapshots__/**',
    reason: 'test or snapshot path',
    match: (repoPath) =>
      repoPath.startsWith('tests/') ||
      repoPath.includes('/test/') ||
      repoPath.includes('/__snapshots__/') ||
      /\.(test|spec)\.[cm]?[jt]sx?$/.test(repoPath),
  },
  {
    area: 'api-worker',
    confidence: 'high',
    ownerPath: 'api/src/**',
    reason: 'Cloudflare Workers API source path',
    match: (repoPath) => repoPath.startsWith('api/src/'),
  },
  {
    area: 'types',
    confidence: 'high',
    ownerPath: 'src/types/**',
    reason: 'shared domain type path',
    match: (repoPath) => repoPath.startsWith('src/types/'),
  },
  {
    area: 'ffe',
    confidence: 'high',
    ownerPath: 'src/components/ffe/**, src/hooks/ffe/**, src/lib/export/ffe/**',
    reason: 'FF&E-owned feature path',
    match: (repoPath) =>
      repoPath.startsWith('src/components/ffe/') ||
      repoPath.startsWith('src/hooks/ffe/') ||
      repoPath.startsWith('src/lib/export/ffe/'),
  },
  {
    area: 'ffe',
    confidence: 'medium',
    ownerPath: 'src/lib/items/**, src/lib/import/formats/ffe.ts',
    reason: 'FF&E-oriented helper/import path',
    match: (repoPath) =>
      repoPath.startsWith('src/lib/items/') || repoPath.startsWith('src/lib/import/formats/ffe.'),
  },
  {
    area: 'proposal',
    confidence: 'high',
    ownerPath: 'src/components/proposal/**, src/hooks/proposal/**, src/lib/export/proposal/**',
    reason: 'Proposal-owned feature path',
    match: (repoPath) =>
      repoPath.startsWith('src/components/proposal/') ||
      repoPath.startsWith('src/hooks/proposal/') ||
      repoPath.startsWith('src/lib/export/proposal/'),
  },
  {
    area: 'proposal',
    confidence: 'medium',
    ownerPath: 'src/lib/import/formats/proposal.ts, src/lib/api/proposal.ts',
    reason: 'Proposal-oriented API/import path',
    match: (repoPath) =>
      repoPath.startsWith('src/lib/import/formats/proposal.') ||
      repoPath === 'src/lib/api/proposal.ts',
  },
  {
    area: 'plans',
    confidence: 'high',
    ownerPath:
      'src/components/plans/**, src/hooks/plans/**, src/lib/plans/**, src/pages/Plans*.tsx, src/pages/PlanCanvas*.tsx',
    reason: 'Plans-owned feature path',
    match: (repoPath) =>
      repoPath.startsWith('src/components/plans/') ||
      repoPath.startsWith('src/hooks/plans/') ||
      repoPath.startsWith('src/lib/plans/') ||
      repoPath.startsWith('src/pages/Plans') ||
      repoPath.startsWith('src/pages/PlanCanvas'),
  },
  {
    area: 'finish-library',
    confidence: 'high',
    ownerPath: 'src/components/materials/**, src/hooks/materials/**',
    reason: 'Finish Library / Materials UI or hook path',
    match: (repoPath) =>
      repoPath.startsWith('src/components/materials/') ||
      repoPath.startsWith('src/hooks/materials/'),
  },
  {
    area: 'finish-library',
    confidence: 'medium',
    ownerPath: 'src/lib/api/materials.ts, src/lib/export/materials.ts',
    reason: 'Finish Library / Materials API or export path',
    match: (repoPath) =>
      repoPath === 'src/lib/api/materials.ts' || repoPath === 'src/lib/export/materials.ts',
  },
  {
    area: 'project-shell',
    confidence: 'high',
    ownerPath: 'src/components/project/**, src/pages/Dashboard*.tsx, src/pages/Project*.tsx',
    reason: 'Project shell UI/page path',
    match: (repoPath) =>
      repoPath.startsWith('src/components/project/') ||
      repoPath.startsWith('src/pages/Dashboard') ||
      repoPath.startsWith('src/pages/Project'),
  },
  {
    area: 'project-shell',
    confidence: 'medium',
    ownerPath:
      'src/App.tsx, src/main.tsx, src/lib/projectSnapshot/**, src/lib/api/projects.ts, src/lib/api/users.ts',
    reason: 'route shell, app bootstrap, or Project/User API path',
    match: (repoPath) =>
      repoPath === 'src/App.tsx' ||
      repoPath === 'src/main.tsx' ||
      repoPath.startsWith('src/lib/projectSnapshot/') ||
      repoPath === 'src/lib/api/projects.ts' ||
      repoPath === 'src/lib/api/users.ts',
  },
  {
    area: 'shared-ui',
    confidence: 'high',
    ownerPath: 'src/components/shared/**, src/components/primitives/**',
    reason: 'shared UI primitive/chrome path',
    match: (repoPath) =>
      repoPath.startsWith('src/components/shared/') ||
      repoPath.startsWith('src/components/primitives/'),
  },
  {
    area: 'shared-lib',
    confidence: 'high',
    ownerPath:
      'src/lib/auth/**, src/lib/images/**, src/lib/import/**, src/lib/money/**, src/lib/pdf.ts, src/lib/query/**, src/lib/theme/**, src/lib/utils/**',
    reason: 'shared client utility path',
    match: (repoPath) =>
      repoPath.startsWith('src/lib/auth/') ||
      repoPath.startsWith('src/lib/images/') ||
      repoPath.startsWith('src/lib/import/') ||
      repoPath.startsWith('src/lib/money/') ||
      repoPath === 'src/lib/pdf.ts' ||
      repoPath.startsWith('src/lib/query/') ||
      repoPath.startsWith('src/lib/theme/') ||
      repoPath.startsWith('src/lib/utils/'),
  },
  {
    area: 'shared-lib',
    confidence: 'medium',
    ownerPath: 'src/lib/api/**, src/lib/export/*, src/hooks/shared/**, src/hooks/*.ts',
    reason: 'shared client API/export/hook path',
    match: (repoPath) =>
      repoPath === 'src/lib/api.ts' ||
      repoPath.startsWith('src/lib/api/') ||
      /^src\/lib\/export\/[^/]+\.ts$/.test(repoPath) ||
      repoPath.startsWith('src/hooks/shared/') ||
      /^src\/hooks\/[^/]+\.ts$/.test(repoPath),
  },
  {
    area: 'unknown',
    confidence: 'low',
    ownerPath: 'src/data/**',
    reason:
      'sample/demo data path; confirm whether it belongs with tests, Project shell, or seed tooling',
    match: (repoPath) => repoPath.startsWith('src/data/'),
  },
  {
    area: 'unknown',
    confidence: 'low',
    ownerPath: 'src/pages/DemoPage.tsx',
    reason: 'demo page path; confirm route usage before assigning product ownership',
    match: (repoPath) => repoPath === 'src/pages/DemoPage.tsx',
  },
  {
    area: 'tooling',
    confidence: 'high',
    ownerPath: 'scripts/**, *.config.ts',
    reason: 'build, test, or repository tooling path',
    match: (repoPath) => repoPath.startsWith('scripts/') || repoPath.endsWith('.config.ts'),
  },
];

const ownedProductAreas = new Set<ProductArea>([
  'ffe',
  'proposal',
  'plans',
  'finish-library',
  'project-shell',
]);
const sharedAreas = new Set<ProductArea>(['shared-ui', 'shared-lib']);
const publicFacadePaths = new Set([
  'src/hooks/index.ts',
  'src/lib/api.ts',
  'src/lib/export/index.ts',
  'src/lib/import/index.ts',
]);
const reviewSectionOrder: ReviewSignalSection[] = [
  'Review Targets',
  'Route/Shell Composition',
  'Facade/Barrel Aggregation',
  'Expected Shared Dependencies',
  'Unknown / Ambiguous Dependencies',
  'Test Dependencies',
];

function toRepoPath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
}

function fromRepoPath(repoPath: string): string {
  return path.join(repoRoot, ...repoPath.split('/'));
}

function sortByPath<T extends { path: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.path.localeCompare(b.path));
}

function readTsConfig(config: ProjectConfig): ts.ParsedCommandLine {
  const configPath = fromRepoPath(config.tsconfigPath);
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(formatDiagnostic(configFile.error));
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(formatDiagnostic).join('\n'));
  }

  if (config.extraFiles) {
    parsed.fileNames = uniqueSorted([
      ...parsed.fileNames,
      ...config.extraFiles
        .map((repoPath) => fromRepoPath(repoPath))
        .filter((filePath) => fs.existsSync(filePath)),
    ]);
  }

  return parsed;
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function collectModuleSpecifiers(
  sourceFile: ts.SourceFile,
): Array<{ specifier: string; kind: ImportKind }> {
  const imports: Array<{ specifier: string; kind: ImportKind }> = [];

  const pushStringLiteral = (node: ts.Node | undefined, kind: ImportKind) => {
    if (node && ts.isStringLiteralLike(node)) {
      imports.push({ specifier: node.text, kind });
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      pushStringLiteral(node.moduleSpecifier, 'import');
    } else if (ts.isExportDeclaration(node)) {
      pushStringLiteral(node.moduleSpecifier, 'export');
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        pushStringLiteral(node.arguments[0], 'dynamic-import');
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        pushStringLiteral(node.arguments[0], 'require');
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument.literal;
      pushStringLiteral(argument, 'import-type');
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return imports;
}

function isRepoSource(resolvedPath: string): boolean {
  const relativePath = toRepoPath(resolvedPath);

  if (relativePath.startsWith('..')) {
    return false;
  }

  return !relativePath.includes('/node_modules/');
}

function getExternalPackageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('@/')) {
    return null;
  }

  const parts = specifier.split('/');
  if (specifier.startsWith('@') && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0] ?? null;
}

function isAssetImport(specifier: string): boolean {
  return /\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|pdf|csv|xlsx?)$/i.test(specifier);
}

function getModulePath(repoPath: string): string {
  const parts = repoPath.split('/');

  if (parts[0] === 'src') {
    return parts.length >= 2 ? parts.slice(0, 2).join('/') : 'src';
  }

  if (parts[0] === 'api' && parts[1] === 'src') {
    return parts.length >= 3 ? parts.slice(0, 3).join('/') : 'api/src';
  }

  if (parts[0] === 'api' && parts[1] === 'test') {
    return 'api/test';
  }

  if (parts[0] === 'tests') {
    return parts.length >= 2 ? parts.slice(0, 2).join('/') : 'tests';
  }

  return parts[0] ?? repoPath;
}

function getArea(repoPath: string): string {
  if (repoPath.startsWith('src/')) {
    return 'client';
  }

  if (repoPath.startsWith('api/')) {
    return 'api';
  }

  if (repoPath.startsWith('scripts/')) {
    return 'scripts';
  }

  if (repoPath.startsWith('tests/')) {
    return 'tests';
  }

  return 'root';
}

function classifyProductArea(repoPath: string): ProductClassification {
  const normalizedPath = repoPath.replaceAll('\\', '/');
  const rule = classifierRules.find((candidate) => candidate.match(normalizedPath));

  if (rule) {
    return {
      area: rule.area,
      confidence: rule.confidence,
      reason: rule.reason,
      ownerPath: rule.ownerPath,
    };
  }

  const parts = normalizedPath.split('/');
  return {
    area: 'unknown',
    confidence: 'low',
    reason: 'no product-area path heuristic matched',
    ownerPath: parts.length > 1 ? parts.slice(0, 2).join('/') : normalizedPath,
  };
}

function scanProject(config: ProjectConfig): FileRecord[] {
  const parsedConfig = readTsConfig(config);
  const host = ts.createCompilerHost(parsedConfig.options, true);
  const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options, host);

  return sortByPath(
    program
      .getSourceFiles()
      .filter((sourceFile) => !sourceFile.isDeclarationFile)
      .filter((sourceFile) => isRepoSource(sourceFile.fileName))
      .map((sourceFile) => {
        const importer = toRepoPath(sourceFile.fileName);
        const classification = classifyProductArea(importer);
        const imports = collectModuleSpecifiers(sourceFile).map(({ specifier, kind }) => {
          const resolved = ts.resolveModuleName(
            specifier,
            sourceFile.fileName,
            parsedConfig.options,
            host,
          ).resolvedModule;
          const resolvedPath =
            resolved && isRepoSource(resolved.resolvedFileName)
              ? toRepoPath(resolved.resolvedFileName)
              : null;

          return {
            importer,
            specifier,
            kind,
            resolved: resolvedPath,
            externalPackage: resolvedPath ? null : getExternalPackageName(specifier),
            asset: !resolvedPath && isAssetImport(specifier),
          };
        });

        return {
          path: importer,
          project: config.name,
          module: getModulePath(importer),
          productArea: classification.area,
          ownershipConfidence: classification.confidence,
          ownershipReason: classification.reason,
          ownerPath: classification.ownerPath,
          imports,
        };
      }),
  );
}

function uniqueSorted(items: Iterable<string>): string[] {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

function uniqueProductAreas(items: Iterable<ProductArea>): ProductArea[] {
  const values = new Set(items);
  return productAreaOrder.filter((area) => values.has(area));
}

function buildModules(files: FileRecord[]): ModuleRecord[] {
  const modules = new Map<string, ModuleRecord>();

  for (const file of files) {
    if (!modules.has(file.module)) {
      modules.set(file.module, {
        path: file.module,
        files: 0,
        importsIn: 0,
        importsOut: 0,
        internalDependencies: [],
        externalDependencies: [],
      });
    }

    modules.get(file.module)!.files += 1;
  }

  const internalDependencies = new Map<string, Set<string>>();
  const externalDependencies = new Map<string, Set<string>>();

  for (const file of files) {
    const moduleRecord = modules.get(file.module)!;
    moduleRecord.importsOut += file.imports.length;

    for (const importRecord of file.imports) {
      if (importRecord.resolved) {
        const targetModule = getModulePath(importRecord.resolved);
        if (targetModule !== file.module) {
          if (!internalDependencies.has(file.module)) {
            internalDependencies.set(file.module, new Set());
          }

          internalDependencies.get(file.module)!.add(targetModule);
        }

        const targetModuleRecord = modules.get(targetModule);
        if (targetModuleRecord) {
          targetModuleRecord.importsIn += 1;
        }
      } else if (importRecord.externalPackage) {
        if (!externalDependencies.has(file.module)) {
          externalDependencies.set(file.module, new Set());
        }

        externalDependencies.get(file.module)!.add(importRecord.externalPackage);
      }
    }
  }

  for (const moduleRecord of modules.values()) {
    moduleRecord.internalDependencies = uniqueSorted(
      internalDependencies.get(moduleRecord.path) ?? [],
    );
    moduleRecord.externalDependencies = uniqueSorted(
      externalDependencies.get(moduleRecord.path) ?? [],
    );
  }

  return sortByPath([...modules.values()]);
}

function buildProjectSummaries(files: FileRecord[]): ProjectRecord[] {
  return projectConfigs.map((config) => {
    const projectFiles = files.filter((file) => file.project === config.name);
    const imports = projectFiles.flatMap((file) => file.imports);

    return {
      name: config.name,
      tsconfig: config.tsconfigPath,
      files: projectFiles.length,
      internalImports: imports.filter((importRecord) => importRecord.resolved).length,
      externalImports: imports.filter((importRecord) => importRecord.externalPackage).length,
      unresolvedImports: imports.filter(
        (importRecord) =>
          !importRecord.resolved && !importRecord.externalPackage && !importRecord.asset,
      ).length,
    };
  });
}

function buildProductAreaSummaries(files: FileRecord[]): ProductAreaRecord[] {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const records = new Map<ProductArea, ProductAreaRecord>(
    productAreaOrder.map((area) => [
      area,
      { area, files: 0, importsIn: 0, importsOut: 0, dependsOn: [], importedBy: [] },
    ]),
  );
  const dependsOn = new Map<ProductArea, Set<ProductArea>>();
  const importedBy = new Map<ProductArea, Set<ProductArea>>();

  for (const file of files) {
    records.get(file.productArea)!.files += 1;
    records.get(file.productArea)!.importsOut += file.imports.filter(
      (importRecord) => importRecord.resolved,
    ).length;

    for (const importRecord of file.imports) {
      if (!importRecord.resolved) {
        continue;
      }

      const targetArea = filesByPath.get(importRecord.resolved)?.productArea;
      if (!targetArea) {
        continue;
      }

      records.get(targetArea)!.importsIn += 1;

      if (targetArea !== file.productArea) {
        if (!dependsOn.has(file.productArea)) {
          dependsOn.set(file.productArea, new Set());
        }

        if (!importedBy.has(targetArea)) {
          importedBy.set(targetArea, new Set());
        }

        dependsOn.get(file.productArea)!.add(targetArea);
        importedBy.get(targetArea)!.add(file.productArea);
      }
    }
  }

  for (const record of records.values()) {
    record.dependsOn = uniqueProductAreas(dependsOn.get(record.area) ?? []);
    record.importedBy = uniqueProductAreas(importedBy.get(record.area) ?? []);
  }

  return productAreaOrder.map((area) => records.get(area)!).filter((record) => record.files > 0);
}

function buildProductCrossAreaImports(files: FileRecord[]): ProductCrossAreaImport[] {
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  return files
    .flatMap((file) =>
      file.imports
        .filter((importRecord) => importRecord.resolved)
        .map((importRecord) => {
          const targetFile = filesByPath.get(importRecord.resolved!);
          if (!targetFile || targetFile.productArea === file.productArea) {
            return null;
          }

          return {
            importer: file.path,
            importerArea: file.productArea,
            specifier: importRecord.specifier,
            resolved: importRecord.resolved!,
            resolvedArea: targetFile.productArea,
            kind: importRecord.kind,
            ...getProductImportReviewSignal(file, targetFile),
          };
        })
        .filter((importRecord): importRecord is ProductCrossAreaImport => Boolean(importRecord)),
    )
    .sort((a, b) => {
      const areaCompare = a.importerArea.localeCompare(b.importerArea);
      if (areaCompare !== 0) {
        return areaCompare;
      }

      const targetCompare = a.resolvedArea.localeCompare(b.resolvedArea);
      return targetCompare === 0 ? a.importer.localeCompare(b.importer) : targetCompare;
    });
}

function getProductImportReviewSignal(
  importer: FileRecord,
  resolved: FileRecord,
): Pick<ProductCrossAreaImport, 'reviewNote' | 'reviewSection'> {
  const from = importer.productArea;
  const to = resolved.productArea;

  if (from === 'tests' || to === 'tests') {
    return {
      reviewNote: 'expected: test coverage dependency',
      reviewSection: 'Test Dependencies',
    };
  }

  if (from === 'unknown' || to === 'unknown') {
    return {
      reviewNote: 'unknown: ownership unclear',
      reviewSection: 'Unknown / Ambiguous Dependencies',
    };
  }

  if (publicFacadePaths.has(importer.path) && ownedProductAreas.has(to)) {
    return {
      reviewNote: 'expected: facade/barrel aggregates product namespaces',
      reviewSection: 'Facade/Barrel Aggregation',
    };
  }

  if (from === 'project-shell' && ownedProductAreas.has(to)) {
    return {
      reviewNote: 'expected: project shell mounts product route/page',
      reviewSection: 'Route/Shell Composition',
    };
  }

  if (
    (from === 'ffe' || from === 'proposal') &&
    to === 'finish-library' &&
    isInternalFinishLibraryPath(resolved.path)
  ) {
    return {
      reviewNote:
        'review: product imports internal Finish Library file; consider public Finish Library entry point',
      reviewSection: 'Review Targets',
    };
  }

  if (sharedAreas.has(from) && ownedProductAreas.has(to)) {
    return {
      reviewNote: 'review: shared core imports product-specific code',
      reviewSection: 'Review Targets',
    };
  }

  if (ownedProductAreas.has(from) && ownedProductAreas.has(to)) {
    return {
      reviewNote: 'review: product module imports another product module directly',
      reviewSection: 'Review Targets',
    };
  }

  if (ownedProductAreas.has(from) && to === 'shared-ui') {
    return {
      reviewNote: 'expected: product uses shared UI',
      reviewSection: 'Expected Shared Dependencies',
    };
  }

  if (ownedProductAreas.has(from) && to === 'shared-lib') {
    return {
      reviewNote: 'expected: product uses shared lib',
      reviewSection: 'Expected Shared Dependencies',
    };
  }

  if (ownedProductAreas.has(from) && to === 'types') {
    return {
      reviewNote: 'expected: product uses shared types',
      reviewSection: 'Expected Shared Dependencies',
    };
  }

  if (sharedAreas.has(from) && (sharedAreas.has(to) || to === 'types')) {
    return {
      reviewNote:
        to === 'types'
          ? 'expected: shared code uses shared types'
          : 'expected: shared UI/lib dependency',
      reviewSection: 'Expected Shared Dependencies',
    };
  }

  if (from === 'api-worker' || to === 'api-worker') {
    return {
      reviewNote: 'review: client/API seam dependency',
      reviewSection: 'Review Targets',
    };
  }

  return {
    reviewNote: 'unknown: ownership unclear',
    reviewSection: 'Unknown / Ambiguous Dependencies',
  };
}

function isInternalFinishLibraryPath(repoPath: string): boolean {
  if (
    !repoPath.startsWith('src/components/materials/') &&
    !repoPath.startsWith('src/hooks/materials/')
  ) {
    return false;
  }

  return !repoPath.endsWith('/index.ts') && !repoPath.endsWith('/index.tsx');
}

function buildProductCrossAreaImportGroups(
  imports: ProductCrossAreaImport[],
): ProductCrossAreaImportGroup[] {
  const groups = new Map<string, ProductCrossAreaImportGroup>();

  for (const importRecord of imports) {
    const key = `${importRecord.reviewSection}:${importRecord.reviewNote}:${importRecord.importerArea}->${importRecord.resolvedArea}`;
    if (!groups.has(key)) {
      groups.set(key, {
        section: importRecord.reviewSection,
        from: importRecord.importerArea,
        to: importRecord.resolvedArea,
        imports: 0,
        reviewNote: importRecord.reviewNote,
        examples: [],
      });
    }

    const group = groups.get(key)!;
    group.imports += 1;
    const hasExample = group.examples.some(
      (example) =>
        example.importer === importRecord.importer && example.resolved === importRecord.resolved,
    );
    if (!hasExample && group.examples.length < 3) {
      group.examples.push(importRecord);
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      reviewSectionOrder.indexOf(a.section) - reviewSectionOrder.indexOf(b.section) ||
      productAreaOrder.indexOf(a.from) - productAreaOrder.indexOf(b.from) ||
      productAreaOrder.indexOf(a.to) - productAreaOrder.indexOf(b.to),
  );
}

function buildProductPathSummaries(files: FileRecord[]): ProductPathSummary[] {
  const counts = new Map<ProductArea, Map<string, number>>();

  for (const file of files) {
    if (!counts.has(file.productArea)) {
      counts.set(file.productArea, new Map());
    }

    const areaCounts = counts.get(file.productArea)!;
    areaCounts.set(file.ownerPath, (areaCounts.get(file.ownerPath) ?? 0) + 1);
  }

  return productAreaOrder
    .map((area) => {
      const paths = [...(counts.get(area)?.entries() ?? [])]
        .map(([pathPattern, filesInPattern]) => ({ path: pathPattern, files: filesInPattern }))
        .sort((a, b) => b.files - a.files || a.path.localeCompare(b.path));

      return { area, paths };
    })
    .filter((summary) => summary.paths.length > 0);
}

function buildCycles(files: FileRecord[]): string[][] {
  const graph = new Map<string, string[]>();

  for (const file of files) {
    graph.set(
      file.path,
      uniqueSorted(
        file.imports
          .map((importRecord) => importRecord.resolved)
          .filter((resolved): resolved is string => Boolean(resolved) && resolved !== file.path),
      ),
    );
  }

  const stack: string[] = [];
  const stackSet = new Set<string>();
  const indexByNode = new Map<string, number>();
  const lowLinkByNode = new Map<string, number>();
  const cycles: string[][] = [];
  let index = 0;

  const strongConnect = (node: string) => {
    indexByNode.set(node, index);
    lowLinkByNode.set(node, index);
    index += 1;
    stack.push(node);
    stackSet.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) {
        continue;
      }

      if (!indexByNode.has(next)) {
        strongConnect(next);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node)!, lowLinkByNode.get(next)!));
      } else if (stackSet.has(next)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node)!, indexByNode.get(next)!));
      }
    }

    if (lowLinkByNode.get(node) === indexByNode.get(node)) {
      const component: string[] = [];
      let current: string | undefined;

      do {
        current = stack.pop();
        if (!current) {
          break;
        }

        stackSet.delete(current);
        component.push(current);
      } while (current !== node);

      if (component.length > 1) {
        cycles.push(component.sort((a, b) => a.localeCompare(b)));
      }
    }
  };

  for (const node of uniqueSorted(graph.keys())) {
    if (!indexByNode.has(node)) {
      strongConnect(node);
    }
  }

  return cycles.sort((a, b) => a[0]!.localeCompare(b[0]!));
}

function buildCrossAreaImports(files: FileRecord[]): ImportRecord[] {
  return files
    .flatMap((file) => file.imports)
    .filter((importRecord) => importRecord.resolved)
    .filter((importRecord) => getArea(importRecord.importer) !== getArea(importRecord.resolved!))
    .sort((a, b) => {
      const importerCompare = a.importer.localeCompare(b.importer);
      return importerCompare === 0 ? a.specifier.localeCompare(b.specifier) : importerCompare;
    });
}

function buildMarkdown(data: {
  generatedAt: string;
  projects: ProjectRecord[];
  modules: ModuleRecord[];
  productAreas: ProductAreaRecord[];
  productPathSummaries: ProductPathSummary[];
  productCrossAreaImportGroups: ProductCrossAreaImportGroup[];
  unknownOwnership: FileRecord[];
  cycles: string[][];
  crossAreaImports: ImportRecord[];
  unresolvedImports: ImportRecord[];
  topExternalPackages: Array<{ name: string; imports: number }>;
}): string {
  const largestModules = [...data.modules].sort((a, b) => b.files - a.files).slice(0, 20);

  return `# Generated Architecture Map

> Generated by \`pnpm arch:scan\` at ${data.generatedAt}. Do not edit this file by hand.

## Purpose

This map gives agents and engineers current repo facts before planning module moves or architecture refactors. It reports TypeScript/JavaScript source files, import edges, module-level dependencies, product-area ownership heuristics, cross-area imports, unresolved local imports, and circular dependency groups.

## Tooling Choice

This repo currently uses a custom scanner built on the TypeScript compiler API already present in dev dependencies. That is intentionally lighter than adding \`dependency-cruiser\` or \`madge\` in this slice: it avoids package and lockfile churn, reads the existing \`tsconfig\` files, resolves the \`@/*\` client alias, and emits both Markdown and JSON for agents. Product-area ownership is path-based and heuristic; use it as a review aid, not as a source of architectural truth or enforcement.

## How To Use This Map

- Use this map to choose one module audit target at a time.
- Treat review targets as prompts for investigation, not automatic refactor instructions.
- Heuristic ownership can be wrong; confirm with actual imports, product terminology, and relevant docs before moving files.
- Route composition and facade/barrel aggregation are expected patterns unless a future audit decides the interface is too shallow.
- Future slices should focus on one product module and one proposed seam at a time.

## Product Module Summary

| Product area | Files | Imports in | Imports out | Depends on | Imported by |
| --- | ---: | ---: | ---: | --- | --- |
${data.productAreas
  .map(
    (area) =>
      `| \`${area.area}\` | ${area.files} | ${area.importsIn} | ${area.importsOut} | ${formatAreaList(area.dependsOn)} | ${formatAreaList(area.importedBy)} |`,
  )
  .join('\n')}

## Product Cross-Area Imports

Direct imports between generated product areas, split by review signal. Test coverage imports are kept in the JSON companion but omitted here.

${formatCrossAreaSignalSections(data.productCrossAreaImportGroups)}

## Likely Module-Owned Paths

Generated from path heuristics, not business-logic inspection.

${formatProductPathSummaries(data.productPathSummaries)}

## Unknown / Ambiguous Ownership

${formatUnknownOwnership(data.unknownOwnership)}

## Projects

| Project | tsconfig | Files | Internal imports | External imports | Unresolved local imports |
| --- | --- | ---: | ---: | ---: | ---: |
${data.projects
  .map(
    (project) =>
      `| ${project.name} | \`${project.tsconfig}\` | ${project.files} | ${project.internalImports} | ${project.externalImports} | ${project.unresolvedImports} |`,
  )
  .join('\n')}

## Largest Folder Modules

| Module | Files | Imports in | Imports out | Internal dependencies |
| --- | ---: | ---: | ---: | --- |
${largestModules
  .map(
    (moduleRecord) =>
      `| \`${moduleRecord.path}\` | ${moduleRecord.files} | ${moduleRecord.importsIn} | ${moduleRecord.importsOut} | ${moduleRecord.internalDependencies.map((dependency) => `\`${dependency}\``).join(', ') || '-'} |`,
  )
  .join('\n')}

## Top-Level Cross-Area Imports

${formatImportList(data.crossAreaImports, 'No top-level cross-area imports found.')}

## Circular Dependency Groups

${formatCycleList(data.cycles)}

## Top External Packages

| Package | Import count |
| --- | ---: |
${data.topExternalPackages.map((item) => `| \`${item.name}\` | ${item.imports} |`).join('\n')}

## Unresolved Local Imports

${formatImportList(data.unresolvedImports, 'No unresolved local imports found.')}

## JSON Companion

The full machine-readable graph is in [architecture-map.json](architecture-map.json).
`;
}

function formatAreaList(areas: ProductArea[]): string {
  return areas.map((area) => `\`${area}\``).join(', ') || '-';
}

function formatCrossAreaSignalSections(groups: ProductCrossAreaImportGroup[]): string {
  const visibleGroups = groups.filter(
    (group) =>
      group.section !== 'Test Dependencies' && group.from !== 'tests' && group.to !== 'tests',
  );

  return reviewSectionOrder
    .filter((section) => section !== 'Test Dependencies')
    .map((section) => {
      const sectionGroups = visibleGroups.filter((group) => group.section === section);
      return `### ${section}\n\n${formatProductCrossAreaImportGroups(sectionGroups)}`;
    })
    .join('\n\n');
}

function formatProductCrossAreaImportGroups(groups: ProductCrossAreaImportGroup[]): string {
  if (groups.length === 0) {
    return 'No imports in this signal group.';
  }

  const rows = groups
    .slice(0, 80)
    .map((group) => {
      const examples = group.examples
        .map((example) => `\`${example.importer}\` -> \`${example.resolved}\``)
        .join('<br>');
      return `| \`${group.from}\` | \`${group.to}\` | ${group.imports} | ${group.reviewNote} | ${examples} |`;
    })
    .join('\n');

  return `| From | To | Imports | Signal | Examples |
| --- | --- | ---: | --- | --- |
${rows}`;
}

function formatProductPathSummaries(summaries: ProductPathSummary[]): string {
  return summaries
    .map((summary) => {
      const paths = summary.paths
        .slice(0, 8)
        .map((pathSummary) => `\`${pathSummary.path}\` (${pathSummary.files})`)
        .join(', ');
      return `- \`${summary.area}\`: ${paths}`;
    })
    .join('\n');
}

function formatUnknownOwnership(files: FileRecord[]): string {
  if (files.length === 0) {
    return 'No unknown or low-confidence ownership files found.';
  }

  return files
    .slice(0, 100)
    .map(
      (file) =>
        `- \`${file.path}\` (${file.ownershipConfidence}; ${file.ownershipReason}; suggested owner path \`${file.ownerPath}\`)`,
    )
    .join('\n');
}

function formatImportList(imports: ImportRecord[], emptyText: string): string {
  if (imports.length === 0) {
    return emptyText;
  }

  return imports
    .slice(0, 100)
    .map((importRecord) => {
      const target = importRecord.resolved ? ` -> \`${importRecord.resolved}\`` : '';
      return `- \`${importRecord.importer}\` imports \`${importRecord.specifier}\`${target}`;
    })
    .join('\n');
}

function formatCycleList(cycles: string[][]): string {
  if (cycles.length === 0) {
    return 'No circular dependency groups found.';
  }

  return cycles
    .slice(0, 50)
    .map((cycle, index) => `${index + 1}. ${cycle.map((file) => `\`${file}\``).join(' -> ')}`)
    .join('\n');
}

const files = projectConfigs.flatMap(scanProject);
const imports = files.flatMap((file) => file.imports);
const modules = buildModules(files);
const projects = buildProjectSummaries(files);
const productAreas = buildProductAreaSummaries(files);
const productPathSummaries = buildProductPathSummaries(files);
const productCrossAreaImports = buildProductCrossAreaImports(files);
const productCrossAreaImportGroups = buildProductCrossAreaImportGroups(productCrossAreaImports);
const unknownOwnership = files
  .filter((file) => file.productArea === 'unknown' || file.ownershipConfidence === 'low')
  .sort((a, b) => a.path.localeCompare(b.path));
const cycles = buildCycles(files);
const crossAreaImports = buildCrossAreaImports(files);
const unresolvedImports = imports
  .filter(
    (importRecord) =>
      !importRecord.resolved && !importRecord.externalPackage && !importRecord.asset,
  )
  .sort((a, b) => a.importer.localeCompare(b.importer));
const externalPackageCounts = new Map<string, number>();

for (const importRecord of imports) {
  if (importRecord.externalPackage) {
    externalPackageCounts.set(
      importRecord.externalPackage,
      (externalPackageCounts.get(importRecord.externalPackage) ?? 0) + 1,
    );
  }
}

const generatedAt = new Date().toISOString();
const topExternalPackages = [...externalPackageCounts.entries()]
  .map(([name, importCount]) => ({ name, imports: importCount }))
  .sort((a, b) => b.imports - a.imports || a.name.localeCompare(b.name))
  .slice(0, 30);

const data = {
  schemaVersion: 3,
  generatedAt,
  generatedBy: 'pnpm arch:scan',
  source: 'scripts/architecture-map.ts',
  classifier: {
    description:
      'Product areas are inferred from path heuristics only. They are intended to guide review before future module-seam work, not to enforce architecture.',
    productAreaOrder,
    rules: classifierRules.map(({ area, confidence, ownerPath, reason }) => ({
      area,
      confidence,
      ownerPath,
      reason,
    })),
  },
  projects,
  productAreas,
  productPathSummaries,
  productCrossAreaImports,
  productCrossAreaImportGroups,
  unknownOwnership,
  modules,
  files,
  importEdges: imports,
  topLevelCrossAreaImports: crossAreaImports,
  cycles,
  unresolvedImports,
  topExternalPackages,
};

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(outputJsonPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(
  outputMdPath,
  buildMarkdown({
    generatedAt,
    projects,
    modules,
    productAreas,
    productPathSummaries,
    productCrossAreaImportGroups,
    unknownOwnership,
    cycles,
    crossAreaImports,
    unresolvedImports,
    topExternalPackages,
  }),
);

console.log(`Wrote ${toRepoPath(outputMdPath)} and ${toRepoPath(outputJsonPath)}`);
