import { expect, test } from '@playwright/test';

import { installApiRouteMocks, installSupabaseClientMock, type ApiCallTracker } from './support/installMocks';

test.describe('Connect to Chat smoke flow', () => {
  test('runs connect -> sync -> embeddings -> chat in-browser', async ({ page }) => {
    const tracker: ApiCallTracker = {
      syncGithubCalls: 0,
      syncEmbeddingsCalls: 0,
      chatCalls: 0,
    };

    await installSupabaseClientMock(page);
    await installApiRouteMocks(page, tracker);

    await page.goto('/connect/github');

    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible();
    await expect(page.getByText('Connected & syncing').first()).toBeVisible();

    const syncNowButton = page.getByRole('button', { name: 'Sync Now' });
    await expect(syncNowButton).toBeVisible();
    await syncNowButton.click();

    await expect.poll(() => tracker.syncGithubCalls).toBeGreaterThan(0);

    const embeddingsSyncOk = await page.evaluate(async () => {
      const response = await fetch('/api/sync/embeddings', { method: 'POST' });
      return response.ok;
    });

    expect(embeddingsSyncOk).toBe(true);
    await expect.poll(() => tracker.syncEmbeddingsCalls).toBeGreaterThan(0);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'EYES' })).toBeVisible();

    const chatInput = page.getByPlaceholder('Search digital memories...');
    await expect(chatInput).toBeVisible();

    await chatInput.fill('What changed in my GitHub activity this week?');
    await chatInput.press('Enter');

    await expect.poll(() => tracker.chatCalls).toBeGreaterThan(0);

    await expect(page.getByText(/retry resiliency work/i)).toBeVisible();
  });
});
