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

export function handleMessage(message: Message): Message | undefined {
  let response: Message | undefined;
  switch (message.type) {
    case 'DimSumChatWidgetInfoRequest':
      response = {
        type: "DimSumChatWidgetInfoResponse",
        content: {
          base: getBaseNameFromURL(),
          url: window.location.href,
        }
      };
  }
  return response;
}