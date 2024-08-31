import { Message } from './types'

const templateChatMessage: Message = {
  type: 'LIVE_OPEN_PLATFORM_DM',
  content: {
    "cmd":"LIVE_OPEN_PLATFORM_DM",
    "data":{
        "uname":"Miego糕社",
        "msg":"版权所有，盗用必究！",
        "guard_level":1,
        "uface":"https://i0.hdslb.com/bfs/face/d3055b0614c7bd8479a3e83330ad6762605a4995.jpg",
        "emoji_img_url": "",
        "dm_type": 0,
    }
  }
}

const templateGiftMessage: Message = {
  type: 'LIVE_OPEN_PLATFORM_SEND_GIFT',
  content: {
    "cmd":"LIVE_OPEN_PLATFORM_SEND_GIFT",
    "data":{
        "uname":"Miego糕社",
        "uface":"https://i0.hdslb.com/bfs/face/d3055b0614c7bd8479a3e83330ad6762605a4995.jpg",
        "gift_id":99999,
        "gift_name":"警告",
        "gift_num":10,
        "price":1000000,
        "paid":true,
        "guard_level":1,
        "gift_icon":"data:image/png;base64,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",
    }
  }
}

export const messages: Message[] = [templateChatMessage, templateGiftMessage];