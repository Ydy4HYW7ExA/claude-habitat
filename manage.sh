#!/usr/bin/env bash
#
# claude-habitat 管理器
# 安装 / 卸载 / 重装，幂等操作，自动发现 Claude API 凭证
#
# Usage:
#   ./manage.sh install    安装（从本地源码 build + pack + global install）
#   ./manage.sh uninstall  卸载
#   ./manage.sh reinstall  重装（卸载 + 安装）
#   ./manage.sh status     查看安装状态
#

set -euo pipefail

# ─── 常量 ─────────────────────────────────────────────────────────────
INSTALL_INFO="$HOME/.claude-habitat.json"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# ─── 颜色 ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; }
info() { echo -e "${CYAN}→${RESET} $1"; }
warn() { echo -e "${YELLOW}!${RESET} $1"; }

# ─── 工具函数 ─────────────────────────────────────────────────────────

is_installed() {
  [ -f "$INSTALL_INFO" ] && command -v claude-habitat &>/dev/null
}

read_install_info() {
  if [ -f "$INSTALL_INFO" ]; then
    cat "$INSTALL_INFO"
  else
    echo "{}"
  fi
}

write_install_info() {
  local version="$1"
  local source_path="$2"
  local bin_path="$3"
  local api_key_source="$4"
  cat > "$INSTALL_INFO" <<EOF
{
  "version": "$version",
  "sourcePath": "$source_path",
  "binPath": "$bin_path",
  "apiKeySource": "$api_key_source",
  "installedAt": "$(date -Iseconds)"
}
EOF
}

remove_install_info() {
  rm -f "$INSTALL_INFO"
}

get_version() {
  node -e "console.log(require('$PROJECT_ROOT/package.json').version)" 2>/dev/null || echo "unknown"
}

# ─── API 凭证发现 ─────────────────────────────────────────────────────

