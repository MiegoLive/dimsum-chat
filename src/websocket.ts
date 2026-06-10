"use strict";

import { Parser } from ".";
import { DimSumAuth } from "./auth";
import { Message } from "./types";
import { infoMessage } from "./infoMessage";
import { handleMessage } from "./dimsumMessage";

/**
 * WebSocket 连接管理器（单例模式）。
 *
 * 管理 WebSocket 的连接生命周期：
 * - 建立连接（仅调用一次）
 * - 自动重连（断开后每 3 秒重试）
 * - 消息分发到多个监听器
 * - 通过 send() 主动发送消息到主程序
 * - 内部自动处理 DimSumChatWidgetInfoRequest 等握手消息
 *
 * @see {@link https://dimsum.chat/zh/api/websocket-manager.html}
 */
class WebSocketManager {
  private static instance: WebSocketManager;
  private webSocket: WebSocket | null;
  private messageListeners: ((message: string) => void)[];

  /**
   * Nickname for this widget instance.
   * Set before connection (via onMessageOptions) or dynamically at runtime.
   * When non-empty, it will be included in DimSumChatWidgetInfoResponse
   * so other components can identify this widget via DimSumChatCallMessageRequest.
   */
  public widgetNickName: string = '';

  private constructor() {
    this.webSocket = null;
    this.messageListeners = [];
  }

  /**
   * 获取唯一的 WebSocket 管理器实例。
   *
   * @returns WebSocketManager 单例
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * 连接到指定 WebSocket 服务器。
   *
   * 仅可调用一次，重复调用将被忽略。
   * 连接断开后自动每 3 秒尝试重连。
   *
   * @param url - WebSocket 服务器 URL
   * @see {@link https://dimsum.chat/zh/api/websocket-manager.html#websocketmanager-connect}
   */
  public connect(url: string | URL): void {
    if (this.webSocket) {
      return;
    }
    this.webSocket = new WebSocket(url);
    this.webSocket.onmessage = this.handleMessage.bind(this);
    this.webSocket.onopen = () => {
      console.log("connected");
      setTimeout(() => {
        this.messageListeners.forEach(
          listener => listener(JSON.stringify(infoMessage.connected))
        );
      }, 100);
    }
    this.webSocket.onclose = () => {
      console.log("close");
      setTimeout(() => {
        this.webSocket = null;
        this.connect(url);
      }, 3000);
    }
  }


  private handleMessage(event: MessageEvent): void {
    const message = event.data;
    this.messageListeners.forEach(listener => listener(message));
    const messageObj = JSON.parse(message) as Message;
    const response = handleMessage(messageObj, {
      widgetNickName: this.widgetNickName
    });
    if (response) {
      this.webSocket?.send(JSON.stringify(response));
    }
  }

  /**
   * 注册消息监听器。
   *
   * 收到 WebSocket 消息后以字符串形式传递给监听器。
   * 添加监听器时若连接已建立，会自动推送一条欢迎消息。
   *
   * @param listener - 消息回调，接收原始 JSON 字符串
   * @see {@link https://dimsum.chat/zh/api/websocket-manager.html#websocketmanager-addmessagelistener}
   */
  public addMessageListener(listener: (message: string) => void): void {
    this.messageListeners.push(listener);

    setTimeout(() => {
      listener(JSON.stringify(infoMessage.welcome));
    }, 100);
  }

  /**
   * 移除已注册的消息监听器。
   *
   * @param listener - 之前通过 addMessageListener 注册的回调
   */
  public removeMessageListener(listener: (message: string) => void): void {
    const index = this.messageListeners.indexOf(listener);
    if (index !== -1) {
      this.messageListeners.splice(index, 1);
    }
  }

  /**
   * 通过 WebSocket 主动发送消息到主程序。
   *
   * 连接未就绪时静默失败，不会抛出异常。
   *
   * @param message - 要发送的消息对象，会自动 JSON.stringify
   * @returns 发送成功返回 true，连接未就绪返回 false
   *
   * @example
   * ```ts
   * import { WebSocketManager } from 'dimsum-chat'
   *
   * const ws = WebSocketManager.getInstance()
   * ws.send({
   *   type: 'DimSumChatCallMessageRequest',
   *   content: {
   *     targetNickName: 'another-widget',
   *     requestData: { action: 'refresh' }
   *   }
   * })
   * ```
   */
  public send(message: object): boolean {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}

/**
 * 根据当前页面 URL 自动生成 WebSocket 服务器地址。
 *
 * http 页面 → ws://，https 页面 → wss://
 * 路径固定为 /websocket。
 *
 * @returns WebSocket URL，例如 "ws://localhost:13500/websocket"
 */
function getWebSocketURL(): string {
  const parsedURL = new URL(window.location.href);
  const protocol = parsedURL.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = parsedURL.host;

  // 组合 WebSocket URL
  const webSocketURL = `${protocol}//${host}/websocket`;

  return webSocketURL;
}

/**
 * 生成 B 站用户头像的代理 URL。
 *
 * 走主程序 /bface/ 接口，避免跨域问题。
 *
 * @param uid - B 站用户 ID
 * @returns 头像代理 URL，例如 "http://localhost:13500/bface/123456"
 */
function getBfaceURL(uid: string | number): string {
  const parsedURL = new URL(window.location.href);
  const protocol = parsedURL.protocol;
  const host = parsedURL.host;

  // 组合 Bface URL
  const bfaceURL = `${protocol}//${host}/bface/${uid}`;

  return bfaceURL;
}

/**
 * onMessage 配置选项。
 *
 * @see {@link https://dimsum.chat/zh/api/websocket-manager.html#onmessage}
 */
interface onMessageOptions {
  customWsServer?: string | URL;
  /**
   * Nickname for this widget instance.
   * Set this to identify your widget when communicating between components
   * (e.g., via DimSumChatCallMessageRequest).
   *
   * Can also be set directly on WebSocketManager.getInstance().widgetNickName
   * at any point before the DimSumChatWidgetInfoRequest is received.
   */
  widgetNickName?: string;
}

/**
 * 注册消息回调，一行代码接入直播间消息。
 *
 * 内部组合了 WebSocketManager、getWebSocketURL、Parser 和 DimSumAuth，
 * 自动处理连接、认证和消息解析，开箱即用。
 *
 * @param callback - 消息回调，接收原始 Message 和已创建的 Parser 实例
 * @param options - 配置选项（可选），支持自定义 WebSocket 服务器
 *
 * @example
 * ```ts
 * import { onMessage } from 'dimsum-chat'
 *
 * onMessage((msg, parser) => {
 *   console.log(parser.userName + ': ' + parser.comment)
 * })
 * ```
 *
 * @see {@link https://dimsum.chat/zh/api/websocket-manager.html#onmessage}
 */
function onMessage(callback: (message: Message, parser: Parser) => void, options: onMessageOptions = {}): void {
  const {
    customWsServer = getWebSocketURL(),
    widgetNickName = ''
  } = options;
  const auth = DimSumAuth.getInstance();
  const webSocketManager = WebSocketManager.getInstance();
  webSocketManager.widgetNickName = widgetNickName;
  webSocketManager.connect(customWsServer);
  webSocketManager.addMessageListener(messageString => {
    const message = JSON.parse(messageString) as Message;
    const authenticatedMessage = auth.passMessage(message);
    const parser = new Parser(authenticatedMessage)
    callback(authenticatedMessage, parser);
  });
}

export { WebSocketManager, getBfaceURL, getWebSocketURL, onMessage};