<!-- claude-habitat-command -->
# /habitat-help

Show available Claude Habitat commands and MCP tools.

## Commands

- `/habitat-init` — Initialize claude-habitat in the current project
- `/habitat-status` — Show project and workflow status
- `/habitat-next` — Get next-step suggestion based on workflow state
- `/habitat-help` — Show this help message

## MCP Tools

### Workflow Core
- `habitat_workflow_status` — Session resume: check for active workflows
- `habitat_workflow_create` — Create a new workflow
- `habitat_workflow_init_cursor` — Initialize execution cursor
- `habitat_workflow_transition` — Complete current leaf, move to next node
- `habitat_workflow_expand` — Expand a composite node with children
- `habitat_workflow_update_tree` — Batch add/remove/modify tree nodes
- `habitat_workflow_cursor_state` — Get current cursor position and tree context
- `habitat_workflow_load` — Load a workflow tree from storage
- `habitat_workflow_update_status` — Update a single node's status
- `habitat_workflow_get_progress` — Get progress summary

### Documents
- `habitat_doc_create` — Create a new document
- `habitat_doc_read` — Read a document by ID
- `habitat_doc_update` — Update an existing document
- `habitat_doc_delete` — Delete a document
- `habitat_doc_list` — Query and list documents
- `habitat_doc_graph` — View document reference graph

### Skills
- `habitat_skill_resolve` — Load a skill protocol (e.g. `{{SKILL_PROJECT_ITERATE}}`)

### Project
- `habitat_project_init` — Initialize project (used by /habitat-init)
- `habitat_project_info` — Get project metadata and stats

## Getting Started

1. Run `/habitat-init` to initialize your project
2. Run `/habitat-status` to check project and workflow state
3. Describe a multi-step task — the `{{SKILL_PROJECT_ITERATE}}` skill drives execution

$ARGUMENTS
