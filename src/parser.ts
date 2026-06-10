"use strict";
import { DouyinEmots } from "./emots/douyin-emots.js";
import { BilibiliEmots } from "./emots/bilibili-emots.js";
import { KuaishouEmots } from "./emots/kuaishou-emots.js";

type MessageType = "comment" | "gift" | "follow" | "joinclub" | "like" | "guard" | "superchat" | "enter" | "share" | undefined;

/**
 * 多平台直播消息解析器。
 *
 * 将各平台（B站/OpenBLive/抖音/快手/AcFun/CHZZK）的原始消息
 * 统一解析为便于使用的属性访问接口，内置属性值缓存机制。
 *
 * @example
 * ```ts
 * const parser = new Parser({ type: 'DANMU_MSG', content: '...' })
 * console.log(parser.platform, parser.userName, parser.comment)
 * ```
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html}
 */
class Parser {
  /**
   * Douyin emoji mappings. Accessible directly without going through CommentBuilder.
   *
   * @example
   * Parser.DouyinEmots.forEach(([emot, url]) => console.log(emot, url));
   */
  static readonly DouyinEmots: readonly [string, string][] = DouyinEmots;
  /**
   * Bilibili emoji mappings (also used by OpenBLive).
   *
   * @example
   * Parser.BilibiliEmots.forEach(([emot, url]) => console.log(emot, url));
   */
  static readonly BilibiliEmots: readonly [string, string][] = BilibiliEmots;
  /**
   * Kuaishou emoji mappings.
   *
   * @example
   * Parser.KuaishouEmots.forEach(([emot, url]) => console.log(emot, url));
   */
  static readonly KuaishouEmots: readonly [string, string][] = KuaishouEmots;

  // groupId_userId_giftId : comboCount
  private static douyinGiftGroup = new Map<string, number>();
  private static kuaishouGiftGroup = new Map<string, number>();

