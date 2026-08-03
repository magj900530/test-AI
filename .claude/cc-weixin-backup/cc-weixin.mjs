#!/usr/bin/env node
/**
 * cc-weixin
 * 微信 ← iLink Bot API → Claude Code Agent
 *
 * 用法: npm start              # TUI 界面（默认）
 *       npm start -- --no-tui  # 纯 CLI 模式
 *       npm start -- --login   # 强制重新扫码
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
try { require("dotenv").config(); } catch {}

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const STATE_DIR = join(homedir(), ".claude", "state");
const SCRIPTS_DIR = join(homedir(), ".claude", "scripts");
const INBOX_DIR = join(STATE_DIR, "inbox");
const OUTBOX_DIR = join(STATE_DIR, "outbox");
let lastUserId = null;

// 从持久化文件恢复上次的微信用户（防止重启后丢失）
try {
  const luf = join(STATE_DIR, "last_user.json");
  if (existsSync(luf)) {
    lastUserId = JSON.parse(readFileSync(luf, "utf-8")).userId;
    console.log(`   👤 恢复微信用户: ${lastUserId}`);
  }
} catch {}

// ── 消息去重 ──
const seenMsgs = new Set();
const MSG_TTL = 60000; // 1 分钟内相同消息视为重复
function isDuplicate(from, text) {
  const key = `${from}::${text}`;
  if (seenMsgs.has(key)) return true;
  seenMsgs.add(key);
  setTimeout(() => seenMsgs.delete(key), MSG_TTL);
  return false;
}

/** 检测所有 VS Code 窗口，解析项目目录名，尝试匹配路径并更新 active_project.json */
function detectVSCodeProject() {
  try {
    const script = join(SCRIPTS_DIR, "detect_vscode.py");
    const out = execSync(`python "${script}"`, {
      timeout: 5000, encoding: "utf-8", windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    }).trim();
    if (!out) return false;
    const titles = JSON.parse(out);
    if (!titles.length) return false;

    for (const title of titles) {
      // 格式: "文件名 — 目录名 - Visual Studio Code"
      const m = title.match(/ — (.+?) - Visual Studio Code/);
      if (!m) continue;
      const dirName = m[1].trim();
      // 尝试 D:/AI项目/<dirName>
      const candidate = join("D:/AI项目", dirName);
      if (existsSync(candidate)) {
        const pf = join(STATE_DIR, "active_project.json");
        writeFileSync(pf, JSON.stringify({ cwd: candidate, set_at: Date.now() }));
        console.log(`   📁 检测到 VS Code 项目: ${candidate}`);
        return true;
      }
      // 尝试直接匹配完整路径
      if (existsSync(dirName)) {
        const pf = join(STATE_DIR, "active_project.json");
        writeFileSync(pf, JSON.stringify({ cwd: dirName, set_at: Date.now() }));
        console.log(`   📁 检测到 VS Code 项目: ${dirName}`);
        return true;
      }
    }
  } catch (e) {
    console.log(`   ⚠️ VS Code 项目检测失败: ${e.message}`);
  }
  return false;
}

/** 检查是否有待批请求 */
function checkPendingApproval() {
  const pf = join(STATE_DIR, "pending_approval.json");
  if (!existsSync(pf)) return null;
  try { return JSON.parse(readFileSync(pf, "utf-8")); } catch { return null; }
}

/** 处理审批回复 */
function handleApprovalReply(text) {
  const pending = checkPendingApproval();
  if (!pending) return false;
  const approved = text.trim() === "同意";
  const rf = join(STATE_DIR, `approval_result_${pending.id}.json`);
  writeFileSync(rf, JSON.stringify({ approved, timestamp: Date.now() }, null, 2));
  return true;
}

/** 调用 Python 状态管理模块 */
function pythonState(command) {
  try {
    const fnName = command.split("(")[0].trim();
    const call = command.includes("(") ? command : `${command}()`;
    return execSync(
      `python -c "import sys; sys.path.insert(0, r'${SCRIPTS_DIR}'); from state_manager import ${fnName}; print(${call})"`,
      { timeout: 5000, encoding: "utf-8", windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }
    ).trim();
  } catch (e) {
    return `状态查询失败: ${e.message}`;
  }
}

