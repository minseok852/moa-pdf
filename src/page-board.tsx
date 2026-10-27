import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragMoveEvent, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { PageCard, PageVisual } from './components';
import { useEditor } from './store';
import { reorderPages } from './editor-actions';
import type { PageItem, Settings } from './types';
export function PageBoard({ density, pages, settings, disabled, onCommit, onAdd, onPreview, onCrop, onRotate, onDelete, onMove, onNotice }: {
    density: 'compact' | 'normal' | 'large';
    pages: PageItem[];
    settings: Settings;
    disabled: boolean;
    onCommit: (pages: PageItem[]) => void;
    onAdd: () => void;
    onPreview: (id: string) => void;
    onCrop: (id: string) => void;
    onRotate: (id: string) => void;
    onDelete: (id: string) => void;
    onMove: (id: string, step: number) => void;
    onNotice: (message: string) => void;
}) {
    const { selected, select } = useEditor();
    const [moving, setMoving] = useState<string[]>([]), [slot, setSlot] = useState<number | null>(null), [highlighted, setHighlighted] = useState<string[]>([]);
    const movingRef = useRef<string[]>([]), boardRef = useRef<HTMLDivElement>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    useEffect(() => { if (!highlighted.length)
        return; const timer = setTimeout(() => setHighlighted([]), 1600); return () => clearTimeout(timer); }, [highlighted]);
    function dropSlot(event: DragMoveEvent) {
        if (!event.over)
            return null;
        const index = pages.findIndex(page => page.id === event.over!.id);
        if (index < 0 || movingRef.current.includes(String(event.over.id)))
            return null;
        const activator = event.activatorEvent;
        const pointer = 'clientX' in activator;
        const after = pointer ? Number((activator as PointerEvent).clientX) + event.delta.x > event.over.rect.left + event.over.rect.width / 2 : index > pages.findIndex(page => page.id === event.active.id);
        return index + (after ? 1 : 0);
    }
    function start(event: DragStartEvent) { const id = String(event.active.id), ids = selected.includes(id) ? pages.filter(page => selected.includes(page.id)).map(page => page.id) : [id]; movingRef.current = ids; setMoving(ids); setSlot(null); if (!selected.includes(id))
        select([id]); }
    function update(event: DragMoveEvent) { setSlot(dropSlot(event)); }
    function end(event: DragEndEvent) { const boundary = dropSlot(event), ids = movingRef.current; if (boundary !== null) {
        const next = reorderPages(pages, ids, boundary);
        if (next !== pages) {
            onCommit(next);
            setHighlighted(ids);
            onNotice(`${ids.length}쪽을 ${next.findIndex(page => ids.includes(page.id)) + 1}쪽 위치로 이동했습니다.`);
        }
    } movingRef.current = []; setMoving([]); setSlot(null); }
    const first = pages.find(page => page.id === moving[0]);
    return <DndContext sensors={sensors} collisionDetection={args => { const point = args.pointerCoordinates, box = boardRef.current?.getBoundingClientRect(); return point && box && (point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) ? [] : closestCenter(args); }} onDragStart={start} onDragMove={update} onDragOver={update} onDragEnd={end} onDragCancel={() => { movingRef.current = []; setMoving([]); setSlot(null); }} accessibility={{ screenReaderInstructions: { draggable: t("Space로 이동을 시작하고 방향키로 위치를 바꾼 뒤 Space로 놓으세요. Escape로 취소합니다.") }, announcements: { onDragStart: () => t("{0}쪽 이동을 시작했습니다.", [movingRef.current.length]), onDragOver: () => slot === null ? t("이동할 위치를 선택하세요.") : t("{0}쪽 앞에 놓습니다.", [slot + 1]), onDragEnd: () => t("페이지 이동을 마쳤습니다."), onDragCancel: () => t("페이지 이동을 취소했습니다.") } }}>
 <SortableContext items={pages.map(page => page.id)} strategy={rectSortingStrategy}><div ref={boardRef} className={'page-grid ' + density + ' ' + (disabled ? 'disabled-interactions' : '')}>
 {pages.map((page, index) => <div className={'page-cell' + (slot === index ? ' insert-before' : '') + (slot === pages.length && index === pages.length - 1 ? ' insert-after' : '')} key={page.id}>{slot === index && <span className="insertion-label">{t("여기에 놓기")}</span>}{slot === pages.length && index === pages.length - 1 && <span className="insertion-label at-end">{t("맨 뒤에 놓기")}</span>}<PageCard page={page} index={index} settings={settings} dragged={moving.includes(page.id)} highlighted={highlighted.includes(page.id)} onPreview={() => onPreview(page.id)} onCrop={() => onCrop(page.id)} onRotate={() => onRotate(page.id)} onDelete={() => onDelete(page.id)} onMove={step => onMove(page.id, step)}/></div>)}
 <button className="add-page-tile" disabled={disabled || moving.length > 0} onClick={onAdd}><Plus size={24}/><span>{t("페이지 더하기")}</span></button></div></SortableContext>
 <DragOverlay dropAnimation={null} zIndex={120}>{first && <div className="drag-preview"><div className="drag-count">{t("{0}쪽 이동 중", [moving.length])}</div><div className="drag-preview-page"><PageVisual page={first} settings={settings}/></div><span>{slot === null ? t("페이지 사이로 옮겨 놓으세요.") : slot === pages.length ? t("맨 뒤에 놓기") : t("{0}쪽 앞에 놓기", [slot + 1])}</span></div>}</DragOverlay>
 </DndContext>;
}
