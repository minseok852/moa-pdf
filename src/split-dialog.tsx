import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Modal } from './components';
import { ImageViewport, OrientedImage } from './image-viewport';
import { useEditor } from './store';
import { sourcePreview, readImage } from './files';
import { contentSize } from './layout';
import { evenCuts, moveCut, rotateRect, splitCrops } from './image-edit';
import { LIMITS } from './types';
import type { PageItem } from './types';
export function SplitDialog({ page, onClose, onNotice }: {
    page: PageItem;
    onClose: () => void;
    onNotice: (value: string) => void;
}) {
    const [url, setUrl] = useState(''), [error, setError] = useState(''), [cuts, setCuts] = useState(() => evenCuts(2));
    const plane = useRef<HTMLDivElement>(null), drag = useRef<{
        index: number;
        id: number;
        original: number[];
    } | null>(null);
    const visible = rotateRect(page.crop ?? { x: 0, y: 0, width: 1, height: 1 }, page.rotation), size = contentSize(page);
    useEffect(() => { let alive = true; const source = useEditor.getState().sources[page.sourceId]; if (!source) {
        setError('원본 파일을 찾을 수 없습니다.');
        return;
    } void sourcePreview(source, page).then(async (value) => { await readImage(value); if (alive)
        setUrl(value); }).catch(() => { if (alive)
        setError('분할 미리보기를 불러오지 못했습니다.'); }); return () => { alive = false; }; }, [page.id]);
    function update(event: ReactPointerEvent) { const active = drag.current; if (!active || active.id !== event.pointerId)
        return; const box = plane.current!.getBoundingClientRect(); setCuts(current => moveCut(current, active.index, (event.clientY - box.top) / box.height)); }
    function finish(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) { const active = drag.current; if (!active || active.id !== event.pointerId)
        return; if (cancelled)
        setCuts(active.original);
    else
        update(event); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId); }
    function apply() { const editor = useEditor.getState(); if (editor.pages.length + cuts.length > LIMITS.pages) {
        setError('분할 후 총 페이지 수가 200쪽을 넘습니다.');
        return;
    } const parts = splitCrops(page, cuts).map(crop => ({ ...page, id: crypto.randomUUID(), crop })); editor.commit(editor.pages.flatMap(item => item.id === page.id ? parts : [item])); editor.select(parts.map(item => item.id)); onNotice(`${parts.length}쪽으로 나눴습니다.`); onClose(); }
    const boundaries = [0, ...cuts, 1];
    return <Modal title={t("긴 이미지 나누기")} wide onClose={onClose}><p className="modal-description">{t("이미지 위 분할선을 위아래로 옮겨 글자나 사진 사이에 맞추세요. 현재 자르기와 회전 상태를 그대로 반영합니다.")}</p><div className="split-top-controls"><label className="field-label" htmlFor="split-count">{t("나눌 페이지 수")}</label><select id="split-count" value={cuts.length + 1} onChange={event => setCuts(evenCuts(Number(event.target.value)))}>{Array.from({ length: 11 }, (_, i) => i + 2).map(count => <option key={count} value={count}>{t("{0}쪽", [count])}</option>)}</select><button className="button secondary" onClick={() => setCuts(evenCuts(cuts.length + 1))}>{t("균등하게 나누기")}</button></div>
 {error && <p className="inline-error" role="alert">{t(error)}</p>}{url ? <ImageViewport width={size.width} height={size.height}>{({ scale, width, height }) => <div className="split-image-plane" ref={plane} style={{ width, height }} onPointerMove={update} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { if (drag.current) {
        setCuts(drag.current.original);
        drag.current = null;
    } }}><div className="split-source-clip"><OrientedImage url={url} width={page.width} height={page.height} rotation={page.rotation} scale={scale} offset={visible} alt={t("{0} 분할 미리보기", [page.sourceName])}/></div>{boundaries.slice(0, -1).map((start, i) => <span className="split-page-number" key={i} style={{ top: `${(start + boundaries[i + 1]) / 2 * 100}%` }}>{t("{0}쪽", [i + 1])}</span>)}{cuts.map((cut, index) => <button type="button" className="split-cut-line" key={index} style={{ top: `${cut * 100}%` }} aria-label={t("{0}번째 분할선. 위아래 방향키로 조정", [index + 1])} onPointerDown={event => { if (!event.isPrimary || event.button !== 0)
        return; drag.current = { index, id: event.pointerId, original: cuts }; plane.current!.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); event.preventDefault(); }} onKeyDown={event => { if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
        return; event.preventDefault(); const delta = (event.key === 'ArrowUp' ? -1 : 1) * (event.shiftKey ? 10 : 1) / size.height; setCuts(current => moveCut(current, index, current[index] + delta)); }}><span>{t("{0} / {1}쪽 경계 · {2}%", [index + 1, index + 2, Math.round(cut * 1000) / 10])}</span></button>)}</div>}</ImageViewport> : !error && <p role="status">{t("이미지 미리보기를 준비하고 있습니다…")}</p>}
 <details className="split-numeric"><summary>{t("분할 위치를 숫자로 조절")}</summary><div>{cuts.map((cut, index) => <label key={index}>{t("{0}번째 경계 (%)", [index + 1])}<input type="number" className="text-input" min={((cuts[index - 1] ?? 0) + .002) * 100} max={((cuts[index + 1] ?? 1) - .002) * 100} step="0.1" value={Number((cut * 100).toFixed(2))} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value))
        setCuts(current => moveCut(current, index, value / 100)); }}/></label>)}</div></details><div className="modal-footer"><button className="button secondary" onClick={onClose}>{t("취소")}</button><button className="button primary" disabled={!url} onClick={apply}>{t("{0}쪽으로 나누기", [cuts.length + 1])}</button></div></Modal>;
}
