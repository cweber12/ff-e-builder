import { createProjectWithSampleContent } from './sampleProject';
import { reportError } from '../lib/utils';

/**
 * Seeds an example project for a newly created account.
 * Calls the API directly (not via React Query) so it can be called
 * immediately after Firebase auth before the React tree re-renders.
 */
export async function seedExampleProject(): Promise<void> {
  try {
    await createProjectWithSampleContent({
      name: 'Sample Project',
      clientName: 'Interior Design Co.',
      companyName: 'ChillDesignStudio',
      projectLocation: 'Los Angeles, CA',
      budgetCents: 3500000,
    });
  } catch (err) {
    reportError(err, { source: 'seedExampleProject' });
    throw err;
  }
}
