/**
 * dimsum-chat — 多平台直播消息解析与 WebSocket 通信工具包。
 *
 * 核心能力：
 * - onMessage：一行代码接入直播间消息
 * - Parser：跨平台统一消息解析（B站/抖音/快手/AcFun/CHZZK）
 * - WebSocketManager：WebSocket 连接管理与自动重连
 *
 * @module dimsum-chat
 */

export { WebSocketManager, getBfaceURL, getWebSocketURL, onMessage } from './websocket';
export { Parser } from './parser';
export type { commentParseOptions, abstractLevelOptions } from './parser';