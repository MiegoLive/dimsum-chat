import { Message } from './types';

function getBaseNameFromURL(): string | undefined {
  const pathname = window.location.pathname;

  const parts = pathname.split('/');

  if (parts.length > 1) {
    const relativePath = parts[1];
    return relativePath;
  } else {
    return "unknown base name";
  }
}

/**
 * Optional context passed to handleMessage for enriching response messages.
 * Extend this interface when more contextual fields are needed in the future.
 */
export interface HandleMessageContext {
  widgetNickName?: string;
  // Future fields:
  // widgetAvatar?: string;
  // widgetColor?: string;
  // customPingInterval?: number;
}

export function handleMessage(
  message: Message,
  context: HandleMessageContext = {}
): Message | undefined {
  const { widgetNickName } = context;
  let response: Message | undefined;
  switch (message.type) {
    case 'DimSumChatWidgetInfoRequest':
      response = {
        type: "DimSumChatWidgetInfoResponse",
        content: {
          base: getBaseNameFromURL(),
          url: window.location.href,
          ...(widgetNickName ? { widgetNickName } : {}),
        }
      };
  }
  return response;
}