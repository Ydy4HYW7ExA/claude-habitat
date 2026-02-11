import type { Command } from './types.js';

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  unregister(name: string): void {
    this.commands.delete(name);
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  async execute(name: string, args: string[]): Promise<string> {
    const cmd = this.commands.get(name);
    if (!cmd) throw new Error(`Unknown command: ${name}`);
    return cmd.handler(args);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }
}
