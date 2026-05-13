import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../primitives/Modal';
import { Button } from '../../primitives/Button';
import { cents, dollarsToCents, parseUnitCostDollarsInput } from '../../../types';
import type { Project } from '../../../types';
import type { UpdateProjectInput } from '../../../lib/api';

type EditProjectModalProps = {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onSave: (projectId: string, patch: UpdateProjectInput) => Promise<void> | void;
  isSaving?: boolean;
};

export function EditProjectModal({
  project,
  open,
  onClose,
  onSave,
  isSaving = false,
}: EditProjectModalProps) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [budgetDollars, setBudgetDollars] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!project || !open) return;
    setName(project.name);
    setClientName(project.clientName);
    setCompanyName(project.companyName ?? '');
    setProjectLocation(project.projectLocation ?? '');
    setBudgetDollars(project.budgetCents > 0 ? String(cents(project.budgetCents)) : '');
    setNameError('');
  }, [open, project]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!project) return;
    if (!name.trim()) {
      setNameError('Project name is required');
      return;
    }

    const parsedDollars = budgetDollars ? parseUnitCostDollarsInput(budgetDollars) : undefined;
    const budgetCents = parsedDollars !== undefined ? dollarsToCents(parsedDollars) : 0;

    await onSave(project.id, {
      name: name.trim(),
      clientName: clientName.trim(),
      companyName: companyName.trim(),
      projectLocation: projectLocation.trim(),
      budgetCents,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Update project">
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ep-name" className="text-sm font-medium text-gray-700">
              Project name <span className="text-danger-500">*</span>
            </label>
            <input
              id="ep-name"
              type="text"
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError('');
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              aria-required="true"
              aria-describedby={nameError ? 'ep-name-error' : undefined}
            />
            {nameError && (
              <p id="ep-name-error" role="alert" className="text-xs text-danger-500">
                {nameError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ep-client" className="text-sm font-medium text-gray-700">
              Client name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="ep-client"
              type="text"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="ep-company" className="text-sm font-medium text-gray-700">
                Company <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="ep-company"
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="ep-location" className="text-sm font-medium text-gray-700">
                Project location <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="ep-location"
                type="text"
                value={projectLocation}
                onChange={(event) => setProjectLocation(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ep-budget" className="text-sm font-medium text-gray-700">
              Budget <span className="text-gray-400">(optional, in dollars)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                $
              </span>
              <input
                id="ep-budget"
                type="number"
                min="0"
                step="0.01"
                value={budgetDollars}
                onChange={(event) => setBudgetDollars(event.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-6 pr-3 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
