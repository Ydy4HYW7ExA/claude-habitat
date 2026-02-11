import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { readFileOrNull } from '../../infra/fs-utils.js';
import type { HabitatConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { ValidationError } from '../../infra/errors.js';

const UNSAFE_MERGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    if (UNSAFE_MERGE_KEYS.has(key as string)) continue;
    const val = override[key];
    if (val !== undefined && typeof val === 'object' && !Array.isArray(val) && val !== null) {
      result[key] = deepMerge(
        (result[key] ?? {}) as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

export class ConfigLoader {
  async load(habitatDir: string): Promise<HabitatConfig> {
    let config = { ...DEFAULT_CONFIG };

    const configPath = join(habitatDir, 'config.json');
    const raw = await readFileOrNull(configPath);
    if (raw !== null) {
      let fileConfig: Partial<HabitatConfig>;
      try {
        fileConfig = JSON.parse(raw) as Partial<HabitatConfig>;
      } catch (e) {
        throw new ValidationError(
          `Invalid JSON in config file: ${configPath}`,
          [e instanceof Error ? e.message : String(e)],
        );
      }
      config = deepMerge(config, fileConfig);
    }

    return config;
  }

  /**
   * Three-layer config fallback: DEFAULT_CONFIG → global → project.
   * Global config with invalid JSON is silently skipped.
   * Project config with invalid JSON throws ValidationError.
   */
  async loadWithFallback(
    projectHabitatDir: string,
    globalHabitatDir: string,
  ): Promise<HabitatConfig> {
    let config = { ...DEFAULT_CONFIG };

    // Layer 1: global config (silent on invalid JSON)
    const globalPath = join(globalHabitatDir, 'config.json');
    const globalRaw = await readFileOrNull(globalPath);
    if (globalRaw !== null) {
      try {
        const globalConfig = JSON.parse(globalRaw) as Partial<HabitatConfig>;
        config = deepMerge(config, globalConfig);
      } catch {
        // Invalid global config — silently skip
      }
    }

    // Layer 2: project config (throws on invalid JSON)
    const projectPath = join(projectHabitatDir, 'config.json');
    const projectRaw = await readFileOrNull(projectPath);
    if (projectRaw !== null) {
      let projectConfig: Partial<HabitatConfig>;
      try {
        projectConfig = JSON.parse(projectRaw) as Partial<HabitatConfig>;
      } catch (e) {
        throw new ValidationError(
          `Invalid JSON in config file: ${projectPath}`,
          [e instanceof Error ? e.message : String(e)],
        );
      }
      config = deepMerge(config, projectConfig);
    }

    return config;
  }

  async save(habitatDir: string, config: HabitatConfig): Promise<void> {
    const configPath = join(habitatDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
