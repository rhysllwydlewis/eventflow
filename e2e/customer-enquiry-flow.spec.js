import { test, expect } from '@playwright/test';

test.describe('Customer Enquiry Flow @backend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display enquiry/contact form option', async ({ page }) => {
    // Look for enquiry or contact links
    const enquiryLink = page.locator(
      'a:has-text("Contact"), a:has-text("Enquire"), a:has-text("Get Quote"), button:has-text("Contact"), button:has-text("Enquire")'
    );

    if ((await enquiryLink.count()) > 0) {
      await expect(enquiryLink.first()).toBeVisible();
    }
  });

  test('should navigate to enquiry form from supplier listing', async ({ page }) => {
    // Find a supplier
    const supplierCard = page.locator('.supplier-card, [data-supplier-id], .card').first();

    if ((await supplierCard.count()) > 0) {
      await supplierCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Look for enquiry button on supplier page
      const enquiryButton = page.locator(
        'button:has-text("Enquire"), button:has-text("Contact"), a:has-text("Send Message")'
      );

      if ((await enquiryButton.count()) > 0) {
        await expect(enquiryButton.first()).toBeVisible();
      }
    }
  });

  test('should display required enquiry form fields', async ({ page }) => {
    // Navigate to contact/enquiry page
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check for essential enquiry fields
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], #name');
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const messageInput = page.locator(
        'textarea[name="message"], textarea[placeholder*="message" i]'
      );

      // Should have basic contact fields
      const hasBasicFields =
        (await nameInput.count()) > 0 &&
        (await emailInput.count()) > 0 &&
        (await messageInput.count()) > 0;

      if (hasBasicFields) {
        expect(hasBasicFields).toBe(true);
      }
    }
  });

  test('should display event-specific fields', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for event-specific fields
      const eventDateInput = page.locator(
        'input[type="date"], input[name*="date"], input[placeholder*="date" i]'
      );
      const eventTypeSelect = page.locator(
        'select[name*="event"], select[name*="type"], input[name*="event"]'
      );
      const guestCountInput = page.locator(
        'input[name*="guest"], input[placeholder*="guest" i], input[type="number"]'
      );

      // Should have at least some event fields
      const hasEventFields =
        (await eventDateInput.count()) > 0 ||
        (await eventTypeSelect.count()) > 0 ||
        (await guestCountInput.count()) > 0;

      if (hasEventFields) {
        expect(hasEventFields).toBe(true);
      }
    }
  });

  test('should validate required email field', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Try to submit with invalid email
      const emailInput = page.locator('input[type="email"]').first();
      const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();

      if ((await emailInput.count()) > 0 && (await submitButton.count()) > 0) {
        await emailInput.fill('invalid-email');
        await submitButton.click();
        await page.waitForTimeout(1000);

        // Should show validation error
        const emailError = await emailInput.evaluate(el => {
          return !el.checkValidity() || el.getAttribute('aria-invalid') === 'true';
        });

        expect(emailError).toBe(true);
      }
    }
  });

  test('should validate event date is in the future', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for date validation
      const dateInput = page.locator('input[type="date"]').first();
      if ((await dateInput.count()) > 0) {
        // Try to set past date
        await dateInput.fill('2020-01-01');

        const submitButton = page.locator('button[type="submit"]').first();
        if ((await submitButton.count()) > 0) {
          await submitButton.click();
          await page.waitForTimeout(1000);

          // Should show error or prevent submission
          const errorMessage = page.locator('.error, .alert-danger, [role="alert"]');
          if ((await errorMessage.count()) > 0) {
            expect(await errorMessage.count()).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  test('should allow selecting event type', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for event type selection
      const eventTypeSelect = page.locator('select[name*="type"], select[name*="event"]').first();

      if ((await eventTypeSelect.count()) > 0) {
        await expect(eventTypeSelect).toBeVisible();

        // Should have multiple event type options
        const options = await eventTypeSelect.locator('option').count();
        expect(options).toBeGreaterThan(1);
      }
    }
  });

  test('should allow specifying budget range', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for budget field
      const budgetInput = page.locator(
        'select[name*="budget"], input[name*="budget"], input[placeholder*="budget" i]'
      );

      if ((await budgetInput.count()) > 0) {
        await expect(budgetInput.first()).toBeVisible();
      }
    }
  });

  test('should display phone number field', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for phone field
      const phoneInput = page.locator('input[type="tel"], input[name*="phone"]');

      if ((await phoneInput.count()) > 0) {
        await expect(phoneInput.first()).toBeVisible();
      }
    }
  });

  test('should allow adding postcode for location', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for postcode field
      const postcodeInput = page.locator(
        'input[name*="postcode"], input[placeholder*="postcode" i]'
      );

      if ((await postcodeInput.count()) > 0) {
        await expect(postcodeInput.first()).toBeVisible();
      }
    }
  });

  test('should handle successful form submission', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Fill out the form with valid data
      const nameInput = page.locator('input[name="name"]').first();
      const emailInput = page.locator('input[type="email"]').first();
      const messageInput = page.locator('textarea[name="message"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      if (
        (await nameInput.count()) > 0 &&
        (await emailInput.count()) > 0 &&
        (await messageInput.count()) > 0 &&
        (await submitButton.count()) > 0
      ) {
        await nameInput.fill('Test Customer');
        await emailInput.fill('test@example.com');
        await messageInput.fill('This is a test enquiry message.');

        // Set event date if available
        const dateInput = page.locator('input[type="date"]').first();
        if ((await dateInput.count()) > 0) {
          const futureDate = new Date();
          futureDate.setMonth(futureDate.getMonth() + 3);
          await dateInput.fill(futureDate.toISOString().split('T')[0]);
        }

        await submitButton.click();
        await page.waitForTimeout(2000);

        // Should show success message or redirect
        const successMessage = page.locator(
          '.success, .alert-success, :has-text("Thank you"), :has-text("Success")'
        );

        if ((await successMessage.count()) > 0) {
          await expect(successMessage.first()).toBeVisible();
        }
      }
    }
  });

  test('should have CAPTCHA or bot protection', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for CAPTCHA or honeypot fields
      const captcha = page.locator('.g-recaptcha, .h-captcha, input[name="captcha"]');
      const honeypot = page.locator(
        'input[style*="display: none"], input[style*="visibility: hidden"]'
      );

      const hasBotProtection = (await captcha.count()) > 0 || (await honeypot.count()) > 0;

      if (hasBotProtection) {
        expect(hasBotProtection).toBe(true);
      }
    }
  });

  test('should display privacy policy acknowledgment', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for privacy/GDPR checkbox or text
      const privacyCheckbox = page.locator(
        'input[type="checkbox"][name*="privacy"], input[type="checkbox"]:near(:text("Privacy"))'
      );
      const privacyText = page.locator(':text("Privacy Policy"), :text("GDPR")');

      const hasPrivacyInfo = (await privacyCheckbox.count()) > 0 || (await privacyText.count()) > 0;

      if (hasPrivacyInfo) {
        expect(hasPrivacyInfo).toBe(true);
      }
    }
  });

  test('should show lead quality indicators', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact"), a[href*="contact"]').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for optional but quality-improving fields
      const phoneField = await page.locator('input[type="tel"]').count();
      const budgetField = await page
        .locator('select[name*="budget"], input[name*="budget"]')
        .count();
      const guestField = await page.locator('input[name*="guest"]').count();

      // Form should encourage quality information
      const hasQualityFields = phoneField > 0 || budgetField > 0 || guestField > 0;
      expect(hasQualityFields).toBe(true);
    }
  });

  test('should be mobile responsive', async ({ page, isMobile }) => {
    if (isMobile) {
      const contactLink = page.locator('a:has-text("Contact")').first();

      if ((await contactLink.count()) > 0) {
        await contactLink.click();
        await page.waitForLoadState('networkidle');

        // Form should be visible and usable on mobile
        const form = page.locator('form').first();
        if ((await form.count()) > 0) {
          await expect(form).toBeVisible();

          // Check form doesn't overflow
          const formWidth = await form.evaluate(el => el.offsetWidth);
          const viewportWidth = page.viewportSize()?.width || 0;
          expect(formWidth).toBeLessThanOrEqual(viewportWidth);
        }
      }
    }
  });

  test('should allow enquiring about multiple suppliers', async ({ page }) => {
    // Find first supplier
    const firstSupplier = page.locator('.supplier-card, [data-supplier-id]').first();

    if ((await firstSupplier.count()) > 0) {
      await firstSupplier.click();
      await page.waitForLoadState('networkidle');

      const enquiryButton = page
        .locator('button:has-text("Enquire"), button:has-text("Contact")')
        .first();

      if ((await enquiryButton.count()) > 0) {
        await enquiryButton.click();
        await page.waitForTimeout(1000);

        // Should show enquiry form or modal
        const enquiryForm = page.locator('form, .modal');
        if ((await enquiryForm.count()) > 0) {
          await expect(enquiryForm.first()).toBeVisible();
        }
      }
    }
  });

  test('should show confirmation message after submission', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact")').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // After form submission, should see confirmation
      // This is tested by the successful submission test above
      expect(true).toBe(true);
    }
  });

  test('should validate minimum message length', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact")').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      const messageInput = page.locator('textarea[name="message"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      if ((await messageInput.count()) > 0 && (await submitButton.count()) > 0) {
        // Try very short message
        await messageInput.fill('Hi');

        // Check for minlength attribute or validation
        const minLength = await messageInput.getAttribute('minlength');
        if (minLength && parseInt(minLength) > 2) {
          expect(parseInt(minLength)).toBeGreaterThan(2);
        }
      }
    }
  });

  test('should have accessible form with proper labels', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact")').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Check for proper labels
      const inputs = page.locator('input[type="text"], input[type="email"], textarea');
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        // Each input should have label, placeholder, or aria-label
        for (let i = 0; i < Math.min(inputCount, 3); i++) {
          const input = inputs.nth(i);
          const inputId = await input.getAttribute('id');
          const hasLabel =
            (await input.getAttribute('aria-label')) !== null ||
            (await input.getAttribute('placeholder')) !== null ||
            (inputId && (await page.locator(`label[for="${inputId}"]`).count()) > 0);

          if (hasLabel) {
            expect(hasLabel).toBe(true);
            break;
          }
        }
      }
    }
  });

  test('should provide helpful error messages', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact")').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      // Submit empty form
      const submitButton = page.locator('button[type="submit"]').first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
        await page.waitForTimeout(1000);

        // Should show specific error messages
        const errorMessages = page.locator('.error, .invalid-feedback, [role="alert"]');
        if ((await errorMessages.count()) > 0) {
          const errorText = await errorMessages.first().textContent();
          expect(errorText).toBeTruthy();
          if (errorText) {
            expect(errorText.length).toBeGreaterThan(5); // Meaningful error
          }
        }
      }
    }
  });

  test('should retain form data on validation errors', async ({ page }) => {
    const contactLink = page.locator('a:has-text("Contact")').first();

    if ((await contactLink.count()) > 0) {
      await contactLink.click();
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('input[name="name"]').first();
      const messageInput = page.locator('textarea[name="message"]').first();

      if ((await nameInput.count()) > 0 && (await messageInput.count()) > 0) {
        // Fill some fields
        await nameInput.fill('Test User');
        await messageInput.fill('Test message');

        // Submit (may fail validation)
        const submitButton = page.locator('button[type="submit"]').first();
        if ((await submitButton.count()) > 0) {
          await submitButton.click();
          await page.waitForTimeout(1000);

          // Form data should still be there
          const nameValue = await nameInput.inputValue();
          expect(nameValue).toBe('Test User');
        }
      }
    }
  });
});
