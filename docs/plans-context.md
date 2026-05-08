# Plans Workspace — Codebase Context

## Project stack

React 18 + TypeScript 5 + Vite 5, Tailwind 3, shadcn/ui primitives, @tanstack/react-query, Firebase Auth → Cloudflare Workers (Hono 4) → Neon Postgres (hand-written SQL via @neondatabase/serverless), pnpm monorepo (`src/` client, `api/` worker).

---

## Routing

Route already registered in `src/App.tsx`:

```tsx
<Route path="plans" element={<ProjectPlansRoute />} />
```

Nav tab already present. `ProjectPlansRoute` calls `useOutletContext<ProjectContext>()` to get `project`. A canvas sub-route would be `<Route path="plans/:planId" element={<PlanCanvasRoute />} />` inside the same `ProjectLayout`.

---

## Domain types — `src/types/plan.ts`

```ts
type CalibrationStatus = 'uncalibrated' | 'calibrated';
type PlanMeasurementUnit = 'in' | 'ft' | 'mm' | 'cm' | 'm';

type MeasuredPlan = {
  id;
  projectId;
  ownerUid;
  name;
  sheetReference;
  imageFilename;
  imageContentType;
  imageByteSize;
  calibrationStatus: CalibrationStatus; // computed SQL column — read-only
  measurementCount: number; // aggregated — read-only
  createdAt;
  updatedAt;
};

type PlanCalibration = {
  id;
  measuredPlanId;
  startX;
  startY;
  endX;
  endY; // raw pixel coords
  realWorldLength;
  unit;
  pixelsPerUnit;
  createdAt;
  updatedAt;
};

type LengthLine = {
  id;
  measuredPlanId;
  startX;
  startY;
  endX;
  endY; // raw pixel coords
  measuredLengthBase;
  label;
  createdAt;
  updatedAt;
};

type Measurement = {
  id;
  measuredPlanId;
  targetKind: 'ffe' | 'proposal';
  targetItemId;
  targetTagSnapshot;
  rectX;
  rectY;
  rectWidth;
  rectHeight; // raw pixel coords
  horizontalSpanBase;
  verticalSpanBase;
  cropX;
  cropY;
  cropWidth;
  cropHeight; // 0–1 percentages (nullable)
  createdAt;
  updatedAt;
};
```

`CropParams` (from `src/types/image.ts`) uses **0–1 percentages**. Plan geometry types use **raw pixels**. Never mix.

---

## Image type gap

`ImageEntityType` union (`src/types/image.ts`) does NOT include `'plan'`. `MeasuredPlan` images are stored separately in R2 via `image_r2_key` — not as `ImageAsset` rows. Do NOT use `ImageFrame` or `useImages` for plan images.

---

## Protected R2 image loading

All R2 assets are auth-gated. Pattern:

```
apiFetchResponse(path)          // adds Authorization: Bearer <token>
  → Worker assertProjectOwnership
  → R2 stream
  → response.blob()
  → URL.createObjectURL(blob)   // revoke on cleanup
```

Client API: `api.plans.downloadContent(projectId, planId)` → `GET /api/v1/projects/:id/plans/:planId/content`

Transport in `src/lib/api/transport.ts`: `apiFetchResponse` returns raw `Response`; `apiFetch` returns parsed JSON. For blobs, use `apiFetchResponse(...).then(r => r.blob())`.

---

## Existing hooks — `src/hooks/plans/usePlans.ts`

```ts
useMeasuredPlans(projectId); // useQuery → api.plans.list
useCreateMeasuredPlan(projectId); // useMutation, optimistic prepend to cache
useDeleteMeasuredPlan(projectId); // useMutation, optimistic remove from cache
```

Query key family: `planKeys.forProject(projectId) = ['plans', projectId]`

Add new keys to `src/hooks/queryKeys.ts` (e.g. `calibrationKeys`, `measurementKeys`).

---

## Worker API patterns — `api/src/routes/plans.ts`

Every handler follows this order:

1. `assertProjectOwnership(c.env, projectId, uid)` → catch → 404
2. `SomeSchema.safeParse(body)` → `.success === false` → 400 with `error.flatten()`
3. R2 upload: `c.env.IMAGES_BUCKET.put(r2Key, file.stream(), { httpMetadata, customMetadata })`
4. R2 key convention: `users/${uid}/projects/${projectId}/plans/${planId}.${ext}`
5. SQL insert, then if it throws: `IMAGES_BUCKET.delete(r2Key)` rollback
6. Return `c.json({ plan: row }, 201)`

`calibrationStatus` and `measurementCount` are computed in SQL via `LEFT JOIN` and `COUNT` — never UPDATE them directly.

---

## Crop / zoom reuse — `src/components/shared/CropModal.tsx`

Uses `react-easy-crop` (`Cropper` component). Props: `image` (URL), `crop/zoom` state, `aspect`, `initialCroppedAreaPercentages`, `onCropComplete`. Emits `CropParams` (percentages). Good model for a calibration point-picker modal but **not** reusable as a free-form canvas shell — `react-easy-crop` owns its own pan/zoom. A free canvas editor needs custom pointer event math.

---

## Blob URL lifecycle pattern (from `MeasuredPlanCard`)

```ts
useEffect(() => {
  let disposed = false;
  let objectUrl: string | null = null;
  async function load() {
    const blob = await api.plans.downloadContent(projectId, plan.id);
    if (disposed) return;
    objectUrl = URL.createObjectURL(blob);
    setPreviewUrl(objectUrl);
  }
  void load();
  return () => {
    disposed = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}, [plan.id, projectId]);
```

---

## Current `PlansPage` UI shell — `src/pages/PlansPage.tsx`

- Outer grid: `grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]` (content + aside)
- Left: plan library grid (`md:grid-cols-2 2xl:grid-cols-3`) with `MeasuredPlanCard` per plan
- Right aside: upload form with name, sheet reference, file input
- State: `useMeasuredPlans`, `useCreateMeasuredPlan`, `useDeleteMeasuredPlan`
- Delete guard: `window.confirm` with measurement count warning

---

## Key primitives — `src/components/primitives/`

| Component        | Notes                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `Drawer`         | Right-side slide-in, focus-trapped, Esc-closeable, scroll-locked   |
| `Modal`          | `<dialog>` native, backdrop-click dismiss, Esc natively handled    |
| `Button`         | `variant: 'default' \| 'ghost' \| 'outline'`, `size: 'sm' \| 'md'` |
| `InlineTextEdit` | Click-to-edit text field, used in CatalogView                      |

---

## Files to modify for canvas feature

1. `src/pages/PlansPage.tsx` — add `<Link>` or navigate to canvas sub-route from `MeasuredPlanCard`
2. `src/pages/PlanCanvasPage.tsx` _(new)_ — canvas editor, zoom/pan, tool state
3. `src/hooks/plans/usePlans.ts` — add calibration + measurement hooks
4. `src/hooks/queryKeys.ts` — add `calibrationKeys`, `measurementKeys`
5. `api/src/routes/plans.ts` — add calibration and measurement CRUD routes
6. `src/App.tsx` — add `<Route path="plans/:planId" element={...} />`

---

## Files to read first

1. `src/pages/PlansPage.tsx` — full current UI + `MeasuredPlanCard` blob loading
2. `src/types/plan.ts` — all coordinate types
3. `api/src/routes/plans.ts` — Worker CRUD, R2 upload/stream
4. `src/components/shared/CropModal.tsx` — react-easy-crop wiring
5. `src/hooks/plans/usePlans.ts` — mutation + optimistic cache patterns
