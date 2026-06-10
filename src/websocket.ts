"use strict";

import { Parser } from ".";
import { DimSumAuth } from "./auth";
import { Message } from "./types";
import { infoMessage } from "./infoMessage";
import { handleMessage } from "./dimsumMessage";

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

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

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

  public addMessageListener(listener: (message: string) => void): void {
    this.messageListeners.push(listener);

    setTimeout(() => {
      listener(JSON.stringify(infoMessage.welcome));
    }, 100);
  }

  public removeMessageListener(listener: (message: string) => void): void {
    const index = this.messageListeners.indexOf(listener);
    if (index !== -1) {
      this.messageListeners.splice(index, 1);
    }
  }
}

function getWebSocketURL(): string {
  const parsedURL = new URL(window.location.href);
  const protocol = parsedURL.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = parsedURL.host;

  // 组合 WebSocket URL
  const webSocketURL = `${protocol}//${host}/websocket`;

  return webSocketURL;
}

function getBfaceURL(uid: string | number): string {
  const parsedURL = new URL(window.location.href);
  const protocol = parsedURL.protocol;
  const host = parsedURL.host;

  // 组合 Bface URL
  const bfaceURL = `${protocol}//${host}/bface/${uid}`;

  return bfaceURL;
}

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