"use strict";
import { DouyinEmots } from "./emots/douyin-emots.js";
import { BilibiliEmots } from "./emots/bilibili-emots.js";
import { KuaishouEmots } from "./emots/kuaishou-emots.js";

type MessageType = "comment" | "gift" | "follow" | "joinclub" | "like" | "guard" | "superchat" | "enter" | "share" | undefined;

class Parser {
  // groupId_userId_giftId : comboCount
  private static douyinGiftGroup = new Map<string, number>();
  private static kuaishouGiftGroup = new Map<string, number>();

  public readonly rawType: string;
  public readonly rawContent: any;

  private _cachedValues: { [key: string]: any } = {};

  public constructor(rawMsg: {type: string, content: any}) {
    this.rawType = rawMsg.type;
    try {
      if (typeof(rawMsg.content) === "string"){
        this.rawContent = JSON.parse(rawMsg.content);
      }else{
        this.rawContent = rawMsg.content;
      }
    }
    catch{
      this.rawContent = rawMsg.content;
    }

    const self = this;
    const proto = Object.getPrototypeOf(this);
    Object.getOwnPropertyNames(proto).forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (descriptor && typeof descriptor.get === 'function') {
            Object.defineProperty(self, key, {
                get: function() {
                    return self.getCachedValue(key, () => descriptor.get?.call(self));
                },
                enumerable: true,
                configurable: true
            });
        }
    });
  }

  private getCachedValue(key: string, calculateFn: () => any): any {
    try {
      if (!this._cachedValues[key]) {
          this._cachedValues[key] = calculateFn();
      }
      return this._cachedValues[key];
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

/**
 * The live platform to which the message belongs.
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-platform}
 */
  get platform(): "acfun" | "openblive" | "bilibili" | "douyin" | "kuaishou" | undefined {
    const douyinPattern = /^Webcast[A-Z][a-zA-Z]*Message$/;
    const AcfunPattern = /^(Common|Acfun)(Action|State)Signal[A-Z][a-zA-Z]*/;
    if ("cmd" in this.rawContent && typeof(this.rawContent.cmd) === "string") {
      if ((this.rawContent.cmd as string).includes("LIVE_OPEN_PLATFORM")){
        return "openblive";
      }else{
        return "bilibili";
      }
    }
    if (douyinPattern.test(this.rawType)) {
      return "douyin";
    }
    if (this.rawType.startsWith("Kuaishou")){
      return "kuaishou";
    }
    if (AcfunPattern.test(this.rawType)) {
      return "acfun";
    }
    return undefined;
  }

/**
 * Message Type.
 *
 * @type see {@link MessageType}
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-type}
 */
  get type(): MessageType {
    const types = {
      comment: [
        "LIVE_OPEN_PLATFORM_DM",
        "CommonActionSignalComment",
        "WebcastChatMessage",
        "DANMU_MSG",
        "KuaishouCommentFeeds"
      ],
      gift: [
        "LIVE_OPEN_PLATFORM_SEND_GIFT",
        "CommonActionSignalGift",
        "WebcastGiftMessage",
        "SEND_GIFT",
        "KuaishouGiftFeeds"
      ],
      follow: [
        "CommonActionSignalUserFollowAuthor"
      ],
      joinclub: [
        "AcfunActionSignalJoinClub",
        "WebcastFansclubMessage"
      ],
      like: [
        "LIVE_OPEN_PLATFORM_LIKE",
        "CommonActionSignalLike",
        "WebcastLikeMessage",
        "LIKE_INFO_V3_CLICK",
        "KuaishouLikeFeeds"
      ],
      guard: [
        "LIVE_OPEN_PLATFORM_GUARD",
        "GUARD_BUY"
      ],
      superchat: [
        "LIVE_OPEN_PLATFORM_SUPER_CHAT",
        "SUPER_CHAT_MESSAGE"
      ],
      enter: [
        "CommonActionSignalUserEnterRoom",
        "WebcastMemberMessage"
      ],
      share: [
        "KuaishouShareFeeds"
      ]
    };
    if (this.rawType === "WebcastGiftMessage" && this.rawContent.repeatEnd === 1) {
      return undefined; // ignore repeatend gift message
    }
    for (let type in types) {
      if (types[type as keyof typeof types].includes(this.rawType as never)){
        return type as MessageType;
      }
    }
    if (this.rawType === "INTERACT_WORD") {
      const interactTypes = [undefined, "enter", "follow", "share", "follow", "follow", "like"];
      return interactTypes[this.rawContent.data.msg_type as number] as MessageType;
    }
    if (this.rawType === "WebcastSocialMessage") {
      if (this.rawContent.action === 1) {
        return "follow";
      }
      if (this.rawContent.action === 3) {
        return "share";
      }
    }
    return undefined;
  }

/**
 * User Name.
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-username}
 */
  get userName(): string | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if (this.rawType === "DANMU_MSG") {
        return this.rawContent.info[2][1];
      }
      if ("data" in this.rawContent) {
        if ("user_info" in this.rawContent.data) {
          if ("uname" in this.rawContent.data.user_info) {
            return this.rawContent.data.user_info.uname;
          }
        }
        if ("uname" in this.rawContent.data) {
          return this.rawContent.data.uname;
        }
        if ("username" in this.rawContent.data) {
          return this.rawContent.data.username;
        }
      }
    }
    if (this.platform === "acfun") {
      if ("gift" in this.rawContent) {
        return this.rawContent.gift.userInfo.nickname;
      }
      if ("userInfo" in this.rawContent) {
        return this.rawContent.userInfo.nickname;
      }
    }
    if (this.platform === "douyin") {
      if ("user" in this.rawContent) {
        return this.rawContent.user.nickName;
      }
    }
    if (this.platform === "kuaishou") {
      if ("user" in this.rawContent) {
        return this.rawContent.user.userName;
      }
    }
    return undefined;
  }

