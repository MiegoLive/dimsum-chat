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
  private isAuthenticated: boolean = false;
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
    
    const retry = () => {
      this.retryCount++;
      if (this.retryCount < this.MAX_RETRY_COUNT) {
        setTimeout(() => {
          this.checkAuthentication(widgetId, platform, roomId);
        }, 1000);
      } else {
        this.isAuthenticated = true;
        this.isPiracy = true;
      }
    }

    if (this.WHITELIST_WIDGETS.includes(widgetId)) {
      const url = `${this.AUTH_HOST}/${widgetId}/whitelist/${platform}/${roomId}`;
      return fetch(url)
        .then(res => {
          console.log('checkAuthentication', res.status);
          if (res.status === 200) {
            this.isAuthenticated = true;
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
  }

  public passMessage(message: Message): Message {
    if (!this.isAuthenticated) {
      if (message.type === 'DimSumChatRoomInfo') {
        const platform: string = message.content.platform ?? message.content.platfrom as string;
        const roomId: string = message.content.roomId as string;
        const widgetId: string = window.location.pathname.split('/')[1];
        this.checkAuthentication(widgetId, platform, roomId);
      }
    }
    if (this.isPiracy) {
      // messages随机取一个
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      return randomMessage;
    }

    return message;
  }
}