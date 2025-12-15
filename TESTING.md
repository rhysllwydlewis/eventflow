# Testing Guide

This document describes the testing strategy and practices for EventFlow.

## Overview

EventFlow uses Jest as the testing framework with support for both unit and integration tests.

## Prerequisites

```bash
npm install
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

## Test Structure

```
tests/
├── unit/              # Unit tests
│   ├── auth.test.js
│   └── middleware.test.js
├── integration/       # Integration tests
│   └── api.test.js
└── setup.js          # Test setup and configuration
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions and modules in isolation.

**Example:**

```javascript
describe('Authentication Helper', () => {
  it('should hash password correctly', () => {
    const password = 'test123';
    const hashed = hashPassword(password);
    expect(hashed).not.toBe(password);
  });
});
```

### Integration Tests

Integration tests verify that different parts of the application work together correctly.

**Example:**

```javascript
describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
  });
});
```

## Test Coverage

We aim for at least 70% code coverage across the codebase.

To generate a coverage report:

```bash
npm test -- --coverage
```

Coverage reports are generated in the `coverage/` directory (excluded from git).

## Best Practices

1. **Descriptive Test Names**: Use clear, descriptive names that explain what the test does
2. **Arrange-Act-Assert**: Structure tests with setup, execution, and verification phases
3. **Test Isolation**: Each test should be independent and not rely on other tests
4. **Mock External Dependencies**: Use mocks for database calls, API requests, etc.
5. **Test Edge Cases**: Include tests for error conditions and boundary cases

## Mocking

### Mocking Database Calls

```javascript
jest.mock('../db', () => ({
  findUser: jest.fn(),
  createUser: jest.fn(),
}));
```

### Mocking Environment Variables

```javascript
process.env.JWT_SECRET = 'test-secret';
```

## Continuous Integration

Tests run automatically on every pull request via GitHub Actions. See `.github/workflows/ci.yml` for details.

All tests must pass before merging code.

## Debugging Tests

### Run a Specific Test File

```bash
npm test -- tests/unit/auth.test.js
```

### Run a Specific Test

```bash
npm test -- -t "should hash password correctly"
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome and click "inspect".

## Common Issues

### Tests Timing Out

If tests are timing out, increase the timeout:

```javascript
jest.setTimeout(10000); // 10 seconds
```

### Database Connection Issues

Make sure test database is properly configured or mocked.

### Port Already in Use

Tests should use dynamic ports or mock the server instead of binding to a real port.

## Contributing

When adding new features, please include tests. See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.
