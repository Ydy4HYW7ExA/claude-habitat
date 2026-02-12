export default async function reviewer(ctx) {
    const { ai, memory, emit, task } = ctx;
    const args = task.payload;
    // Recall review standards and past reviews
    const pastReviews = await memory.recall('code review standards', 3);
    const standardsContext = pastReviews.length > 0
        ? '\n\n审查标准参考：\n' + pastReviews.map(e => `- ${e.summary}`).join('\n')
        : '';
    const result = await ai(`请审查以下代码变更：\n\n` +
        `${JSON.stringify(args, null, 2)}\n` +
        standardsContext + '\n\n' +
        '请关注：代码质量、安全性、性能、可维护性。\n' +
        '给出具体的改进建议。', {
        model: 'sonnet',
        maxTurns: 20,
        outputFormat: {
            type: 'json_schema',
            schema: {
                type: 'object',
                properties: {
                    approved: { type: 'boolean' },
                    comments: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                severity: { type: 'string', enum: ['info', 'warning', 'error'] },
                                message: { type: 'string' },
                            },
                            required: ['severity', 'message'],
                        },
                    },
                    summary: { type: 'string' },
                },
                required: ['approved', 'comments', 'summary'],
            },
        },
    });
    // Record review experience
    const structured = result.structured;
    await memory.remember(`审查结果: ${structured?.approved ? '通过' : '需修改'} — ${structured?.summary ?? result.text.slice(0, 200)}`, ['code-review', task.type]);
    // Route result
    if (structured && !structured.approved) {
        await emit('revision-needed', {
            originalTaskId: args.taskId,
            reviewComments: structured,
        });
    }
    else {
        await emit('review-approved', {
            originalTaskId: args.taskId,
            summary: structured?.summary ?? 'Approved',
        });
    }
}
//# sourceMappingURL=reviewer.js.map