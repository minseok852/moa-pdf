import { t } from './i18n';
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { ArrowLeft, ArrowRight, Crop, Grip, Maximize2, MoreHorizontal, RotateCw, Trash2, X, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PageItem, Settings } from './types';
import { useEditor } from './store';
import { contentSize, paperSize, placement } from './layout';
import { readImage } from './files';
import { imagePrintResolution } from './image-edit';
export function IconButton({ icon: Icon, label, onClick, disabled = false }: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return <button type="button" className="icon-button" title={label} aria-label={label} onClick={onClick} disabled={disabled}><Icon size={17}/></button>;
}
export function PageVisual({ page, settings, imageUrl, large = false, renderSize }: {
    page: PageItem;
    settings: Settings;
    imageUrl?: string;
    large?: boolean;
    renderSize?: number;
}) {
    const ref = useRef<HTMLCanvasElement>(null), opts = { ...settings, ...page.settings };
    const pageNumber = useEditor(s => s.pages.findIndex(p => p.id === page.id) + 1);
    const size = contentSize(page), paper = paperSize(opts, size, page.kind);
    useEffect(() => {
        let alive = true;
        const draw = async () => {
            const image = await readImage(imageUrl ?? page.thumbnail);
            if (!alive)
                return;
            const canvas = ref.current!, scale = (renderSize ?? (large ? 1100 : 420)) / Math.max(paper.width, paper.height);
            canvas.width = Math.ceil(paper.width * scale);
            canvas.height = Math.ceil(paper.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const pos = placement(size, paper, opts.paper === 'original' || (page.kind === 'pdf' && opts.keepPdfSize) ? 0 : opts.margin, opts.fit);
            ctx.save();
            ctx.scale(scale, scale);
            ctx.beginPath();
            ctx.rect(pos.margin, pos.margin, pos.availableWidth, pos.availableHeight);
            ctx.clip();
            ctx.translate(paper.width / 2, paper.height / 2);
            ctx.rotate(page.rotation * Math.PI / 180);
            const sideways = page.rotation % 180 !== 0, w = sideways ? pos.height : pos.width, h = sideways ? pos.width : pos.height;
            const crop = page.crop ?? { x: 0, y: 0, width: 1, height: 1 };
            ctx.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, crop.width * image.naturalWidth, crop.height * image.naturalHeight, -w / 2, -h / 2, w, h);
            ctx.restore();
            if (settings.pageNumbers) {
                ctx.fillStyle = '#626571';
                ctx.font = (10 * scale) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(String(pageNumber), canvas.width / 2, canvas.height - 12 * scale);
            }
        };
        void draw().catch(() => { });
        return () => { alive = false; };
    }, [page, settings, imageUrl, large, renderSize, paper.width, paper.height, pageNumber]);
    return <canvas ref={ref} className="page-canvas" aria-label={t("{0} 출력 미리보기", [page.sourceName])} style={{ aspectRatio: paper.width / paper.height }}/>;
}
export function PageCard({ page, index, settings, onPreview, onCrop, onRotate, onDelete, onMove, dragged = false, highlighted = false }: {
    page: PageItem;
    index: number;
    settings: Settings;
    onPreview: () => void;
    onCrop: () => void;
    onRotate: () => void;
    onDelete: () => void;
    onMove: (n: number) => void;
    dragged?: boolean;
    highlighted?: boolean;
}) {
    const { selected, select, pages } = useEditor(), isSelected = selected.includes(page.id);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id: page.id });
    const ppi = imagePrintResolution(page, settings);
    const style: CSSProperties = { opacity: dragged || isDragging ? .35 : 1 };
    return <article ref={setNodeRef} style={style} className={'page-card' + (isSelected ? ' selected' : '') + (highlighted ? ' just-moved' : '')}>
  <div className="card-top" {...listeners}>
   <label className="check-label" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => select(isSelected ? selected.filter(id => id !== page.id) : [...selected, page.id])} aria-label={t("{0}쪽 선택", [(index + 1)])}/></label>
   <button type="button" ref={setActivatorNodeRef} className="drag-handle" {...attributes} aria-label={t("{0}쪽 상단을 잡아 이동", [(index + 1)])} title={t("상단을 잡고 끌어 순서를 바꾸세요")}><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="drag-caption">{t("잡아서 이동")}</span><Grip size={17}/></button>
  </div>
  <button className="page-stage" onClick={onPreview} aria-label={t("{0}쪽 확대 미리보기", [(index + 1)])}><PageVisual page={page} settings={settings}/><span className="zoom-hint"><Maximize2 size={14}/>{t("확대")}</span>{page.settings && Object.keys(page.settings).length > 0 && <span className="custom-badge">{t("개별 설정")}</span>}</button>
  <div className="card-description"><span className={'type-label ' + page.kind}>{page.kind === 'pdf' ? 'PDF' : 'IMG'}</span><span className="source-name" title={page.sourceName}>{page.sourceName}</span>{page.kind === 'pdf' && <span className="source-page">{t("원본 {0}쪽", [page.sourceIndex + 1])}</span>}</div>
  {ppi !== null && ppi < 149 && <div className="quality-notice" title={t("예상 출력 해상도 약 {0} DPI", [Math.round(ppi)])}><AlertTriangle size={14}/><span>{t("인쇄하면 흐릴 수 있어요")}</span></div>}
  <div className="card-bottom"><div className="card-primary-actions"><button className="text-action" onClick={onRotate} aria-label={t("{0}쪽 오른쪽 회전", [(index + 1)])}><RotateCw size={15}/>{t("회전")}</button><button className="text-action" onClick={onCrop} aria-label={t("{0}쪽 자르기", [(index + 1)])}><Crop size={15}/>{t("자르기")}</button><button className="text-action delete-action" onClick={onDelete} aria-label={t("{0}쪽 삭제", [(index + 1)])}><Trash2 size={15}/>{t("삭제")}</button></div><details className="card-more"><summary aria-label={t("{0}쪽 더 보기", [(index + 1)])}><MoreHorizontal size={16}/>{t("더 보기")}</summary><div className="card-menu"><button disabled={index === 0} onClick={event => { onMove(-1); event.currentTarget.closest('details')?.removeAttribute('open'); }}><ArrowLeft size={15}/>{t("앞으로 한 칸")}</button><button disabled={index === pages.length - 1} onClick={event => { onMove(1); event.currentTarget.closest('details')?.removeAttribute('open'); }}><ArrowRight size={15}/>{t("뒤로 한 칸")}</button></div></details></div>
 </article>;
}
export function Modal({ title, children, onClose, wide = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        ref.current?.focus();
        const listener = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
            if (e.key === 'Tab') {
                const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]');
                const els = Array.from(nodes ?? []).filter(node => node.getClientRects().length > 0 && !node.matches(':disabled'));
                if (!els.length)
                    return;
                const first = els[0], last = els[els.length - 1];
                if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', listener);
        const old = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', listener); document.body.style.overflow = old; previous?.focus(); };
    }, []);
    return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
        onClose(); }}><div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="modal-header"><h2>{title}</h2><IconButton icon={X} label={t("닫기")} onClick={onClose}/></div>{children}</div></div>;
}