/** 处理系统指令（不转发给 Claude） */
async function handleSystemCommand(text, from, sendMsg, baseUrl, token, ctx) {
  const cmd = text.trim();

  // 状态查询 — 先重新检测 VS Code 项目
  if (cmd === "查看远程状态" || cmd === "查看状态") {
    detectVSCodeProject();
    const status = pythonState("format_status");
    await sendMsg(baseUrl, token, from, status, ctx);
    return true;
  }

  // 模式切换
  if (cmd === "开启远程" || cmd === "开启远程模式") {
    pythonState("set_mode('remote')");
    await sendMsg(baseUrl, token, from,
      "🟢 已开启远程模式\n下次 VS Code 新对话生效。\n进度、审批将推送到微信。", ctx);
    return true;
  }
  if (cmd === "关闭远程" || cmd === "关闭远程模式") {
    pythonState("set_mode('local')");
    await sendMsg(baseUrl, token, from,
      "🔵 已关闭远程模式\n不再向微信推送通知。", ctx);
    return true;
  }

  if (cmd === "compact" || cmd === "执行compact" || cmd === "清理上下文") {
    await sendMsg(baseUrl, token, from,
      "📦 compact 指令已接收。请在 VS Code 终端手动执行 /compact，或等待下次自动 compact 触发。", ctx);
    return true;
  }

  if (cmd.startsWith("切换到 ") || cmd.startsWith("激活项目 ")) {
    const input = cmd.replace(/^(切换到|激活项目)\s*/, "").trim();
    let cwd;
    if (/^[A-Za-z]:[\\/]/.test(input) || input.startsWith("/") || input.startsWith("~")) {
      cwd = input.startsWith("~") ? join(homedir(), input.slice(1)) : input;
    } else {
      cwd = join("D:/AI项目", input);
    }
    if (!existsSync(cwd)) {
      await sendMsg(baseUrl, token, from, `❌ 路径不存在: ${cwd}`, ctx);
      return true;
    }
    const pf = join(STATE_DIR, "active_project.json");
    writeFileSync(pf, JSON.stringify({ cwd, set_at: Date.now() }));
    await sendMsg(baseUrl, token, from, `✅ 已切换: ${cwd}`, ctx);
    return true;
  }

  return false;
}

/** 将微信指令写入 inbox，供 PC 端查看 */
function writeInbox(text, from) {
  try {
    mkdirSync(INBOX_DIR, { recursive: true });
    const file = join(INBOX_DIR, `cmd_${Date.now()}.json`);
    writeFileSync(file, JSON.stringify({
      from,
      command: text,
      timestamp: Date.now(),
    }, null, 2));
    console.log(`   📥 指令已写入 inbox: ${file}`);
  } catch (e) {
    console.error(`   ⚠️ 写入 inbox 失败: ${e.message}`);
  }
}

/** 检查 PC 端通知并推送到微信 */
async function checkPCNotification(sendMsg, baseUrl, token, ctx) {
  const nf = join(STATE_DIR, "notify.json");
  if (!existsSync(nf)) return;
  try {
    const stat = statSync(nf);
    const age = Date.now() - stat.mtimeMs;
    // 只转发 30 秒内的新通知
    if (age > 30000) return;
    const data = JSON.parse(readFileSync(nf, "utf-8"));
    if (!data.message || data.sent) return;
    // 标记已发送
    data.sent = true;
    writeFileSync(nf, JSON.stringify(data, null, 2));
    let to = lastUserId || data.to;
    // 兜底：从白名单读取第一个用户
    if (!to) {
      try {
        const wl = join(homedir(), ".claude", "bot_whitelist.json");
        if (existsSync(wl)) {
          const users = JSON.parse(readFileSync(wl, "utf-8")).allowed_users || [];
          if (users.length > 0) to = users[0];
        }
      } catch {}
    }
    if (!to) {
      console.log("   ⚠️ 无微信用户可推送通知（无 lastUserId 且白名单为空）");
      return;
    }
    const alertMsg = [
      `🖥️ PC 端通知`,
      `━━━━━━━━━━━━━━━━`,
      data.message,
      data.result ? `\n📋 结果摘要:\n${data.result.slice(0, 500)}` : "",
      `━━━━━━━━━━━━━━━━`,
    ].join("\n");
    await sendMsg(baseUrl, token, to, alertMsg, ctx || "");
    console.log(`   📤 PC 通知已推送到微信: ${data.message.slice(0, 60)}`);
  } catch (e) {
    console.error(`   ❌ 通知处理异常: ${e.message}`);
  }
}

const forceLogin = process.argv.includes("--login");
const noTui = process.argv.includes("--no-tui");

