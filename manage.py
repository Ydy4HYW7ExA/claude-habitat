#!/usr/bin/env python3
"""
claude-habitat 管理器
安装 / 卸载 / 重装，幂等操作，自动发现 Claude API 凭证

Usage:
    python manage.py install    安装
    python manage.py uninstall  卸载
    python manage.py reinstall  重装
    python manage.py status     查看安装状态
"""

import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── 常量 ──────────────────────────────────────────────────────────────
INSTALL_INFO = Path.home() / ".claude-habitat.json"
CLAUDE_SETTINGS = Path.home() / ".claude" / "settings.json"
PROJECT_ROOT = Path(__file__).resolve().parent

# ─── 颜色 ──────────────────────────────────────────────────────────────
USE_COLOR = sys.stdout.isatty() and os.name != "nt"

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

def ok(msg: str):   print(f"{_c('0;32', '✓')} {msg}")
def fail(msg: str): print(f"{_c('0;31', '✗')} {msg}")
def info(msg: str): print(f"{_c('0;36', '→')} {msg}")
def warn(msg: str): print(f"{_c('0;33', '!')} {msg}")
def heading(text: str):
    print(f"\n{_c('1;36', f'═══ {text} ═══')}\n")

# ─── 工具函数 ──────────────────────────────────────────────────────────

def run(cmd: list[str], cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=capture, text=True)

def run_out(cmd: list[str], cwd: Path | None = None) -> str:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return r.stdout.strip()

def find_npm() -> str:
    npm = shutil.which("npm")
    if not npm:
        fail("npm 未找到，请先安装 Node.js >= 18")
        sys.exit(1)
    return npm

def find_node() -> str:
    node = shutil.which("node")
    if not node:
        fail("node 未找到，请先安装 Node.js >= 18")
        sys.exit(1)
    return node

def get_version() -> str:
    try:
        pkg = json.loads((PROJECT_ROOT / "package.json").read_text())
        return pkg.get("version", "unknown")
    except Exception:
        return "unknown"

def is_installed() -> bool:
    return INSTALL_INFO.exists() and shutil.which("claude-habitat") is not None

def read_install_info() -> dict:
    try:
        return json.loads(INSTALL_INFO.read_text())
    except Exception:
        return {}

def write_install_info(version: str, source_path: str, bin_path: str, api_key_source: str):
    data = {
        "version": version,
        "sourcePath": source_path,
        "binPath": bin_path,
        "apiKeySource": api_key_source,
        "installedAt": datetime.now(timezone.utc).isoformat(),
    }
    INSTALL_INFO.write_text(json.dumps(data, indent=2, ensure_ascii=False))

def remove_install_info():
    INSTALL_INFO.unlink(missing_ok=True)

# ─── API 凭证发现 ──────────────────────────────────────────────────────

def discover_api_credentials() -> str:
    """从 ~/.claude/settings.json 发现 API 凭证，返回 api_key_source。"""
    if not CLAUDE_SETTINGS.exists():
        warn(f"未找到 {CLAUDE_SETTINGS}")
        return "none"

    try:
        settings = json.loads(CLAUDE_SETTINGS.read_text())
    except Exception:
        warn(f"无法解析 {CLAUDE_SETTINGS}")
        return "none"

    env = settings.get("env", {})
    key = env.get("ANTHROPIC_AUTH_TOKEN") or env.get("ANTHROPIC_API_KEY") or ""
    url = env.get("ANTHROPIC_BASE_URL") or ""

    if not key:
        warn("Claude settings 中未找到 API key")
        return "none"

    masked = f"{key[:8]}...{key[-4:]}"
    print(f"\n{_c('1', '发现 Claude API 凭证:')}")
    print(f"  Key: {_c('2', masked)}")
    if url:
        print(f"  URL: {_c('2', url)}")
    print()

    try:
        answer = input("是否将这些凭证写入环境变量？[Y/n] ").strip() or "Y"
    except EOFError:
        answer = "Y"
        print("Y (auto)")
    if answer.lower() != "y":
        info("跳过凭证配置")
        return "skipped"

    _write_env_vars(key, url)
    return "claude-settings"

def _write_env_vars(key: str, url: str):
    """将环境变量写入 shell rc 文件。"""
    marker = "# claude-habitat managed"

    if platform.system() == "Windows":
        # Windows: 用 setx 写入用户环境变量
        subprocess.run(["setx", "ANTHROPIC_API_KEY", key], capture_output=True)
        if url:
            subprocess.run(["setx", "ANTHROPIC_BASE_URL", url], capture_output=True)
        ok("已写入 Windows 用户环境变量（重启终端生效）")
    else:
        # Unix: 写入 shell rc
        rc = _find_shell_rc()
        lines = rc.read_text() if rc.exists() else ""

        # 清除旧的
        new_lines = [l for l in lines.splitlines() if marker not in l]
        new_lines.append(f'export ANTHROPIC_API_KEY="{key}" {marker}')
        if url:
            new_lines.append(f'export ANTHROPIC_BASE_URL="{url}" {marker}')

        rc.write_text("\n".join(new_lines) + "\n")
        ok(f"已写入 {rc}（新终端自动生效）")

    # 当前进程也生效
    os.environ["ANTHROPIC_API_KEY"] = key
    if url:
        os.environ["ANTHROPIC_BASE_URL"] = url

def _find_shell_rc() -> Path:
    """找到当前用户的 shell rc 文件。"""
    home = Path.home()
    shell = os.environ.get("SHELL", "")
    if "zsh" in shell or (home / ".zshrc").exists():
        return home / ".zshrc"
    return home / ".bashrc"

