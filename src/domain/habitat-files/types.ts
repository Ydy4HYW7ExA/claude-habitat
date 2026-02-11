export type HabitatScope = 'global' | 'project';
export type HabitatFileKind = 'command' | 'skill' | 'rule';

export interface HabitatFileInfo {
  name: string;
  kind: HabitatFileKind;
  scope: HabitatScope;
  filePath: string;
  symlinkPath?: string;
  content: string;
}

export interface HabitatFileCreateInput {
  name: string;
  kind: HabitatFileKind;
  scope: HabitatScope;
  content: string;
}

export interface HabitatFileUpdateInput {
  name: string;
  kind: HabitatFileKind;
  scope: HabitatScope;
  content: string;
}
