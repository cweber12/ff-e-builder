export function EditablePencilHint() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-1.5 top-2 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-60"
    >
      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
        <path
          d="M8.5 1.5 10.5 3.5 4 10H2v-2z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
