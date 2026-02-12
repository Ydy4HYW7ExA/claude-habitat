#!/usr/bin/env tsx
import { run } from '../src/cli/index.js';
run(process.argv.slice(2)).catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
//# sourceMappingURL=claude-habitat.js.map