discover_api_credentials() {
  if [ ! -f "$CLAUDE_SETTINGS" ]; then
    warn "未找到 $CLAUDE_SETTINGS"
    return
  fi

  local key url
  key=$(node -e "
    const s = require('$CLAUDE_SETTINGS');
    console.log(s.env?.ANTHROPIC_AUTH_TOKEN || s.env?.ANTHROPIC_API_KEY || '');
  " 2>/dev/null || true)
  url=$(node -e "
    const s = require('$CLAUDE_SETTINGS');
    console.log(s.env?.ANTHROPIC_BASE_URL || '');
  " 2>/dev/null || true)

  if [ -z "$key" ]; then
    warn "Claude settings 中未找到 API key"
    return
  fi

  local masked="${key:0:8}...${key: -4}"
  echo ""
  echo -e "${BOLD}发现 Claude API 凭证:${RESET}"
  echo -e "  Key: ${DIM}${masked}${RESET}"
  [ -n "$url" ] && echo -e "  URL: ${DIM}${url}${RESET}"
  echo ""

  read -rp "是否将这些凭证写入环境变量？[Y/n] " answer
  answer="${answer:-Y}"

  if [[ "$answer" =~ ^[Yy]$ ]]; then
    local shell_rc
    if [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
      shell_rc="$HOME/.zshrc"
    else
      shell_rc="$HOME/.bashrc"
    fi

    local marker="# claude-habitat managed"

    # 先清除旧的
    if grep -q "$marker" "$shell_rc" 2>/dev/null; then
      sed -i "/$marker/d" "$shell_rc"
    fi

    echo "export ANTHROPIC_API_KEY=\"$key\" $marker" >> "$shell_rc"
    [ -n "$url" ] && echo "export ANTHROPIC_BASE_URL=\"$url\" $marker" >> "$shell_rc"

    # 当前 shell 也生效
    export ANTHROPIC_API_KEY="$key"
    [ -n "$url" ] && export ANTHROPIC_BASE_URL="$url"

    ok "已写入 $shell_rc（新终端自动生效）"
    API_KEY_SOURCE="claude-settings"
  else
    info "跳过凭证配置"
    API_KEY_SOURCE="skipped"
  fi
}

# ─── 安装 ─────────────────────────────────────────────────────────────

do_install() {
  echo -e "\n${BOLD}${CYAN}═══ claude-habitat 安装 ═══${RESET}\n"

  if is_installed; then
    local cur_version
    cur_version=$(node -e "const i=require('$INSTALL_INFO');console.log(i.version)" 2>/dev/null || echo "?")
    warn "已安装 v${cur_version}，如需重装请使用: $0 reinstall"
    return 0
  fi

  local version
  version=$(get_version)
  info "版本: $version"
  info "源码: $PROJECT_ROOT"

  # Step 1: 安装依赖
  info "安装依赖..."
  (cd "$PROJECT_ROOT" && npm install --ignore-scripts 2>&1 | tail -1)

  # Step 2: 构建
  info "构建..."
  (cd "$PROJECT_ROOT" && npm run build 2>&1 | tail -1)

  # Step 3: 打包
  info "打包..."
  local tgz
  tgz=$(cd "$PROJECT_ROOT" && npm pack --ignore-scripts 2>&1 | tail -1)
  local tgz_path="$PROJECT_ROOT/$tgz"

  if [ ! -f "$tgz_path" ]; then
    fail "打包失败: $tgz_path 不存在"
    return 1
  fi

  # Step 4: 全局安装
  info "全局安装..."
  npm install -g "$tgz_path" 2>&1 | tail -1

  # Step 5: 清理 tarball
  rm -f "$tgz_path"

  # Step 6: 验证
  local bin_path
  bin_path=$(which claude-habitat 2>/dev/null || true)

  if [ -z "$bin_path" ]; then
    fail "安装失败: claude-habitat 命令未找到"
    return 1
  fi

  ok "安装成功: $bin_path"

  # Step 7: API 凭证
  API_KEY_SOURCE="none"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    discover_api_credentials
  else
    ok "ANTHROPIC_API_KEY 已设置"
    API_KEY_SOURCE="env"
  fi

  # Step 8: 写入安装信息
  write_install_info "$version" "$PROJECT_ROOT" "$bin_path" "$API_KEY_SOURCE"
  ok "安装信息已写入 $INSTALL_INFO"

  echo -e "\n${GREEN}${BOLD}安装完成!${RESET}"
  echo -e "\n使用方法:"
  echo "  claude-habitat init        # 在项目中初始化"
  echo "  claude-habitat bootstrap   # AI 设计团队"
  echo "  claude-habitat status      # 查看状态"
  echo ""
}

# ─── 卸载 ─────────────────────────────────────────────────────────────

do_uninstall() {
  echo -e "\n${BOLD}${CYAN}═══ claude-habitat 卸载 ═══${RESET}\n"

  if ! is_installed && [ ! -f "$INSTALL_INFO" ]; then
    warn "未安装，无需卸载"
    return 0
  fi

  # Step 1: npm 卸载
  if command -v claude-habitat &>/dev/null; then
    info "卸载全局包..."
    npm uninstall -g claude-habitat 2>&1 | tail -1
    ok "全局包已卸载"
  fi

  # Step 2: 清理环境变量
  local marker="# claude-habitat managed"
  for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$rc" ] && grep -q "$marker" "$rc" 2>/dev/null; then
      sed -i "/$marker/d" "$rc"
      ok "已清理 $rc 中的环境变量"
    fi
  done

  # Step 3: 删除安装信息
  remove_install_info
  ok "已删除 $INSTALL_INFO"

  echo -e "\n${GREEN}${BOLD}卸载完成${RESET}\n"
}

# ─── 重装 ─────────────────────────────────────────────────────────────

do_reinstall() {
  echo -e "\n${BOLD}${CYAN}═══ claude-habitat 重装 ═══${RESET}\n"
  do_uninstall
  do_install
}

# ─── 状态 ─────────────────────────────────────────────────────────────

do_status() {
  echo -e "\n${BOLD}${CYAN}═══ claude-habitat 状态 ═══${RESET}\n"

  if is_installed; then
    ok "已安装"
    echo ""
    echo -e "${DIM}$(read_install_info)${RESET}"
    echo ""
    local bin_path
    bin_path=$(which claude-habitat)
    echo -e "  命令路径: $bin_path"
    echo -e "  CLI 版本: $(claude-habitat --help 2>&1 | head -1)"
  elif [ -f "$INSTALL_INFO" ]; then
    warn "安装信息存在但命令不可用（可能需要重装）"
    echo ""
    echo -e "${DIM}$(read_install_info)${RESET}"
  else
    info "未安装"
  fi

  echo ""
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    local masked="${ANTHROPIC_API_KEY:0:8}...${ANTHROPIC_API_KEY: -4}"
    ok "ANTHROPIC_API_KEY: ${DIM}${masked}${RESET}"
  else
    warn "ANTHROPIC_API_KEY 未设置"
  fi

  if [ -n "${ANTHROPIC_BASE_URL:-}" ]; then
    ok "ANTHROPIC_BASE_URL: ${DIM}${ANTHROPIC_BASE_URL}${RESET}"
  fi
  echo ""
}

# ─── 入口 ─────────────────────────────────────────────────────────────

case "${1:-help}" in
  install)   do_install ;;
  uninstall) do_uninstall ;;
  reinstall) do_reinstall ;;
  status)    do_status ;;
  *)
    echo -e "${BOLD}claude-habitat 管理器${RESET}"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  install    安装 claude-habitat CLI"
    echo "  uninstall  卸载"
    echo "  reinstall  重装（卸载 + 安装）"
    echo "  status     查看安装状态"
    ;;
esac
