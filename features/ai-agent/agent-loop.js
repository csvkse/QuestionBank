/**
 * Multi-Step Autonomous Agentic Loop Engine
 * Core 2.1: features/ai-agent/agent-loop.js
 */

import { DECK_TOOL_DEFINITIONS } from './tool-definitions.js';
import { toToolErrorPayload } from './tool-errors.js';

export class AgentLoopEngine {
  constructor({ client, executor, store, ui }) {
    this.client = client;
    this.executor = executor;
    this.store = store;
    this.ui = ui;
    this.maxSteps = 5;
    this.currentStep = 0;
    this.isRunning = false;
    this.isPausedForApproval = false;
    this.pendingAssistantMsgId = null;
    this.pendingToolCall = null;
    this.consecutiveErrorCounts = {};
  }

  abort() {
    this.store.saveSessions();
    this.isRunning = false; this.isPausedForApproval = false;
    this.pendingAssistantMsgId = null; this.pendingToolCall = null;
    this.consecutiveErrorCounts = {};
    this.client.abort();
    this.ui.toggleSendButtonState(false);
    this.ui.renderCurrentSession();
  }

  async startLoop(userContent) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.consecutiveErrorCounts = {};

    // 1. 追加用户问题
    this.store.appendMessage({ id: 'msg_' + Date.now(), role: 'user', content: userContent });
    this.ui.render();

