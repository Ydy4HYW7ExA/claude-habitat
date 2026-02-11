<!-- claude-habitat-command -->
# /habitat-status

Show the current project and workflow status.

1. Call `habitat_workflow_status` to check for active workflows
2. Call `habitat_project_info` to retrieve project metadata

Report:

- **Project**: ID, name, document/workflow counts
- **Workflow**: If `hasActiveWorkflow: true`, show current leaf, tree visualization, and progress summary
- **Workflow**: If `hasActiveWorkflow: false`, report "No active workflow"

If the project is not initialized, suggest running `/habitat-init` first.

$ARGUMENTS
