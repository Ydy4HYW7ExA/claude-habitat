/** @param {import('../src/workflow/types.js').WorkflowContext} ctx */
export default async function coder(ctx) {
  const { ai, memory, emit, task } = ctx;
  const args = task.payload;

  // Recall relevant experience
  const pastExperience = await memory.recall(task.type + ' ' + JSON.stringify(args).slice(0, 100), 5);
  const experienceContext = pastExperience.length > 0
    ? '\n\n相关历史经验：\n' + pastExperience.map(e => `- ${e.summary}`).join('\n')
    : '';

  // Execute the coding task
  const result = await ai(
    `请执行以下编码任务：\n\n` +
    `任务类型: ${task.type}\n` +
    `任务数据: ${JSON.stringify(args, null, 2)}\n` +
    experienceContext,
    {
      model: 'sonnet',
      maxTurns: 30,
    }
  );

  // Record experience
  await memory.remember(
    `完成了 ${task.type} 任务: ${result.text.slice(0, 200)}`,
    [task.type, ...(args?.keywords ?? [])],
  );

  // Route to reviewer if configured
  if (result.status === 'success') {
    await emit('code-review', {
      taskId: task.id,
      summary: result.text.slice(0, 500),
    });
  }
}
