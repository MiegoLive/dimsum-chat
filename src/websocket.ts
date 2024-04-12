"use strict";

import { Parser } from ".";

class WebSocketManager {
  private static instance: WebSocketManager;
  private webSocket: WebSocket | null;
  private messageListeners: ((message: string) => void)[];

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
  }

  public addMessageListener(listener: (message: string) => void): void {
    this.messageListeners.push(listener);
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
  customWsServer?: string | URL
}

function onMessage(callback: (msg?: {type: string, content: any}, parser?: Parser) => void, options: onMessageOptions = {}): void {
  const {
    customWsServer = getWebSocketURL()
  } = options;
  const webSocketManager = WebSocketManager.getInstance();
  webSocketManager.connect(customWsServer);
  webSocketManager.addMessageListener( msg => {
    const msgObj = JSON.parse(msg) as {
      type: string,
      content: any
    };
    const parser = new Parser(msgObj)
    callback(msgObj, parser);
  });
}

export { WebSocketManager, getBfaceURL, getWebSocketURL, onMessage};