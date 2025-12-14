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
   npm run dev
   ```

4. **Run tests**:
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
   - Use clear, descriptive commit messages
   - Reference issue numbers when applicable

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

## Coding Standards

### JavaScript/Node.js

- We use **ESLint** and **Prettier** for code formatting
- Run linting before committing:
  ```bash
  npm run lint
  npm run format
  ```
- Follow existing code style and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Prefer `const` over `let`, avoid `var`

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

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features
3. **Ensure all tests pass** (`npm test`)
4. **Ensure linting passes** (`npm run lint`)
5. **Keep PRs focused** - one feature/fix per PR
6. **Write a clear PR description**:
   - What changes were made
   - Why the changes were necessary
   - How to test the changes
   - Screenshots for UI changes

### PR Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged

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

## License

By contributing to EventFlow, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

---

Thank you for contributing to EventFlow! 🎉
