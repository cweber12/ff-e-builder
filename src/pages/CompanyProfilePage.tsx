import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ImageFrame } from '../components/shared/image/ImageFrame';
import { Button } from '../components/primitives';
import { useCompany, useUpdateCompany } from '../hooks';
import { cn } from '../lib/utils';
import type { UpsertCompanyInput } from '../lib/api';

type MarkPlacementH = 'left' | 'center' | 'right';
type MarkPlacementV = 'header' | 'footer';

// ─── Sub-components ────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-sm font-medium text-neutral-700">{children}</span>;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string | null) => void;
}) {
  const displayHex = value || '#d3dbe6';

  function handleTextChange(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '#') {
      onChange(null);
      return;
    }
    const normalised = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    onChange(normalised);
  }

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <label className="relative flex-shrink-0 cursor-pointer">
          <input
            type="color"
            value={displayHex}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} colour picker`}
          />
          <span
            className="flex h-9 w-9 rounded-md border border-neutral-300 shadow-sm"
            style={{ backgroundColor: value || undefined }}
            aria-hidden
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="#RRGGBB"
          maxLength={7}
          spellCheck={false}
          className="w-28 rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-neutral-400 hover:text-danger-600 focus-visible:outline-none"
            aria-label={`Clear ${label}`}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="inline-flex rounded-md border border-neutral-200 bg-canvas-shell p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-semibold transition-colors',
              value === opt.value
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={cn(
            'h-5 w-9 rounded-full border transition-colors',
            checked ? 'border-brand-600 bg-brand-600' : 'border-neutral-300 bg-neutral-100',
          )}
        />
        <div
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function CompanyProfilePage() {
  const { data: company, isLoading } = useCompany();
  const updateCompany = useUpdateCompany();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [colorPrimary, setColorPrimary] = useState<string | null>(null);
  const [colorSecondary, setColorSecondary] = useState<string | null>(null);
  const [colorAccent, setColorAccent] = useState<string | null>(null);
  const [markEnabled, setMarkEnabled] = useState(false);
  const [markIncludeName, setMarkIncludeName] = useState(true);
  const [markPlacementH, setMarkPlacementH] = useState<MarkPlacementH>('right');
  const [markPlacementV, setMarkPlacementV] = useState<MarkPlacementV>('footer');
  const [markOpacity, setMarkOpacity] = useState(30);

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setLocation(company.location ?? '');
    setColorPrimary(company.colorPrimary);
    setColorSecondary(company.colorSecondary);
    setColorAccent(company.colorAccent);
    setMarkEnabled(company.markEnabled);
    setMarkIncludeName(company.markIncludeName);
    setMarkPlacementH(company.markPlacementH);
    setMarkPlacementV(company.markPlacementV);
    setMarkOpacity(company.markOpacity);
  }, [company]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: UpsertCompanyInput = {
      name: name.trim(),
      location: location.trim() || null,
      colorPrimary,
      colorSecondary,
      colorAccent,
      markEnabled,
      markIncludeName,
      markPlacementH,
      markPlacementV,
      markOpacity,
    };
    updateCompany.mutate(input);
  }

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-2xl space-y-10">
        {/* Page header */}
        <header className="space-y-3">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 transition hover:text-brand-600 focus-visible:outline-none"
          >
            <ArrowLeftIcon />
            Dashboard
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
              Settings
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-neutral-950">
              {company?.name || 'Company Profile'}
            </h1>
            {company && (
              <p className="mt-1 text-sm text-neutral-500">
                Manage your company identity, brand colours, and document mark.
              </p>
            )}
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* ── Identity ── */}
          <section className="section-rule">
            <h2 className="eyebrow mb-5">Identity</h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Logo upload — only available once a company record exists */}
              <div className="flex flex-col gap-1 sm:col-span-2">
                <FieldLabel>Logo</FieldLabel>
                {company ? (
                  <div className="flex items-start gap-4">
                    <ImageFrame
                      entityType="company_logo"
                      entityId={company.id}
                      alt={company.name}
                      className="h-20 w-20 rounded-lg object-contain"
                      placeholderClassName="h-20 w-20 rounded-lg"
                    />
                    <p className="self-center text-xs leading-relaxed text-neutral-500">
                      Upload a PNG or JPEG. Displayed on exported documents when the document mark
                      is enabled.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400">
                    Save your company profile first to upload a logo.
                  </p>
                )}
              </div>

              <TextInput
                label="Company name"
                value={name}
                onChange={setName}
                placeholder="Acme Interior Design"
              />
              <TextInput
                label="Location"
                value={location}
                onChange={setLocation}
                placeholder="New York, NY"
              />
            </div>
          </section>

          {/* ── Brand colours ── */}
          <section className="section-rule">
            <h2 className="eyebrow mb-1">Brand Colours</h2>
            <p className="mb-5 text-xs text-neutral-500">
              Used in exported PDFs and proposals when colours are applied.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              <ColorField label="Primary" value={colorPrimary ?? ''} onChange={setColorPrimary} />
              <ColorField
                label="Secondary"
                value={colorSecondary ?? ''}
                onChange={setColorSecondary}
              />
              <ColorField label="Accent" value={colorAccent ?? ''} onChange={setColorAccent} />
            </div>
            {(colorPrimary || colorSecondary || colorAccent) && (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-neutral-200 bg-canvas-shell px-4 py-3">
                <span className="text-xs font-medium text-neutral-500">Preview</span>
                {colorPrimary && (
                  <div
                    className="flex h-7 w-7 flex-shrink-0 rounded-md shadow-sm"
                    style={{ backgroundColor: colorPrimary }}
                    title={`Primary: ${colorPrimary}`}
                  />
                )}
                {colorSecondary && (
                  <div
                    className="flex h-7 w-7 flex-shrink-0 rounded-md shadow-sm"
                    style={{ backgroundColor: colorSecondary }}
                    title={`Secondary: ${colorSecondary}`}
                  />
                )}
                {colorAccent && (
                  <div
                    className="flex h-7 w-7 flex-shrink-0 rounded-md shadow-sm"
                    style={{ backgroundColor: colorAccent }}
                    title={`Accent: ${colorAccent}`}
                  />
                )}
              </div>
            )}
          </section>

          {/* ── Document mark ── */}
          <section className="section-rule">
            <h2 className="eyebrow mb-1">Document Mark</h2>
            <p className="mb-5 text-xs text-neutral-500">
              Controls whether your company logo and name appear on exported documents.
            </p>

            <div className="space-y-5">
              <Toggle
                label="Enable document mark"
                description="Show the company logo and/or name on exported PDFs."
                checked={markEnabled}
                onChange={setMarkEnabled}
              />

              {markEnabled && (
                <div className="ml-12 space-y-5 border-l-2 border-neutral-200 pl-5">
                  <Toggle
                    label="Include company name"
                    description="Print the company name alongside the logo."
                    checked={markIncludeName}
                    onChange={setMarkIncludeName}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SegmentedControl<MarkPlacementH>
                      label="Horizontal position"
                      value={markPlacementH}
                      options={[
                        { value: 'left', label: 'Left' },
                        { value: 'center', label: 'Centre' },
                        { value: 'right', label: 'Right' },
                      ]}
                      onChange={setMarkPlacementH}
                    />
                    <SegmentedControl<MarkPlacementV>
                      label="Vertical position"
                      value={markPlacementV}
                      options={[
                        { value: 'header', label: 'Header' },
                        { value: 'footer', label: 'Footer' },
                      ]}
                      onChange={setMarkPlacementV}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <FieldLabel>Opacity</FieldLabel>
                      <span className="num text-xs text-neutral-500">{markOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={markOpacity}
                      onChange={(e) => setMarkOpacity(Number(e.target.value))}
                      className="w-full accent-brand-600"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Subtle</span>
                      <span>Full</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
            {isLoading ? (
              <span className="text-sm text-neutral-400">Loading…</span>
            ) : company ? (
              <span className="text-xs text-neutral-400">
                Last saved{' '}
                <time dateTime={company.updatedAt}>
                  {new Date(company.updatedAt).toLocaleDateString()}
                </time>
              </span>
            ) : (
              <span className="text-xs text-neutral-400">No company profile yet</span>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={updateCompany.isPending || !name.trim()}
            >
              {updateCompany.isPending ? 'Saving…' : company ? 'Save changes' : 'Create company'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
