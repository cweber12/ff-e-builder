import fs from 'node:fs';
import path from 'node:path';

type ColumnRecord = {
  name: string;
  type: string;
  nullable: boolean | null;
  default: string | null;
  references: string | null;
  introducedBy: string;
  removedBy: string | null;
  notes: string[];
};

type IndexRecord = {
  name: string;
  table: string;
  unique: boolean;
  columns: string[];
  where: string | null;
  introducedBy: string;
};

type ForeignKeyRecord = {
  table: string;
  column: string;
  references: string;
  introducedBy: string;
};

type TableRecord = {
  name: string;
  introducedBy: string;
  renamedFrom: string[];
  columns: Record<string, ColumnRecord>;
  indexes: IndexRecord[];
  foreignKeys: ForeignKeyRecord[];
  notes: string[];
};

type MigrationRecord = {
  filename: string;
  summary: string;
  createsTables: string[];
  altersTables: string[];
  createsIndexes: string[];
};

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const generatedDir = path.join(repoRoot, 'docs', 'generated');
const outputJsonPath = path.join(generatedDir, 'database-map.json');
const outputMdPath = path.join(generatedDir, 'database-map.md');

const constraintStarters = new Set([
  'constraint',
  'primary',
  'unique',
  'foreign',
  'check',
  'exclude',
]);

function toRepoPath(filePath: string) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

