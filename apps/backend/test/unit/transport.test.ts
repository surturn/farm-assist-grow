import './setup-env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { checkImage } from '../../src/conversation/filter';
import { routeIntent } from '../../src/channels/whatsapp/intent.router';
import { toMetaPayload } from '../../src/channels/whatsapp/sender';

test('image filter: ok, too small, unreadable', async () => {
  const ok = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#2e7d32' } }).jpeg().toBuffer();
  const small = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#2e7d32' } }).jpeg().toBuffer();
  assert.equal(await checkImage(ok), 'ok');
  assert.equal(await checkImage(small), 'too_small');
  assert.equal(await checkImage(Buffer.from('not an image')), 'unreadable');
});

test('router maps an interactive button reply', () => {
  const intent = routeIntent({ from: '254700000001', id: 'w1', timestamp: '1', type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'a:s1:q1:lower', title: 'Old lower leaves' } } } as any);
  assert.deepEqual(intent, { kind: 'message.button', id: 'a:s1:q1:lower', title: 'Old lower leaves' });
});

test('text and button payloads match the Graph API shape', () => {
  assert.deepEqual(toMetaPayload('+254700000001', { text: 'hi' }),
    { messaging_product: 'whatsapp', to: '254700000001', type: 'text', text: { body: 'hi' } });
  const p: any = toMetaPayload('+254700000001', { text: 'Q?', buttons: [{ id: 'a:s:q:o', title: 'Yes' }] });
  assert.equal(p.type, 'interactive');
  assert.deepEqual(p.interactive.action.buttons, [{ type: 'reply', reply: { id: 'a:s:q:o', title: 'Yes' } }]);
});
