/// <reference lib="webworker" />
import { buildPdf } from './pdf-export';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = async (event) => {
  try {
    const { pages, sources, settings } = event.data;
    const bytes = await buildPdf(pages, sources, settings, n => worker.postMessage({ type: 'progress', value: n }));
    worker.postMessage({ type: 'done', bytes }, [bytes.buffer as ArrayBuffer]);
  } catch (e) { worker.postMessage({ type: 'error', message: e instanceof Error ? e.message : 'PDF 생성에 실패했습니다.' }); }
};
