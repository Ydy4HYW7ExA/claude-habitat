export default async function memoryCurator(ctx) {
    const { ai, memory, task } = ctx;
    switch (task.type) {
        case 'consolidate': {
            // Check all layers for consolidation candidates
            const layers = ['episode', 'trace', 'category'];
            for (const layer of layers) {
                const candidates = await memory.recall(`layer:${layer}`, 50);
                if (candidates.length < 5)
                    continue;
                ctx.log('info', `Found ${candidates.length} ${layer} entries, consolidating...`);
                const result = await ai(`请整合以下${candidates.length}条${layer}级记忆：\n\n` +
                    candidates.map((e, i) => `[${i + 1}] ${e.summary}\n${e.content}`).join('\n\n---\n\n') +
                    '\n\n请提炼出更高层次的理解，合并重复信息，保留关键细节。', {
                    model: 'haiku',
                    maxTurns: 5,
                });
                await memory.remember(`整合了 ${candidates.length} 条 ${layer} 记忆: ${result.text.slice(0, 200)}`, ['consolidation', layer]);
            }
            break;
        }
        case 'cleanup': {
            // Find and remove outdated or redundant memories
            const allMemories = await memory.recall('*', 100);
            ctx.log('info', `Reviewing ${allMemories.length} memories for cleanup...`);
            await ai(`请审查以下记忆条目，标记需要清理的条目：\n\n` +
                allMemories.map((e, i) => `[${i + 1}] (${e.id}) ${e.summary}`).join('\n') +
                '\n\n标记标准：过时信息、重复内容、低价值条目。', {
                model: 'haiku',
                maxTurns: 10,
            });
            break;
        }
        default: {
            ctx.log('warn', `Unknown task type for memory-curator: ${task.type}`);
        }
    }
}
//# sourceMappingURL=memory-curator.js.map