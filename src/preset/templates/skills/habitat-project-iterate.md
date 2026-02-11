---
name: {{SKILL_PROJECT_ITERATE}}
description: "Self-recursive project iteration protocol. Drives all multi-step work through a unified leaf execution cycle."
version: 4.0.0
tags: [workflow, iteration, core]
category: workflow
difficulty: advanced
---

# {{SKILL_PROJECT_ITERATE}}

> **Important:** When exiting Plan Mode (`ExitPlanMode`), persist the plan via `habitat_doc_create` first,
> then drive workflow tree operations (`habitat_workflow_create`/`habitat_workflow_expand`/`habitat_workflow_update_tree`).
> The workflow's leaf execution cycle generates TodoList items — not the plan directly.
> Follow the document → work-tree → TodoList pipeline for consistent results.

## Purpose

Defines the **single** execution flow for claude-habitat workflows: the **Leaf Execution Cycle**.

Every leaf node instantiates as a TodoList with a four-part structure:

1. **Part 1 — Execute business** — the actual work items for this leaf (may be empty for the first seed leaf). If multiple items have no dependencies, mark them `parallelizable: true` and use Task subagents to run them in parallel.
2. **Part 2 — Incremental tree mutation** — based on Part 1 results, perform incremental operations on the work tree to refine it until the next executable leaf emerges
3. **Part 2.5 — Rule feedback** — review session rule activity and update rules as needed
4. **Part 3 — State transition** — complete the leaf and advance the cursor

There are no separate "Bootstrap" or "expand_composite" paths:
- **Bootstrap** is simply creating a seed workflow and entering the cycle — the first leaf's Part 1 is empty, and Part 2 designs the full work tree.
- **expand_composite** is a code-layer action returned by `habitat_workflow_transition`. Part 2 proactively designs any needed expansions, so Part 3 just executes the pre-designed `habitat_workflow_expand`.

---

## Entry Point: Session Start

1. Call `habitat_workflow_status` (no arguments)
2. If `hasActiveWorkflow: true` → jump to **Leaf Execution Cycle**
3. If `hasActiveWorkflow: false` and task requires ≥ 3 steps → **Create Seed Workflow** (below), then enter **Leaf Execution Cycle**
4. If `hasActiveWorkflow: false` and task requires < 3 steps → execute directly, no workflow needed

### Create Seed Workflow

Create a minimal workflow with one composite root and one atomic "seed" leaf:

```
habitat_workflow_create({
  name: "<concise task name>",
  description: "<1-2 sentence description>",
  rootNode: {
    type: "composite",
    name: "<root name>",
    description: "<root description>",
    children: [
      { type: "atomic", name: "Seed: design work tree", description: "Empty execution — Part 2 will design the full work tree structure." }
    ]
  }
})
```

Then initialize and activate:
```
habitat_workflow_init_cursor({ workflowId: "<workflowId>" })
habitat_workflow_transition({ workflowId: "<workflowId>" })
```

The seed leaf's Part 1 has no business items. Part 2 will use Plan Mode to explore the codebase and design the entire work tree.

---

## Leaf Execution Cycle (Core Recursion)

### Part 1: Execute Business

1. Call `habitat_workflow_cursor_state({ workflowId })` to get the current leaf's name, description, and `branchPath` (the full branch chain from root to current leaf's parent — use this to understand where you are in the overall project)
2. Create business TodoList items based on the leaf description:
```
TaskCreate({
  subject: "<imperative action>",
  description: "<what needs to be done>",
  activeForm: "<present continuous form>"
})
```
3. If multiple items have no dependencies on each other, mark them `parallelizable: true` and use Task subagents to execute them in parallel
4. For each item:
   - `TaskUpdate({ taskId, status: "in_progress" })` when starting
   - Execute the work using project tools (Read, Edit, Write, Bash, Task, etc.)
   - `TaskUpdate({ taskId, status: "completed" })` when done
5. If the leaf is a seed leaf (no business work), skip directly to Part 2
6. After all business items, proceed to Part 2

### Part 2: Incremental Tree Mutation

This is the structural core of the cycle. Part 2 performs incremental operations on the work tree — the output is a changed tree, not a "plan".

**When structural changes are needed** (new nodes, expansions, removals, modifications):

