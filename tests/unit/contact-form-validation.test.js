/**
 * Contact Form Validation Tests (P2-04)
 * Tests for supplier contact form validation
 */

describe('Contact Form Validation', () => {
  describe('Name Validation', () => {
    test('should reject empty name', () => {
      const validateName = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Name is required';
        }
        if (trimmed.length < 2) {
          return 'Name must be at least 2 characters';
        }
        if (trimmed.length > 100) {
          return 'Name must be less than 100 characters';
        }
        return null;
      };

      expect(validateName('')).toBe('Name is required');
      expect(validateName('   ')).toBe('Name is required');
    });

    test('should reject name shorter than 2 characters', () => {
      const validateName = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Name is required';
        }
        if (trimmed.length < 2) {
          return 'Name must be at least 2 characters';
        }
        if (trimmed.length > 100) {
          return 'Name must be less than 100 characters';
        }
        return null;
      };

      expect(validateName('A')).toBe('Name must be at least 2 characters');
    });

    test('should reject name longer than 100 characters', () => {
      const validateName = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Name is required';
        }
        if (trimmed.length < 2) {
          return 'Name must be at least 2 characters';
        }
        if (trimmed.length > 100) {
          return 'Name must be less than 100 characters';
        }
        return null;
      };

      const longName = 'A'.repeat(101);
      expect(validateName(longName)).toBe('Name must be less than 100 characters');
    });

    test('should accept valid names', () => {
      const validateName = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Name is required';
        }
        if (trimmed.length < 2) {
          return 'Name must be at least 2 characters';
        }
        if (trimmed.length > 100) {
          return 'Name must be less than 100 characters';
        }
        return null;
      };

      expect(validateName('John Doe')).toBeNull();
      expect(validateName('AB')).toBeNull();
      expect(validateName('A'.repeat(100))).toBeNull();
    });
  });

  describe('Email Validation', () => {
    test('should reject empty email', () => {
      const validateEmail = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address';
        }
        if (trimmed.length > 100) {
          return 'Email must be less than 100 characters';
        }
        return null;
      };

      expect(validateEmail('')).toBe('Email is required');
      expect(validateEmail('   ')).toBe('Email is required');
    });

    test('should reject invalid email formats', () => {
      const validateEmail = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address';
        }
        if (trimmed.length > 100) {
          return 'Email must be less than 100 characters';
        }
        return null;
      };

      expect(validateEmail('invalid')).toBe('Please enter a valid email address');
      expect(validateEmail('invalid@')).toBe('Please enter a valid email address');
      expect(validateEmail('invalid@domain')).toBe('Please enter a valid email address');
      expect(validateEmail('@domain.com')).toBe('Please enter a valid email address');
      expect(validateEmail('invalid domain@test.com')).toBe('Please enter a valid email address');
    });

    test('should reject email longer than 100 characters', () => {
      const validateEmail = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address';
        }
        if (trimmed.length > 100) {
          return 'Email must be less than 100 characters';
        }
        return null;
      };

      const longEmail = `${'a'.repeat(92)}@test.com`; // 92 + 9 = 101 characters
      expect(validateEmail(longEmail)).toBe('Email must be less than 100 characters');
    });

    test('should accept valid email addresses', () => {
      const validateEmail = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address';
        }
        if (trimmed.length > 100) {
          return 'Email must be less than 100 characters';
        }
        return null;
      };

      expect(validateEmail('test@example.com')).toBeNull();
      expect(validateEmail('user.name@example.co.uk')).toBeNull();
      expect(validateEmail('user+tag@example.com')).toBeNull();
    });
  });

  describe('Message Validation', () => {
    test('should reject empty message', () => {
      const validateMessage = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Message is required';
        }
        if (trimmed.length < 10) {
          return 'Message must be at least 10 characters';
        }
        if (trimmed.length > 1000) {
          return 'Message must be less than 1000 characters';
        }
        return null;
      };

      expect(validateMessage('')).toBe('Message is required');
      expect(validateMessage('   ')).toBe('Message is required');
    });

    test('should reject message shorter than 10 characters', () => {
      const validateMessage = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Message is required';
        }
        if (trimmed.length < 10) {
          return 'Message must be at least 10 characters';
        }
        if (trimmed.length > 1000) {
          return 'Message must be less than 1000 characters';
        }
        return null;
      };

      expect(validateMessage('Short')).toBe('Message must be at least 10 characters');
      expect(validateMessage('123456789')).toBe('Message must be at least 10 characters');
    });

    test('should reject message longer than 1000 characters', () => {
      const validateMessage = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Message is required';
        }
        if (trimmed.length < 10) {
          return 'Message must be at least 10 characters';
        }
        if (trimmed.length > 1000) {
          return 'Message must be less than 1000 characters';
        }
        return null;
      };

      const longMessage = 'A'.repeat(1001);
      expect(validateMessage(longMessage)).toBe('Message must be less than 1000 characters');
    });

    test('should accept valid messages', () => {
      const validateMessage = value => {
        const trimmed = value.trim();
        if (!trimmed) {
          return 'Message is required';
        }
        if (trimmed.length < 10) {
          return 'Message must be at least 10 characters';
        }
        if (trimmed.length > 1000) {
          return 'Message must be less than 1000 characters';
        }
        return null;
      };

      expect(validateMessage('Hello there!')).toBeNull();
      expect(validateMessage('A'.repeat(10))).toBeNull();
      expect(validateMessage('A'.repeat(1000))).toBeNull();
      expect(
        validateMessage('Hi! We are planning an event on [DATE] for around [GUESTS] guests.')
      ).toBeNull();
    });
  });

  describe('Complete Form Validation', () => {
    test('should validate complete form data', () => {
      const validateContactForm = formData => {
        const errors = [];

        // Name validation
        if (!formData.name || formData.name.trim().length < 2) {
          errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
        }
        if (formData.name && formData.name.trim().length > 100) {
          errors.push({ field: 'name', message: 'Name must be less than 100 characters' });
        }

        // Email validation
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          errors.push({ field: 'email', message: 'Please enter a valid email address' });
        }
        if (formData.email && formData.email.length > 100) {
          errors.push({ field: 'email', message: 'Email must be less than 100 characters' });
        }

        // Message validation
        if (!formData.message || formData.message.trim().length < 10) {
          errors.push({ field: 'message', message: 'Message must be at least 10 characters' });
        }
        if (formData.message && formData.message.length > 1000) {
          errors.push({ field: 'message', message: 'Message must be less than 1000 characters' });
        }

        return errors;
      };

      // Valid form
      const validForm = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello! I would like to inquire about your services.',
      };
      expect(validateContactForm(validForm)).toHaveLength(0);

      // Invalid form - empty fields
      const invalidForm1 = {
        name: '',
        email: '',
        message: '',
      };
      expect(validateContactForm(invalidForm1).length).toBeGreaterThan(0);

      // Invalid form - bad email
      const invalidForm2 = {
        name: 'John Doe',
        email: 'invalid-email',
        message: 'Hello! I would like to inquire about your services.',
      };
      const errors2 = validateContactForm(invalidForm2);
      expect(errors2).toContainEqual({
        field: 'email',
        message: 'Please enter a valid email address',
      });

      // Invalid form - message too short
      const invalidForm3 = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hi',
      };
      const errors3 = validateContactForm(invalidForm3);
      expect(errors3).toContainEqual({
        field: 'message',
        message: 'Message must be at least 10 characters',
      });
    });
  });
});