    // 2. 启动第一步循环
    await this.stepLoop();
  }

  async stepLoop() {
    if (!this.isRunning) return;
    this.currentStep++;

    if (this.currentStep > this.maxSteps) {
      this.finishLoop(`⚠️ 已达到最大自主多步执行限制 (${this.maxSteps} 步)，已自动熔断保护。`);
      return;
    }

    const assistantMsgId = 'msg_' + Date.now() + '_' + this.currentStep;
    this.pendingAssistantMsgId = assistantMsgId;
    this.store.appendMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      step: this.currentStep
    });

    this.ui.toggleSendButtonState(true, `Agent 循环第 ${this.currentStep}/${this.maxSteps} 步...`);
    this.ui.renderCurrentSession();

    const activeSession = this.store.getActiveSession();
    // 过滤掉当前正在流式生成的占位消息
    const contextMessages = activeSession.messages.filter(m => m.id !== assistantMsgId);

    await this.client.sendChatStream({
      messages: contextMessages,
      tools: DECK_TOOL_DEFINITIONS,
      step: this.currentStep,
      callbacks: {
        onReasoning: (accumulated) => {
          if (!this.isRunning || this.pendingAssistantMsgId !== assistantMsgId) return;
          this.store.updateMessage(assistantMsgId, m => { m.reasoning = accumulated; }, { persist: false });
          this.ui.scheduleMessageRender?.(assistantMsgId);
        },
        onContent: (accumulated) => {
          if (!this.isRunning || this.pendingAssistantMsgId !== assistantMsgId) return;
          this.store.updateMessage(assistantMsgId, m => { m.content = accumulated; }, { persist: false });
          this.ui.scheduleMessageRender?.(assistantMsgId);
        },
        onToolCallFragment: (name, args, id) => {
          if (!this.isRunning || this.pendingAssistantMsgId !== assistantMsgId) return;
          this.store.updateMessage(assistantMsgId, m => {
            m.toolCall = {
              id,
              name,
              arguments: args,
              status: this.store.config.autoApprove ? 'executing' : 'pending',
              previewText: `[第 ${this.currentStep} 步] 正在调用接口: ${name}`
            };
          }, { persist: false });
          this.ui.scheduleMessageRender?.(assistantMsgId);
        },
        onFinish: async (result) => {
          if (!this.isRunning || this.pendingAssistantMsgId !== assistantMsgId) return;
          await this.handleStepFinish(assistantMsgId, result);
        },
        onError: (err) => {
          if (!this.isRunning || this.pendingAssistantMsgId !== assistantMsgId) return;
          this.finishLoop(`\n\n❌ 执行异常: ${err.message || '网络连接中断'}`);
        }
      }
    });
  }

  async handleStepFinish(assistantMsgId, result) {
    const hasToolCall = !!result.toolCall;

    this.store.updateMessage(assistantMsgId, m => {
      m.content = result.content;
      m.reasoning = result.reasoning;
      if (hasToolCall) {
        m.tool_calls = [
          {
            id: result.toolCall.id,
            type: 'function',
            function: {
              name: result.toolCall.name,
              arguments: JSON.stringify(result.toolCall.arguments || {})
            }
          }
        ];
        m.toolCall = {
          id: result.toolCall.id,
          name: result.toolCall.name,
          arguments: result.toolCall.arguments,
          status: this.store.config.autoApprove ? 'executing' : 'pending',
          previewText: `[第 ${this.currentStep} 步] 提议调用: ${result.toolCall.name}`
        };
      }
    });
    this.ui.renderCurrentSession();

    if (!hasToolCall) {
      // 大模型未发起新工具调用，说明已得出最终回答，循环成功闭环！
      this.finishLoop();
      return;
    }

    // 存在工具调用，判断是否自动批准
    this.pendingToolCall = result.toolCall;

    if (this.store.config.autoApprove) {
      await this.executeAndFeedBack(assistantMsgId, result.toolCall);
    } else {
      // 挂起循环，等待用户手动点击批准或拒绝
      this.isPausedForApproval = true;
      this.ui.toggleSendButtonState(false, '等待批准工具执行...');
    }
  }

  async executeAndFeedBack(assistantMsgId, toolCall) {
    let execResult;
    let isError = false;

    try {
      execResult = await this.executor.execute(toolCall.name, toolCall.arguments);
    } catch (err) {
      isError = true;
      execResult = toToolErrorPayload(err, toolCall);
    }

    if (isError) {
      const errObj = execResult.error || {};
      const errorKey = `${toolCall.name}:${errObj.code || 'UNKNOWN'}`;
      this.consecutiveErrorCounts[errorKey] = (this.consecutiveErrorCounts[errorKey] || 0) + 1;

      // 1. 标记当前助手卡片为 error 状态并记录结构化错误
      this.store.updateMessage(assistantMsgId, m => {
        if (m.toolCall) {
          m.toolCall.status = 'error';
          m.toolCall.error = errObj;
          m.toolCall.previewText = `[第 ${this.currentStep} 步] 调用 ${toolCall.name} 失败: ${errObj.message}`;
        }
      });

      // 2. 将错误结构作为 role: 'tool' 存入上下文流，让 Agent 自愈
      this.store.appendMessage({
        id: 'msg_tool_' + Date.now(),
        role: 'tool',
        name: toolCall.name,
        tool_call_id: toolCall.id,
        content: JSON.stringify(execResult)
      });

      this.ui.renderCurrentSession();

      // 3. 连续同类错误死循环熔断保护 (>= 2 次相同工具与错误代码)
      if (this.consecutiveErrorCounts[errorKey] >= 2) {
        this.finishLoop(`\n\n⚠️ 检测到工具 \`${toolCall.name}\` 连续异常 (${errObj.message})，自愈熔断保护生效已暂停执行。请检查参数或手动操作。`);
        return;
      }

      // 4. 推动进入下一步循环，让 Agent 读取错误自愈/修正/解释！
      this.isPausedForApproval = false;
      this.pendingToolCall = null;
      await this.stepLoop();

    } else {
      this.consecutiveErrorCounts = {}; // 成功调用，重置连续错误计数

      this.store.updateMessage(assistantMsgId, m => {
        if (m.toolCall) {
          m.toolCall.status = 'success';
          m.toolCall.result = execResult;
        }
      });

      this.store.appendMessage({
        id: 'msg_tool_' + Date.now(),
        role: 'tool',
        name: toolCall.name,
        tool_call_id: toolCall.id,
        content: JSON.stringify(execResult)
      });

      this.ui.renderCurrentSession();

      this.isPausedForApproval = false;
      this.pendingToolCall = null;
      await this.stepLoop();
    }
  }

  async resumeWithApproval(msgId, toolCallId) {
    if (!this.pendingToolCall || this.pendingToolCall.id !== toolCallId) {
      const msg = this.store.getActiveSession()?.messages.find(m => m.id === msgId);
      if (msg?.toolCall) {
        try {
          const res = await this.executor.execute(msg.toolCall.name, msg.toolCall.arguments);
          msg.toolCall.status = 'success';
          msg.toolCall.result = res;
        } catch (err) {
          const payload = toToolErrorPayload(err, msg.toolCall);
          msg.toolCall.status = 'error';
          msg.toolCall.error = payload.error;
        }
        this.store.saveSessions();
        this.ui.renderCurrentSession();
      }
      return;
    }

    const tc = this.pendingToolCall;
    this.pendingToolCall = null;
    this.isPausedForApproval = false;
    await this.executeAndFeedBack(msgId, tc);
  }

  rejectApproval(msgId) {
    const tc = this.pendingToolCall;
    this.pendingToolCall = null;
    this.isPausedForApproval = false;

    this.store.updateMessage(msgId, m => {
      if (m.toolCall) m.toolCall.status = 'rejected';
    });

    if (tc) {
      // 向模型回传用户拒绝的消息，让模型调整策略
      this.store.appendMessage({
        id: 'msg_tool_' + Date.now(),
        role: 'tool',
        name: tc.name,
        tool_call_id: tc.id,
        content: JSON.stringify({ error: 'User rejected this tool execution.' })
      });
      this.stepLoop();
    } else {
      this.finishLoop();
    }
  }

  finishLoop(errorMessage = null) {
    this.isRunning = false; this.isPausedForApproval = false;
    this.pendingToolCall = null; this.pendingAssistantMsgId = null;

    if (errorMessage) {
      const activeSession = this.store.getActiveSession();
      const lastMsg = activeSession?.messages.slice().reverse().find(m => m.role === 'assistant');
      if (lastMsg) lastMsg.content += errorMessage;
    }

    this.store.saveSessions();
    this.ui.toggleSendButtonState(false);
    this.ui.renderCurrentSession();
  }
}
