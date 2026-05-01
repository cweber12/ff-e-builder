import { expect, test } from '@playwright/test';

test('catalog next navigation updates page state', async ({ page }) => {
  await page.goto('./projects/demo-project/catalog');

  await expect(
    page.getByRole('article', { name: /Channel Lounge Chair catalog page/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next catalog item' }).click();

  await expect(page).toHaveURL(/catalog\?page=2$/);
  await expect(page.getByRole('article', { name: /Arc Floor Lamp catalog page/ })).toBeVisible();
});

test('catalog PDF page count matches fixture item count', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'PDF generation is only available in Chromium.');

  await page.goto('./projects/demo-project/catalog');
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  const pdfText = pdf.toString('latin1');
  const pageCount = pdfText.match(/\/Type\s*\/Page\b/g)?.length ?? 0;

  expect(pageCount).toBe(3);
});