1. Enter Plan Mode:
```
EnterPlanMode()
```
2. Inside Plan Mode, perform **read-only exploration only**:
   - Use `Glob`, `Grep`, `Read` to understand context and discoveries from Part 1
   - Design tree mutations: add subtrees (composite + atomic nodes), remove obsolete nodes, modify descriptions
   - A single Part 2 can add both composite and atomic nodes, forming entire subtrees
   - Write the mutation design to the plan file as specified by Plan Mode
3. Exit and await approval:
```
ExitPlanMode()
```

> **Note:** After `ExitPlanMode`, persist the approved mutation design via `habitat_doc_create` before any workflow mutation.
> Each Part 2 is an edit operation on the tree — the tree is persistent and cumulative across leaves.

4. Persist the approved design:
```
habitat_doc_create({
  title: "<leaf name> — Tree Mutation",
  content: "<the approved mutation design>",
  tags: ["workflow-design", "tree-mutation"]
})
```

5. Apply tree mutations from the persisted design:
```
habitat_workflow_update_tree({
  workflowId: "<workflowId>",
  operations: [
    { op: "add", parentId: "<id>", node: { type: "atomic"|"composite", name: "...", description: "..." } },
    { op: "remove", nodeId: "<id>" },
    { op: "modify", nodeId: "<id>", updates: { name: "...", description: "...", status: "..." } }
  ]
})
```

State transition only advances to the DFS-order first pending atomic — the rest of the tree waits for future cycles.

If the design includes expanding a composite node (which will be encountered as `expand_composite` in Part 3), prepare the children list now — Part 3 will execute the `habitat_workflow_expand`.

**When no structural changes are needed** (simple leaf with no discoveries):
- Call `habitat_workflow_cursor_state` to review the tree
- Skip Plan Mode — only apply minor `habitat_workflow_update_tree` adjustments if needed

### Part 2.5: Rule Feedback

After workflow design and before state transition, review session rule activity to close the feedback loop.

1. Call `habitat_session_stats({ format: "markdown" })` to get current session's rule activity data
2. Review the stats:
   - Which rules triggered frequently? Should their priority be adjusted?
   - Were there repeated patterns not covered by existing rules? Create new rules via `habitat_rule_create`
   - Are there rules that triggered but had no matched skill? Consider creating a skill for them
   - Are there rules that never triggered? Consider if they're still relevant
3. If rule changes are needed:
   - Use `habitat_rule_update` to adjust priority/content of existing rules
   - Use `habitat_rule_create` to add new rules for uncovered patterns
   - These changes automatically refresh CLAUDE.md and RuleEngine
4. Proceed to Part 3 (State Transition)

**When no rule feedback is needed** (stats show normal activity, no gaps):
- Skip directly to Part 3

### Part 3: State Transition

1. Call `habitat_workflow_transition({ workflowId })` to complete the current leaf
2. Handle the returned `action`:

**If `activate_leaf`:**
- The response includes `node` (next leaf details), `todoItems` (trailing mandatory items), and `branchPath` (the full ID chain from root to the leaf's parent — provides project-wide context for understanding where this leaf sits in the overall work)
- Return to **Part 1** with the new leaf

**If `expand_composite`:**
- The response includes `nodeId` of the composite that needs expansion
- Execute the `habitat_workflow_expand` using the children designed in Part 2:
```
habitat_workflow_expand({ workflowId, nodeId, children: [...] })
```
- Call `habitat_workflow_transition({ workflowId })` again to activate the first new leaf
- Return to **Part 1**

**If `workflow_complete`:**
- All leaves are done. Summarize results to the user.
- Report the final `treeSummary` and `treeVisualization`.

---

## Guidelines

- Every leaf's TodoList should include Part 2 (Incremental tree mutation), Part 2.5 (Rule feedback), and Part 3 (State transition) as trailing items
- The seed leaf's Part 1 is empty — Part 2 designs the full work tree
- Each Part 2 is an edit operation on the tree — the tree is persistent and cumulative across leaves
- Parallelizable TodoItems should be marked `parallelizable: true` and executed via Task subagents
- Avoid skipping trailing items — they maintain workflow integrity
- Stay within the current leaf node's scope
- Part 2 should use `EnterPlanMode`/`ExitPlanMode` when structural changes are needed
- After `ExitPlanMode`, persist the mutation design via `habitat_doc_create` before workflow mutations
- Designs flow through: `habitat_doc_create` → workflow tree mutation → leaf execution → TodoList
- Part 2.5 uses `habitat_session_stats` to review rule activity and close the feedback loop
- There is ONE flow: the Leaf Execution Cycle. No separate Bootstrap or expand_composite paths exist at the skill layer
