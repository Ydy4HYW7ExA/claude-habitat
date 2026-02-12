export default async function orgArchitect(ctx) {
    const { ai, memory, task } = ctx;
    switch (task.type) {
        case 'bootstrap': {
            const result = await ai('分析当前项目的代码库、技术栈、开发流程。\n' +
                '然后使用你的管理工具（create_role_template, create_position）创建合适的 AI 团队。\n' +
                '至少创建以下岗位：\n' +
                '1. coder — 负责编写代码\n' +
                '2. reviewer — 负责代码审查\n' +
                '\n' +
                '为每个岗位配置合适的工作流和协作关系。', {
                model: 'opus',
                maxTurns: 50,
            });
            await memory.remember('Bootstrap completed: ' + result.text.slice(0, 200), ['bootstrap', 'team-design']);
            break;
        }
        case 'restructure': {
            const stats = await memory.recallGlobal('team performance');
            await ai('根据以下运行数据，优化团队结构和工作流：\n' +
                stats.map(e => e.content).join('\n'), { model: 'opus', maxTurns: 30 });
            break;
        }
    }
}
//# sourceMappingURL=org-architect.js.map