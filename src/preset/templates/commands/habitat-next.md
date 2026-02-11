<!-- claude-habitat-command -->
# /habitat-next

Suggest the next action based on current workflow state.

1. Call `habitat_workflow_status` to check for active workflows
2. If `hasActiveWorkflow: true`:
   - Show the current leaf node name and description
   - Show tree progress (completed/total leaves)
   - Instruct: call `habitat_skill_resolve("{{SKILL_PROJECT_ITERATE}}")` to resume the leaf execution cycle
3. If `hasActiveWorkflow: false`:
   - If the user has a pending task ≥ 3 steps → suggest creating a workflow via `{{SKILL_PROJECT_ITERATE}}`
   - Otherwise → report "No active workflow. Describe a task to get started."

$ARGUMENTS
