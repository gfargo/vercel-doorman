# Vercel Doorman

A powerful CLI tool for managing Vercel Firewall rules as code, enabling version control and automated deployment of your project's security configuration.

## Features

- 🔒 **Manage Firewall Rules**: Create, update, and delete Vercel Firewall rules using a simple configuration file
- 🔄 **Sync Rules**: Easily sync rules between your configuration file and Vercel
- ⬇️ **Download Rules**: Import existing firewall rules from your Vercel project
- ✅ **Validation**: Built-in configuration validation to prevent errors
- 📋 **List Rules**: View current firewall rules in table or JSON format
- 🚀 **CI/CD Integration**: Automate firewall rule management in your deployment pipeline
- 🔑 **Team Support**: Full support for team and project-specific configurations

## Installation

```bash
npm install vercel-doorman
# or
yarn add vercel-doorman
```

## Configuration

Create a `vercel-firewall.config.json` file in your project root:

```json
{
  "projectId": "your-project-id",
  "teamId": "your-team-id",
  "rules": [
    {
      "name": "block-country",
      "type": "country",
      "action": "deny",
      "values": ["CN", "RU"],
      "active": true,
      "description": "Block traffic from specific countries"
    },
    {
      "name": "rate-limit-api",
      "type": "path",
      "values": ["/api"],
      "active": true,
      "description": "Rate limit API endpoints",
      "action": {
        "type": "log",
        "rateLimit": {
          "requests": 100,
          "window": "60s"
        },
        "duration": "1h"
      }
    },
    {
      "name": "redirect-legacy",
      "type": "path",
      "values": ["/old-path"],
      "active": true,
      "description": "Redirect legacy paths",
      "action": {
        "type": "allow",
        "redirect": {
          "url": "https://example.com/new-path",
          "status": 301
        }
      }
    }
  ]
}
```

## Usage

