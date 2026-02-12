import type { AttentionInput, AttentionContext } from '../../src/attention/types.js';
import type { MemoryStore, MemoryEntry } from '../../src/memory/types.js';
import type { Process, Program, Task } from '../../src/position/types.js';
/** Portable temp directory base for tests (never hardcode /tmp) */
export declare const TEST_BASE: string;
/** Create a minimal mock MemoryStore */
export declare function mockMemoryStore(overrides?: Partial<MemoryStore>): MemoryStore;
/** Create a minimal test Process */
export declare function makeProcess(overrides?: Partial<Process>): Process;
/** Create a minimal test Program */
export declare function makeProgram(overrides?: Partial<Program>): Program;
/** Create a minimal test Task */
export declare function makeTask(overrides?: Partial<Task>): Task;
/** Create a minimal test MemoryEntry */
export declare function makeMemoryEntry(overrides?: Partial<MemoryEntry>): MemoryEntry;
/** Create a minimal AttentionContext */
export declare function makeAttentionContext(overrides?: Partial<AttentionContext>): AttentionContext;
/** Create a minimal AttentionInput */
export declare function makeAttentionInput(prompt?: string, contextOverrides?: Partial<AttentionContext>): AttentionInput;
//# sourceMappingURL=test-helpers.d.ts.map