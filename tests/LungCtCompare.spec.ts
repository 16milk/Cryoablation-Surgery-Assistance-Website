import { expect, test } from './utils';

/** Static WADO (ohif datasource); includes chest CT suitable for modality gate. */
const STUDY_INSTANCE_UID = '1.3.6.1.4.1.14519.5.2.1.5099.8010.217836670708542506360829799868';

test.describe('Lung CT compare mode', () => {
  test('loads route and shows compare panel', async ({ page }) => {
    await page.goto(`/lung-ct-compare/ohif?StudyInstanceUIDs=${STUDY_INSTANCE_UID}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.getByTestId('lung-compare-panel')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('lung-compare-layout-select')).toBeVisible({ timeout: 30000 });
  });
});