function normalizeIdentifier(value: string) {
  return value
    .trim()
    .replace(/^if\s+exists\s+/i, '')
    .replace(/^if\s+not\s+exists\s+/i, '')
    .replace(/^only\s+/i, '')
    .replace(/["`]/g, '')
    .split(/\s+/)[0]!
    .replace(/[;,]$/, '');
}

function stripSqlComments(sql: string) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

function migrationSummary(sql: string) {
  const firstComment = sql
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('--') && line.replace(/^--\s*/, '').trim().length > 0);
  return firstComment?.replace(/^--\s*/, '').trim() ?? '';
}

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    const previous = value[index - 1];

    if ((char === "'" || char === '"') && previous !== '\\') {
      quote = quote === char ? null : (quote ?? char);
    }

    if (!quote) {
      if (char === '(') depth += 1;
      if (char === ')') depth = Math.max(0, depth - 1);
      if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitStatements(sql: string) {
  const statements: string[] = [];
  let current = '';
  let quote: string | null = null;
  let dollarQuote = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]!;
    const next = sql[index + 1];
    const previous = sql[index - 1];

    if (!quote && char === '$' && next === '$') {
      dollarQuote = !dollarQuote;
      current += '$$';
      index += 1;
      continue;
    }

    if (!dollarQuote && (char === "'" || char === '"') && previous !== '\\') {
      quote = quote === char ? null : (quote ?? char);
    }

    if (!quote && !dollarQuote && char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function parseColumnDefinition(definition: string, migration: string): ColumnRecord | null {
  const trimmed = definition.trim();
  const firstToken = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (!firstToken || constraintStarters.has(firstToken)) return null;

  const name = normalizeIdentifier(firstToken);
  const rest = trimmed.slice(trimmed.indexOf(firstToken) + firstToken.length).trim();
  const keywordMatch = rest.search(
    /\s+(not\s+null|null|default|primary\s+key|references|check|constraint|unique)\b/i,
  );
  const type = (keywordMatch === -1 ? rest : rest.slice(0, keywordMatch)).trim();
  const nullable = /\bnot\s+null\b/i.test(rest) ? false : /\bnull\b/i.test(rest) ? true : null;
  const defaultMatch = rest.match(
    /\bdefault\s+(.+?)(?=\s+(?:not\s+null|null|references|check|constraint|primary\s+key|unique)\b|$)/i,
  );
  const referencesMatch = rest.match(/\breferences\s+([a-zA-Z0-9_".]+(?:\s*\([^)]+\))?)/i);

  return {
    name,
    type: type || 'unknown',
    nullable,
    default: defaultMatch?.[1]?.trim() ?? null,
    references: referencesMatch?.[1]?.trim() ?? null,
    introducedBy: migration,
    removedBy: null,
    notes: [],
  };
}

function ensureTable(tables: Map<string, TableRecord>, name: string, migration: string) {
  if (!tables.has(name)) {
    tables.set(name, {
      name,
      introducedBy: migration,
      renamedFrom: [],
      columns: {},
      indexes: [],
      foreignKeys: [],
      notes: ['Inferred from ALTER statements; CREATE TABLE not found in scanned migrations.'],
    });
  }
  return tables.get(name)!;
}

function rewriteReferenceTable(reference: string | null, oldName: string, newName: string) {
  if (!reference) return reference;
  const pattern = new RegExp(`^${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return reference.replace(pattern, newName);
}

function renameTableReferences(tables: Map<string, TableRecord>, oldName: string, newName: string) {
  for (const table of tables.values()) {
    for (const column of Object.values(table.columns)) {
      column.references = rewriteReferenceTable(column.references, oldName, newName);
    }
    for (const foreignKey of table.foreignKeys) {
      foreignKey.references =
        rewriteReferenceTable(foreignKey.references, oldName, newName) ?? foreignKey.references;
    }
  }
}

function addColumn(table: TableRecord, column: ColumnRecord) {
  const existing = table.columns[column.name];
  table.columns[column.name] = existing
    ? {
        ...existing,
        ...column,
        introducedBy: existing.introducedBy,
        notes: [...existing.notes, `Altered in ${column.introducedBy}.`],
      }
    : column;

  if (column.references) {
    table.foreignKeys.push({
      table: table.name,
      column: column.name,
      references: column.references,
      introducedBy: column.introducedBy,
    });
  }
}

function scanCreateTable(
  statement: string,
  migration: string,
  tables: Map<string, TableRecord>,
  record: MigrationRecord,
) {
  const match = statement.match(
    /^create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_".]+)\s*\(([\s\S]+)\)$/i,
  );
  if (!match) return;

  const name = normalizeIdentifier(match[1]!);
  const table = ensureTable(tables, name, migration);
  table.introducedBy = table.notes.length > 0 ? migration : table.introducedBy;
  table.notes = table.notes.filter((note) => !note.startsWith('Inferred from ALTER'));
  record.createsTables.push(name);

  for (const part of splitTopLevel(match[2]!)) {
    const column = parseColumnDefinition(part, migration);
    if (column) addColumn(table, column);
  }
}

function parseIndex(statement: string, migration: string): IndexRecord | null {
  const compact = statement.replace(/\s+/g, ' ').trim();
  const match = compact.match(
    /^create\s+(unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_".]+)\s+on\s+([a-zA-Z0-9_".]+)\s*\((.+)\)(?:\s+where\s+(.+))?$/i,
  );
  if (!match) return null;

  return {
    name: normalizeIdentifier(match[2]!),
    table: normalizeIdentifier(match[3]!),
    unique: Boolean(match[1]),
    columns: splitTopLevel(match[4]!).map((column) => column.trim()),
    where: match[5]?.trim() ?? null,
    introducedBy: migration,
  };
}

function scanAlterTable(
  statement: string,
  migration: string,
  tables: Map<string, TableRecord>,
  indexes: IndexRecord[],
  record: MigrationRecord,
) {
  const renameTableMatch = statement.match(
    /^alter\s+table\s+([a-zA-Z0-9_".]+)\s+rename\s+to\s+([a-zA-Z0-9_".]+)$/i,
  );
  if (renameTableMatch) {
    const oldName = normalizeIdentifier(renameTableMatch[1]!);
    const newName = normalizeIdentifier(renameTableMatch[2]!);
    const table = tables.get(oldName) ?? ensureTable(tables, oldName, migration);
    tables.delete(oldName);
    table.name = newName;
    table.renamedFrom.push(oldName);
    table.notes.push(`Renamed from ${oldName} in ${migration}.`);
    tables.set(newName, table);
    renameTableReferences(tables, oldName, newName);
    for (const index of indexes) {
      if (index.table === oldName) index.table = newName;
    }
    record.altersTables.push(`${oldName} -> ${newName}`);
    return;
  }

  const match = statement.match(/^alter\s+table\s+([a-zA-Z0-9_".]+)\s+([\s\S]+)$/i);
  if (!match) return;

  const tableName = normalizeIdentifier(match[1]!);
  const table = ensureTable(tables, tableName, migration);
  const actions = splitTopLevel(match[2]!);
  record.altersTables.push(tableName);

  for (const action of actions) {
    const addColumnMatch = action.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i);
    if (addColumnMatch) {
      const column = parseColumnDefinition(addColumnMatch[1]!, migration);
      if (column) addColumn(table, column);
      continue;
    }

    const dropColumnMatch = action.match(/^drop\s+column\s+(?:if\s+exists\s+)?([a-zA-Z0-9_".]+)/i);
    if (dropColumnMatch) {
      const columnName = normalizeIdentifier(dropColumnMatch[1]!);
      if (table.columns[columnName]) {
        table.columns[columnName]!.removedBy = migration;
      } else {
        table.notes.push(
          `Drops column ${columnName} in ${migration}, but creation was not inferred.`,
        );
      }
      continue;
    }

    const renameColumnMatch = action.match(
      /^rename\s+column\s+([a-zA-Z0-9_".]+)\s+to\s+([a-zA-Z0-9_".]+)/i,
    );
    if (renameColumnMatch) {
      const oldName = normalizeIdentifier(renameColumnMatch[1]!);
      const newName = normalizeIdentifier(renameColumnMatch[2]!);
      const existing = table.columns[oldName];
      if (existing) {
        delete table.columns[oldName];
        table.columns[newName] = {
          ...existing,
          name: newName,
          notes: [...existing.notes, `Renamed from ${oldName} in ${migration}.`],
        };
        for (const index of indexes) {
          if (index.table === table.name) {
            index.columns = index.columns.map((column) => (column === oldName ? newName : column));
          }
        }
      } else {
        table.notes.push(
          `Renames column ${oldName} to ${newName} in ${migration}, but creation was not inferred.`,
        );
      }
    }
  }
}

function scanDropIndex(statement: string, indexes: IndexRecord[]) {
  const match = statement.match(/^drop\s+index\s+(?:if\s+exists\s+)?([a-zA-Z0-9_".]+)/i);
  if (!match) return false;

  const indexName = normalizeIdentifier(match[1]!);
  for (let index = indexes.length - 1; index >= 0; index -= 1) {
    if (indexes[index]!.name === indexName) {
      indexes.splice(index, 1);
    }
  }
  return true;
}

function scanAlterIndex(statement: string, indexes: IndexRecord[]) {
  const match = statement.match(
    /^alter\s+index\s+(?:if\s+exists\s+)?([a-zA-Z0-9_".]+)\s+rename\s+to\s+([a-zA-Z0-9_".]+)/i,
  );
  if (!match) return false;

  const oldName = normalizeIdentifier(match[1]!);
  const newName = normalizeIdentifier(match[2]!);
  const index = indexes.find((candidate) => candidate.name === oldName);
  if (index) index.name = newName;
  return true;
}

function buildMarkdown(data: {
  generatedAt: string;
  migrations: MigrationRecord[];
  tables: TableRecord[];
  indexes: IndexRecord[];
}) {
  const activeTables = data.tables;
  const hotTables = activeTables.filter((table) =>
    [
      'items',
      'proposal_items',
      'proposal_item_generated_item_links',
      'rooms',
      'proposal_categories',
      'proposal_revisions',
      'proposal_revision_snapshots',
      'proposal_item_changelog',
      'item_materials',
      'proposal_item_materials',
      'image_assets',
      'measurements',
    ].includes(table.name),
  );

  return `# Generated Database Map

> Generated by \`pnpm db:scan\` at ${data.generatedAt}. Do not edit this file by hand.

## Purpose

This map gives agents and engineers a migration-derived view of the current database shape before schema, API, import/export, or Generated Item refactors. It does not connect to Neon and it does not read \`.env.local\`; it scans SQL migration files under \`db/migrations/\`.

## How To Use This Map

- Use this as a fast current-state reference before changing database architecture.
- Treat the map as inferred documentation, not a replacement for reading the relevant migration and route code.
- Prefer the JSON companion for targeted tooling and this Markdown file for agent orientation.
- When a table looks surprising, check the \`introducedBy\`, \`removedBy\`, and notes fields before editing.

## Summary

- Migrations scanned: ${data.migrations.length}
- Tables inferred: ${activeTables.length}
- Indexes inferred: ${data.indexes.length}

## Item Architecture Hot Tables

${formatTableList(hotTables)}

## All Tables

${formatTableList(activeTables)}

## Indexes

| Index | Table | Unique | Columns / expression | Predicate | Migration |
| --- | --- | --- | --- | --- | --- |
${data.indexes
  .map(
    (index) =>
      `| \`${index.name}\` | \`${index.table}\` | ${index.unique ? 'yes' : 'no'} | ${index.columns.map((column) => `\`${column}\``).join(', ')} | ${index.where ? `\`${index.where}\`` : '-'} | \`${index.introducedBy}\` |`,
  )
  .join('\n')}

## Migration Inventory

| Migration | Summary | Creates tables | Alters tables | Creates indexes |
| --- | --- | --- | --- | --- |
${data.migrations
  .map(
    (migration) =>
      `| \`${migration.filename}\` | ${escapeMarkdown(migration.summary || '-')} | ${formatInlineList(migration.createsTables)} | ${formatInlineList(migration.altersTables)} | ${formatInlineList(migration.createsIndexes)} |`,
  )
  .join('\n')}

## JSON Companion

The machine-readable map is in [database-map.json](database-map.json).
`;
}

function formatTableList(tables: TableRecord[]) {
  if (tables.length === 0) return 'No tables found.';

  return tables
    .map((table) => {
      const activeColumns = Object.values(table.columns).filter((column) => !column.removedBy);
      const removedColumns = Object.values(table.columns).filter((column) => column.removedBy);
      const columns = activeColumns
        .map((column) => {
          const nullable =
            column.nullable === false
              ? 'not null'
              : column.nullable === true
                ? 'nullable'
                : 'nullable unknown';
          const extras = [
            nullable,
            column.default ? `default ${column.default}` : null,
            column.references ? `references ${column.references}` : null,
            `from ${column.introducedBy}`,
          ].filter(Boolean);
          return `  - \`${column.name}\` ${column.type} (${extras.join('; ')})`;
        })
        .join('\n');
      const removed = removedColumns.length
        ? `\n\n  Removed columns: ${removedColumns.map((column) => `\`${column.name}\` in \`${column.removedBy}\``).join(', ')}`
        : '';
      const notes = table.notes.length
        ? `\n\n  Notes: ${table.notes.map((note) => escapeMarkdown(note)).join(' ')}`
        : '';

      return `### \`${table.name}\`\n\nIntroduced by \`${table.introducedBy}\`${table.renamedFrom.length ? `; renamed from ${table.renamedFrom.map((name) => `\`${name}\``).join(', ')}` : ''}.\n\n${columns || '  - No columns inferred.'}${removed}${notes}`;
    })
    .join('\n\n');
}