  /** 原始消息类型。 */
  public readonly rawType: string;
  /** 原始消息内容（字符串已自动反序列化为对象）。 */
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
  get platform(): "acfun" | "openblive" | "bilibili" | "douyin" | "kuaishou" | "chzzk" | undefined {
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
    if (this.rawType.startsWith("Chzzk")){
      return "chzzk";
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
        "KuaishouCommentFeeds",
        "ChzzkChatMessage"
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
        "GUARD_BUY",
        "ChzzkSubscriptionMessage"
      ],
      superchat: [
        "LIVE_OPEN_PLATFORM_SUPER_CHAT",
        "SUPER_CHAT_MESSAGE",
        "ChzzkDonationMessage"
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
        const userInfo = this.rawContent.data.user_info || this.rawContent.data;
        return userInfo?.uname ?? userInfo?.username;
      }
    }
    if (this.platform === "acfun") {
      const userInfo = this.rawContent.gift?.userInfo || this.rawContent.userInfo;
      return userInfo?.nickname;
    }
    if (this.platform === "douyin") {
      if ("user" in this.rawContent) {
        // 需要兼容nickName和nickname 两种字段
        return this.rawContent.user.nickName ?? this.rawContent.user.nickname;
      }
    }
    if (this.platform === "kuaishou") {
      return this.rawContent.user?.userName;
    }
    if (this.platform === "chzzk") {
      if (this.rawContent.profile) {
        const profile = JSON.parse(this.rawContent.profile);
        return profile.nickname;
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
    if (this.platform === "chzzk") {
      if ("uid" in this.rawContent) {
        return this.rawContent.uid; // could be "anonymous"
      }
    }
    return undefined;
  }

  /** 粉丝团/守护团等级。 */
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

  /** 粉丝团/守护团名称。 */
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

  /** AcFun 守护团所属主播的用户 ID。 */
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

  /**
   * 用户头像 URL。
   *
   * B 站头像存在跨域限制，建议配合 getBfaceURL() 使用。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-avatar}
   */
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
        // 需要兼容 urlListList 和 urlList 两种字段
        const avatarThumb = this.rawContent.user.avatarThumb;
        return avatarThumb.urlListList?.[0] ?? avatarThumb.urlList?.[0];
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

  /**
   * 弹幕聊天内容。
   *
   * 当 type 为 comment 或 superchat 时均有值。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-comment}
   */
  get comment(): string | undefined {
    const map = {
      acfun: () => this.rawContent.content,
      bilibili: () => this.rawContent.info[1],
      openblive: () => this.rawContent.data.msg,
      douyin: () => this.rawContent.content,
      kuaishou: () => this.rawContent.content,
      chzzk: () => this.rawContent.msg
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
      },
      chzzk: () => {
        let content = escapeHtml(this.rawContent.msg);
        if (this.rawContent.extras) {
          const extras = JSON.parse(this.rawContent.extras);
          const emojis = extras.emojis || {}; // {"key": "url"} replace {:key:}
          for (let emoji in emojis) {
            const re = new RegExp(`\\{:${emoji}:}`, "g");
            content = content.replace(re, `<img src="${emojis[emoji]}" alt="" style="${emotStyle}" class="${emotClass}">`);
          }
          return content;
        }
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
        let TempEmots: [string, string][] = [];
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
      },
      chzzk: () => {
        let content = escapeHtml(this.rawContent.msg);
        let TempEmots: [string, string][] = [];
        if (this.rawContent.extras) {
          const extras = JSON.parse(this.rawContent.extras);
          const emojis = extras.emojis || {}; // {"key": "url"} replace {:key:}
          for (let emoji in emojis) {
            TempEmots.push([`{:${emoji}:}`, emojis[emoji]]);
          }
        }
        return builder(content, undefined, TempEmots);
      }
    }
    if (this.type === "comment" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  /**
   * 大航海等级。
   *
   * 0=无，3=舰长，2=提督，1=总督。
   * 当 type 为 guard 时，表示本次购买的大航海等级；
   * 其他消息类型中表示该用户当前的大航海等级。
   * Chzzk 平台的 Subscription 事件也支持此属性。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-guardlevel}
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
    if (this.platform === "chzzk") {
      const tier = this.chzzkTier;
      if (tier && tier <= 3 && tier >= 1){
        return (4 - tier) as 3 | 2 | 1;
      }
      return 0;
    }
    return undefined;
  }

  /**
   * 大航海购买数量。
   *
   * B 站表示购买月数，Chzzk 表示订阅月数。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-guardnum}
   */
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
    if (this.platform === "chzzk") {
      return this.chzzkTierMonth;
    }
    return undefined;
  }

  /**
   * 大航海购买价格（CNY）。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-guardprice}
   */
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

  /** Chzzk 订阅等级（1-3）。 */
  get chzzkTier(): number | undefined {
    if (this.platform === "chzzk") {
      if (this.rawType === "ChzzkSubscriptionMessage") {
        if (this.rawContent.extras) {
          const extras = JSON.parse(this.rawContent.extras);
          const tierNo = extras.tierNo;
          return tierNo;
        }
      }
    }
    return undefined;
  }

  /** Chzzk 订阅月数。 */
  get chzzkTierMonth(): number | undefined {
    if (this.platform === "chzzk") {
      if (this.rawType === "ChzzkSubscriptionMessage") {
        if (this.rawContent.extras) {
          const extras = JSON.parse(this.rawContent.extras);
          const month = extras.month;
          return month;
        }
      }
    }
    return undefined;
  }

  /** 礼物名称。 */
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

  /**
   * 礼物数量。
   *
   * 抖音和快手已由 SDK 内部处理连击去重，每次返回增量值。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-giftnum}
   */
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

  /**
   * 单个礼物价格（CNY）。
   *
   * 免费礼物（如 B 站银瓜子）返回 0。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-giftunitprice}
   */
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

  /**
   * 礼物总价值（CNY）。
   *
   * 等价于 giftNum × giftUnitPrice。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-gifttotalprice}
   */
  get giftTotalPrice(): number | undefined {
    if (this.giftNum !== undefined && this.giftUnitPrice !== undefined) {
      return this.giftNum * this.giftUnitPrice;
    }
    return undefined;
  }

  /** 礼物图片 URL。 */
  get giftImage(): string | undefined {
    if (this.type !== "gift") return undefined;
    const map = {
      acfun: () => this.rawContent.giftInfo.pic,
      bilibili: () => this.rawContent.data.gift_info.webp,
      openblive: () => this.rawContent.data.gift_icon,
      douyin: () => {
        const image = this.rawContent.gift.image;
        return image.urlListList?.[0] ?? image.urlList?.[0];
      },
      kuaishou: () => this.rawContent.giftInfo.picUrl[0].url
    }
    return map[this.platform as keyof typeof map]();
  }

  /** 超级聊天评论内容。 */
  get superChatComment(): string | undefined {
    const map = {
      bilibili: () => this.rawContent.data.message,
      openblive: () => this.rawContent.data.message,
      chzzk: () => this.rawContent.msg,
    }
    if (this.type === "superchat" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  /**
   * 超级聊天价格。
   *
   * B 站与 OpenBLive 为人民币（元），Chzzk 为韩元（KRW）。
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-superchatprice}
   */
  get superChatPrice(): number | undefined {
    const map = {
      bilibili: () => this.rawContent.data.price,
      openblive: () => this.rawContent.data.rmb,
      chzzk: () => {
        if (this.rawContent.extras) {
          const extras = JSON.parse(this.rawContent.extras);
          const payAmount = extras.payAmount;
          return payAmount; // 1 cheese = 1 South Korean won
        }
        return undefined;
      }
    }
    if (this.type === "superchat" && map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }

  /**
   * 广义价格，根据消息类型自动选择对应价格属性：
   *
   * | 消息类型   | 对应属性          |
   * |-----------|-----------------|
   * | gift      | giftTotalPrice  |
   * | superchat | superChatPrice  |
   * | guard     | guardPrice      |
   * | 其它      | undefined       |
   *
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-price}
   */
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

  /**
   * 获取用户的抽象化分级，用于渲染用户等级标识。
   *
   * 不同平台的映射规则见官网文档。
   *
   * @param options - 各平台分段阈值配置，见 {@link abstractLevelOptions}
   * @returns 0-3 等级，undefined 表示不支持
   * @see {@link https://dimsum.chat/zh/api/parser.html#parser-getabstractlevel}
   */
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
      openblive: () => getLevelByGuard(),
      chzzk: () => this.chzzkTier ?? 0
    }
    if (map[this.platform as keyof typeof map]) {
      return map[this.platform as keyof typeof map]();
    } else {
      return undefined;
    }
  }
}


/**
 * getCommentHTML 渲染选项。
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-getcommenthtml}
 */
interface commentParseOptions {
  /** 贴纸表情的 CSS 样式。 */
  stickerStyle?: string
  /** 贴纸表情的 CSS 类名。 */
  stickerClass?: string
  /** 小表情的 CSS 样式。 */
  emotStyle?: string
  /** 小表情的 CSS 类名。 */
  emotClass?: string
  /** 自定义 AcFun 贴纸表情。仅 platform='acfun' 时生效。 */
  acfunCustomStickers?: {
    keyWord: string,
    path: string
  } []
  acfunCustomHtmlBuilder?:
  (stickerPath: string, content: string) => string
}

/**
 * getAbstractLevel 配置选项。
 *
 * 各平台的默认分段均为 [7, 11, 15]，即 clubLevel ≤ 7 → 0, ≤ 11 → 1, ≤ 15 → 2, > 15 → 3。
 *
 * @see {@link https://dimsum.chat/zh/api/parser.html#parser-getabstractlevel}
 */
interface abstractLevelOptions {
  /** 抖音 clubLevel 分段阈值，默认 [7, 11, 15]。 */
  douyinSteps?: number[]
  /** 快手 clubLevel 分段阈值，默认 [7, 11, 15]。 */
  kuaishouSteps?: number[]
  /** AcFun clubLevel 分段阈值，默认 [7, 11, 15]。 */
  acfunSteps?: number[]
  /** AcFun 目标主播 UID。设置后仅该主播的守护团成员返回 >0 的值。 */
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
