import { t } from './i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Hand, ZoomOut, ZoomIn, Scan, Maximize } from 'lucide-react';
import { rotatedSize } from './image-edit';
type ViewSize = {
    scale: number;
    width: number;
    height: number;
};
export function ImageViewport({ width, height, children, initialPan = false, outputOnly = false }: {
    initialPan?: boolean;
    outputOnly?: boolean;
    width: number;
    height: number;
    children: (size: ViewSize) => ReactNode;
}) {
    const viewport = useRef<HTMLDivElement>(null), previous = useRef({ width: 0, height: 0 }), pan = useRef<{
        id: number;
        x: number;
        y: number;
        left: number;
        top: number;
    } | null>(null);
    const [size, setSize] = useState({ width: 650, height: 360 }), [zoom, setZoom] = useState(1), [panMode, setPanMode] = useState(initialPan);
    useEffect(() => { const node = viewport.current!; const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight })); observer.observe(node); return () => observer.disconnect(); }, []);
    const base = Math.min(Math.max(1, size.width - 48) / width, Math.max(1, size.height - 48) / height);
    const scale = base * zoom, planeWidth = width * scale, planeHeight = height * scale;
    const canvasWidth = Math.max(size.width, planeWidth + 48), canvasHeight = Math.max(size.height, planeHeight + 48);
    const widthZoom = Math.min(100, Math.max(1, (size.width - 48) / (width * base)));
    useLayoutEffect(() => { const node = viewport.current; if (!node)
        return; const old = previous.current; const x = old.width ? (node.scrollLeft + node.clientWidth / 2) / old.width : .5, y = old.height ? (node.scrollTop + node.clientHeight / 2) / old.height : .5; node.scrollLeft = x * canvasWidth - node.clientWidth / 2; node.scrollTop = y * canvasHeight - node.clientHeight / 2; previous.current = { width: canvasWidth, height: canvasHeight }; }, [canvasWidth, canvasHeight]);
    return <div className="image-editor-view"><div className="image-view-controls"><div><button type="button" className="button secondary" onClick={() => setZoom(Math.max(1, zoom / 1.5))} disabled={zoom <= 1} aria-label={t("미리보기 축소")}><ZoomOut size={17}/></button><output aria-label={t("미리보기 확대 배율")}>{t("{0}배", [zoom.toFixed(1)])}</output><button type="button" className="button secondary" onClick={() => setZoom(Math.min(100, zoom * 1.5))} disabled={zoom >= 100} aria-label={t("미리보기 확대")}><ZoomIn size={17}/></button></div><button type="button" className="button secondary" onClick={() => setZoom(1)}><Scan size={16}/>{t("전체 보기")}</button><button type="button" className="button secondary" onClick={() => setZoom(widthZoom)}><Maximize size={16}/>{t("너비 맞춤")}</button><button type="button" className={'button ' + (panMode ? 'primary' : 'secondary')} aria-pressed={panMode} onClick={() => setPanMode(!panMode)}><Hand size={16}/>{panMode ? t("화면 이동 중") : t("화면 이동")}</button></div>
 <div className={'edit-viewport' + (panMode ? ' panning' : '')} ref={viewport} tabIndex={0} aria-label={t("이미지 편집 화면. 확대 후 스크롤하거나 화면 이동 버튼으로 보이는 위치를 바꿀 수 있습니다.")} onPointerDownCapture={event => { if (!panMode || event.button !== 0)
        return; const node = event.currentTarget; pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop }; node.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation(); }} onPointerMoveCapture={event => { const active = pan.current; if (!active || active.id !== event.pointerId)
        return; event.currentTarget.scrollLeft = active.left + active.x - event.clientX; event.currentTarget.scrollTop = active.top + active.y - event.clientY; event.stopPropagation(); }} onPointerUpCapture={event => { if (pan.current?.id === event.pointerId) {
        pan.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        event.stopPropagation();
    } }} onPointerCancelCapture={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}><div className="edit-scroll-canvas" style={{ width: canvasWidth, height: canvasHeight }}>{children({ scale, width: planeWidth, height: planeHeight })}</div></div><p className="image-view-hint">{outputOnly ? t("확대해도 출력 크기는 바뀌지 않습니다.") : initialPan ? t("돋보기로 확대하고 끌거나 스크롤해 자세히 보세요. 자르기 버튼으로 바로 편집할 수 있어요.") : t("확대해도 원본과 출력 크기는 바뀌지 않습니다. 화면 이동을 끄면 선택 영역을 편집할 수 있어요.")}</p></div>;
}
export function OrientedImage({ url, width, height, rotation, scale, offset = { x: 0, y: 0 }, alt }: {
    url: string;
    width: number;
    height: number;
    rotation: number;
    scale: number;
    offset?: {
        x: number;
        y: number;
    };
    alt: string;
}) {
    const display = rotatedSize(width, height, rotation);
    return <div className="oriented-image" style={{ width: display.width * scale, height: display.height * scale, left: -offset.x * display.width * scale, top: -offset.y * display.height * scale }}><img src={url} draggable={false} alt={alt} style={{ width: width * scale, height: height * scale, transform: `translate(-50%,-50%) rotate(${rotation}deg)` }}/></div>;
}
