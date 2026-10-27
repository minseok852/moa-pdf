import { t } from './i18n';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Crop, RotateCw, Settings2 } from 'lucide-react';
import { IconButton, Modal, PageVisual } from './components';
import { ImageViewport } from './image-viewport';
import { contentSize, paperSize } from './layout';
import { sourcePreview, readImage } from './files';
import type { PageItem, Settings, SourceFile } from './types';
export function PagePreviewDialog({ page, pages, sources, settings, onClose, onNavigate, onRotate, onCrop, onSettings }: {
    page: PageItem;
    pages: PageItem[];
    sources: Record<string, SourceFile>;
    settings: Settings;
    onClose: () => void;
    onNavigate: (id: string) => void;
    onRotate: () => void;
    onCrop: () => void;
    onSettings: () => void;
}) {
    const [loaded, setLoaded] = useState<{
        id: string;
        url: string;
    } | null>(null), [error, setError] = useState('');
    const index = pages.findIndex(item => item.id === page.id), paper = paperSize({ ...settings, ...page.settings }, contentSize(page), page.kind);
    const url = loaded?.id === page.id ? loaded.url : '';
    useEffect(() => { let alive = true; setError(''); const source = sources[page.sourceId]; void sourcePreview(source, page, 3000).then(async (url) => { await readImage(url); if (alive)
        setLoaded({ id: page.id, url }); }).catch(() => { if (alive)
        setError('큰 미리보기를 불러오지 못했습니다.'); }); return () => { alive = false; }; }, [page.id, page.sourceId, sources]);
    return <Modal title={t("{0}쪽 미리보기", [index + 1])} wide onClose={onClose}><div className="preview-meta"><span>{page.sourceName} {page.kind === 'pdf' ? t("· 원본 {0}쪽", [page.sourceIndex + 1]) : ''}</span><span>{Math.round(paper.width / 72 * 25.4)} × {Math.round(paper.height / 72 * 25.4)} mm</span></div>
 {error ? <p role="alert" className="inline-error">{t(error)}</p> : url ? <ImageViewport key={page.id} width={paper.width} height={paper.height} initialPan>{({ width, height }) => <div className="zoom-page-sheet" style={{ width, height }}><PageVisual page={page} settings={settings} imageUrl={url} large renderSize={Math.min(4096, Math.max(1100, Math.ceil(Math.max(width, height) * 1.5)))}/></div>}</ImageViewport> : <p role="status">{t("원본 미리보기를 준비하고 있습니다…")}</p>}
 <div className="modal-footer preview-footer"><div className="preview-edit-actions"><button className="button secondary" onClick={onRotate}><RotateCw size={16}/>{t("회전")}</button><button className="button primary" onClick={onCrop}><Crop size={16}/>{t("자르기")}</button><button className="button secondary" onClick={onSettings}><Settings2 size={16}/>{t("페이지 설정")}</button></div><div className="preview-nav"><IconButton icon={ChevronLeft} label={t("이전 페이지")} disabled={index === 0} onClick={() => onNavigate(pages[index - 1].id)}/><span>{index + 1} / {pages.length}</span><IconButton icon={ChevronRight} label={t("다음 페이지")} disabled={index === pages.length - 1} onClick={() => onNavigate(pages[index + 1].id)}/></div></div></Modal>;
}
export function OutputPreview({ url }: {
    url: string;
}) {
    const [size, setSize] = useState<{
        url: string;
        width: number;
        height: number;
    } | null>(null), [error, setError] = useState(false);
    useEffect(() => { let alive = true; setError(false); void readImage(url).then(image => { if (alive)
        setSize({ url, width: image.naturalWidth, height: image.naturalHeight }); }).catch(() => { if (alive)
        setError(true); }); return () => { alive = false; }; }, [url]);
    return error ? <p role="alert">{t("결과 미리보기를 불러오지 못했습니다. 다운로드하여 확인해 주세요.")}</p> : size?.url === url ? <ImageViewport key={url} width={size.width} height={size.height} initialPan outputOnly>{({ width, height }) => <img src={url} draggable={false} width={width} height={height} className="output-preview-image" alt={t("완성된 PDF 출력 미리보기")}/>}</ImageViewport> : <p role="status">{t("이미지 미리보기를 준비하고 있습니다…")}</p>;
}