/**
 * User ID.
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-uid}
 */
  get uid(): number | string | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if (this.rawType === "DANMU_MSG") {
        return this.rawContent.info[2][0];
      }
      if ("data" in this.rawContent) {
        if ("user_info" in this.rawContent.data) {
          if ("uid" in this.rawContent.data.user_info) {
            return this.rawContent.data.user_info.uid;
          }
        }
        if ("uid" in this.rawContent.data) {
          return this.rawContent.data.uid;
        }
      }
    }
    if (this.platform === "acfun") {
      if ("gift" in this.rawContent) {
        return this.rawContent.gift.userInfo.userId;
      }
      if ("userInfo" in this.rawContent) {
        return this.rawContent.userInfo.userId;
      }
    }
    if (this.platform === "douyin") {
      if ("user" in this.rawContent) {
        return this.rawContent.user.id;
      }
    }
    if (this.platform === "kuaishou") {
      if ("user" in this.rawContent) {
        return this.rawContent.user.principalId;
      }
    }
    return undefined;
  }

  get clubLevel(): number | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if (this.rawType === "DANMU_MSG") {
        return this.rawContent.info[3][0];
      }
      if ("data" in this.rawContent) {
        if ("medal_info" in this.rawContent.data) {
          if ("medal_level" in this.rawContent.data.medal_info) {
            return this.rawContent.data.medal_info.medal_level;
          }
        }
        if ("fans_medal" in this.rawContent.data && this.rawContent.data.fans_medal !== null) {
          if ("medal_level" in this.rawContent.data.fans_medal) {
            return this.rawContent.data.fans_medal.medal_level;
          }
        }
        if ("fans_medal_level" in this.rawContent.data) {
          return this.rawContent.data.fans_medal_level;
        }
      }
    }
    if (this.platform === "acfun") {
      let userInfo;
      if ("gift" in this.rawContent) {
        userInfo = this.rawContent.gift.userInfo;
      }
      if ("userInfo" in this.rawContent) {
        userInfo = this.rawContent.userInfo;
      }
      if (userInfo) {
        if (userInfo.badge.length > 0) {
          const badge = JSON.parse(userInfo.badge);
          return badge.medalInfo.level;
        }
      }
    }
    if (this.platform === "douyin") {
      if ("user" in this.rawContent && this.rawContent.user.fansClub !== null) {
        return this.rawContent.user.fansClub.data.level;
      }
    }
    return undefined;
  }

  get clubName(): string | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if (this.rawType === "DANMU_MSG") {
        return this.rawContent.info[3][1];
      }
      if ("data" in this.rawContent) {
        if ("medal_info" in this.rawContent.data) {
          if ("medal_name" in this.rawContent.data.medal_info) {
            return this.rawContent.data.medal_info.medal_name;
          }
        }
        if ("fans_medal" in this.rawContent.data && this.rawContent.data.fans_medal !== null) {
          if ("medal_name" in this.rawContent.data.fans_medal) {
            return this.rawContent.data.fans_medal.medal_name;
          }
        }
        if ("fans_medal_name" in this.rawContent.data) {
          return this.rawContent.data.fans_medal_name;
        }
      }
    }
    if (this.platform === "acfun") {
      let userInfo;
      if ("gift" in this.rawContent) {
        userInfo = this.rawContent.gift.userInfo;
      }
      if ("userInfo" in this.rawContent) {
        userInfo = this.rawContent.userInfo;
      }
      if (userInfo) {
        if (userInfo.badge.length > 0) {
          const badge = JSON.parse(userInfo.badge);
          return badge.medalInfo.clubName;
        }
      }
    }
    if (this.platform === "douyin") {
      if ("user" in this.rawContent) {
        return this.rawContent.user.fansClub?.data?.clubName;
      }
    }
    return undefined;
  }

  get acfunClubUid(): number | undefined {
    if (this.platform === "acfun") {
      let userInfo;
      if ("gift" in this.rawContent) {
        userInfo = this.rawContent.gift.userInfo;
      }
      if ("userInfo" in this.rawContent) {
        userInfo = this.rawContent.userInfo;
      }
      if (userInfo) {
        if (userInfo.badge.length > 0) {
          const badge = JSON.parse(userInfo.badge);
          return badge.medalInfo.uperId;
        }
      }
    }
    return undefined;
  }

