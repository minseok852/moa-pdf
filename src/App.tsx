import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { PagePreviewDialog, OutputPreview } from './preview-dialog';
import { LanguageSelector, useLocale, t } from './i18n';
import { CropDialog } from './crop-dialog';
import { SplitDialog } from './split-dialog';
import { useWorkspaceBackup } from './use-workspace-backup';
import { pdfFilename, renderSettingsKey } from './image-edit';
import { ArrowDownToLine, ArrowDownUp, ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, FileImage, Files, FileText, FolderPlus, HelpCircle, LoaderCircle, LockKeyhole, Mail, Plus, Redo2, RotateCw, Scissors, Settings2, ShieldCheck, Trash2, Undo2, X } from 'lucide-react';
import { IconButton, Modal } from './components';
import { PageBoard } from './page-board';
import { SettingsFields, IndividualSettingsDialog } from './settings';
import { useEditor } from './store';
import { importFile, prepareImage, renderPdfPage, clearPdfCache, releasePdfDocument } from './files';
import { modRotation } from './layout';
import { LIMITS } from './types';
import type { ExportPage, PageItem, Settings, SourceFile } from './types';
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));
type Result = {
    url: string;
    bytes: number;
    count: number;
    name: string;
};
type Busy = {
    label: string;
    progress: number;
    kind: 'import' | 'export';
};
export default function App() {
    const locale = useLocale();
    const { pages, sources, selected, past, future, settings, commit, configure, add, select, undo, redo, reset } = useEditor();
    const input = useRef<HTMLInputElement>(null), cancel = useRef(false), worker = useRef<Worker | null>(null), insertingAt = useRef<number | undefined>(undefined), locked = useRef(false);
    const [busy, setBusy] = useState<Busy | null>(null), [errors, setErrors] = useState<string[]>([]), [notice, setNotice] = useState(''), [draggingFiles, setDraggingFiles] = useState(false), [preview, setPreview] = useState<string | null>(null), [cropId, setCropId] = useState<string | null>(null), [individual, setIndividual] = useState(false), [moveOpen, setMoveOpen] = useState(false), [destination, setDestination] = useState(1), [splitOpen, setSplitOpen] = useState(false), [help, setHelp] = useState(false), [clearOpen, setClearOpen] = useState(false), [result, setResult] = useState<Result | null>(null), [generatedPreview, setGeneratedPreview] = useState<string | null>(null), [outputIndex, setOutputIndex] = useState(0);
    const outputRequest = useRef(0);
    const [cropReturnId, setCropReturnId] = useState<string | null>(null);
    const backup = useWorkspaceBackup();
    const [density, setDensity] = useState<'compact' | 'normal' | 'large'>('normal');
    const [mobileSettings, setMobileSettings] = useState(false), [deleteHistory, setDeleteHistory] = useState<typeof past | null>(null);
    const current = pages.find(p => p.id === preview), cropPage = pages.find(p => p.id === cropId), chosen = pages.filter(p => selected.includes(p.id));
    const canUndoDelete = notice.includes('삭제했습니다') && deleteHistory === past && past.length > 0;
    const renderKey = renderSettingsKey(settings);
    const totalBytes = Object.values(sources).reduce((n, f) => n + f.bytes.length, 0);
    useEffect(() => { if (!notice)
        return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
    useEffect(() => { outputRequest.current++; setResult(r => { if (r) {
        releasePdfDocument(r.url);
        URL.revokeObjectURL(r.url);
    } return null; }); setGeneratedPreview(null); }, [pages, renderKey]);
    useEffect(() => { setResult(previous => previous ? { ...previous, name: pdfFilename(settings.filename) } : previous); }, [settings.filename]);
    useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input,select,textarea,[role="dialog"]'))
        return; if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (!locked.current && !backup.restoring) {
                e.shiftKey ? redo() : undo();
            }
        }
        if (e.key.toLowerCase() === 'a') {
            e.preventDefault();
            select(pages.map(p => p.id));
        }
    } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [pages, undo, redo, backup.restoring]);
    useEffect(() => { const unload = (e: BeforeUnloadEvent) => { if (useEditor.getState().pages.length) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload); }, []);
    async function importFiles(files: File[]) {
        if (!files.length || locked.current || backup.restoring)
            return;
        locked.current = true;
        cancel.current = false;
        setErrors([]);
        let accepted: PageItem[] = [], acceptedSources: SourceFile[] = [], bytes = totalBytes;
        const failed: string[] = [];
        for (let i = 0; i < files.length; i++) {
            if (cancel.current)
                break;
            const f = files[i];
            setBusy({ kind: 'import', label: `${f.name} 불러오는 중 · ${i + 1}/${files.length}`, progress: i / files.length });
            await nextFrame();
            try {
                if (f.size > LIMITS.fileBytes)
                    throw new Error('파일당 40 MB를 초과했습니다.');
                if (bytes + f.size > LIMITS.totalBytes)
                    throw new Error('전체 원본 용량 120 MB를 초과했습니다.');
                const imported = await importFile(f);
                if (pages.length + accepted.length + imported.pages.length > LIMITS.pages) {
                    releasePdfDocument(imported.source.id);
                    if (imported.source.url)
                        URL.revokeObjectURL(imported.source.url);
                    throw new Error('총 200쪽까지만 추가할 수 있습니다.');
                }
                accepted.push(...imported.pages);
                acceptedSources.push(imported.source);
                bytes += f.size;
            }
            catch (e) {
                failed.push(`${f.name}: ${e instanceof Error ? e.message : '파일을 읽을 수 없습니다.'}`);
            }
        }
        if (accepted.length)
            add(accepted, acceptedSources, insertingAt.current);
        insertingAt.current = undefined;
        setErrors(failed);
        setBusy(null);
        locked.current = false;
        if (accepted.length)
            setNotice(`${accepted.length}쪽을 추가했습니다.${cancel.current ? ' 남은 파일은 취소했습니다.' : ''}`);
    }
    function chooseFiles(at?: number) { insertingAt.current = at; input.current?.click(); }
    function rotate(ids: string[]) { commit(pages.map(p => ids.includes(p.id) ? { ...p, rotation: modRotation(p.rotation + 90) } : p)); }
    function remove(ids: string[]) { const count = pages.filter(p => ids.includes(p.id)).length; commit(pages.filter(p => !ids.includes(p.id))); setDeleteHistory(useEditor.getState().past); setNotice(`${count}쪽을 삭제했습니다.`); }
    function move(id: string, step: number) { const index = pages.findIndex(p => p.id === id), to = index + step; if (to >= 0 && to < pages.length)
        commit(arrayMove(pages, index, to)); }
    function moveSelected() { const moving = chosen, rest = pages.filter(p => !selected.includes(p.id)); const at = Math.max(0, Math.min(rest.length, destination - 1)); commit([...rest.slice(0, at), ...moving, ...rest.slice(at)]); setMoveOpen(false); }
    async function exportPdf() {
        if (!pages.length || locked.current)
            return;
        setMobileSettings(false);
        locked.current = true;
        cancel.current = false;
        setErrors([]);
        setBusy({ kind: 'export', label: '이미지 준비 중', progress: 0 });
        try {
            const prepared: ExportPage[] = [];
            for (let i = 0; i < pages.length; i++) {
                if (cancel.current)
                    throw new Error('CANCELLED');
                const p = pages[i];
                setBusy({ kind: 'export', label: `이미지 준비 중 · ${i + 1}/${pages.length}`, progress: i / pages.length * .35 });
                await nextFrame();
                if (p.kind === 'image') {
                    const image = await prepareImage(sources[p.sourceId], p, settings.quality);
                    prepared.push({ ...p, imageBytes: image.bytes, imageMime: image.mime });
                }
                else
                    prepared.push(p);
            }
            if (cancel.current)
                throw new Error('CANCELLED');
            const bytes = await new Promise<Uint8Array>((resolve, reject) => { const w = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }); worker.current = w; w.onmessage = e => { if (e.data.type === 'progress')
                setBusy({ kind: 'export', label: 'PDF 페이지를 묶는 중', progress: .35 + e.data.value * .65 }); if (e.data.type === 'done')
                resolve(e.data.bytes); if (e.data.type === 'error')
                reject(new Error(e.data.message)); }; w.onerror = () => reject(new Error('PDF 생성 중 오류가 발생했습니다. 파일 수를 줄여 다시 시도해 주세요.')); const used = Object.fromEntries([...new Set(pages.filter(p => p.kind === 'pdf').map(p => p.sourceId))].map(id => [id, sources[id]])); for (const p of pages.filter(p => p.kind === 'image'))
                used[p.sourceId] = { ...sources[p.sourceId], bytes: new Uint8Array() }; w.postMessage({ pages: prepared, sources: used, settings }); (w as Worker & {
                cancel?: () => void;
            }).cancel = () => reject(new Error('CANCELLED')); });
            const name = pdfFilename(settings.filename);
            const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
            setResult(r => { if (r) {
                releasePdfDocument(r.url);
                URL.revokeObjectURL(r.url);
            } return { url, bytes: bytes.length, count: pages.length, name }; });
            setNotice('PDF가 준비되었습니다. 결과를 확인하고 내려받으세요.');
        }
        catch (e) {
            if (e instanceof Error && e.message === 'CANCELLED')
                setNotice('PDF 생성을 취소했습니다.');
            else
                setErrors([e instanceof Error ? e.message : 'PDF 생성에 실패했습니다.']);
        }
        finally {
            worker.current?.terminate();
            worker.current = null;
            setBusy(null);
            locked.current = false;
        }
    }
    function cancelOperation() { cancel.current = true; if (worker.current) {
        (worker.current as Worker & {
            cancel?: () => void;
        }).cancel?.();
        worker.current.terminate();
        worker.current = null;
    } }
    function closeOutputPreview(){ outputRequest.current++; setGeneratedPreview(null); }
    async function inspectOutput(index:number){
        if(!result)return;
        const request=++outputRequest.current;
        setOutputIndex(index);setGeneratedPreview('loading');
        try{
            const bytes=new Uint8Array(await (await fetch(result.url)).arrayBuffer());
            if(request!==outputRequest.current)return;
            const source:SourceFile={id:result.url,name:result.name,bytes,kind:'pdf',mime:'application/pdf'};
            const image=await renderPdfPage(source,index,1400);
            if(request===outputRequest.current)setGeneratedPreview(image.url);
        }catch{
            if(request!==outputRequest.current)return;
            setGeneratedPreview(null);setNotice('결과 미리보기를 불러오지 못했습니다. 다운로드하여 확인해 주세요.');
        }
    }
    async function demo() { const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib'); const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica); for (let i = 0; i < 2; i++) {
        const p = doc.addPage([420, 595]);
        p.drawRectangle({ x: 0, y: 0, width: 420, height: 595, color: rgb(.96, .97, .95) });
        p.drawRectangle({ x: 30, y: 510, width: 50, height: 5, color: rgb(.2, .4, .25) });
        p.drawText(i ? 'Project notes' : 'A little collection', { x: 30, y: 460, size: 25, font, color: rgb(.15, .23, .18) });
        p.drawText('MOA PDF / SAMPLE ' + (i + 1), { x: 30, y: 430, size: 11, font });
        for (let j = 0; j < 6; j++)
            p.drawRectangle({ x: 30, y: 370 - j * 32, width: j % 2 ? 250 : 350, height: 7, color: rgb(.79, .83, .79) });
        if (i === 1)
            p.setRotation(degrees(90));
    } const pdf = await doc.save(); const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1100; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#efe4d0'; ctx.fillRect(0, 0, 900, 1100); ctx.fillStyle = '#cbd0b6'; ctx.beginPath(); ctx.arc(450, 470, 290, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#53664c'; ctx.beginPath(); ctx.moveTo(140, 800); ctx.lineTo(460, 260); ctx.lineTo(780, 800); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '50px serif'; ctx.fillText('Small things, together.', 160, 960); const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png')); await importFiles([new File([blob], t('작은-기록.png'), { type: 'image/png' }), new File([pdf.buffer as ArrayBuffer], t('프로젝트-노트.pdf'), { type: 'application/pdf' })]); }
    const activeSourceIds = new Set(pages.map(page => page.sourceId));
    const sampleCount = activeSourceIds.size;
    const activeBytes = Object.values(sources).filter(source => activeSourceIds.has(source.id)).reduce((sum, source) => sum + source.bytes.length, 0);
    const customCount = pages.filter(page => page.settings && Object.keys(page.settings).length > 0).length;
    const settingsContent = <><div className="settings-header"><div className="settings-title"><Settings2 size={18}/><h2>{t("전체 기본 설정")}</h2></div><span>{customCount ? t("개별 설정 {0}쪽은 해당 설정 우선", [customCount]) : t("개별 설정이 없는 페이지에 적용")}</span>{customCount > 0 && <button className="reset-page-settings" disabled={!!busy} onClick={() => { commit(pages.map(page => ({ ...page, settings: undefined }))); setNotice('모든 페이지가 전체 기본 설정을 따릅니다.'); }}>{t("모든 페이지에 기본 설정 적용")}</button>}</div><fieldset disabled={!!busy} className="settings-fields"><SettingsFields value={settings} onChange={patch => configure({ ...settings, ...patch })}/><div className="settings-divider"/><div className="setting-block"><label className="field-label" htmlFor="quality">{t("이미지 화질")}</label><select id="quality" value={settings.quality} onChange={e => configure({ ...settings, quality: e.target.value as Settings['quality'] })}><option value="original">{t("최상 · 원본 해상도 유지")}</option><option value="balanced">{t("균형 · 선명도와 용량 사이")}</option><option value="small">{t("작게 · 파일 용량 우선")}</option></select><p className="field-hint">{t("이미지에만 적용됩니다. PDF 본문은 유지해요.")}</p></div><label className="toggle-row"><span><strong>{t("페이지 번호 넣기")}</strong><small>{t("하단 가운데에 1, 2, 3…")}</small></span><input type="checkbox" checked={settings.pageNumbers} onChange={e => configure({ ...settings, pageNumbers: e.target.checked })}/></label><div className="settings-divider"/><div className="setting-block filename-block"><label className="field-label" htmlFor="filename">{t("파일 이름")}</label><div className="filename-input"><input id="filename" maxLength={100} value={settings.filename} onChange={e => configure({ ...settings, filename: e.target.value })}/><span>.pdf</span></div></div></fieldset>
 <div className="export-area">{result ? <div className="result-card"><div><span className="success-circle"><Check size={14}/></span><strong>{t("PDF 완성")}</strong><span>{t("{0}쪽 · {1}", [result.count, formatBytes(result.bytes)])}</span></div><strong className="result-filename">{result.name}</strong><button className="button secondary" onClick={() => void inspectOutput(0)}>{t("완성된 PDF 확인")}</button><a className="button primary" href={result.url} download={result.name}><ArrowDownToLine size={17}/>{t("PDF 다운로드")}</a></div> : <><button className="button primary export-button" disabled={!pages.length || !!busy} onClick={() => void exportPdf()}>{busy?.kind === 'export' ? <LoaderCircle size={17} className="spin"/> : <ArrowDownToLine size={18}/>}{t("PDF 만들기")}<span>{t("{0}쪽", [pages.length])}</span></button><p>{t("원본 파일은 변경되지 않습니다.")}</p></>}</div></>;
    return <div className="app-shell" onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        setDraggingFiles(true);
    } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node))
        setDraggingFiles(false); }} onDrop={e => { if ([...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        setDraggingFiles(false);
        void importFiles([...e.dataTransfer.files]);
    } }}>
 <input ref={input} type="file" accept=".png,.jpg,.jpeg,.pdf" multiple hidden onChange={(e: ChangeEvent<HTMLInputElement>) => { void importFiles([...(e.target.files ?? [])]); e.target.value = ''; }}/>
 <header className="site-header"><a className="brand" href="./" aria-label={t("모아 PDF 홈")}><span className="brand-mark"><Files size={22} strokeWidth={1.8}/></span><span>{t("모아")}<span className="brand-pdf">PDF</span></span></a><div className="header-center"><span className="live-dot"/>{t("작은 파일들이, 하나의 문서로.")}</div><div className="header-actions"><LanguageSelector /><span className="local-badge"><LockKeyhole size={13}/>{t("내 기기에서 안전하게")}</span><button className="help-button" onClick={() => setHelp(true)}><HelpCircle size={18}/><span>{t("사용 방법")}</span></button></div></header>
 <main className={'main' + (pages.length ? ' editing-workspace' : '')}><section className={'intro' + (pages.length ? ' editing-intro' : '')}><div><div className="eyebrow"><span /> YOUR PAGES, YOUR WAY</div><h1>{pages.length ? <>{t("문서 편집")}{' '}<span>{t("{0}쪽", [pages.length])}</span></> : <>{t("흩어진 페이지를")}{' '}<span>{t("한곳에, 모아.")}</span></>}</h1><p>{pages.length ? t("페이지를 정리하고 출력 모양을 확인하세요.") : <>{t("사진과 PDF를 올리고, 순서를 정리하세요.")}<br className="mobile-break"/>{' '}{t("나만의 문서가 간단하게 완성됩니다.")}</>}</p></div><div className="intro-note"><ShieldCheck size={21}/><div><strong>{t("파일은 이 기기에만 머물러요")}</strong><span>{t("서버 전송 없이 브라우저에서 처리합니다.")}</span></div></div></section>
 <section className="backup-bar" aria-label={t("이 기기에 작업 저장")}><div><label><input type="checkbox" checked={backup.enabled} disabled={!backup.ready || !!busy || backup.restoring} onChange={event => backup.toggle(event.target.checked)}/>{t("이 기기에 작업 임시 저장")}</label><span role="status">{t(backup.status) || (backup.enabled ? t("파일을 추가하면 자동 저장합니다.") : t("선택하면 파일과 편집 내용을 이 기기에 저장합니다."))}</span></div><div>{backup.info && <><span className="saved-info">{t("저장본 {0}쪽 · {1}", [backup.info.pageCount, new Date(backup.info.savedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')])}</span>{!pages.length && !past.length && <button className="button secondary" disabled={!!busy || backup.restoring} onClick={() => void backup.restore()}>{backup.restoring ? t("복구 중…") : t("저장한 작업 복구")}</button>}<button className="button secondary" disabled={!!busy || backup.restoring} onClick={() => void backup.removeSaved()}>{t("저장본 삭제")}</button></>}</div></section>
 <div className="workspace"><section className="editor-panel" aria-label={t("페이지 편집")}><div className="editor-header"><div><h2>{t("내 페이지")}<span>{pages.length}</span></h2><p>{pages.length ? t("{0}개 파일 · 원본 {1}", [sampleCount, formatBytes(activeBytes)]) : t("사진과 PDF를 자유롭게 섞어보세요.")}</p></div><button className="button secondary add-button" onClick={() => chooseFiles()} disabled={!!busy || backup.restoring}><Plus size={17}/>{t("파일 추가")}</button></div>
 <div className="editor-body" inert={!!busy}>
 {errors.length > 0 && <div className="error-box" role="alert"><div><strong>{t("일부 파일을 처리하지 못했습니다")}</strong><IconButton icon={X} label={t("오류 닫기")} onClick={() => setErrors([])}/></div>{errors.map((e, i) => <p key={i}>{t(e)}</p>)}<small>{t("해당 파일을 바꾸거나 제외하고 계속할 수 있습니다.")}</small></div>}
 <div className="toolbar"><label className="select-all"><input type="checkbox" aria-label={t("전체 페이지 선택")} checked={pages.length > 0 && selected.length === pages.length} disabled={!pages.length || !!busy} onChange={() => select(selected.length === pages.length ? [] : pages.map(p => p.id))}/><span>{selected.length ? t("{0}쪽 선택", [selected.length]) : t("전체 선택")}</span></label><div className="history-buttons"><IconButton icon={Undo2} label={t("실행 취소 (Ctrl+Z)")} onClick={undo} disabled={!past.length || !!busy}/><IconButton icon={Redo2} label={t("다시 실행 (Ctrl+Shift+Z)")} onClick={redo} disabled={!future.length || !!busy}/></div><select aria-label={t("썸네일 크기")} className="density-select" value={density} onChange={event => setDensity(event.target.value as typeof density)}><option value="compact">{t("작은 썸네일")}</option><option value="normal">{t("보통 썸네일")}</option><option value="large">{t("큰 썸네일")}</option></select><select aria-label={t("페이지 정렬")} className="sort-select" value="" disabled={!pages.length || !!busy} onChange={e => { if (e.target.value === 'reverse')
        commit([...pages].reverse());
    else
        commit([...pages].sort((a, b) => a.sourceName.localeCompare(b.sourceName, locale, { numeric: true }) || a.sourceIndex - b.sourceIndex)); }}><option value="" disabled>{t("정렬 방식")}</option><option value="name">{t("파일명 · 숫자순")}</option><option value="reverse">{t("현재 순서 뒤집기")}</option></select></div>
 {!pages.length ? <><button className={'dropzone ' + (draggingFiles ? 'dragging' : '')} disabled={!!busy || backup.restoring} onClick={() => chooseFiles()}><div className="upload-illustration"><span className="back-paper"><FileText size={30}/></span><span className="front-paper"><FileImage size={33}/></span><span className="upload-plus"><Plus size={18}/></span></div><strong>{t("파일을 여기에 놓아주세요")}</strong><span>{t("또는 클릭해서 파일 선택")}</span><span className="file-types"><b>PNG</b><b>JPG</b><b>PDF</b></span><small>{t("파일당 40 MB · 전체 120 MB · 최대 200쪽")}</small></button><div className="demo-row"><span>{t("먼저 가볍게 둘러볼까요?")}</span><button onClick={() => void demo()} disabled={!!busy || backup.restoring}>{t("샘플로 시작하기")}<ArrowRight size={14}/></button></div><div className="steps"><div><span>01</span><strong>{t("파일 모으기")}</strong><p>{t("사진과 PDF를 한 번에")}</p></div><div><span>02</span><strong>{t("내 방식으로 정리")}</strong><p>{t("순서, 회전, 크기까지")}</p></div><div><span>03</span><strong>{t("하나의 PDF로")}</strong><p>{t("확인하고 내려받기")}</p></div></div></> : <>

 <fieldset className="selection-toolbar" disabled={!selected.length || !!busy} aria-label={t("선택한 페이지 작업")}><button onClick={() => rotate(selected)}><RotateCw size={15}/>{t("회전")}</button><button onClick={() => setIndividual(true)}><Settings2 size={15}/>{t("페이지 설정")}</button><button onClick={() => { setDestination(1); setMoveOpen(true); }}><ArrowDownUp size={15}/>{t("이동")}</button><button onClick={() => chooseFiles(pages.findIndex(p => selected.includes(p.id)))}><FolderPlus size={15}/>{t("앞에 삽입")}</button><button disabled={chosen.length !== 1 || chosen[0]?.kind !== 'image'} onClick={() => setSplitOpen(true)} title={t("사진 한 장을 선택하면 나눌 수 있어요")}><Scissors size={15}/>{t("분할")}</button><button className="danger-text" onClick={() => remove(selected)}><Trash2 size={15}/>{t("삭제")}</button><button onClick={() => select([])} aria-label={t("선택 해제")}><X size={15}/></button></fieldset>
 <PageBoard density={density} pages={pages} settings={settings} disabled={!!busy} onCommit={commit} onAdd={() => chooseFiles()} onPreview={setPreview} onCrop={setCropId} onRotate={id => rotate([id])} onDelete={id => remove([id])} onMove={move} onNotice={setNotice}/><div className="editor-bottom"><span><CheckCheck size={14}/>{t("카드 상단을 잡아 이동 · 사진을 누르면 확대")}</span><button onClick={() => setClearOpen(true)} disabled={!!busy}>{t("모두 비우기")}</button></div></>}
 </div><div className="editor-footnote"><LockKeyhole size={13}/><span>{backup.enabled ? (backup.writing ? t("저장 중에는 창을 닫지 마세요.") : t("자동 저장 상태를 확인하고 창을 닫으세요. 브라우저 저장 공간을 지우면 저장본도 삭제됩니다.")) : t("새로고침하거나 창을 닫으면 작업 내용이 사라집니다.")}</span></div></section>
 <aside className="settings-panel" aria-label={t("전체 기본 설정")}>{!mobileSettings && settingsContent}</aside></div>
 <footer><span className="footer-logo">{t("모아PDF")}</span><span>{t("꼭 필요한 페이지를, 가장 간단하게.")}</span><a className="footer-contact" href="mailto:min85296@gmail.com"><Mail size={15} aria-hidden="true"/><span>{t("문의·피드백")}</span><span className="contact-email">min85296@gmail.com</span></a><span className="footer-tag">MADE FOR YOUR EVERYDAY DOCUMENTS</span></footer></main>
 <div className="mobile-action-bar"><div><strong>{t("총 {0}쪽", [pages.length])}</strong><span>{result ? formatBytes(result.bytes) : selected.length ? t("{0}쪽 선택", [selected.length]) : t("편집 후 PDF로 저장")}</span></div><button className="button secondary" onClick={() => setMobileSettings(true)} disabled={!!busy}><Settings2 size={17}/>{t("설정")}</button>{result ? <a className="button primary" href={result.url} download={result.name}><ArrowDownToLine size={17}/>{t("다운로드")}</a> : <button className="button primary" disabled={!pages.length || !!busy} onClick={() => void exportPdf()}><ArrowDownToLine size={17}/>{t("PDF 만들기")}</button>}</div>
 {mobileSettings && <Modal title={t("전체 기본 설정")} onClose={() => setMobileSettings(false)}>{settingsContent}<div className="modal-footer"><button className="button secondary" onClick={() => setMobileSettings(false)}>{t("편집으로 돌아가기")}</button></div></Modal>}
 {draggingFiles && <div className="drop-overlay"><Files size={48}/><strong>{t("여기에 놓으면 추가됩니다")}</strong><span>PNG · JPG · JPEG · PDF</span></div>}
 {notice && <div className="toast" role="status"><Check size={17}/><span>{t(notice)}</span>{canUndoDelete && <button onClick={() => { undo(); setDeleteHistory(null); setNotice('삭제한 페이지를 복구했습니다.'); }} disabled={!!busy}>{t("되돌리기")}</button>}</div>}
 {busy && <div className="busy-panel" role="status"><LoaderCircle size={19} className="spin"/><div><strong>{t(busy.label)}</strong><progress max="1" value={busy.progress}/></div><button onClick={cancelOperation}>{t("취소")}</button></div>}
 {current && <PagePreviewDialog page={current} pages={pages} sources={sources} settings={settings} onClose={() => setPreview(null)} onNavigate={setPreview} onRotate={() => rotate([current.id])} onCrop={() => { setCropReturnId(current.id); setPreview(null); setCropId(current.id); }} onSettings={() => { select([current.id]); setPreview(null); setIndividual(true); }}/>}
 {cropPage && <CropDialog page={cropPage} onClose={() => { setCropId(null); if (cropReturnId) {
        setPreview(cropReturnId);
        setCropReturnId(null);
    } }}/>}
 {individual && chosen.length > 0 && <IndividualSettingsDialog pages={pages} settings={settings} selected={selected} onApply={commit} onClose={() => setIndividual(false)}/>}
 {moveOpen && <Modal title={t("선택한 페이지 이동")} onClose={() => setMoveOpen(false)}><p className="modal-description">{t("{0}쪽을 현재 순서대로 묶어 이동합니다.", [selected.length])}</p><label className="field-label" htmlFor="destination">{t("이동 후 시작 페이지")}</label><input id="destination" className="text-input" type="number" min="1" max={pages.length - selected.length + 1} value={destination} onChange={e => setDestination(Number(e.target.value))}/><div className="modal-footer"><button className="button primary" onClick={moveSelected}>{t("이동")}</button></div></Modal>}
 {splitOpen && chosen.length === 1 && chosen[0].kind === 'image' && <SplitDialog page={chosen[0]} onClose={() => setSplitOpen(false)} onNotice={setNotice}/>}
 {clearOpen && <Modal title={t("모든 페이지를 비울까요?")} onClose={() => setClearOpen(false)}><p className="modal-description">{t("추가한 파일과 편집 이력이 모두 사라집니다.")}</p><div className="modal-footer"><button className="button secondary" onClick={() => setClearOpen(false)}>{t("돌아가기")}</button><button className="button danger" onClick={() => { for (const s of Object.values(sources))
        if (s.url)
            URL.revokeObjectURL(s.url); clearPdfCache(); reset(); void backup.removeSaved(); setClearOpen(false); }}>{t("모두 비우기")}</button></div></Modal>}
 {help && <Modal title={t("모아PDF 사용 방법")} onClose={() => setHelp(false)}><ol className="help-list"><li><strong>{t("파일을 모아주세요")}</strong><p>{t("PNG, JPG, JPEG, PDF를 함께 선택합니다. PDF는 낱장으로 펼쳐집니다.")}</p></li><li><strong>{t("페이지를 정리하세요")}</strong><p>{t("체크박스 밖의 카드 상단을 잡아 끌거나 화살표로 순서를 바꿉니다. 선택한 여러 쪽은 함께 끌 수 있어요. 체크박스로 여러 쪽을 선택해 회전·이동·삭제할 수 있어요.")}</p></li><li><strong>{t("규격을 맞춰주세요")}</strong><p>{t("전체 기본 설정에서 용지와 여백을 정합니다. 모바일에서는 하단 설정 버튼으로 열 수 있어요. 선택한 페이지는 개별 설정도 가능해요. ‘페이지 채우기’는 내용이 잘릴 수 있습니다.")}</p></li><li><strong>{t("확인하고 내려받으세요")}</strong><p>{t("PDF를 만든 뒤 완성된 PDF 미리보기를 확인합니다. 설정을 바꾸면 다시 만들 수 있어요.")}</p></li></ol><p className="help-note">{t("비밀번호 PDF, PDF 본문 편집·OCR, 목표 용량 보장은 아직 지원하지 않습니다. 원본 크기 유지 시 PDF 링크·주석은 사본으로 복사되지만, 용지 통일 시 주석·양식은 보존되지 않을 수 있습니다.")}</p><p className="help-note">{t("Ctrl+Z 실행 취소 · Ctrl+Shift+Z 다시 실행 · Ctrl+A 전체 선택. 카드 상단 이동 버튼에 초점을 둔 후 Space와 방향키로도 정렬할 수 있습니다.")}</p></Modal>}
 {generatedPreview && result && <Modal title={t("완성된 PDF 확인")} wide onClose={closeOutputPreview}><div className="preview-meta"><span>{result.name}</span><span>{t("{0}쪽 · {1}", [result.count, formatBytes(result.bytes)])}</span></div><div className="generated-preview">{generatedPreview === 'loading' ? <LoaderCircle className="spin"/> : <OutputPreview url={generatedPreview}/>}</div><div className="modal-footer"><div className="preview-nav"><IconButton icon={ChevronLeft} label={t("결과 이전 페이지")} disabled={outputIndex === 0 || generatedPreview === 'loading'} onClick={() => void inspectOutput(outputIndex - 1)}/><span>{outputIndex + 1} / {result.count}</span><IconButton icon={ChevronRight} label={t("결과 다음 페이지")} disabled={outputIndex === result.count - 1 || generatedPreview === 'loading'} onClick={() => void inspectOutput(outputIndex + 1)}/></div><a className="button primary" href={result.url} download={result.name}><ArrowDownToLine size={16}/>{t("다운로드")}</a></div></Modal>}
 </div>;
}
