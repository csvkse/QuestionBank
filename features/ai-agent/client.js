import { fetchEventSource, parsePartialJson } from '../../vendor/ai-sdk/ai-agent-bundle.js';

export class AiAgentClient {
  constructor(config = {}) {
    this.config = config;
    this.abortController = null;
  }

  updateConfig(newConfig) { this.config = { ...this.config, ...newConfig }; }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async sendChatStream({ messages, tools = [], callbacks = {}, step = 1 }) {
    const { onReasoning, onContent, onToolCallFragment, onFinish, onError } = callbacks;
    if (!this.config.apiKey || !this.config.apiKey.trim()) {
      return this.simulateChatStream({ messages, tools, callbacks, step });
    }

    this.abortController = new AbortController();
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let currentToolCall = null;
    let inThinkTag = false;

    const payload = {
      model: this.config.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
          tool_call_id: m.tool_call_id,
          tool_calls: m.tool_calls
        }))
      ],
      stream: true
    };

    if (this.config.reasoningEffort && this.config.reasoningEffort !== 'none') {
      payload.reasoning_effort = this.config.reasoningEffort;
    }

    if (this.config.maxOutputTokens) {
      const maxTok = Number(this.config.maxOutputTokens);
      if (maxTok > 0) {
        if (this.config.model?.startsWith('o1') || this.config.model?.startsWith('o3')) {
          payload.max_completion_tokens = maxTok;
        } else {
          payload.max_tokens = maxTok;
        }
      }
    }

    if (tools.length > 0) {
      payload.tools = tools;
    }

    let endpoint = (this.config.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    const apiType = this.config.apiType || 'openai';

    if (apiType === 'anthropic') {
      endpoint += '/messages';
      headers['x-api-key'] = this.config.apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    } else if (apiType === 'gemini') {
      endpoint += `/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey.trim()}`;
    } else if (apiType === 'ollama') {
      endpoint += '/api/chat';
    } else {
      endpoint += '/chat/completions';
      headers['Authorization'] = `Bearer ${this.config.apiKey.trim()}`;
    }

    try {
      await fetchEventSource(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
        openWhenHidden: true,

        onmessage: (event) => {
          if (!event.data || event.data === '[DONE]') return;
          let parsed;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            return;
          }

          const choice = parsed.choices?.[0];
          if (!choice) return;

          const delta = choice.delta || {};

          // 1. 深度求索 DeepSeek 原生 reasoning_content 处理
          if (delta.reasoning_content) {
            accumulatedReasoning += delta.reasoning_content;
            onReasoning?.(accumulatedReasoning, delta.reasoning_content);
          }

          // 2. 正文流与 <think> 标签状态机分流
          if (delta.content) {
            let chunk = delta.content;
            if (chunk.includes('<think>')) {
              inThinkTag = true;
              chunk = chunk.replace('<think>', '');
            }
            if (chunk.includes('</think>')) {
              inThinkTag = false;
              const parts = chunk.split('</think>');
              accumulatedReasoning += parts[0];
              onReasoning?.(accumulatedReasoning, parts[0]);
              chunk = parts[1] || '';
            }

            if (inThinkTag) {
              accumulatedReasoning += chunk;
              onReasoning?.(accumulatedReasoning, chunk);
            } else if (chunk) {
              accumulatedContent += chunk;
              onContent?.(accumulatedContent, chunk);
            }
          }

          // 3. 工具调用分片流式拼接 (借助 partial-json 容错解析)
          if (delta.tool_calls && delta.tool_calls.length > 0) {
            const tc = delta.tool_calls[0];
            if (!currentToolCall) {
              currentToolCall = {
                id: tc.id || 'call_' + Date.now(),
                name: tc.function?.name || '',
                argumentsRaw: ''
              };
            }
            if (tc.function?.name) currentToolCall.name = tc.function.name;
            if (tc.function?.arguments) {
              currentToolCall.argumentsRaw += tc.function.arguments;
              try {
                const partialArgs = parsePartialJson(currentToolCall.argumentsRaw);
                onToolCallFragment?.(currentToolCall.name, partialArgs, currentToolCall.id);
              } catch {
                // partial-json 内部自动补齐括号
              }
            }
          }
        },

        onerror: (err) => {
          throw err;
        }
      });

      let finalParsedArgs = {};
      if (currentToolCall) {
        try {
          finalParsedArgs = JSON.parse(currentToolCall.argumentsRaw);
        } catch {
          finalParsedArgs = parsePartialJson(currentToolCall.argumentsRaw) || {};
        }
      }

      if (onFinish) {
        await onFinish({
          content: accumulatedContent,
          reasoning: accumulatedReasoning,
          toolCall: currentToolCall ? { id: currentToolCall.id, name: currentToolCall.name, arguments: finalParsedArgs } : null
        });
      }

    } catch (err) {
      if (this.abortController?.signal?.aborted) return;
      onError?.(err);
    } finally {
      this.abortController = null;
    }
  }

  // 仿真演示模式 (支持多步自主循环验证)
  simulateChatStream({ messages, callbacks, step = 1 }) {
    return new Promise((resolve) => {
      const userQuery = messages.find(m => m.role === 'user')?.content || '';
      const hasToolResult = messages.some(m => m.role === 'tool');
      const { onReasoning, onContent, onFinish } = callbacks;

      let reasoningText = `[第 ${step} 步思考] 分析当前上下文与工具执行反馈...`;
      let replyText = '';
      let toolCall = null;

      if (!hasToolResult) {
        // 第一步：初次接收用户需求
        if (userQuery.includes('Docker') || userQuery.includes('建') || userQuery.includes('创建')) {
          reasoningText = `[第 ${step} 步思考] 用户希望构建新知识库。按照 Core 2.1 门禁规范，首先调用只读工具 tool_list_decks 检查现有库命名与分布，避免冲突。`;
          toolCall = { id: 'call_mock_list_' + Date.now(), name: 'tool_list_decks', arguments: {} };
          replyText = '正在为您检索系统现有题库状态，以确保规划不重复...';
        } else if (userQuery.includes('查询') || userQuery.includes('列表')) {
          reasoningText = `[第 ${step} 步思考] 用户发起了系统题库检索请求。调用只读工具 tool_list_decks()。`;
          toolCall = { id: 'call_mock_list_' + Date.now(), name: 'tool_list_decks', arguments: {} };
          replyText = '正在为您检索当前系统的全部题库清单：';
        } else if (userQuery.includes('检查') || userQuery.includes('混淆')) {
          reasoningText = `[第 ${step} 步思考] 诊断指定题库。调用 tool_get_deck 提取英语动词题库完整知识图谱元数据。`;
          toolCall = { id: 'call_mock_get_' + Date.now(), name: 'tool_get_deck', arguments: { deckId: 'deck_verbs' } };
          replyText = '正在提取英语动词题库完整知识实体元数据以执行健康度与干扰项深度诊断...';
        } else {
          reasoningText = `[第 ${step} 步思考] 深度辨析用户知识点，设计同胞干扰项。`;
          replyText = `在 Knowledge Master 知识图谱中，任何考点必须具备标准答案与 >=3 个同胞干扰项。随时告诉我您想创建或编辑哪个题库！`;
        }
      } else {
        // 第二步或后续步骤：已经收到了工具反馈！
        const lastToolMsg = messages.filter(m => m.role === 'tool').pop();
        if (lastToolMsg && lastToolMsg.name === 'tool_list_decks' && (userQuery.includes('Docker') || userQuery.includes('建'))) {
          reasoningText = `[第 ${step} 步思考] 已成功获取题库列表。确认无重名冲突！开始规划 Docker 三维知识结构（2大分类，8个考点，满足 >=4 门禁），调用 tool_create_deck 进行落库。`;
          toolCall = {
            id: 'call_mock_create_' + Date.now(),
            name: 'tool_create_deck',
            arguments: {
              title: 'Docker 容器架构与命令实战',
              icon: '🐳',
              description: '包含容器生命周期指令、数据卷驱动与网络互联',
              categories: [
                { id: 'cat_lifecycle', name: '容器生命周期指令', group: '一、基础架构' },
                { id: 'cat_storage', name: '数据卷与存储驱动', group: '二、存储网络' }
              ],
              layers: [
                { level: 1, name: 'Layer 1: 基础认知' },
                { level: 2, name: 'Layer 2: 规律运用' },
                { level: 3, name: 'Layer 3: 陷阱特例' }
              ],
              entities: [
                { id: 'e_run', categoryId: 'cat_lifecycle', layer: 1, title: 'docker run', prompt: '创建并启动容器：', answer: 'docker run' },
                { id: 'e_start', categoryId: 'cat_lifecycle', layer: 1, title: 'docker start', prompt: '启动已停止容器：', answer: 'docker start' },
                { id: 'e_stop', categoryId: 'cat_lifecycle', layer: 2, title: 'docker stop', prompt: '优雅停止容器：', answer: 'docker stop' },
                { id: 'e_rm', categoryId: 'cat_lifecycle', layer: 2, title: 'docker rm', prompt: '删除容器：', answer: 'docker rm' },
                { id: 'e_vol', categoryId: 'cat_storage', layer: 2, title: 'docker volume create', prompt: '创建具名数据卷：', answer: 'docker volume create' },
                { id: 'e_mount', categoryId: 'cat_storage', layer: 3, title: '--mount', prompt: '精确挂载语法：', answer: '--mount' },
                { id: 'e_ro', categoryId: 'cat_storage', layer: 3, title: ':ro', prompt: '挂载为只读模式：', answer: ':ro' },
                { id: 'e_inspect', categoryId: 'cat_storage', layer: 1, title: 'docker inspect', prompt: '查看容器底层配置元数据：', answer: 'docker inspect' }
              ]
            }
          };
          replyText = '系统状态核验完毕！正在为您调用创建接口，批量录入 8 个核心考点：';
        } else if (lastToolMsg && lastToolMsg.name === 'tool_list_decks') {
          reasoningText = `[第 ${step} 步思考] 题库清单检索成功。对当前题库规模与健康度指标进行综合汇总。`;
          replyText = `📊 **系统现有题库状态检索完毕：**\n\n已成功获取系统当前所有题库及其健康度指标。您可以通过自然语言指令直接进行考点诊断、同胞干扰项补齐或创建新学科库！`;
          toolCall = null;
        } else if (lastToolMsg && lastToolMsg.name === 'tool_get_deck') {
          reasoningText = `[第 ${step} 步思考] 发现高频混淆点。调用 tool_update_entity 为 arise 补充精确辨析。`;
          toolCall = {
            id: 'call_mock_update_' + Date.now(),
            name: 'tool_update_entity',
            arguments: {
              deckId: 'deck_verbs',
              entityId: 'v_arise',
              updates: { prompt: '出现；发生；产生 (区分 rise: 升起/上涨)' }
            }
          };
          replyText = '已完成健康度体检，检测到考点 `arise` 与 `rise` 易混淆。正在调用接口补齐混淆辨析提示：';
        } else {
          // 工具已全部执行完成，输出最终闭环总结！
          reasoningText = `[第 ${step} 步思考] 所有前置工具调用已成功完成。开始输出综合执行报告与学习指引。`;
          replyText = `🎉 **恭喜！多步流水线任务已全部闭环完成！**\n\n所有相关工具均已成功执行并回传上下文。您现在可以在左侧或**【学习大厅】**中直接选择该题库开启极速刷题或精读！`;
          toolCall = null;
        }
      }

      let progress = 0;
      const timer = setInterval(async () => {
        progress++;
        if (progress === 1 && onReasoning) onReasoning(reasoningText, reasoningText);
        if (progress === 2 && onContent) onContent(replyText, replyText);
        if (progress === 3) {
          clearInterval(timer);
          if (onFinish) await onFinish({ content: replyText, reasoning: reasoningText, toolCall });
          resolve();
        }
      }, 350);
    });
  }
}
