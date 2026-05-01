import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  '/signin',
  '/projects',
  '/projects/demo-project/table',
  '/projects/demo-project/catalog',
  '/projects/demo-project/summary',
];

for (const route of routes) {
  test(`axe audit has no violations above minor on ${route}`, async ({ page }) => {
    await page.goto(`.${route}`);

    const results = await new AxeBuilder({ page }).analyze();
    const violationsAboveMinor = results.violations.filter(
      (violation) => violation.impact !== 'minor',
    );

    expect(violationsAboveMinor).toEqual([]);
  });
}