if (noTui) {
  const { loadSession, login } = await import("./lib/auth.mjs");
  const { getUpdates, sendMessage, extractText } = await import("./lib/messaging.mjs");
  const { askClaude } = await import("./lib/claude.mjs");

  async function main() {
    let session = forceLogin ? null : loadSession();
    if (session) {
      console.log(`✅ 已连接（Bot: ${session.accountId}）\n`);
    } else {
      session = await login();
    }

    const { token, baseUrl } = session;

    // 启动时自动检测 VS Code 活跃项目
    detectVSCodeProject();

    let running = true;
    let notifyTimer = null;

    process.on("SIGINT", () => {
      if (notifyTimer) clearInterval(notifyTimer);
      console.log("\n\n👋 已退出");
      process.exit(0);
    });

    console.log("🚀 开始长轮询收消息（Ctrl+C 退出）...\n");
    let buf = "";
    let lastApprovalCheck = 0;

    // 独立定时器：每 5 秒检查 PC 端通知（避免被长轮询阻塞）
    notifyTimer = setInterval(() => {
      if (!running) return;
      checkPCNotification(sendMessage, baseUrl, token).catch(() => {});
    }, 5000);

    while (running) {
      try {
        const resp = await getUpdates(baseUrl, token, buf);
        if (resp.get_updates_buf) buf = resp.get_updates_buf;

        for (const msg of resp.msgs ?? []) {
          if (msg.message_type !== 1) continue;

          const from = msg.from_user_id;
          if (from) {
            lastUserId = from;
            // 持久化，防止重启后丢失接收人
            try {
              writeFileSync(join(STATE_DIR, "last_user.json"), JSON.stringify({ userId: from, ts: Date.now() }));
            } catch {}
          }

          const text = extractText(msg);
          const ctx = msg.context_token;

          // ── 去重检查 ──
          if (isDuplicate(from, text)) {
            console.log(`   🔄 重复消息已跳过: ${text}`);
            continue;
          }

          // ── 系统指令检测 ──
          if (await handleSystemCommand(text, from, sendMessage, baseUrl, token, ctx)) {
            continue;
          }

          // ── 审批回复检测 ──
          const pending = checkPendingApproval();
          if (pending) {
            if (text === "同意") {
              handleApprovalReply("同意");
              console.log("   🔔 审批: ✅ 已批准执行");
              await sendMessage(baseUrl, token, from, "✅ 已批准执行", ctx);
            } else if (text === "拒绝") {
              handleApprovalReply("拒绝");
              console.log("   🔔 审批: ❌ 已拒绝操作");
              await sendMessage(baseUrl, token, from, "❌ 已拒绝操作", ctx);
            } else {
              handleApprovalReply("拒绝");
              console.log(`   🔔 审批取消，处理追问: ${text}`);
              await sendMessage(baseUrl, token, from, "⏸️ 审批已取消，正在处理你的问题…", ctx);
              console.log(`📩 [${new Date().toLocaleTimeString()}] ${from}`);
              console.log(`   ${text}`);
              process.stdout.write("   🤔 Claude 思考中...");
              const reply = await askClaude(text, from);
              process.stdout.write(" 完成\n");
              await sendMessage(baseUrl, token, from, reply, ctx);
              console.log(`   ✅ ${reply.slice(0, 80)}${reply.length > 80 ? "…" : ""}\n`);
            }
            continue;
          }

          // ── 正常对话 ──
          console.log(`📩 [${new Date().toLocaleTimeString()}] ${from}`);
          console.log(`   ${text}`);

          // 将微信指令写入 inbox，供 PC 端 VS Code 查看
          writeInbox(text, from);

          process.stdout.write("   🤔 Claude 思考中...");
          const reply = await askClaude(text, from);
          process.stdout.write(" 完成\n");

          await sendMessage(baseUrl, token, from, reply, ctx);
          console.log(`   ✅ ${reply.slice(0, 80)}${reply.length > 80 ? "…" : ""}\n`);
        }

        // ── 审批推送 ──
        const now = Date.now();
        if (now - lastApprovalCheck > 3000 && lastUserId) {
          lastApprovalCheck = now;
          const pending = checkPendingApproval();
          if (pending && pending.status === "pending") {
            const isCompact = pending.type === "compact";
            let alertMsg, timeout;
            if (isCompact) {
              timeout = "5分钟";
              alertMsg = [
                `📦 上下文压缩建议`,
                `━━━━━━━━━━━━━━━━`,
                `${pending.risk}`,
                `━━━━━━━━━━━━━━━━`,
                `回复「同意」执行 compact（完成后自动续跑）`,
                `回复「拒绝」或任何问题（${timeout}超时自动同意）`,
              ].join("\n");
            } else {
              timeout = "15分钟";
              alertMsg = [
                `⚠️ 高危操作审批 [${pending.id}]`,
                `━━━━━━━━━━━━━━━━`,
                `风险：${pending.risk}`,
                `工具：${pending.tool}`,
                `命令：${(pending.command || "").slice(0, 150)}`,
                `文件：${pending.file_path || "N/A"}`,
                `━━━━━━━━━━━━━━━━`,
                `回复「同意」或「拒绝」（${timeout}自动拒绝）`,
              ].join("\n");
            }
            await sendMessage(baseUrl, token, lastUserId, alertMsg, "");
            pending.status = "sent";
            writeFileSync(
              join(STATE_DIR, "pending_approval.json"),
              JSON.stringify(pending, null, 2),
            );
            console.log(`   📤 ${isCompact ? "Compact" : "审批"}请求已推送到微信`);
          }
        }

        // ── PC 端通知推送 ──
        if (lastUserId) {
          await checkPCNotification(sendMessage, baseUrl, token);
        }
      } catch (err) {
        if (err.message?.includes("session timeout") || err.message?.includes("-14")) {
          console.error("❌ Session 已过期，请重新运行: npm start -- --login");
          process.exit(1);
        }
        console.error(`⚠️  轮询出错: ${err.message}，3s 后重试...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    console.log("✅ 已退出");
  }

  main().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
} else {
  const { startTUI } = await import("./lib/tui/index.mjs");
  startTUI({ forceLogin });
}
