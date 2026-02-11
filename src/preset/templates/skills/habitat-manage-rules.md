---
name: habitat-manage-rules
description: "CRUD management protocol for habitat rules."
version: 1.0.0
tags: [management, rules]
category: management
---

# habitat-manage-rules

## Purpose

Interactive protocol for managing habitat rules — create, read, update, delete, and list.

## Flow

1. **List current rules**
   - Call `habitat_rule_list({ scope: "global" })` and `habitat_rule_list({ scope: "project" })` to show all rules
   - Display results to user

2. **Ask user intent**
   - Present options: create / read / update / delete
   - If user provided intent in arguments, skip this step

3. **Execute operation**

   ### Create
   - Ask for: name (must start with `habitat-`, kebab-case), scope (global/project)
   - Ask for rule fields: description, pattern, action, category, priority, tags, keywords, content
   - Call `habitat_rule_create({ name, content: JSON.stringify(ruleObj), scope })`

   ### Read
   - Ask which rule to read (by name and scope)
   - Call `habitat_rule_read({ name, scope })`
   - Display full content

   ### Update
   - Ask which rule to update
   - Call `habitat_rule_read({ name, scope })` to show current content
   - Ask what to change
   - Call `habitat_rule_update({ name, content: JSON.stringify(updatedObj), scope })`

   ### Delete
   - Ask which rule to delete
   - Confirm with user
   - Call `habitat_rule_delete({ name, scope })`

4. **Continue or exit**
   - Ask if user wants to perform another operation
   - If yes, go to step 2
   - If no, done

## Notes

- Rule files are JSON with fields: id, name, description, priority, scope, pattern, action, category, enabled, tags, keywords, content
- The `content` field contains the rule text injected into CLAUDE.md
- The `keywords` field is used for mechanical pre-filtering in prompt augmentation
- Changes to rules automatically refresh CLAUDE.md and the RuleEngine
