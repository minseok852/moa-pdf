import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Modal } from './components';
import { ImageViewport, OrientedImage } from './image-viewport';
import { rotatedSize, rotateRect } from './image-edit';
import { sourcePreview, readImage } from './files';
import { useEditor } from './store';
import { cropRatio, drawCrop, fitCropAspect, FULL_CROP, isFullCrop, moveCrop, normalizeCrop, resizeCrop } from './crop-geometry';
import type { CropHandle, CropPoint } from './crop-geometry';
import type { PageItem, Rect } from './types';
const HANDLES: {
    handle: CropHandle;
    label: string;
}[] = [{ handle: 'nw', label: '왼쪽 위' }, { handle: 'n', label: '위쪽' }, { handle: 'ne', label: '오른쪽 위' }, { handle: 'e', label: '오른쪽' }, { handle: 'se', label: '오른쪽 아래' }, { handle: 's', label: '아래쪽' }, { handle: 'sw', label: '왼쪽 아래' }, { handle: 'w', label: '왼쪽' }];
type Interaction = {
    pointerId: number;
    handle: CropHandle | 'move' | 'new';
    start: CropPoint;
    original: Rect;
    ratio?: number;
    startClient: CropPoint;
};
const percent = (value: number) => `${value * 100}%`;
export function CropDialog({ page, onClose }: {
    page: PageItem;
    onClose: () => void;
}) {
    const [url, setUrl] = useState(''), [error, setError] = useState(''), [ready, setReady] = useState(false);
    const [area, setArea] = useState<Rect>(() => rotateRect(normalizeCrop(page.crop ?? FULL_CROP), page.rotation));
    const [mode, setMode] = useState('free');
    const plane = useRef<HTMLDivElement>(null), interaction = useRef<Interaction | null>(null);
    const display = rotatedSize(page.width, page.height, page.rotation);
    const imageAspect = display.width / display.height;
    const ratio = cropRatio(mode === 'free' ? undefined : mode === 'original' ? imageAspect : Number(mode), imageAspect);
    useEffect(() => {
        let alive = true;
        const source = useEditor.getState().sources[page.sourceId];
        if (!source) {
            setError('원본 파일을 찾을 수 없습니다.');
            return;
        }
        void sourcePreview(source, page, 2600).then(async (value) => { await readImage(value); if (alive) {
            setUrl(value);
            setReady(true);
        } }).catch(() => { if (alive)
            setError('미리보기를 불러오지 못했습니다. 창을 닫고 다시 시도해 주세요.'); });
        return () => { alive = false; };
    }, [page.id]);
    function point(event: ReactPointerEvent): CropPoint {
        const box = plane.current!.getBoundingClientRect();
        return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
    }
    function begin(event: ReactPointerEvent<HTMLDivElement>) {
        if (!ready || interaction.current || !event.isPrimary || event.button !== 0)
            return;
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-crop-handle]');
        const handle = (target?.dataset.cropHandle ?? 'new') as Interaction['handle'];
        interaction.current = { pointerId: event.pointerId, handle, start: point(event), original: area, ratio, startClient: { x: event.clientX, y: event.clientY } };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        if (handle === 'move')
            event.currentTarget.querySelector<HTMLElement>('.crop-selection')?.focus({ preventScroll: true });
        else if (handle !== 'new')
            target?.focus({ preventScroll: true });
    }
    function update(event: ReactPointerEvent<HTMLDivElement>) {
        const active = interaction.current;
        if (!active || active.pointerId !== event.pointerId)
            return;
        const current = point(event), dx = current.x - active.start.x, dy = current.y - active.start.y;
        setArea(active.handle === 'new' ? drawCrop(active.start, current, active.ratio) : active.handle === 'move' ? moveCrop(active.original, dx, dy) : resizeCrop(active.original, active.handle, dx, dy, active.ratio));
    }
    function finish(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
        const active = interaction.current;
        if (!active || active.pointerId !== event.pointerId)
            return;
        if (cancelled || (active.handle === 'new' && Math.hypot(event.clientX - active.startClient.x, event.clientY - active.startClient.y) < 4))
            setArea(active.original);
        else
            update(event);
        interaction.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }
    function keyboard(event: KeyboardEvent<HTMLElement>, handle: CropHandle | 'move') {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
            return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 10 : 1, dx = event.key === 'ArrowLeft' ? -step / display.width : event.key === 'ArrowRight' ? step / display.width : 0, dy = event.key === 'ArrowUp' ? -step / display.height : event.key === 'ArrowDown' ? step / display.height : 0;
        setArea(current => handle === 'move' ? moveCrop(current, dx, dy) : resizeCrop(current, handle, dx, dy, ratio));
    }
    function apply() {
        if (!ready || area.width <= 0 || area.height <= 0)
            return;
        const editor = useEditor.getState(), crop = isFullCrop(area) ? undefined : normalizeCrop(rotateRect(area, -page.rotation));
        editor.commit(editor.pages.map(item => item.id === page.id ? { ...item, crop } : item));
        onClose();
    }
    const selectionStyle: CSSProperties = { left: percent(area.x), top: percent(area.y), width: percent(area.width), height: percent(area.height) };
    const units = page.kind === 'image' ? 'px' : 'mm', factor = page.kind === 'image' ? 1 : 25.4 / 72;
    const dimensions = `${Math.max(1, Math.round(display.width * area.width * factor))} × ${Math.max(1, Math.round(display.height * area.height * factor))} ${units}`;
    return <Modal title={t("페이지 자르기")} onClose={onClose} wide>
 <p className="modal-description crop-description">{t("모서리나 변을 잡아 크기를 조절하고, 선택 영역 안쪽을 끌어 위치를 옮기세요. 바깥쪽을 끌면 새 영역을 그릴 수 있어요.")}</p>
 <div className="free-crop-stage">{url && !error ? <ImageViewport width={display.width} height={display.height}>{({ scale, width, height }) => <div ref={plane} className="crop-image-plane" style={{ width, height }} onPointerDown={begin} onPointerMove={update} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { const active = interaction.current; if (active) {
                interaction.current = null;
                setArea(active.original);
            } }}>
  <OrientedImage url={url} width={page.width} height={page.height} rotation={page.rotation} scale={scale} alt={t("{0} 자르기 원본", [page.sourceName])}/>
  {ready && <><div className="crop-mask" style={{ inset: `0 0 ${percent(1 - area.y)} 0` }}/><div className="crop-mask" style={{ inset: `${percent(area.y + area.height)} 0 0 0` }}/><div className="crop-mask" style={{ left: 0, top: percent(area.y), width: percent(area.x), height: percent(area.height) }}/><div className="crop-mask" style={{ left: percent(area.x + area.width), top: percent(area.y), right: 0, height: percent(area.height) }}/>
  <div className="crop-selection" data-crop-handle="move" style={selectionStyle} role="group" aria-label={t("자르기 선택 영역. 방향키로 이동, Shift와 함께 누르면 크게 이동")} tabIndex={0} onKeyDown={event => keyboard(event, 'move')}><div className="crop-thirds" aria-hidden="true"><i /><i /><i /><i /></div>{HANDLES.map(({ handle, label }) => <button type="button" className={'crop-resize-handle handle-' + handle} key={handle} data-crop-handle={handle} aria-label={t("{0} 자르기 크기 조절", [label])} title={t("{0} 크기 조절 · 방향키 사용 가능", [label])} onKeyDown={event => keyboard(event, handle)}><span /></button>)}</div></>}
 </div>}</ImageViewport> : <span className={error ? 'crop-error' : ''} role={error ? 'alert' : 'status'}>{t(error) || t("원본 미리보기를 준비하고 있습니다…")}</span>}</div>
 <div className="free-crop-controls"><div className="crop-ratio-control"><label className="field-label" htmlFor="crop-ratio">{t("비율 고정")}</label><select id="crop-ratio" value={mode} disabled={!ready} onChange={event => { const value = event.target.value; setMode(value); setArea(current => fitCropAspect(current, cropRatio(value === 'free' ? undefined : value === 'original' ? imageAspect : Number(value), imageAspect))); }}><option value="free">{t("자유 자르기")}</option><option value="original">{t("원본 비율")}</option><option value="1">{t("정사각형 · 1:1")}</option><option value={210 / 297}>{t("A4 세로 비율")}</option><option value={297 / 210}>{t("A4 가로 비율")}</option></select></div>
 <div className="crop-size-control"><label className="field-label" htmlFor="crop-width">{t("선택 너비 (%)")}</label><input id="crop-width" className="text-input" aria-label={t("선택 영역 너비 백분율")} type="number" min="0.01" max="100" step="0.1" value={Number((area.width * 100).toFixed(2))} disabled={!ready} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && value > 0)
        setArea(current => resizeCrop(current, 'e', Math.min(1, value / 100) - current.width, 0, ratio)); }}/></div>
 <div className="crop-size-control"><label className="field-label" htmlFor="crop-height">{t("선택 높이 (%)")}</label><input id="crop-height" className="text-input" aria-label={t("선택 영역 높이 백분율")} type="number" min="0.01" max="100" step="0.1" value={Number((area.height * 100).toFixed(2))} disabled={!ready} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && value > 0)
        setArea(current => resizeCrop(current, 's', 0, Math.min(1, value / 100) - current.height, ratio)); }}/></div></div>
 <div className="crop-info"><span>{t("선택 영역")}{' '}<strong>{dimensions}</strong></span><span>{t("현재 보이는 방향으로 편집 · 비율 선택은 용지 크기를 바꾸지 않아요.")}</span></div><p className="crop-keyboard-hint">{t("선택 영역이나 조절점에 초점을 둔 뒤 방향키로 조절할 수 있습니다. Shift를 함께 누르면 10배씩 움직여요.")}</p>
 <div className="modal-footer crop-footer"><button className="button secondary" disabled={!ready} onClick={() => { setMode('free'); setArea({ ...FULL_CROP }); }}>{t("전체 선택")}</button><div><button className="button secondary" onClick={onClose}>{t("취소")}</button><button className="button primary" disabled={!ready || area.width <= 0 || area.height <= 0} onClick={apply}>{t("자르기 적용")}</button></div></div>
 </Modal>;
}
