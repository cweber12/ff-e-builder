// Revision Rounds — server-side logic for opening, closing, and baking
// Revision Rounds in the Proposal tool. See /CONTEXT.md for the domain model
// and /db/migrations/0023_proposal_revisions.sql for the schema.

import type { getDb } from './db';

type Sql = ReturnType<typeof getDb>;

// Every column is potentially price-affecting: any confirmed change while the
// proposal is not `in_progress` opens a Revision Round (or sub-revision) and
// flags the snapshot for cost review. Only `quantity` and `unit_cost_cents`
// are locked in proposal_items during a revision (tracked in the snapshot);
// all other fields update freely and simply flag the snapshot.
export function isPriceAffectingColumn(): boolean {
  return true;
}

export type RevisionRow = {
  id: string;
  project_id: string;
  revision_major: number;
  revision_minor: number;
  triggered_at_status: 'pricing_complete' | 'submitted' | 'approved';
  opened_at: string;
  closed_at: string | null;
};

export type SnapshotRow = {
  revision_id: string;
  item_id: string;
  quantity: string | null;
  unit_cost_cents: number | null;
  cost_status: 'none' | 'flagged' | 'resolved';
};

/**
 * Look up the currently-open Revision Round for a project, if any.
 * A project has at most one open revision (enforced via partial unique index).
 */
export async function findOpenRevision(sql: Sql, projectId: string): Promise<RevisionRow | null> {
  const rows = await sql`
    SELECT id, project_id, revision_major, revision_minor,
           triggered_at_status, opened_at, closed_at
    FROM   proposal_revisions
    WHERE  project_id = ${projectId} AND closed_at IS NULL
    LIMIT  1
  `;
  return (rows[0] as RevisionRow | undefined) ?? null;
}

/**
 * Compute the next (revision_major, revision_minor) for a new Revision Round.
 *
 * The current acceptance cycle's MAJOR is always `last_revision_major + 1`.
 * We look only at revisions whose MAJOR matches the current cycle so that
 * preserved historical rounds from prior cycles (e.g. 1.x) do not affect
 * the numbering of the new cycle (e.g. 2.x).
 */
export async function nextRevisionNumber(
  sql: Sql,
  projectId: string,
): Promise<{ major: number; minor: number }> {
  const projectRows = await sql`
    SELECT last_revision_major FROM projects WHERE id = ${projectId}
  `;
  const lastMajor =
    (projectRows[0] as { last_revision_major: number } | undefined)?.last_revision_major ?? 0;
  const currentMajor = lastMajor + 1;

  const existing = await sql`
    SELECT revision_minor
    FROM   proposal_revisions
    WHERE  project_id = ${projectId} AND revision_major = ${currentMajor}
    ORDER  BY revision_minor DESC
    LIMIT  1
  `;
  if (existing[0]) {
    const r = existing[0] as { revision_minor: number };
    return { major: currentMajor, minor: r.revision_minor + 1 };
  }
  return { major: currentMajor, minor: 1 };
}

/**
 * Open a new Revision Round for a project:
 *   1. Insert into proposal_revisions
 *   2. Snapshot every Proposal Item in the project at current values (cost_status='none')
 *   3. Reassign any orphan changelog entries (revision_id IS NULL) for items in this
 *      project to the new revision (folds in prior non-price-affecting edits)
 *   4. Revert project status to 'in_progress'
 *
 * Callers may then update individual snapshots to reflect the triggering change.
 * Returns the new revision row.
 */
