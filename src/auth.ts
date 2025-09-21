import { messages } from './warningMessage';
import { Message } from './types';

export class DimSumAuth {

  private static instance: DimSumAuth;

  private constructor() {}

  static getInstance(): DimSumAuth {
    if (!DimSumAuth.instance) {
      DimSumAuth.instance = new DimSumAuth();
    }
    return DimSumAuth.instance;
  }

  private readonly AUTH_HOST = 'https://dimsum-widget-auth-1301031323.cos.ap-guangzhou.myqcloud.com';
  private readonly WHITELIST_WIDGETS = ['dimsum-bonk-2024-widget', 'douyin-bonk-2024-widget'];
  private readonly MAX_RETRY_COUNT = 3;
  private authenticatedPlatformAndRoomId?: string = undefined;
  private isPiracy: boolean = false;
  private retryCount: number = 0;

  private updateWidgetId(widgetId: string) {
    if (widgetId === 'douyin-bonk-2024-widget') {
      return 'dimsum-bonk-2024-widget';
    }
    return widgetId;
  }

  private checkAuthentication(widgetId: string, platform: string, roomId: string) {
    widgetId = this.updateWidgetId(widgetId);
    if (!this.WHITELIST_WIDGETS.includes(widgetId)) return;
    if (this.authenticatedPlatformAndRoomId === `${platform}-${roomId}`) return;
    // 不验证 chzzk 平台的 bonk widget
    if (platform === 'chzzk' && widgetId === 'dimsum-bonk-2024-widget') return;
    
    const retry = () => {
      this.retryCount++;
      if (this.retryCount < this.MAX_RETRY_COUNT) {
        setTimeout(() => {
          this.checkAuthentication(widgetId, platform, roomId);
        }, 1000);
      } else {
        this.isPiracy = true;
      }
    }

    const url = `${this.AUTH_HOST}/${widgetId}/whitelist/${platform}/${roomId}`;
    return fetch(url)
      .then(res => {
        console.log('checkAuthentication', res.status);
        if (res.status === 200) {
          this.authenticatedPlatformAndRoomId = `${platform}-${roomId}`;
          this.isPiracy = false;
        } else {
          retry();
        }
      })
      .catch(() => {
        console.log('checkAuthentication error');
        retry();
      });
  }

  public passMessage(message: Message): Message {
    try {
      if (message.type === 'DimSumChatRoomInfo') {
        const platform: string = message.content.platform ?? message.content.platfrom as string;
        const roomId: string = message.content.roomId as string;
        const widgetId: string = window.location.pathname.split('/')[1];
        this.checkAuthentication(widgetId, platform, roomId);
      }
      if (message.type === 'INTERACT_WORD') {
        const content = typeof message.content === 'object'? message.content : JSON.parse(message.content);
        const platform = 'bilibili';
        const roomId: string = String(content.data.roomid);
        const widgetId: string = window.location.pathname.split('/')[1];
        this.checkAuthentication(widgetId, platform, roomId);
      }
      if (message.type === 'LIVE_OPEN_PLATFORM_DM' || message.type === 'LIVE_OPEN_PLATFORM_SEND_GIFT') {
        const content = typeof message.content === 'object'? message.content : JSON.parse(message.content);
        if (content.data.room_id === undefined) {
          return message;
        }
        const platform = 'bilibili';
        const roomId: string = String(content.data.room_id);
        const widgetId: string = window.location.pathname.split('/')[1];
        this.checkAuthentication(widgetId, platform, roomId);
      }
      if (this.isPiracy) {
        // messages随机取一个
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        return randomMessage;
      }
    }
    catch (error) {
      console.log('DimSumAuth error', error);
    }
    
    return message;
  }
}