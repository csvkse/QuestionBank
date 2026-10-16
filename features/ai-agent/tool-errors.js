/**
 * AI Agent Tool Calling Exception Taxonomy & Protocols
 * Core 2.1: features/ai-agent/tool-errors.js
 */

export class ToolError extends Error {
  constructor(message, code = 'TOOL_EXECUTION_FAILED', suggestion = '', details = {}) {
    super(message);
    this.name = 'ToolError';
    this.type = 'EXECUTION_ERROR';
    this.code = code;
    this.suggestion = suggestion;
    this.details = details;
  }

  toJSON() {
    return {
      success: false,
      error: {
        type: this.type,
        code: this.code,
        message: this.message,
        suggestion: this.suggestion,
        details: this.details
      }
    };
  }
}

export class ToolFormatError extends ToolError {
  constructor(message, code = 'FORMAT_ERROR', suggestion = '', details = {}) {
    super(message, code, suggestion, details);
    this.name = 'ToolFormatError';
    this.type = 'FORMAT_ERROR';
  }
}

export class ToolReferenceError extends ToolError {
  constructor(message, code = 'REFERENCE_ERROR', suggestion = '', details = {}) {
    super(message, code, suggestion, details);
    this.name = 'ToolReferenceError';
    this.type = 'REFERENCE_ERROR';
  }
}

export class ToolPermissionError extends ToolError {
  constructor(message, code = 'PERMISSION_ERROR', suggestion = '', details = {}) {
    super(message, code, suggestion, details);
    this.name = 'ToolPermissionError';
    this.type = 'PERMISSION_ERROR';
  }
}

export class ToolExecutionError extends ToolError {
  constructor(message, code = 'EXECUTION_ERROR', suggestion = '', details = {}) {
    super(message, code, suggestion, details);
    this.name = 'ToolExecutionError';
    this.type = 'EXECUTION_ERROR';
  }
}

/**
 * 将任意异常标准化包装为符合模型通信规范的 Tool 错误载荷
 */
export function toToolErrorPayload(err, toolCall = null) {
  if (err instanceof ToolError) {
    const payload = err.toJSON();
    if (toolCall) payload.error.toolName = toolCall.name;
    return payload;
  }

  return {
    success: false,
    error: {
      type: 'EXECUTION_ERROR',
      code: 'UNHANDLED_EXCEPTION',
      message: err?.message || String(err || '工具执行发生未捕获异常'),
      suggestion: '请检查工具调用参数或更换备选方案',
      toolName: toolCall?.name || 'unknown',
      details: {}
    }
  };
}
