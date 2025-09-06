# Contributing to wiki rego

Thank you for your interest in contributing to wiki rego! We welcome contributions from the community to help improve this lightweight, file-based wiki application.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain a professional and welcoming environment

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/wikirego.git
   cd wikirego
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/dannyswat/wikirego.git
   ```

## Development Setup

### Prerequisites

- Go 1.23+
- Node.js 20+ and npm
- Git

### Backend (Go) Setup

```bash
cd server
go mod download
go mod verify
```

### Frontend (React) Setup

```bash
cd client
npm install
```

### Running the Application

1. Build the frontend:

   ```bash
   cd client
   npm run dev
   ```

2. Run the backend:

   ```bash
   cd server
   go run ./cmd/web/main.go
   ```

3. Access the application at http://localhost:3000

## Making Changes

### Before You Start

1. Check existing issues and pull requests to avoid duplication
2. Create an issue to discuss major changes before implementing
3. Keep changes focused and atomic

### Development Workflow

1. Create a new branch for your feature/fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our code style guidelines

3. Test your changes thoroughly

4. Commit your changes with descriptive commit messages:
   ```bash
   git commit -m "feat: add new diagram export feature"
   ```

## Submitting Changes

1. Push your branch to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a pull request from your fork to the main repository

3. Fill out the pull request template with:

   - Clear description of changes
   - Link to related issues
   - Screenshots (if applicable)
   - Testing notes

4. Respond to code review feedback promptly

## Code Style Guidelines

### Go Code

- Follow standard Go conventions (`go fmt`, `go vet`)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Use proper error handling

### TypeScript/React Code

- Use TypeScript for all new code
- Follow React best practices and hooks patterns
- Use meaningful component and variable names
- Keep components small and focused
- Use proper prop types and interfaces

### General

- Write clear, descriptive commit messages
- Keep line lengths reasonable
- Use consistent indentation (tabs for Go, 2 spaces for TypeScript)
- Remove trailing whitespace

## Testing

### Backend Testing

```bash
cd server
go test ./...
```

### Frontend Testing

```bash
cd client
npm test
```

### Manual Testing

- Test your changes in both development and production builds
- Verify functionality works with Docker deployment
- Test on different browsers (Chrome, Firefox, Safari)
- Ensure responsive design works on mobile devices

## Reporting Issues

When reporting bugs or requesting features:

1. Check if the issue already exists
2. Use the appropriate issue template
3. Provide detailed information:
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Screenshots or error logs
   - Environment details (OS, browser, version)

### Bug Report Template

```
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Windows 11]
- Browser: [e.g. Chrome 91]
- Version: [e.g. 1.0.0]
```

## Areas for Contribution

We welcome contributions in these areas:

- **Bug fixes**: Help us identify and fix issues
- **Features**: Implement new functionality (discuss first in issues)
- **Documentation**: Improve README, API docs, code comments
- **Testing**: Add unit tests, integration tests, or manual testing
- **Performance**: Optimize database queries, frontend performance
- **Security**: Identify and fix security vulnerabilities
- **UI/UX**: Improve the user interface and experience

## License

By contributing to wiki rego, you agree that your contributions will be licensed under the GNU General Public License v2.0, the same license as the project.

## Questions?

If you have questions about contributing, feel free to:

- Open an issue with the "question" label
- Start a discussion in the repository discussions
- Contact the maintainers

Thank you for contributing to wiki rego!