First, [create a Vercel API Token](https://vercel.com/guides/how-do-i-use-a-vercel-api-access-token) with appropriate permissions.

### Available Commands

#### List Current Rules

```bash
vercel-doorman list --token YOUR_TOKEN
```

Options:

- `--projectId, -p`: Vercel Project ID
- `--teamId, -t`: Vercel Team ID
- `--token`: Vercel API token
- `--format, -f`: Output format (json or table, defaults to table)

#### Sync Rules

```bash
vercel-doorman sync --token YOUR_TOKEN
```

Options:

- `--config, -c`: Path to config file (defaults to vercel-firewall.config.json)
- `--projectId, -p`: Vercel Project ID (can be set in config file)
- `--teamId, -t`: Vercel Team ID (can be set in config file)
- `--token`: Vercel API token

#### Download Remote Rules

```bash
vercel-doorman download --token YOUR_TOKEN
```

Downloads remote firewall rules from your Vercel project and updates your local configuration file. Includes a confirmation prompt before making changes.

Options:

- `--config, -c`: Path to config file (defaults to vercel-firewall.config.json)
- `--projectId, -p`: Vercel Project ID (can be set in config file)
- `--teamId, -t`: Vercel Team ID (can be set in config file)
- `--token`: Vercel API token
- `--dry-run, -d`: Preview changes without modifying the config file

Example workflow:

```bash
# First, preview the rules that would be downloaded
vercel-doorman download --dry-run

# Then, if the rules look correct, download and update the config
vercel-doorman download
```

#### Validate Configuration

```bash
vercel-doorman validate
```

Options:

- `--config, -c`: Path to config file (defaults to vercel-firewall.config.json)
- `--verbose, -v`: Show detailed validation results

### Environment Variables

Instead of passing command-line arguments, you can set these environment variables:

- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_PROJECT_ID`: Your Vercel project ID
- `VERCEL_TEAM_ID`: Your Vercel team ID

### Script Commands

This starter comes with several predefined scripts to help with development:

- `pnpm build` - Build the project using `tsup`.
- `pnpm build:watch` - Automatically rebuild the project on file changes.
- `pnpm commit` - run `commitizen` tool for helping with commit messages.
- `pnpm commitlint` - lint commit messages.
- `pnpm compile` - Compile TypeScript files using `tsc`.
- `pnpm clean` - Remove compiled code from the `dist/` directory.
- `pnpm format` - Check files for code style issues using Prettier.
- `pnpm format:fix` - Automatically fix code formatting issues with Prettier.
- `pnpm lint` - Check code for style issues with ESLint.
- `pnpm lint:fix` - Automatically fix code style issues with ESLint.
- `pnpm start [command]` - Run the CLI application using `ts-node`.
- `pnpm start:node [command]` - Run the CLI application from the `dist/` directory.
- `pnpm test` - Run unit tests.
- `pnpm test:watch` - Run tests and watch for file changes.

## CI/CD and Automation

### Automated Version Management and NPM Publishing with Semantic-Release

This project utilizes `semantic-release` to automate version management and the NPM publishing
process. `Semantic-release` automates the workflow of releasing new versions, including the generation of detailed
release notes based on commit messages that follow the conventional commit format.

The publishing process is triggered automatically when changes are merged into the main branch. Here's how it works:

1. **Automated Versioning:** Based on the commit messages, `semantic-release` determines the type of version change (
   major, minor, or patch) and updates the version accordingly.
2. **Release Notes:** It then generates comprehensive release notes detailing new features, bug fixes, and any breaking
   changes, enhancing clarity and communication with users.
3. **NPM Publishing:** Finally, `semantic-release` publishes the new version to the NPM registry and creates a GitHub
   release with the generated notes.

To ensure a smooth `semantic-release` process:

- Merge feature or fix branches into the main branch following thorough review and testing.
- Use conventional commit messages to help `semantic-release` accurately determine version changes and generate
  meaningful release notes.
- Configure an NPM access token as a GitHub secret under the name `NPM_TOKEN` for authentication during the publication
  process.

By integrating `semantic-release`, this project streamlines its release process, ensuring that versions are managed
efficiently and that users are well-informed of each update through automatically generated release notes.

## Development

To contribute to this project or customize it for your needs, consider the following guidelines:

1. **Code Styling:** Follow the predefined code style, using Prettier for formatting and ESLint for linting, to ensure
   consistency.
2. **Commit Messages:** We use `commitizen` and `commitlint` to ensure our commit messages are consistent and follow the
   conventional commit format, recommended by `@commitlint/config-conventional`. To make a commit, you can
   run `pnpm commit`, which will guide you through creating a conventional commit message.
3. **Testing:** Write unit tests for new features or bug fixes using Jest. Make sure to run tests before pushing any
   changes.
4. **Environment Variables:** Use the `.env` file for local development. For production, ensure you configure the
   environment variables in your deployment environment.
5. **Husky Git Hooks:** This project utilizes Husky to automate linting, formatting, and commit message verification via
   git hooks. This ensures that code commits meet our quality and style standards without manual checks. The hooks set
   up include pre-commit hooks for running ESLint and Prettier, and commit-msg hooks for validating commit messages
   with `commitlint`.

## Contributing

Contributions are welcome! If you'd like to improve this CLI TypeScript starter, please follow the standard
fork-and-pull request workflow. Here are a few guidelines to keep in mind:

- Make sure your code adheres to the project's coding standards, including using Prettier for code formatting and ESLint
  for linting.
- Follow the conventional commit format for your commit messages. This project uses `commitizen` and `commitlint` with
  the `@commitlint/config-conventional` configuration, enforced by Husky git hooks.
- Include tests for new features or bug fixes when applicable.
- Ensure your changes are properly formatted and linted before submitting a pull request.

By adhering to these guidelines, you help maintain the quality and consistency of the project, making it easier for
others to contribute and for users to understand and utilize the project effectively.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
