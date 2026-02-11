---
name: habitat-manage-skills
description: "CRUD management protocol for habitat skills."
version: 1.0.0
tags: [management, skills]
category: management
---

# habitat-manage-skills

## Purpose

Interactive protocol for managing habitat skills — create, read, update, delete, and list.

## Flow

1. **List current skills**
   - Call `habitat_skill_list({ scope: "global" })` and `habitat_skill_list({ scope: "project" })` to show all skills
   - Display results to user

2. **Ask user intent**
   - Present options: create / read / update / delete
   - If user provided intent in arguments, skip this step

3. **Execute operation**

   ### Create
   - Ask for: name (must start with `habitat-`, kebab-case), scope (global/project)
   - Ask for skill content (markdown with YAML frontmatter)
   - Frontmatter must include: name, description, version, tags, category
   - Call `habitat_skill_create({ name, content, scope })`

   ### Read
   - Ask which skill to read (by name and scope)
   - Call `habitat_skill_read({ name, scope })`
   - Display full content

   ### Update
   - Ask which skill to update
   - Call `habitat_skill_read({ name, scope })` to show current content
   - Ask what to change
   - Call `habitat_skill_update({ name, content, scope })`

   ### Delete
   - Ask which skill to delete
   - Confirm with user
   - Call `habitat_skill_delete({ name, scope })`

4. **Continue or exit**
   - Ask if user wants to perform another operation
   - If yes, go to step 2
   - If no, done

## Notes

- Skill files are markdown with YAML frontmatter between `---` delimiters
- Required frontmatter fields: name, description, version, tags, category
- Skills define structured protocols loaded via `habitat_skill_resolve("skill-name")`
