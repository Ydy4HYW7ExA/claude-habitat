export interface Plugin {
  name: string;
  version: string;
  description: string;
  init?: () => Promise<void> | void;
  dispose?: () => Promise<void> | void;
}

export type PluginStatus = 'registered' | 'active' | 'error' | 'disposed';

export interface PluginEntry {
  plugin: Plugin;
  status: PluginStatus;
  error?: string;
}
