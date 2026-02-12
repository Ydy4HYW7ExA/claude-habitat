import { truncateSummary, DEFAULT_RECALL_LIMIT, MEMORY_LAYER } from '../constants.js';
export function buildWorkflowContext(deps) {
    const { position, roleTemplate, task, projectRoot, memoryStore, globalMemoryStore, aiCall, emitFn, callFn, signal, logger, } = deps;
    const memory = {
        async remember(content, keywords) {
            const entry = await memoryStore.write({
                layer: MEMORY_LAYER.EPISODE,
                content,
                summary: truncateSummary(content),
                keywords: keywords ?? [],
                refs: [],
                metadata: {
                    positionId: position.id,
                    taskId: task.id,
                },
            });
            return entry.id;
        },
        async recall(query, limit) {
            return memoryStore.search(query, { limit: limit ?? DEFAULT_RECALL_LIMIT });
        },
        async forget(id, reason) {
            logger('info', `Forgetting memory ${id}: ${reason}`);
            await memoryStore.delete(id);
        },
        async rewrite(id, newContent) {
            await memoryStore.rewrite(id, newContent, truncateSummary(newContent), []);
        },
        async recallGlobal(query, limit) {
            return globalMemoryStore.search(query, { limit: limit ?? DEFAULT_RECALL_LIMIT });
        },
        async rememberGlobal(content, keywords) {
            const entry = await globalMemoryStore.write({
                layer: MEMORY_LAYER.EPISODE,
                content,
                summary: truncateSummary(content),
                keywords: keywords ?? [],
                refs: [],
                metadata: {
                    positionId: position.id,
                    taskId: task.id,
                },
            });
            return entry.id;
        },
    };
    // askUser: delegates to ai() with a prompt that triggers AskUserQuestion tool
    const askUser = async (question) => {
        const result = await aiCall(`Ask the user the following question and return their response verbatim:\n\n${question}`, { maxTurns: 3 });
        return result.text;
    };
    // parallel: execute multiple ai() calls concurrently
    const parallel = async (calls) => {
        return Promise.all(calls.map(c => aiCall(c.prompt, c.options)));
    };
    // todo: in-memory task list for workflow attention enhancement
    const todoItems = [];
    const todo = {
        add(item) {
            todoItems.push({ text: item, done: false });
        },
        complete(item) {
            const found = todoItems.find(t => t.text === item && !t.done);
            if (found)
                found.done = true;
        },
        list() {
            return [...todoItems];
        },
    };
    return {
        ai: aiCall,
        emit: emitFn,
        call: callFn,
        memory,
        askUser,
        parallel,
        todo,
        position,
        roleTemplate,
        projectRoot,
        task,
        args: task.payload,
        signal,
        log: logger,
    };
}
//# sourceMappingURL=context-builder.js.map