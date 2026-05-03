import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './primitives/Modal';
import { Button } from './primitives/Button';
import { dollarsToCents, parseUnitCostDollarsInput } from '../types';
import { useCreateProject } from '../hooks/useProjects';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [budgetDollars, setBudgetDollars] = useState('');
  const [nameError, setNameError] = useState('');

  const reset = () => {
    setName('');
    setClientName('');
    setCompanyName('');
    setProjectLocation('');
    setBudgetDollars('');
    setNameError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Project name is required');
      return;
    }

    const parsedDollars = budgetDollars ? parseUnitCostDollarsInput(budgetDollars) : undefined;
    const budgetCents = parsedDollars !== undefined ? dollarsToCents(parsedDollars) : 0;

    try {
      const input: Parameters<typeof createProject.mutateAsync>[0] = {
        name: name.trim(),
        ...(clientName.trim() ? { clientName: clientName.trim() } : {}),
        ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
        ...(projectLocation.trim() ? { projectLocation: projectLocation.trim() } : {}),
        ...(budgetCents > 0 ? { budgetCents } : {}),
      };
      const project = await createProject.mutateAsync(input);
      reset();
      onClose();
      void navigate(`/projects/${project.id}`);
    } catch {
      // mutation error is surfaced by TanStack Query / sonner toast in hook
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="New project">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="np-name" className="text-sm font-medium text-gray-700">
              Project name <span className="text-danger-500">*</span>
            </label>
            <input
              id="np-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError('');
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              placeholder="Living Room Renovation"
              aria-required="true"
              aria-describedby={nameError ? 'np-name-error' : undefined}
            />
            {nameError && (
              <p id="np-name-error" role="alert" className="text-xs text-danger-500">
                {nameError}
              </p>
            )}
          </div>

          {/* Client name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="np-client" className="text-sm font-medium text-gray-700">
              Client name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="np-client"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              placeholder="Jane Smith"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="np-company" className="text-sm font-medium text-gray-700">
                Company <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="np-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="Chill Design Studio"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="np-location" className="text-sm font-medium text-gray-700">
                Project location <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="np-location"
                type="text"
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="Palm Springs, CA"
              />
            </div>
          </div>

          {/* Budget */}
          <div className="flex flex-col gap-1">
            <label htmlFor="np-budget" className="text-sm font-medium text-gray-700">
              Budget <span className="text-gray-400">(optional, in dollars)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">
                $
              </span>
              <input
                id="np-budget"
                type="number"
                min="0"
                step="0.01"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-6 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                placeholder="250000"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createProject.isPending}>
              {createProject.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
