import { loadClassManifest, loadKnowledge } from '@farmassist/ai/manifest';
import { loadQuestions } from '@farmassist/ai/questions';
import { classifier } from '@farmassist/ai/classifier';
import { saveScanImage } from '../services/imageStore.service';
import * as scanService from '../services/scan.service';
import type { DiagnosisDeps } from './types';

let cached: DiagnosisDeps | null = null;

/** Real wiring. The classifier is read through its object on every call, so tests can stub it. */
export function realDeps(): DiagnosisDeps {
  cached ??= {
    manifest: loadClassManifest(),
    knowledge: loadKnowledge(),
    questions: loadQuestions(),
    classify: (bytes, mime) => classifier.classify(bytes, mime),
    saveImage: saveScanImage,
    findScanByMessage: scanService.findScanByMessage,
    createScan: scanService.createScanWith,
    getScan: scanService.getScanState,
    updateScan: scanService.updateScanState,
  };
  return cached;
}
