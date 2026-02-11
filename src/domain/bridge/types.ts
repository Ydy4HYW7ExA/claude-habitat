export interface BridgeServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface BridgeConfig {
  servers?: BridgeServerConfig[];
}

export interface BridgedTool {
  originServer: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
