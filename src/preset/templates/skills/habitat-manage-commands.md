---
name: habitat-manage-commands
description: "CRUD management protocol for habitat commands."
version: 1.0.0
tags: [management, commands]
category: management
---

# habitat-manage-commands

## Purpose

Interactive protocol for managing habitat commands — create, read, update, delete, and list.

## Flow

1. **List current commands**
   - Call `habitat_command_list({ scope: "global" })` and `habitat_command_list({ scope: "project" })` to show all commands
   - Display results to user

2. **Ask user intent**
   - Present options: create / read / update / delete
   - If user provided intent in arguments, skip this step

3. **Execute operation**

   ### Create
   - Ask for: name (must start with `habitat-`, kebab-case), scope (global/project)
   - Ask for command content (markdown format with `<!-- claude-habitat-command -->` header)
   - Call `habitat_command_create({ name, content, scope })`

   ### Read
   - Ask which command to read (by name and scope)
   - Call `habitat_command_read({ name, scope })`
   - Display full content

   ### Update
   - Ask which command to update
   - Call `habitat_command_read({ name, scope })` to show current content
   - Ask what to change
   - Call `habitat_command_update({ name, content, scope })`

   ### Delete
   - Ask which command to delete
   - Confirm with user
   - Call `habitat_command_delete({ name, scope })`

4. **Continue or exit**
   - Ask if user wants to perform another operation
   - If yes, go to step 2
   - If no, done

## Notes

- Command files are markdown with a `<!-- claude-habitat-command -->` header
- Commands typically trigger a skill via `habitat_skill_resolve("skill-name")`
- Include `$ARGUMENTS` at the end to receive user arguments
