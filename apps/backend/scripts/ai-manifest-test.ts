/**
 * Class manifest / knowledge table boot check, and TS abstention parity.
 *
 *   npm run test:ai
 *
 * No database, Redis or network: imports the manifest and abstention modules
 * directly, not the package index (which opens a Redis client).
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
    assertKnowledgeMatchesManifest,
    checkManifestAndKnowledge,
    loadClassManifest,
    loadKnowledge,
} from '@farmassist/ai/manifest';
import { decide } from '@farmassist/ai/abstention';

let passed = 0;
const test = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`ok  ${name}`);
};

const manifest = loadClassManifest();
const knowledge = loadKnowledge();
const cases = JSON.parse(
    fs.readFileSync(path.join(path.dirname(require.resolve('@farmassist/ai/manifest')), 'abstention-cases.json'), 'utf-8'),
).cases;

test('real manifest and knowledge table pass the boot check', () => {
    assert.equal(assertKnowledgeMatchesManifest().classes.length, 33);
});

test('no maize or cassava anywhere in the class list', () => {
    assert.ok(manifest.classes.every((c) => !/maize|corn|cassava/i.test(c)));
});

test('every crop has a Healthy class', () => {
    for (const crop of manifest.trainedCrops) assert.ok(manifest.classes.includes(`${crop}___Healthy`), crop);
});

test('boot check rejects a missing entry, a stale class, severity and a dosage', () => {
    const k = JSON.parse(JSON.stringify(knowledge));
    delete k.Coffee___Rust;
    k.Maize___Common_Rust = k.Coffee___Phoma;
    k.Tomato___Leaf_Mold.severity = 'Severe';
    k.Tomato___Late_Blight.treatment = 'Spray mancozeb at 50 g per 20 litres.';
    const errors = checkManifestAndKnowledge(manifest, k).join('\n');
    assert.match(errors, /missing class Coffee___Rust/);
    assert.match(errors, /non-class Maize___Common_Rust/);
    assert.match(errors, /Tomato___Leaf_Mold: severity/);
    assert.match(errors, /Tomato___Late_Blight: looks like a dosage/);
});

test('boot check rejects a crop without Healthy', () => {
    const m = { ...manifest, classes: manifest.classes.filter((c) => c !== 'Bean___Healthy') };
    assert.match(checkManifestAndKnowledge(m, knowledge).join('\n'), /Bean has no Healthy/);
});

for (const c of cases) {
    test(`abstention parity: ${c.name}`, () => {
        const d = decide(c.probs, manifest, c.declaredCrop);
        assert.deepEqual({ answer: d.answer, reason: d.reason }, { answer: c.answer, reason: c.reason });
    });
}

console.log(`\n${passed} passed`);