function formatInlineList(values: string[]) {
  return values.length ? values.map((value) => `\`${value}\``).join(', ') : '-';
}

function escapeMarkdown(value: string) {
  return value.replaceAll('|', '\\|');
}

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));
const tables = new Map<string, TableRecord>();
const indexes: IndexRecord[] = [];
const migrations: MigrationRecord[] = [];

for (const filename of migrationFiles) {
  const fullPath = path.join(migrationsDir, filename);
  const sql = fs.readFileSync(fullPath, 'utf8');
  const record: MigrationRecord = {
    filename,
    summary: migrationSummary(sql),
    createsTables: [],
    altersTables: [],
    createsIndexes: [],
  };

  for (const statement of splitStatements(stripSqlComments(sql))) {
    if (scanDropIndex(statement, indexes)) continue;
    if (scanAlterIndex(statement, indexes)) continue;
    scanCreateTable(statement, filename, tables, record);
    scanAlterTable(statement, filename, tables, indexes, record);
    const index = parseIndex(statement, filename);
    if (index) {
      const existingIndex = indexes.findIndex((candidate) => candidate.name === index.name);
      if (existingIndex >= 0) indexes.splice(existingIndex, 1);
      indexes.push(index);
      ensureTable(tables, index.table, filename).indexes.push(index);
      record.createsIndexes.push(index.name);
    }
  }

  record.createsTables = [...new Set(record.createsTables)].sort();
  record.altersTables = [...new Set(record.altersTables)].sort();
  record.createsIndexes = [...new Set(record.createsIndexes)].sort();
  migrations.push(record);
}

const generatedAt = new Date().toISOString();
const tableRecords = [...tables.values()].sort((a, b) => a.name.localeCompare(b.name));
for (const table of tableRecords) {
  table.indexes = [];
}
for (const index of indexes) {
  const table = tables.get(index.table);
  if (table) table.indexes.push(index);
}
const data = {
  schemaVersion: 1,
  generatedAt,
  generatedBy: 'pnpm db:scan',
  source: 'scripts/database-map.ts',
  migrations,
  tables: tableRecords,
  indexes: indexes.sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name)),
};

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(outputJsonPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(outputMdPath, buildMarkdown(data));

console.log(`Wrote ${toRepoPath(outputMdPath)} and ${toRepoPath(outputJsonPath)}`);
