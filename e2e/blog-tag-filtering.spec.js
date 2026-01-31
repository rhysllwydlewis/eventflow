const { test, expect } = require('@playwright/test');

test.describe('Blog Tag Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog.html');
    await page.waitForSelector('#blog-articles .article-card');
    await page.waitForSelector('.tag-filter');
  });

  test('should display all articles by default', async ({ page }) => {
    const articles = await page.locator('.article-card').all();
    expect(articles.length).toBeGreaterThan(0);
    
    for (const article of articles) {
      await expect(article).toBeVisible();
    }
  });

  test('should display tag filter buttons', async ({ page }) => {
    const allButton = page.locator('.tag-filter[data-tag=""]');
    await expect(allButton).toBeVisible();
    await expect(allButton).toHaveText('All');
    await expect(allButton).toHaveClass(/active/);
    
    const filterButtons = await page.locator('.tag-filter').all();
    expect(filterButtons.length).toBeGreaterThan(1);
  });

  test('should display multiple tags on each article', async ({ page }) => {
    const firstArticle = page.locator('.article-card').first();
    const tags = await firstArticle.locator('.article-card-tag').all();
    expect(tags.length).toBeGreaterThan(0);
  });

  test('should filter articles when clicking a tag', async ({ page }) => {
    const planningButton = page.locator('.tag-filter[data-tag="planning"]');
    
    if (await planningButton.count() > 0) {
      await planningButton.click();
      
      await expect(planningButton).toHaveClass(/active/);
      
      const visibleArticles = await page.locator('.article-card:visible').all();
      expect(visibleArticles.length).toBeGreaterThan(0);
      
      for (const article of visibleArticles) {
        const tags = await article.getAttribute('data-tags');
        expect(tags).toContain('planning');
      }
      
      const hiddenArticles = await page.locator('.article-card[style*="display: none"]').all();
      for (const article of hiddenArticles) {
        const tags = await article.getAttribute('data-tags');
        expect(tags).not.toContain('planning');
      }
    }
  });

  test('should show all articles when clicking "All" button', async ({ page }) => {
    const weddingButton = page.locator('.tag-filter[data-tag="wedding"]');
    
    if (await weddingButton.count() > 0) {
      await weddingButton.click();
      
      let visibleArticles = await page.locator('.article-card:visible').all();
      const filteredCount = visibleArticles.length;
      
      const allButton = page.locator('.tag-filter[data-tag=""]');
      await allButton.click();
      
      await expect(allButton).toHaveClass(/active/);
      
      visibleArticles = await page.locator('.article-card:visible').all();
      expect(visibleArticles.length).toBeGreaterThan(filteredCount);
      
      const hiddenArticles = await page.locator('.article-card[style*="display: none"]').count();
      expect(hiddenArticles).toBe(0);
    }
  });

  test('should update active state when switching filters', async ({ page }) => {
    const allButton = page.locator('.tag-filter[data-tag=""]');
    await expect(allButton).toHaveClass(/active/);
    
    const filterButtons = await page.locator('.tag-filter:not([data-tag=""])').all();
    
    if (filterButtons.length > 0) {
      const firstFilter = filterButtons[0];
      await firstFilter.click();
      
      await expect(firstFilter).toHaveClass(/active/);
      await expect(allButton).not.toHaveClass(/active/);
      
      await allButton.click();
      await expect(allButton).toHaveClass(/active/);
      await expect(firstFilter).not.toHaveClass(/active/);
    }
  });

  test('should have proper styling on filter buttons', async ({ page }) => {
    const allButton = page.locator('.tag-filter[data-tag=""]');
    
    const bgColor = await allButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBeTruthy();
    
    const borderRadius = await allButton.evaluate(el => 
      window.getComputedStyle(el).borderRadius
    );
    expect(borderRadius).toContain('999px');
  });

  test('should handle hover state on filter buttons', async ({ page }) => {
    const filters = await page.locator('.tag-filter:not(.active)').all();
    
    if (filters.length > 0) {
      const filter = filters[0];
      await filter.hover();
      
      const hoverBg = await filter.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(hoverBg).toBeTruthy();
    }
  });

  test('should have proper tag badges layout', async ({ page }) => {
    const tagsContainer = page.locator('.article-card-tags').first();
    
    const display = await tagsContainer.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(display).toBe('flex');
    
    const flexWrap = await tagsContainer.evaluate(el => 
      window.getComputedStyle(el).flexWrap
    );
    expect(flexWrap).toBe('wrap');
  });
});
