type ProjectOptionsMenuProps = {
  projectName: string;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onImages: () => void;
  onDelete: () => void;
  align?: 'top' | 'bottom';
  buttonClassName?: string;
};

export function ProjectOptionsMenu({
  projectName,
  open,
  onToggle,
  onEdit,
  onImages,
  onDelete,
  align = 'top',
  buttonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-brand-500 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
}: ProjectOptionsMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Open options for ${projectName}`}
        aria-expanded={open}
        onClick={onToggle}
        className={buttonClassName}
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          className={[
            'absolute right-0 z-30 min-w-44 rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg',
            align === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          ].join(' ')}
        >
          <button
            type="button"
            className="flex w-full rounded px-2 py-1.5 text-left text-gray-700 hover:bg-brand-50"
            onClick={onEdit}
          >
            Update project
          </button>
          <button
            type="button"
            className="flex w-full rounded px-2 py-1.5 text-left text-gray-700 hover:bg-brand-50"
            onClick={onImages}
          >
            Project images
          </button>
          <button
            type="button"
            className="flex w-full rounded px-2 py-1.5 text-left text-danger-600 hover:bg-red-50"
            onClick={onDelete}
          >
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
