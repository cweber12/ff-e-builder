import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type ProjectConfig = {
  name: string;
  tsconfigPath: string;
};

type ImportKind = 'import' | 'export' | 'dynamic-import' | 'require' | 'import-type';

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

const repoRoot = process.cwd();
const generatedDir = path.join(repoRoot, 'docs', 'generated');
const outputJsonPath = path.join(generatedDir, 'architecture-map.json');
const outputMdPath = path.join(generatedDir, 'architecture-map.md');

const projectConfigs: ProjectConfig[] = [
  { name: 'React client', tsconfigPath: 'tsconfig.app.json' },
  { name: 'Root tooling config', tsconfigPath: 'tsconfig.node.json' },
  { name: 'Cloudflare Workers API', tsconfigPath: 'api/tsconfig.json' },
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
          imports,
        };
      }),
  );
}

function uniqueSorted(items: Iterable<string>): string[] {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
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
  cycles: string[][];
  crossAreaImports: ImportRecord[];
  unresolvedImports: ImportRecord[];
  topExternalPackages: Array<{ name: string; imports: number }>;
}): string {
  const largestModules = [...data.modules].sort((a, b) => b.files - a.files).slice(0, 20);

  return `# Generated Architecture Map

> Generated by \`pnpm arch:scan\` at ${data.generatedAt}. Do not edit this file by hand.

## Purpose

This map gives agents and engineers current repo facts before planning module moves or architecture refactors. It reports TypeScript/JavaScript source files, import edges, module-level dependencies, cross-area imports, unresolved local imports, and circular dependency groups.

## Tooling Choice

This repo currently uses a custom scanner built on the TypeScript compiler API already present in dev dependencies. That is intentionally lighter than adding \`dependency-cruiser\` or \`madge\` in this slice: it avoids package and lockfile churn, reads the existing \`tsconfig\` files, resolves the \`@/*\` client alias, and emits both Markdown and JSON for agents. Boundary enforcement can still be added later once the audit has stable facts.

## Projects

| Project | tsconfig | Files | Internal imports | External imports | Unresolved local imports |
| --- | --- | ---: | ---: | ---: | ---: |
${data.projects
  .map(
    (project) =>
      `| ${project.name} | \`${project.tsconfig}\` | ${project.files} | ${project.internalImports} | ${project.externalImports} | ${project.unresolvedImports} |`,
  )
  .join('\n')}

## Largest Modules

| Module | Files | Imports in | Imports out | Internal dependencies |
| --- | ---: | ---: | ---: | --- |
${largestModules
  .map(
    (moduleRecord) =>
      `| \`${moduleRecord.path}\` | ${moduleRecord.files} | ${moduleRecord.importsIn} | ${moduleRecord.importsOut} | ${moduleRecord.internalDependencies.map((dependency) => `\`${dependency}\``).join(', ') || '-'} |`,
  )
  .join('\n')}

## Cross-Area Imports

${formatImportList(data.crossAreaImports, 'No cross-area imports found.')}

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
  schemaVersion: 1,
  generatedAt,
  generatedBy: 'pnpm arch:scan',
  source: 'scripts/architecture-map.ts',
  projects,
  modules,
  files,
  importEdges: imports,
  crossAreaImports,
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
    cycles,
    crossAreaImports,
    unresolvedImports,
    topExternalPackages,
  }),
);

console.log(`Wrote ${toRepoPath(outputMdPath)} and ${toRepoPath(outputJsonPath)}`);