/**
 * User subscription status in the current Douyin live room.
 *
 * @type `0` for non-member, `1` for monthly member, `2` for annual member
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-douyinsubscribe}
 */
  get douyinSubscribe(): 0 | 1 | 2 | undefined {
    if (this.platform === "douyin") {
      if ("user" in this.rawContent && this.rawContent.user.fansClub !== null) {
        const icons = this.rawContent.user.fansClub.data.badge.icons;
        if ("6" in icons && (icons["6"].uri as string).includes("subscribe_year")) {
          return 2;
        }
        if ("5" in icons && (icons["5"].uri as string).includes("subscribe_year")) {
          return 2;
        }
        if ("3" in icons || "5" in icons) {
          return 1;
        }
        return 0;
      }
    }
    return undefined;
  }

  get avatar(): string | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if ("data" in this.rawContent) {
        if ("user_info" in this.rawContent.data) {
          if ("face" in this.rawContent.data.user_info) {
            return this.rawContent.data.user_info.face;
          }
          if ("uface" in this.rawContent.data.user_info) {
            return this.rawContent.data.user_info.uface;
          }
        }
        if ("face" in this.rawContent.data) {
          return this.rawContent.data.face;
        }
        if ("uface" in this.rawContent.data) {
          return this.rawContent.data.uface;
        }
      }
    }
    if (this.platform === "acfun") {
      if ("gift" in this.rawContent) {
        return this.rawContent.gift.userInfo.avatar[0].url;
      }
      if ("userInfo" in this.rawContent) {
        return this.rawContent.userInfo.avatar[0].url;
      }
    }
    if (this.platform === "douyin") {
      if ("user" in this.rawContent) {
        return this.rawContent.user.avatarThumb.urlListList[0];
      }
    }
    if (this.platform === "kuaishou") {
      if ("user" in this.rawContent) {
        if ("headUrl" in this.rawContent.user && this.rawContent.user.headUrl) {
          return this.rawContent.user.headUrl;
        }
      }
    }
    return undefined;
  }

  get comment(): string | undefined {
    const map = {
      acfun: () => this.rawContent.content,
      bilibili: () => this.rawContent.info[1],
      openblive: () => this.rawContent.data.msg,
      douyin: () => this.rawContent.content,
      kuaishou: () => this.rawContent.content
    }
    if (this.type === "comment" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else if (this.type === 'superchat') {
      return this.superChatComment;
    } else {
      return undefined;
    }
  }

/**
 * Simple method to construct comments as HTML strings. Useful for rendering comment messages in general.
 * 
 * @param options - {@link commentParseOptions}
 * @returns Rendered comment HTML.
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-getcommenthtml}
 */
  public getCommentHTML(options: commentParseOptions = {}): string | undefined {
    const {
      stickerStyle = "",
      stickerClass = "",
      emotStyle = "",
      emotClass = "",
      acfunCustomStickers = [],
      acfunCustomHtmlBuilder
    } = options;
    const map = {
      acfun: () => {
        let content = escapeHtml(this.rawContent.content);
        if ("emotionUrl" in this.rawContent && this.rawContent.emotionUrl) {
          const emotionUrl = this.rawContent.emotionUrl;
          return `<img src="${emotionUrl}" alt="" style="${stickerStyle}" class="${stickerClass}">`;
        }
        let stickerPath = undefined;
        acfunCustomStickers.forEach(customSticker => {
          if (content.includes(customSticker.keyWord)) {
            stickerPath = customSticker.path;
          }
        });
        if (stickerPath != undefined) {
          if (acfunCustomHtmlBuilder != undefined) {
            return acfunCustomHtmlBuilder(stickerPath, content);
          }
          return `<div style="display:flex;">
          <img src="${stickerPath}" alt="" style="${stickerStyle}" class="${stickerClass}">
          <div style="flex-grow:1;">${content}</div>
          </div>`;
        }
        return escapeHtml(this.rawContent.content);
      },
      bilibili: () => {
        if ( typeof(this.rawContent.info[0][13]) === "object") {
          const stickerUrl = this.rawContent.info[0][13].url;
          return `<img src="${stickerUrl}" alt="" style="${stickerStyle}" class="${stickerClass}">`;
        }
        const extra = this.rawContent.info[0][15].extra;
        const extraJson = JSON.parse(extra);
        let content = escapeHtml(extraJson.content);
        const emots = extraJson.emots;
        for (let emot in emots) {
          const re = new RegExp(`\\${emot}`, "g");
          content = content.replace(re, `<img src="${emots[emot].url}" alt="" style="${emotStyle}" class="${emotClass}">`);
        }
        return content;
      },
      openblive: () => {
        if (this.rawContent.data.emoji_img_url) {
          return `<img src="${this.rawContent.data.emoji_img_url}" alt="" style="${stickerStyle}" class="${stickerClass}">`;
        }
        let content = escapeHtml(this.rawContent.data.msg);
        BilibiliEmots.forEach(emots => {
          const re = new RegExp(`\\${emots[0]}`, "g");
          content = content.replace(re, `<img src="${emots[1]}" alt="" style="${emotStyle}" class="${emotClass}">`);
        });
        return content;
      },
      douyin: () => {
        let content = escapeHtml(this.rawContent.content);
        DouyinEmots.forEach(emots => {
          const re = new RegExp(`\\${emots[0]}`, "g");
          content = content.replace(re, `<img src="${emots[1]}" alt="" style="${emotStyle}" class="${emotClass}">`);
        });
        return content;
      },
      kuaishou: () => {
        let content = escapeHtml(this.rawContent.content);
        KuaishouEmots.forEach(emots => {
          const re = new RegExp(`\\${emots[0]}`, "g");
          content = content.replace(re, `<img src="${emots[1]}" alt="" style="${emotStyle}" class="${emotClass}">`);
        });
        return content;
      }
    }
    if (this.type === "comment" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

/**
 * Custom comment content builder.
 *
 * @param builder - builder function.
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-commentbuilder}
 */
  public CommentBuilder(
    builder:(comment: string, stickerUrl?: string, emots?: [string, string][], ) => string
  ): string | undefined {
    const map = {
      acfun: () => {
        let content = escapeHtml(this.rawContent.content);
        let stickerUrl = "emotionUrl" in this.rawContent && this.rawContent.emotionUrl ? this.rawContent.emotionUrl : undefined;
        return builder(content, stickerUrl);
      },
      bilibili: () => {
        let stickerUrl = undefined;
        let TempEmots: [string, string][] = []
        if ( typeof(this.rawContent.info[0][13]) === "object") {
          stickerUrl = this.rawContent.info[0][13].url;
        }
        const extra = this.rawContent.info[0][15].extra;
        const extraJson = JSON.parse(extra);
        const content = escapeHtml(extraJson.content);
        const emots = extraJson.emots;
        for (let emot in emots) {
          TempEmots.push([emot, emots[emot].url])
        }
        return builder(content, stickerUrl, TempEmots);
      },
      openblive: () => {
        let stickerUrl = undefined;
        if (this.rawContent.data.emoji_img_url) {
          stickerUrl = this.rawContent.data.emoji_img_url;
        }
        const content = escapeHtml(this.rawContent.data.msg);
        return builder(content, stickerUrl, BilibiliEmots);
      },
      douyin: () => {
        const content = escapeHtml(this.rawContent.content);
        return builder(content, undefined, DouyinEmots);
      },
      kuaishou: () => {
        const content = escapeHtml(this.rawContent.content);
        return builder(content, undefined, KuaishouEmots);
      }
    }
    if (this.type === "comment" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  /**
   * 大航海等级：0-无 3-舰长 2-提督 1-总督
   * 若type为guard，则为购买的大航海等级
   */
  get guardLevel(): 0 | 3 | 2 | 1 | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if (this.rawType === "DANMU_MSG") {
        return this.rawContent.info[7];
      }
      if ("data" in this.rawContent) {
        if ("guard_level" in this.rawContent.data) {
          return this.rawContent.data.guard_level;
        }
        if ("privilege_type" in this.rawContent.data) {
          return this.rawContent.data.privilege_type;
        }
      }
    }
    return undefined;
  }

  get guardNum(): number | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if (this.rawType === "GUARD_BUY") {
        return this.rawContent.data.num;
      }
      if ("data" in this.rawContent) {
        if ("guard_num" in this.rawContent.data) {
          return this.rawContent.guard_num;
        }
      }
    }
    return undefined;
  }

  // 可能是单价（未确认），舰长价格198实际可能为138
  get guardPrice(): number | undefined {
    if (this.platform === "bilibili" || this.platform === "openblive") {
      if ("data" in this.rawContent) {
        if ("price" in this.rawContent.data) {
          return this.rawContent.data.price / 1000;
        }
      }
    }
    return undefined;
  }

  get giftName(): string | undefined {
    const map = {
      acfun: () => this.rawContent.giftInfo.name,
      bilibili: () => this.rawContent.data.giftName,
      openblive: () => this.rawContent.data.gift_name,
      douyin: () => this.rawContent.gift.name,
      kuaishou: () => this.rawContent.giftInfo.name
    }
    if (this.type === "gift" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  get giftNum(): number | undefined {
    const map = {
      acfun: () => this.rawContent.gift.batchSize,
      bilibili: () => this.rawContent.data.num,
      openblive: () => this.rawContent.data.gift_num,
      douyin: () => {
        if (this.rawContent.sendType === 4) {
          const LIMIT = 1024;
          const comboCount = this.rawContent.comboCount as number;
          const groupId = this.rawContent.groupId as number;
          const giftId = this.rawContent.giftId;
          const userId = this.uid;
          const key = `${groupId}_${userId}_${giftId}`;
          let lastComboCount = 0;
          if (Parser.douyinGiftGroup.has(key)) {
            lastComboCount = Parser.douyinGiftGroup.get(key) ?? 0;
          }
          Parser.douyinGiftGroup.set(key, comboCount);
          if (Parser.douyinGiftGroup.size > LIMIT) {
            Parser.douyinGiftGroup.delete(Parser.douyinGiftGroup.keys().next().value ?? "");
          }
          return comboCount - lastComboCount;
        }
        return this.rawContent.groupCount;
      },
      kuaishou: () => {
        const LIMIT = 1024;
        const totalCount =this.rawContent.batchSize * this.rawContent.comboCount;
        const key = this.rawContent.mergeKey;
        let lastComboCount = 0;
        if (Parser.kuaishouGiftGroup.has(key)) {
          lastComboCount = Parser.kuaishouGiftGroup.get(key) ?? 0;
        }
        Parser.kuaishouGiftGroup.set(key, totalCount);
        if (Parser.kuaishouGiftGroup.size > LIMIT) {
          Parser.kuaishouGiftGroup.delete(Parser.kuaishouGiftGroup.keys().next().value ?? "");
        }
        return totalCount - lastComboCount;
      }
    }
    if (this.type === "gift" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  get giftUnitPrice(): number | undefined {
    const map = {
      acfun: () => {
        if (this.rawContent.gift.giftId !== 1) {
          return this.rawContent.giftInfo.value / 10;
        }
        return 0;
      },
      bilibili: () => {
        if (this.rawContent.data.coin_type !== "silver") {
          return this.rawContent.data.price / 1000;
        }
        return 0;
      },
      openblive: () => {
        if (this.rawContent.data.paid) {
          return this.rawContent.data.price / 1000;
        }
        return 0;
      },
      douyin: () => this.rawContent.gift.diamondCount / 10,
      kuaishou: () => this.rawContent.giftInfo.unitPrice / 10
    }
    if (this.type === "gift" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  get giftTotalPrice(): number | undefined {
    if (this.giftNum !== undefined && this.giftUnitPrice !== undefined) {
      return this.giftNum * this.giftUnitPrice;
    }
    return undefined;
  }

  get giftImage(): string | undefined {
    if (this.type !== "gift") return undefined;
    const map = {
      acfun: () => this.rawContent.giftInfo.pic,
      bilibili: () => this.rawContent.data.gift_info.webp,
      openblive: () => this.rawContent.data.gift_icon,
      douyin: () => this.rawContent.gift.image.urlListList[0],
      kuaishou: () => this.rawContent.giftInfo.picUrl[0].url
    }
    return map[this.platform as keyof typeof map]();
  }

  get superChatComment(): string | undefined {
    const map = {
      bilibili: () => this.rawContent.data.message,
      openblive: () => this.rawContent.data.message,
    }
    if (this.type === "superchat" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  get superChatPrice(): number | undefined {
    const map = {
      bilibili: () => this.rawContent.data.price,
      openblive: () => this.rawContent.data.rmb,
    }
    if (this.type === "superchat" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  get price(): number | undefined {
    if (this.type === "gift") {
      return this.giftTotalPrice;
    }
    if (this.type === "superchat") {
      return this.superChatPrice;
    }
    if (this.type === "guard") {
      return this.guardPrice;
    }
  }

  public getAbstractLevel(options: abstractLevelOptions = {}): number | undefined {
    const {
      douyinSteps = [7, 11, 15],
      kuaishouSteps = [7, 11, 15],
      acfunSteps = [7, 11, 15],
      acfunClubUid = 0
    } = options;
    const getLevelBySteps = (steps: number[]) => {
      if (this.clubLevel === undefined) return 0;
      const index = steps.findIndex(step => this.clubLevel! <= step);
      return index !== -1 ? index : steps.length;
    }
    const getLevelByGuard = () => {
      return this.guardLevel && this.guardLevel > 0 ? 4 - this.guardLevel : 0;
    }
    const map = {
      douyin: () => getLevelBySteps(douyinSteps),
      kuaishou: () => getLevelBySteps(kuaishouSteps),
      acfun: () => acfunClubUid > 0 && this.acfunClubUid !== acfunClubUid ? 0 : getLevelBySteps(acfunSteps),
      bilibili: () => getLevelByGuard(),
      openblive: () => getLevelByGuard()
    }
    if (map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }
}


interface commentParseOptions {
  stickerStyle?: string
  stickerClass?: string
  emotStyle?: string
  emotClass?: string
  acfunCustomStickers?: {
    keyWord: string,
    path: string
  } []
  acfunCustomHtmlBuilder?:
  (stickerPath: string, content: string) => string
}

interface abstractLevelOptions {
  douyinSteps?: number[]
  kuaishouSteps?: number[]
  acfunSteps?: number[]
  acfunClubUid?: number
}

function escapeHtml(str: string) {
  return str.replace(/[&<>"']/g, function(match) {
    switch (match) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#x27;';
      default:
        return match;
    }
  });
}

export { Parser };
export type { commentParseOptions, abstractLevelOptions };
