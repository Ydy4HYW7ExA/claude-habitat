export interface Command {
  name: string;
  description: string;
  usage?: string;
  handler: (args: string[]) => Promise<string> | string;
}