def _clean_env_vars():
    """清理 shell rc 中的环境变量。"""
    marker = "# claude-habitat managed"

    if platform.system() == "Windows":
        subprocess.run(["setx", "ANTHROPIC_API_KEY", ""], capture_output=True)
        subprocess.run(["setx", "ANTHROPIC_BASE_URL", ""], capture_output=True)
        ok("已清理 Windows 用户环境变量")
    else:
        for name in [".bashrc", ".zshrc"]:
            rc = Path.home() / name
            if rc.exists():
                lines = rc.read_text().splitlines()
                cleaned = [l for l in lines if marker not in l]
                if len(cleaned) != len(lines):
                    rc.write_text("\n".join(cleaned) + "\n")
                    ok(f"已清理 {rc} 中的环境变量")

# ─── 安装 ──────────────────────────────────────────────────────────────

def do_install():
    heading("claude-habitat 安装")

    if is_installed():
        cur = read_install_info().get("version", "?")
        warn(f"已安装 v{cur}，如需重装请使用: python manage.py reinstall")
        return

    npm = find_npm()
    version = get_version()
    info(f"版本: {version}")
    info(f"源码: {PROJECT_ROOT}")

    # Step 1: 安装依赖
    info("安装依赖...")
    run([npm, "install", "--ignore-scripts"], cwd=PROJECT_ROOT)

    # Step 2: 构建
    info("构建...")
    run([npm, "run", "build"], cwd=PROJECT_ROOT)

    # Step 3: 打包
    info("打包...")
    tgz_name = run_out([npm, "pack", "--ignore-scripts"], cwd=PROJECT_ROOT)
    # npm pack 可能输出多行（warn 等），取最后一行
    tgz_name = tgz_name.strip().splitlines()[-1]
    tgz_path = PROJECT_ROOT / tgz_name

    if not tgz_path.exists():
        fail(f"打包失败: {tgz_path} 不存在")
        sys.exit(1)

    # Step 4: 全局安装
    info("全局安装...")
    run([npm, "install", "-g", str(tgz_path)])

    # Step 5: 清理 tarball
    tgz_path.unlink(missing_ok=True)

    # Step 6: 验证
    bin_path = shutil.which("claude-habitat")
    if not bin_path:
        fail("安装失败: claude-habitat 命令未找到")
        sys.exit(1)

    ok(f"安装成功: {bin_path}")

    # Step 7: API 凭证
    api_key_source = "none"
    if os.environ.get("ANTHROPIC_API_KEY"):
        ok("ANTHROPIC_API_KEY 已设置")
        api_key_source = "env"
    else:
        api_key_source = discover_api_credentials()

    # Step 8: 写入安装信息
    write_install_info(version, str(PROJECT_ROOT), bin_path, api_key_source)
    ok(f"安装信息已写入 {INSTALL_INFO}")

    print(f"\n{_c('1;32', '安装完成!')}")
    print("\n使用方法:")
    print("  claude-habitat init        # 在项目中初始化")
    print("  claude-habitat bootstrap   # AI 设计团队")
    print("  claude-habitat status      # 查看状态")
    print()

# ─── 卸载 ──────────────────────────────────────────────────────────────

def do_uninstall():
    heading("claude-habitat 卸载")

    if not is_installed() and not INSTALL_INFO.exists():
        warn("未安装，无需卸载")
        return

    npm = find_npm()

    # Step 1: npm 卸载
    if shutil.which("claude-habitat"):
        info("卸载全局包...")
        run([npm, "uninstall", "-g", "claude-habitat"])
        ok("全局包已卸载")

    # Step 2: 清理环境变量
    _clean_env_vars()

    # Step 3: 删除安装信息
    remove_install_info()
    ok(f"已删除 {INSTALL_INFO}")

    print(f"\n{_c('1;32', '卸载完成')}\n")

# ─── 重装 ──────────────────────────────────────────────────────────────

def do_reinstall():
    heading("claude-habitat 重装")
    do_uninstall()
    do_install()

# ─── 状态 ──────────────────────────────────────────────────────────────

def do_status():
    heading("claude-habitat 状态")

    if is_installed():
        ok("已安装")
        print()
        data = read_install_info()
        print(f"  {_c('2', json.dumps(data, indent=2, ensure_ascii=False))}")
        print()
        bin_path = shutil.which("claude-habitat")
        print(f"  命令路径: {bin_path}")
        ver_line = run_out(["claude-habitat", "--help"]).splitlines()[0] if bin_path else "N/A"
        print(f"  CLI 版本: {ver_line}")
    elif INSTALL_INFO.exists():
        warn("安装信息存在但命令不可用（可能需要重装）")
        print()
        print(f"  {_c('2', json.dumps(read_install_info(), indent=2, ensure_ascii=False))}")
    else:
        info("未安装")

    print()
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key:
        masked = f"{key[:8]}...{key[-4:]}"
        ok(f"ANTHROPIC_API_KEY: {_c('2', masked)}")
    else:
        warn("ANTHROPIC_API_KEY 未设置")

    url = os.environ.get("ANTHROPIC_BASE_URL", "")
    if url:
        ok(f"ANTHROPIC_BASE_URL: {_c('2', url)}")
    print()

# ─── 入口 ──────────────────────────────────────────────────────────────

COMMANDS = {
    "install": do_install,
    "uninstall": do_uninstall,
    "reinstall": do_reinstall,
    "status": do_status,
}

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd in COMMANDS:
        COMMANDS[cmd]()
    else:
        print(f"{_c('1', 'claude-habitat 管理器')}")
        print()
        print(f"Usage: python {sys.argv[0]} <command>")
        print()
        print("Commands:")
        print("  install    安装 claude-habitat CLI")
        print("  uninstall  卸载")
        print("  reinstall  重装（卸载 + 安装）")
        print("  status     查看安装状态")

if __name__ == "__main__":
    main()
