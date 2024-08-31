import { Message } from './types'

// TODO: I18N

const connected: Message = {
  type: "LIVE_OPEN_PLATFORM_DM",
  content: {
    cmd: "LIVE_OPEN_PLATFORM_DM",
    data: {
      uname: "Miego糕社",
      uface: "https://i0.hdslb.com/bfs/face/d3055b0614c7bd8479a3e83330ad6762605a4995.jpg",
      msg: "连接成功",
      guard_level: 1
    }
  }
};

const welcome: Message = {
  type: "LIVE_OPEN_PLATFORM_DM",
  content: {
    cmd: "LIVE_OPEN_PLATFORM_DM",
    data: {
      uname: "Miego糕社",
      uface: "https://i0.hdslb.com/bfs/face/d3055b0614c7bd8479a3e83330ad6762605a4995.jpg",
      msg: "欢迎使用点心Chat",
      guard_level: 1
    }
  }
};

export const infoMessage = {
  connected,
  welcome
};