<!-- claude-habitat-command -->
# /habitat-init

Initialize Claude Habitat in the current project directory.

Use the `habitat_project_init` MCP tool to initialize claude-habitat in this project. This will:

1. Create the `.claude-habitat/` directory structure
2. Generate a unique project ID
3. Create a marker.json file for project identification
4. Set up subdirectories for docs, workflows, skills, rules, and commands
5. Copy preset files and create symlinks
6. Generate project-level `CLAUDE.md` with habitat markers
7. Add `.claude-habitat/` to `.gitignore`
8. Detect existing config sources for prompt augmentation

If the project is already initialized, report the existing project ID without making changes.

## Post-Init Configuration

After `habitat_project_init` returns, check the `configSources` field in the response:

- **`globalHasApiKey: true`** — Global config already has an API key. Ask the user via `AskUserQuestion`:
  "Global habitat config has an API key. Use it for this project too?"
  - Yes → call `habitat_project_configure` with `useGlobalConfig: true`
  - No → ask for a project-specific key

- **`envHasAuthToken: true`** — Claude settings have `ANTHROPIC_AUTH_TOKEN`. Ask the user:
  "Found ANTHROPIC_AUTH_TOKEN in Claude settings. Use it for prompt augmentation?"
  - Yes → call `habitat_project_configure` with `useGlobalConfig: true` (the CLI will pick it up from env)
  - No → ask for a project-specific key

- **Neither detected** — Ask the user:
  "No API key found for prompt augmentation. Options:"
  - Enter an API key now → call `habitat_project_configure` with the provided `apiKey`
  - Skip for now → call `habitat_project_configure` with no apiKey (disables augmentation)

$ARGUMENTS
