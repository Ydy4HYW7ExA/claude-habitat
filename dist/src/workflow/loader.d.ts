import type { WorkflowFunction, WorkflowLoaderInterface } from './types.js';
export declare class WorkflowLoader implements WorkflowLoaderInterface {
    private projectRoot;
    private cache;
    constructor(projectRoot: string);
    load(workflowPath: string): Promise<WorkflowFunction>;
    invalidate(workflowPath: string): void;
    getSource(workflowPath: string): Promise<string>;
}
//# sourceMappingURL=loader.d.ts.map