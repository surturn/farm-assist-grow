import type { MetaMessage, MetaMediaMessage, MetaTextMessage } from './types';

/**
 * Classifies an inbound message into the handful of things the channel can
 * act on. Commands are matched before free text, because "SIMAMA" typed on
 * its own is an opt-out, not a farm log entry.
 *
 * Commands are single words in Swahili or English, matched case-insensitively
 * and after trimming, so a farmer who sends " stop " is still opted out.
 */

export type Intent =
  | { kind: 'command.stop' }
  | { kind: 'command.start' }
  | { kind: 'command.language'; language?: string }
  | { kind: 'command.help' }
  | { kind: 'message.image'; mediaId: string; mimeType: string; caption?: string }
  | { kind: 'message.audio'; mediaId: string; mimeType: string; isVoiceNote: boolean }
  | { kind: 'message.text'; body: string }
  | { kind: 'message.unsupported'; type: string };

const STOP_WORDS = new Set(['simama', 'stop', 'acha']);
const START_WORDS = new Set(['anza', 'start']);
const HELP_WORDS = new Set(['msaada', 'help']);
const LANGUAGE_WORDS = new Set(['lugha', 'language']);

/** Maps what a farmer might type to the language codes we store. */
const LANGUAGE_CODES: Record<string, string> = {
  sw: 'sw',
  swahili: 'sw',
  kiswahili: 'sw',
  en: 'en',
  english: 'en',
  kiingereza: 'en',
};

export function routeIntent(message: MetaMessage): Intent {
  if (message.type === 'text') {
    const body = (message as MetaTextMessage).text?.body ?? '';
    const command = classifyCommand(body);
    return command ?? { kind: 'message.text', body };
  }

  if (message.type === 'image') {
    const image = (message as MetaMediaMessage).image;
    if (!image?.id) return { kind: 'message.unsupported', type: 'image' };
    return {
      kind: 'message.image',
      mediaId: image.id,
      mimeType: image.mime_type,
      caption: image.caption,
    };
  }

  if (message.type === 'audio') {
    const audio = (message as MetaMediaMessage).audio;
    if (!audio?.id) return { kind: 'message.unsupported', type: 'audio' };
    return {
      kind: 'message.audio',
      mediaId: audio.id,
      mimeType: audio.mime_type,
      // Meta distinguishes a recorded voice note from an attached audio file.
      isVoiceNote: audio.voice === true,
    };
  }

  return { kind: 'message.unsupported', type: message.type };
}

/** Returns a command intent, or null when the text is ordinary content. */
function classifyCommand(body: string): Intent | null {
  const words = body.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 2) return null;

  const [first, second] = words;

  if (words.length === 1) {
    if (STOP_WORDS.has(first)) return { kind: 'command.stop' };
    if (START_WORDS.has(first)) return { kind: 'command.start' };
    if (HELP_WORDS.has(first)) return { kind: 'command.help' };
    if (LANGUAGE_WORDS.has(first)) return { kind: 'command.language' };
    return null;
  }

  // Two words: only ever a language switch, e.g. "LUGHA English".
  if (LANGUAGE_WORDS.has(first)) {
    return { kind: 'command.language', language: LANGUAGE_CODES[second] };
  }

  return null;
}
