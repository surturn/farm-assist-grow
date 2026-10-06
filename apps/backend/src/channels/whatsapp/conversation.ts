import type { Lang } from '@farmassist/ai/advice';
import { answerQuestion, startDiagnosis } from '../../conversation/diagnosis';
import { realDeps } from '../../conversation/deps';
import { checkImage } from '../../conversation/filter';
import { t } from '../../conversation/i18n';
import { checkFaithful, parseAnswerButtonId, renderStep } from '../../conversation/render';
import { DuplicateMessageError, StaleAnswerError, type OutboundMessage } from '../../conversation/types';
import { downloadMedia, MediaTooLargeError } from './graph';
import type { Intent } from './intent.router';
import { sendMessages } from './sender';
import { WORKER_VERSION } from './version';

type Channel = Parameters<typeof sendMessages>[0] & { userId: string | null; language: string; optedOut: boolean };

const langOf = (c: Channel): Lang => (c.language === 'en' ? 'en' : 'sw');

export async function handleConversation(channel: Channel, intent: Intent, waMessageId: string): Promise<void> {
  if (channel.optedOut) return;
  const lang = langOf(channel);
  const deps = realDeps();
  const reply = (messages: OutboundMessage[]) => sendMessages(channel, messages);

  try {
    if (intent.kind === 'message.image') {
      let image: { bytes: Buffer; mimeType: string };
      try {
        image = await downloadMedia(intent.mediaId);
      } catch (e) {
        if (e instanceof MediaTooLargeError) return void (await reply([{ text: t('reject.unreadable', lang) }]));
        throw e;
      }
      if ((await checkImage(image.bytes)) !== 'ok') return void (await reply([{ text: t('reject.unreadable', lang) }]));
      const step = await startDiagnosis(deps,
        { channelId: channel.id, userId: channel.userId, waMessageId, mediaId: intent.mediaId, workerVersion: WORKER_VERSION },
        image, lang);
      return void (await reply(safe(renderStep(step, lang, deps.manifest.trainedCrops), step, lang)));
    }
    if (intent.kind === 'message.button') {
      const parsed = parseAnswerButtonId(intent.id);
      if (!parsed) return void (await reply([{ text: t('answer.stale', lang) }]));
      const step = await answerQuestion(deps, { channelId: channel.id }, parsed.scanId, parsed.questionId, parsed.optionId, lang);
      return void (await reply(safe(renderStep(step, lang, deps.manifest.trainedCrops), step, lang)));
    }
    if (intent.kind === 'message.text') return void (await reply([{ text: t('help', lang) }]));
  } catch (e) {
    if (e instanceof DuplicateMessageError) return; // replayed delivery: the first one already answered
    if (e instanceof StaleAnswerError) return void (await reply([{ text: t('answer.stale', lang) }]));
    console.error('[whatsapp] conversation failed:', e);
    await reply([{ text: t('error.retry', lang) }]);
  }
}

/** Faithfulness gate before anything leaves the system. */
function safe(messages: OutboundMessage[], step: Parameters<typeof checkFaithful>[1], lang: Lang): OutboundMessage[] {
  const violations = checkFaithful(messages, step);
  if (violations.length === 0) return messages;
  console.error('[whatsapp] unfaithful reply blocked:', violations);
  return [{ text: t('diagnosis.uncertain', lang) }];
}
