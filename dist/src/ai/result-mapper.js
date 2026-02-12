export function mapSdkResult(msg) {
    if (msg.subtype === 'success') {
        return {
            text: msg.result ?? '',
            sessionId: msg.session_id ?? '',
            costUsd: msg.total_cost_usd ?? 0,
            durationMs: msg.duration_ms ?? 0,
            numTurns: msg.num_turns ?? 0,
            structured: msg.structured_output,
            status: 'success',
        };
    }
    const statusMap = {
        error_max_turns: 'max_turns',
        error_max_budget_usd: 'max_budget',
    };
    return {
        text: '',
        sessionId: msg.session_id ?? '',
        costUsd: msg.total_cost_usd ?? 0,
        durationMs: msg.duration_ms ?? 0,
        numTurns: msg.num_turns ?? 0,
        status: statusMap[msg.subtype] ?? 'error',
        error: msg.errors?.join('\n'),
    };
}
//# sourceMappingURL=result-mapper.js.map