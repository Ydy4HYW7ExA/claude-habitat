import { init } from './init.js';
import { runCommand } from './run.js';
import { status } from './status.js';
import { bootstrap } from './bootstrap.js';
import { startHabitat } from './habitat.js';
const HELP = `
claude-habitat — AI 认知操作系统

Usage:
  claude-habitat                       启动 AI 团队（默认）
  claude-habitat init                  初始化项目
  claude-habitat bootstrap             自举：AI 设计团队
  claude-habitat status                查看系统状态
  claude-habitat run <position> [task] 运行单个岗位任务
  claude-habitat help                  显示帮助

Options:
  --project-root <path>   项目根目录（默认当前目录）
`.trim();
export async function run(args) {
    const { remaining, projectRoot } = parseGlobalFlags(args);
    const command = remaining[0];
    switch (command) {
        case 'init':
            await init(projectRoot);
            break;
        case 'run':
            await runCommand(projectRoot, remaining.slice(1));
            break;
        case 'status':
            await status(projectRoot);
            break;
        case 'bootstrap':
            await bootstrap(projectRoot);
            break;
        case 'help':
        case '--help':
        case '-h':
            console.log(HELP);
            break;
        case undefined:
            await startHabitat(projectRoot);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            console.log(HELP);
            process.exit(1);
    }
}
function parseGlobalFlags(args) {
    const remaining = [];
    let projectRoot = process.cwd();
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project-root' && i + 1 < args.length) {
            projectRoot = args[i + 1];
            i++; // skip the value
        }
        else {
            remaining.push(args[i]);
        }
    }
    return { remaining, projectRoot };
}
//# sourceMappingURL=index.js.map