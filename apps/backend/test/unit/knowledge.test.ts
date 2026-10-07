import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkManifestAndKnowledge, loadClassManifest, loadKnowledge } from '@farmassist/ai/manifest';

const manifest = loadClassManifest();
const fresh = () => JSON.parse(JSON.stringify(loadKnowledge()));

test('real knowledge table passes the gate', () => {
  assert.deepEqual(checkManifestAndKnowledge(manifest, loadKnowledge()), []);
});

test('every entry has source, chemicals and sw fields', () => {
  for (const [label, e] of Object.entries(loadKnowledge())) {
    assert.ok('source' in e && 'chemicals' in e && 'sw' in e, label);
  }
});

test('a sourced entry without Swahili fails the build', () => {
  const k = fresh();
  k['Tomato___Late_Blight'].source = { title: 'X', url: 'https://example.org/x' };
  k['Tomato___Late_Blight'].sw = null;
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /Tomato___Late_Blight: sourced entry needs a Swahili translation/);
});

test('a chemical without a PCPB registration fails', () => {
  const k = fresh();
  const e = k['Tomato___Late_Blight'];
  e.source = { title: 'X', url: 'https://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: 'b', prevention: [] };
  e.chemicals = [{ activeIngredient: 'Mancozeb', pcpbReg: '' }];
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /chemical Mancozeb has no PCPB registration/);
});

test('chemicals on an unsourced entry fail', () => {
  const k = fresh();
  k['Tomato___Late_Blight'].source = null;
  k['Tomato___Late_Blight'].chemicals = [{ activeIngredient: 'Mancozeb', pcpbReg: 'PCPB(CR)0001' }];
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /chemicals need a source/);
});

test('a Healthy entry may not list chemicals', () => {
  const k = fresh();
  const e = k['Tomato___Healthy'];
  e.source = { title: 'X', url: 'https://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: '', prevention: [] };
  e.chemicals = [{ activeIngredient: 'Copper', pcpbReg: 'PCPB(CR)0002' }];
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /Healthy entry may not list chemicals/);
});

test('a dose hidden in the Swahili text fails', () => {
  const k = fresh();
  const e = k['Tomato___Late_Blight'];
  e.source = { title: 'X', url: 'https://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: 'Nyunyiza 50 g kwa lita 20', prevention: [] };
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /looks like a dosage/);
});

test('a source URL must be https', () => {
  const k = fresh();
  const e = k['Tomato___Late_Blight'];
  e.source = { title: 'X', url: 'http://example.org/x' };
  e.sw = { diseaseName: 'a', symptoms: [], treatment: 'b', prevention: [] };
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /source url must be https/);
});

test('a sourced disease entry without a short name and action in both languages fails', () => {
  const k = fresh();
  delete k['Tomato___Late_Blight'].sw.short;
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /Tomato___Late_Blight: sourced entry needs a short name and action/);
});

test('a dose in the short action fails', () => {
  const k = fresh();
  k['Tomato___Late_Blight'].short.action = 'Spray 50 ml per knapsack.';
  assert.match(checkManifestAndKnowledge(manifest, k).join('\n'), /looks like a dosage/);
});
