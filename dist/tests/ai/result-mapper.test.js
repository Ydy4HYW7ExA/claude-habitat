import { describe, it, expect } from 'vitest';
import { mapSdkResult } from '../../src/ai/result-mapper.js';
describe('mapSdkResult', () => {
    it('should map success result with all fields', () => {
        const msg = {
            type: 'result',
            subtype: 'success',
            result: 'Hello world',
            session_id: 'sess-abc',
            total_cost_usd: 0.05,
            duration_ms: 1200,
            num_turns: 3,
            structured_output: { key: 'value' },
        };
        const result = mapSdkResult(msg);
        expect(result.text).toBe('Hello world');
        expect(result.sessionId).toBe('sess-abc');
        expect(result.costUsd).toBe(0.05);
        expect(result.durationMs).toBe(1200);
        expect(result.numTurns).toBe(3);
        expect(result.structured).toEqual({ key: 'value' });
        expect(result.status).toBe('success');
        expect(result.error).toBeUndefined();
    });
    it('should map error_max_turns to max_turns status', () => {
        const msg = {
            type: 'result',
            subtype: 'error_max_turns',
            session_id: 'sess-xyz',
            total_cost_usd: 1.0,
            duration_ms: 5000,
            num_turns: 30,
            errors: ['Max turns reached'],
        };
        const result = mapSdkResult(msg);
        expect(result.status).toBe('max_turns');
        expect(result.text).toBe('');
        expect(result.error).toBe('Max turns reached');
    });
    it('should map error_max_budget_usd to max_budget status', () => {
        const msg = {
            type: 'result',
            subtype: 'error_max_budget_usd',
            errors: ['Budget exceeded'],
        };
        const result = mapSdkResult(msg);
        expect(result.status).toBe('max_budget');
        expect(result.error).toBe('Budget exceeded');
    });
    it('should map unknown subtype to error status', () => {
        const msg = {
            type: 'result',
            subtype: 'something_unexpected',
            errors: ['Unknown error'],
        };
        const result = mapSdkResult(msg);
        expect(result.status).toBe('error');
        expect(result.error).toBe('Unknown error');
    });
    it('should handle missing optional fields gracefully', () => {
        const msg = {
            type: 'result',
            subtype: 'success',
        };
        const result = mapSdkResult(msg);
        expect(result.text).toBe('');
        expect(result.sessionId).toBe('');
        expect(result.costUsd).toBe(0);
        expect(result.durationMs).toBe(0);
        expect(result.numTurns).toBe(0);
        expect(result.status).toBe('success');
    });
    it('should join multiple errors with newline', () => {
        const msg = {
            type: 'result',
            subtype: 'error_max_turns',
            errors: ['Error 1', 'Error 2'],
        };
        const result = mapSdkResult(msg);
        expect(result.error).toBe('Error 1\nError 2');
    });
    it('should handle undefined errors array', () => {
        const msg = {
            type: 'result',
            subtype: 'error_max_turns',
        };
        const result = mapSdkResult(msg);
        expect(result.error).toBeUndefined();
    });
});
//# sourceMappingURL=result-mapper.test.js.map