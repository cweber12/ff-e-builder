import type { Project } from '../types';
import { MaterialLibraryPanel } from './MaterialLibraryModal';

type MaterialsViewProps = {
  project: Project;
};

export function MaterialsView({ project }: MaterialsViewProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-base font-semibold text-gray-950">Materials</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage the reusable material library for {project.name}.
        </p>
      </div>
      <MaterialLibraryPanel projectId={project.id} roomId="" />
    </div>
  );
}
