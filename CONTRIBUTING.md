# Contributing to EventFlow

Thank you for your interest in contributing to EventFlow! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/eventflow.git
   cd eventflow
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/rhysllwydlewis/eventflow.git
   ```

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- MongoDB Atlas account (free tier available) or local MongoDB
- Git

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```
   This will install all required dependencies and set up Husky git hooks.

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure:
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Random secret (min 32 characters)
   - Other optional services (email, storage, etc.)

3. **Run the development server**:
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Run linting**:
   ```bash
   npm run lint
   ```
   To automatically fix issues:
   ```bash
   npm run lint:fix
   ```

5. **Run tests**:
   ```bash
   npm test
   ```

For detailed setup instructions, see [README.md](README.md).

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Development branch for integration
- Feature branches - `feature/your-feature-name`
- Bug fix branches - `fix/bug-description`

### Workflow Steps

1. **Create a branch** from `develop`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Brief description of changes"
   ```
   
   **Commit Message Guidelines:**
   - Use present tense ("Add feature" not "Added feature")
   - Use imperative mood ("Move cursor to..." not "Moves cursor to...")
   - Limit first line to 72 characters or less
   - Reference issue numbers when applicable (e.g., "Fix #123")
   - Be descriptive but concise
   
   **Examples:**
   - `Add user authentication middleware`
   - `Fix photo upload validation bug #456`
   - `Update README with deployment instructions`

4. **Keep your branch updated**:
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub
   - Fill out the PR template completely
   - Link related issues
   - Include screenshots for UI changes
   - Ensure all CI checks pass

## Coding Standards

### JavaScript/Node.js

We enforce code quality using **ESLint** and **Prettier**:

- **ESLint** - Linting and code quality rules
- **Prettier** - Code formatting
- **Husky** - Pre-commit hooks automatically run linting
- **lint-staged** - Only lint changed files

#### Running Code Quality Tools

```bash
# Lint JavaScript files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format all files
npm run format

# Check formatting without modifying files
npm run format:check
```

#### Code Style Guidelines

- Follow existing code style and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Prefer `const` over `let`, avoid `var`
- Use async/await instead of callbacks
- Always use semicolons
- Use single quotes for strings
- Maximum line length: 100 characters (soft limit)

### Code Quality

- Write clean, readable, maintainable code
- Keep functions small and focused
- Avoid code duplication (DRY principle)
- Handle errors appropriately
- Use async/await instead of callbacks
- Validate user input
- Sanitize data to prevent security vulnerabilities

### Security

- Never commit secrets or API keys
- Use parameterized queries to prevent SQL/NoSQL injection
- Validate and sanitize all user input
- Use HTTPS in production
- Follow OWASP security guidelines

## Testing

### Writing Tests

- Write tests for new features and bug fixes
- Place unit tests in `tests/unit/`
- Place integration tests in `tests/integration/`
- Aim for >70% code coverage

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Check coverage
npm test -- --coverage
```

For more details, see [TESTING.md](TESTING.md).

## Submitting Changes

### Pull Request Guidelines

Before submitting a pull request, ensure:

1. **Code Quality**
   - All tests pass: `npm test`
   - Linting passes: `npm run lint`
   - Code is formatted: `npm run format`
   - No security vulnerabilities: `npm audit`

2. **Documentation**
   - Update documentation if changing functionality
   - Add JSDoc comments for new functions
   - Update API documentation if adding endpoints

3. **Testing**
   - Add tests for new features
   - Update existing tests if needed
   - Aim for >70% code coverage
   - See [TESTING.md](TESTING.md) for testing guidelines

4. **PR Description**
   - Use the PR template
   - Describe what changes were made
   - Explain why the changes were necessary
   - List how to test the changes
   - Include screenshots for UI changes
   - Link related issues

5. **Keep PRs Focused**
   - One feature or fix per PR
   - Break large changes into smaller PRs
   - Avoid mixing refactoring with new features

### PR Review Process

- Maintainers will review your PR within 3-5 business days
- Address any feedback or requested changes promptly
- Respond to review comments
- Once approved and CI passes, your PR will be merged
- PRs may be closed if inactive for 30 days

## Reporting Bugs

### Before Submitting

- Check if the bug has already been reported
- Check if the bug exists in the latest version
- Collect information about the bug

### How to Report

Create an issue on GitHub with:

- **Clear title** describing the bug
- **Detailed description** including:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Screenshots if applicable
  - Environment details (OS, Node version, browser, etc.)
- **Error messages** or logs

## Suggesting Features

We welcome feature suggestions! Before submitting:

- Check if the feature has already been suggested
- Consider if it fits the project's scope
- Think about how it would benefit users

Create an issue with:

- **Clear title** describing the feature
- **Detailed description** of the feature
- **Use cases** - why is this feature needed?
- **Proposed implementation** (optional)
- **Alternatives considered** (optional)

## Questions?

If you have questions about contributing:

- Check the [README.md](README.md)
- Check existing [issues](https://github.com/rhysllwydlewis/eventflow/issues)
- Open a new issue with the "question" label

## Security

If you discover a security vulnerability, please follow our responsible disclosure process:

1. **DO NOT** open a public issue
2. Email security details to: **[SECURITY-CONTACT-EMAIL]**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

For more information, see [SECURITY.md](SECURITY.md).

## License

By contributing to EventFlow, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

---

Thank you for contributing to EventFlow! 🎉