export async function openRevision(
  sql: Sql,
  projectId: string,
  triggeredAtStatus: 'pricing_complete' | 'submitted' | 'approved',
): Promise<RevisionRow> {
  const { major, minor } = await nextRevisionNumber(sql, projectId);

  const inserted = await sql`
    INSERT INTO proposal_revisions (project_id, revision_major, revision_minor, triggered_at_status)
    VALUES (${projectId}, ${major}, ${minor}, ${triggeredAtStatus})
    RETURNING id, project_id, revision_major, revision_minor,
              triggered_at_status, opened_at, closed_at
  `;
  const rev = inserted[0] as RevisionRow;

  // Snapshot all items currently in this proposal.
  await sql`
    INSERT INTO proposal_revision_snapshots (revision_id, item_id, quantity, unit_cost_cents, cost_status)
    SELECT ${rev.id}, pi.id, pi.quantity, pi.unit_cost_cents, 'none'
    FROM   proposal_items pi
    JOIN   proposal_categories pc ON pc.id = pi.category_id
    WHERE  pc.project_id = ${projectId}
  `;

  // Fold any orphan changelog entries (no revision_id) into this new revision.
  await sql`
    UPDATE proposal_item_changelog cl
    SET    revision_id = ${rev.id}
    FROM   proposal_items pi
    JOIN   proposal_categories pc ON pc.id = pi.category_id
    WHERE  cl.proposal_item_id = pi.id
      AND  pc.project_id = ${projectId}
      AND  cl.revision_id IS NULL
  `;

  // Revert proposal status to in_progress.
  await sql`
    UPDATE projects
    SET    proposal_status = 'in_progress',
           proposal_status_updated_at = NOW()
    WHERE  id = ${projectId}
  `;

  return rev;
}

/**
 * Close the currently-open Revision Round for a project (if any). Called when
 * the proposal status advances away from in_progress.
 */
export async function closeOpenRevision(sql: Sql, projectId: string): Promise<void> {
  await sql`
    UPDATE proposal_revisions
    SET    closed_at = NOW()
    WHERE  project_id = ${projectId} AND closed_at IS NULL
  `;
}

/**
 * Count Cost-Flagged snapshot items in the open revision (if any) for a project.
 * Used to gate progression to `pricing_complete`.
 */
export async function countFlaggedInOpenRevision(sql: Sql, projectId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM   proposal_revision_snapshots s
    JOIN   proposal_revisions r ON r.id = s.revision_id
    WHERE  r.project_id = ${projectId}
      AND  r.closed_at IS NULL
      AND  s.cost_status = 'flagged'
  `;
  return (rows[0] as { cnt: number }).cnt;
}

/**
 * Bake the latest Revision Round into proposal_items and clear all revision
 * data for this project. Called when the proposal transitions to `approved`.
 *
 * Steps:
 *   1. Determine the latest revision (max revision_major, then max revision_minor)
 *   2. For each snapshot in that revision, UPDATE proposal_items with the snapshot's
 *      quantity and unit_cost_cents (skipping NULL values, which mean unchanged)
 *   3. Persist `last_revision_major` on the project so the next cycle increments
 *   4. DELETE FROM proposal_revisions for this project (cascades to snapshots
 *      and SETs revision_id NULL on changelog entries)
 *   5. DELETE FROM proposal_item_changelog for items in this proposal
 *
 * If no revisions exist for this project, this is a no-op (acceptance without
 * any revisions ever triggered).
 */
export async function bakeApprovedRevision(sql: Sql, projectId: string): Promise<void> {
  const latest = await sql`
    SELECT id, revision_major, revision_minor
    FROM   proposal_revisions
    WHERE  project_id = ${projectId}
    ORDER  BY revision_major DESC, revision_minor DESC
    LIMIT  1
  `;
  if (!latest[0]) return;
  const rev = latest[0] as { id: string; revision_major: number; revision_minor: number };

  // Bake snapshot values into proposal_items. Bump version to invalidate any
  // optimistic-concurrency holders. Skip NULL snapshot values (treat as unchanged).
  await sql`
    UPDATE proposal_items pi
    SET    quantity = COALESCE(s.quantity, pi.quantity),
           unit_cost_cents = COALESCE(s.unit_cost_cents, pi.unit_cost_cents),
           version = pi.version + 1
    FROM   proposal_revision_snapshots s
    WHERE  s.revision_id = ${rev.id}
      AND  s.item_id = pi.id
  `;

  // Remember which major number we just closed out so the next cycle bumps
  // and so the GET revisions endpoint can filter to the current cycle.
  await sql`
    UPDATE projects
    SET    last_revision_major = ${rev.revision_major}
    WHERE  id = ${projectId}
  `;

  // Revision rounds and changelog are intentionally preserved after baking.
  // Historical data from this cycle (e.g. 1.x rounds) remains queryable for
  // audit and export purposes. Cleanup happens when the next MAJOR cycle
  // starts (the intercept-and-archive flow, deferred to a future slice).
}
