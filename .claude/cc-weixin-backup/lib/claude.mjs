import { query } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import Debug from "debug";

const debug = Debug("cc-weixin:claude");

const WORKSPACE = join(homedir(), ".cc-weixin", "workspace");
mkdirSync(WORKSPACE, { recursive: true });

const PROJECTS_ROOT = process.env.WECHAT_CWD || "D:/AI项目";
const STATE_DIR = join(homedir(), ".claude", "state");
const OUTBOX_DIR = join(STATE_DIR, "outbox");

const ALLOWED_DIRS = [
  PROJECTS_ROOT,
  "D:/AI项目",
  "D:/AI项目/hotel-compare",
  "D:/AI项目/rag-project",
  "D:/AI项目/IFTFS",
  WORKSPACE,
].filter(d => { try { return existsSync(d); } catch { return true; } });

function resolveCwd() {
  const stateFile = join(homedir(), ".claude", "state", "active_project.json");
  try {
    const { cwd } = JSON.parse(readFileSync(stateFile, "utf-8"));
    if (cwd && existsSync(cwd)) return cwd;
  } catch {}
  return PROJECTS_ROOT;
}

/** 加载 VS Code 的 MCP 服务器配置，确保与 PC 端工具一致 */
function loadMcpConfig() {
  const mcpPath = join(homedir(), ".claude", "mcp.json");
  try {
    if (existsSync(mcpPath)) {
      const config = JSON.parse(readFileSync(mcpPath, "utf-8"));
      const servers = config.mcpServers || {};
      if (Object.keys(servers).length > 0) {
        debug("Loaded %d MCP servers: %s", Object.keys(servers).length, Object.keys(servers).join(", "));
        return servers;
      }
    }
  } catch (e) {
    debug("Failed to load MCP config: %s", e.message);
  }
  return {};
}

/** 加载项目 CLAUDE.md 上下文，确保与 PC 端行为一致 */
function loadContextMd(cwd) {
  const parts = [];
  // 全局 CLAUDE.md
  const homeClaudeMd = join(homedir(), "CLAUDE.md");
  try {
    if (existsSync(homeClaudeMd)) {
      parts.push(readFileSync(homeClaudeMd, "utf-8"));
    }
  } catch {}
  // 项目 CLAUDE.md
  const projectClaudeMd = join(cwd, "CLAUDE.md");
  try {
    if (existsSync(projectClaudeMd)) {
      const content = readFileSync(projectClaudeMd, "utf-8");
      if (!parts.length || content !== parts[0]) {
        parts.push(content);
      }
    }
  } catch {}
  return parts.join("\n\n---\n\n");
}

/** 将执行结果写入 outbox，供 PC 端查看 */
function writeOutbox(userId, userText, result) {
  try {
    mkdirSync(OUTBOX_DIR, { recursive: true });
    const file = join(OUTBOX_DIR, `result_${Date.now()}.json`);
    writeFileSync(file, JSON.stringify({
      userId,
      question: userText.slice(0, 200),
      answer: result.slice(0, 3000),
      timestamp: Date.now(),
    }, null, 2));
    debug("Wrote result to outbox: %s", file);
  } catch (e) {
    debug("Failed to write outbox: %s", e.message);
  }
}

const userSessions = new Map();
const userPermissions = new Map(); // 'safe' | 'elevated' | 'unlocked'

const DANGEROUS_TOOLS = ["Write", "Edit"];
const DANGEROUS_BASH = [
  /rm\s+-rf/i, /rm\s+-r\s/i, /del\s+\/f/i, /del\s+\/s/i,
  /rmdir\s+\/s/i, /format\s/i, /chmod\s+777/i,
];

function isDangerous(toolName, toolInput) {
  if (DANGEROUS_TOOLS.includes(toolName)) return true;
  if (toolName === "Bash" && toolInput?.command) {
    return DANGEROUS_BASH.some(p => p.test(toolInput.command));
  }
  return false;
}

export async function askClaude(userText, userId) {
  // 权限模式指令
  if (userId) {
    const cmd = userText.trim();
    if (cmd === "提权") {
      userPermissions.set(userId, "elevated");
      return "已临时提权，本次操作可用完整工具，完成后自动恢复安全模式。";
    }
    if (cmd === "永久提权" || cmd === "解锁权限") {
      userPermissions.set(userId, "unlocked");
      return "已永久解锁，所有工具可用。发送「锁定」恢复安全模式。";
    }
    if (cmd === "锁定" || cmd === "恢复安全") {
      userPermissions.set(userId, "safe");
      userSessions.delete(userId);
      return "已恢复安全模式，写入操作将被拦截。";
    }
  }

  const existingSessionId = userId ? userSessions.get(userId) : undefined;
  const permMode = userId ? (userPermissions.get(userId) || "safe") : "unlocked";

  debug("askClaude: userId=%s perm=%s hasSession=%s", userId, permMode, !!existingSessionId);

  const activeCwd = resolveCwd();
  debug("cwd: %s", activeCwd);

  // 加载与 VS Code 一致的 MCP 工具和项目上下文
  const mcpServers = loadMcpConfig();
  const claudeMdContent = loadContextMd(activeCwd);

  const options = {
    model: process.env.ANTHROPIC_MODEL || "sonnet",
    baseTools: [{ preset: "default" }],
    deniedTools: ["AskUserQuestion"],
    cwd: activeCwd,
    additionalDirectories: [...ALLOWED_DIRS, activeCwd],
    env: process.env,
    abortController: new AbortController(),
    mcpServers,
    ...(claudeMdContent ? { systemPrompt: claudeMdContent } : {}),
  };

  // 永久解锁模式跳过权限检查，匹配 VS Code 的 bypassPermissions
  if (permMode === "unlocked") {
    options.permissionMode = "bypassPermissions";
    debug("permissionMode: bypassPermissions (unlocked)");
  }

  if (permMode !== "unlocked") {
    options.canUseTool = async (toolName, toolInput) => {
      if (!isDangerous(toolName, toolInput)) return { behavior: "allow" };
      if (permMode === "elevated") return { behavior: "allow" };
      return {
        behavior: "deny",
        message: `安全模式拦截了 ${toolName}。微信发送「提权」临时放行，「永久提权」长期解锁。`,
      };
    };
  }

  if (existingSessionId) {
    options.resume = existingSessionId;
    debug("resuming session: %s", existingSessionId);
  }

  const prompt = existingSessionId
    ? userText
    : (async function* () {
        yield {
          type: "user",
          session_id: "",
          parent_tool_use_id: null,
          message: { role: "user", content: userText },
        };
      })();

  let result = "";
  for await (const msg of query({ prompt, options })) {
    debug("msg type=%s subtype=%s session_id=%s", msg.type, msg.subtype, msg.session_id);
    if (msg.type === "result") {
      result = msg.result ?? "";
      if (userId && msg.session_id) {
        userSessions.set(userId, msg.session_id);
        debug("stored session: userId=%s -> sessionId=%s", userId, msg.session_id);
      }
    }
  }

  // 提权用完自动恢复
  if (permMode === "elevated" && userId) {
    userPermissions.set(userId, "safe");
  }

  // 将执行结果写入 outbox，供 PC 端 VS Code 查看
  if (userId && result) {
    writeOutbox(userId, userText, result);
  }

  debug("result length=%d", result.length);
  return result || "（Claude 无回复）";
}
