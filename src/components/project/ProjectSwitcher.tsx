import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/shared/useProjects';
import { cn } from '../../lib/cn';

interface ProjectSwitcherProps {
  currentProjectId: string;
}

/** Only renders when the user has ≥ 2 projects. */
export function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  const { data: projects } = useProjects();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!projects || projects.length < 2) return null;

  const current = projects.find((p) => p.id === currentProjectId);

  const handleSelect = (id: string) => {
    setOpen(false);
    if (id !== currentProjectId) void navigate(`/projects/${id}`);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-brand-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <span className="max-w-[160px] truncate">{current?.name ?? 'Switch project'}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={cn('h-3.5 w-3.5 flex-shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div aria-hidden="true" className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <ul
            role="listbox"
            aria-label="Projects"
            className="absolute left-0 top-full mt-1 z-20 w-72 rounded-lg bg-surface shadow-lg border border-gray-100 py-1 overflow-hidden"
          >
            {projects.map((p) => (
              <li key={p.id} role="option" aria-selected={p.id === currentProjectId}>
                <button
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 flex flex-col gap-0.5 hover:bg-brand-50 transition-colors',
                    p.id === currentProjectId && 'bg-brand-50',
                  )}
                >
                  <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                  <span className="text-xs text-gray-500 truncate">
                    {p.clientName || 'No client'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
