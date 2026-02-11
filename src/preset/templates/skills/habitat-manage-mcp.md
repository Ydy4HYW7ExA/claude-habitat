---
name: habitat-manage-mcp
description: "CRUD management protocol for MCP bridge servers."
version: 1.0.0
tags: [management, mcp, bridge]
category: management
---

# habitat-manage-mcp

## Purpose

Interactive protocol for managing MCP bridge servers — add, update, remove, and list.

## Flow

1. **List current bridges**
   - Call `habitat_bridge_list()` to show all configured bridge servers
   - Display results to user with name, command, args, enabled status

2. **Ask user intent**
   - Present options: add / update / remove
   - If user provided intent in arguments, skip this step

3. **Execute operation**

   ### Add
   - Ask for: name (unique identifier), command, args
   - Optionally ask for: env (environment variables), enabled (default: true)
   - Call `habitat_bridge_add({ name, command, args, env, enabled })`
   - Remind user: MCP server restart required for changes to take effect

   ### Update
   - Ask which bridge to update (by name)
   - Ask what to change (command, args, env, enabled)
   - Call `habitat_bridge_update({ name, ...changes })`
   - Remind user: MCP server restart required

   ### Remove
   - Ask which bridge to remove (by name)
   - Confirm with user
   - Call `habitat_bridge_remove({ name })`
   - Remind user: MCP server restart required

4. **Continue or exit**
   - Ask if user wants to perform another operation
   - If yes, go to step 2
   - If no, done

## Notes

- Bridge servers are external MCP servers proxied through claude-habitat
- Configuration is stored in `~/.claude-habitat/config.json` under `bridge.servers`
- All changes require an MCP server restart to take effect (no hot-reload)
- Each bridge server exposes its tools with a `[server-name]` prefix in descriptions
