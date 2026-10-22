import type { Lang } from '@farmassist/ai/advice';

export const CATALOG = {
  'diagnosis.short': { en: 'Your {crop} has {name} ({confidence}% sure).', sw: '{crop} yako ina {name} (uhakika {confidence}%).' },
  'button.details': { en: 'More details', sw: 'Maelezo zaidi' },
  'button.prevent': { en: 'How to prevent', sw: 'Jinsi ya kuzuia' },
  'details.stale': { en: 'Those details are no longer available. Send the photo again.', sw: 'Maelezo hayo hayapatikani tena. Tuma picha tena.' },
  'diagnosis.healthy': { en: 'Your {crop} looks healthy.', sw: '{crop} yako inaonekana na afya.' },
  'diagnosis.symptoms': { en: 'Signs:{list}', sw: 'Dalili:{list}' },
  'diagnosis.treatment': { en: 'What to do: {text}', sw: 'Cha kufanya: {text}' },
  'diagnosis.prevention': { en: 'How to prevent it:{list}', sw: 'Jinsi ya kuzuia:{list}' },
  'diagnosis.chemicals': {
    en: 'Registered products contain: {list}. Ask your agrovet for the right product and dose.',
    sw: 'Bidhaa zilizosajiliwa zina: {list}. Muulize mwuzaji wa pembejeo (agrovet) bidhaa na kipimo sahihi.',
  },
  'diagnosis.no_advice': { en: 'Ask your agrovet for treatment.', sw: 'Muulize agrovet wako kuhusu tiba.' },
  'diagnosis.footer': {
    en: 'This is advice, not a guarantee. Ask your agrovet if it spreads.',
    sw: 'Huu ni ushauri, si uhakika. Muulize muuzaji wa pembejeo ugonjwa ukienea.',
  },
  'diagnosis.uncertain': {
    en: "I'm not sure what this is. An expert will check your photo.",
    sw: 'Sina uhakika ni nini. Mtaalamu ataangalia picha yako.',
  },
  'question.intro': { en: 'I need one detail to be sure. {question}', sw: 'Nahitaji jambo moja ili niwe na uhakika. {question}' },
  'reject.unsupported': { en: "I can't diagnose this crop yet. I cover {crops}.", sw: 'Bado siwezi kutambua zao hili. Ninashughulikia {crops}.' },
  'reject.not_plant': { en: "I couldn't see a plant. Send a close photo of one leaf.", sw: 'Sikuona mmea. Tuma picha ya karibu ya jani moja.' },
  'reject.unreadable': { en: "I couldn't read that photo. Try another, in daylight.", sw: 'Sikuweza kusoma picha hiyo. Jaribu nyingine, mchana.' },
  help: {
    en: "Send a photo of one sick leaf and I'll tell you what it is. Send LANGUAGE to change language.",
    sw: 'Tuma picha ya jani moja lililo na ugonjwa nami nitakuambia ni nini. Tuma LUGHA kubadilisha lugha.',
  },
  'language.set': { en: 'I will reply in English.', sw: 'Nitajibu kwa Kiswahili.' },
  'error.retry': { en: 'Something went wrong. Please send the photo again.', sw: 'Kuna hitilafu. Tafadhali tuma picha tena.' },
  'answer.stale': { en: 'That question has expired. Send the photo again.', sw: 'Swali hilo limepitwa na wakati. Tuma picha tena.' },
} as const;

export type MessageKey = keyof typeof CATALOG;

export function t(key: MessageKey, lang: Lang, params: Record<string, string> = {}): string {
  return CATALOG[key][lang].replace(/\{(\w+)\}/g, (m, p) => params[p] ?? m);
}
