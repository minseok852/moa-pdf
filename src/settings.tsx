import { t } from './i18n';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './components';
import type { PageItem, Settings } from './types';
import { mixedSettings, patchPageSettings, sizingMode, sizingPatch } from './editor-actions';
import type { PageSettings, SizingMode } from './editor-actions';
const MODE_LABELS: Record<SizingMode, string> = { images: '사진만 용지에 맞추기', all: '사진·PDF 모두 맞추기', original: '원본 크기·비율 유지' };
export function SettingsFields({ value, onChange, individual = false, mixed = [], modeMixed = false, kinds = ['image', 'pdf'] }: {
    value: Settings;
    onChange: (patch: Partial<PageSettings>) => void;
    individual?: boolean;
    mixed?: readonly (keyof PageSettings)[];
    modeMixed?: boolean;
    kinds?: PageItem['kind'][];
}) {
    const prefix = individual ? 'page-' : '', mode = sizingMode(value);
    const inactive = (!modeMixed && mode === 'original') || (!modeMixed && mode === 'images' && kinds.every(kind => kind === 'pdf'));
    const differs = (key: keyof PageSettings) => mixed.includes(key);
    return <><div className="setting-block"><label className="field-label" htmlFor={prefix + 'sizing'}>{t("페이지 크기 적용")}</label><select id={prefix + 'sizing'} value={modeMixed ? 'mixed' : mode} onChange={e => onChange(sizingPatch(e.target.value as SizingMode, value.paper))}>{modeMixed && <option value="mixed" disabled>{t("서로 다름 · 바꿀 때만 함께 적용")}</option>}{(Object.keys(MODE_LABELS) as SizingMode[]).map(key => <option key={key} value={key}>{t(MODE_LABELS[key])}</option>)}</select><p className="field-hint">{modeMixed ? t("선택한 페이지들의 크기 적용 방식이 서로 달라요.") : mode === 'images' ? t("사진에는 아래 설정을 적용하고, PDF 크기는 그대로 둡니다.") : mode === 'all' ? t("사진과 PDF 모두 아래 용지·방향·여백을 적용합니다.") : t("용지 맞춤 없이 사진 비율과 PDF 원본 크기를 유지합니다.")}</p></div>
 <fieldset disabled={inactive} className={'paper-controls' + (inactive ? ' inactive' : '')}><div className="setting-block"><label className="field-label" htmlFor={prefix + 'paper'}>{t("용지 크기")}</label><select id={prefix + 'paper'} value={differs('paper') ? 'mixed' : value.paper} onChange={e => onChange({ paper: e.target.value as Settings['paper'] })}>{differs('paper') && <option value="mixed" disabled>{t("서로 다름")}</option>}{value.paper === 'original' && !differs('paper') && <option value="original">{t("원본 유지")}</option>}<option value="a4">A4 · 210 × 297 mm</option><option value="a3">A3 · 297 × 420 mm</option><option value="letter">Letter · 216 × 279 mm</option></select></div>
 <div className="setting-block"><span className="field-label">{t("용지 방향")}{differs('orientation') && <span className="mixed-value">{t("서로 다름")}</span>}</span><div className="segmented">{(['auto', 'portrait', 'landscape'] as const).map((orientation, i) => <button key={orientation} aria-pressed={!differs('orientation') && value.orientation === orientation} className={!differs('orientation') && value.orientation === orientation ? 'active' : ''} onClick={() => onChange({ orientation })}>{[t("자동"), t("세로"), t("가로")][i]}</button>)}</div></div>
 <div className="setting-block"><span className="field-label">{t("이미지 배치")}{differs('fit') && <span className="mixed-value">{t("서로 다름")}</span>}</span><div className="fit-options">{(['contain', 'cover'] as const).map((fit, i) => <button key={fit} className={'fit-option ' + (!differs('fit') && value.fit === fit ? 'active' : '')} onClick={() => onChange({ fit })} aria-pressed={!differs('fit') && value.fit === fit}><span className={'fit-icon ' + fit}><i /></span><span><strong>{i ? t("페이지 채우기") : t("전체 보이기")}</strong><small>{i ? t("가장자리가 잘릴 수 있어요") : t("내용이 잘리지 않게")}</small></span>{!differs('fit') && value.fit === fit && <Check size={15}/>}</button>)}</div></div>
 <div className="setting-block"><div className="field-row"><label className="field-label" htmlFor={prefix + 'margin'}>{t("여백")}</label><span>{differs('margin') ? t("서로 다름") : `${value.margin} mm`}</span></div><input id={prefix + 'margin'} type="range" min="0" max="30" step="1" value={value.margin} aria-valuetext={differs('margin') ? t("서로 다름") : `${value.margin} mm`} onChange={e => onChange({ margin: Number(e.target.value) })}/><div className="range-labels"><span>{t("없음")}</span><span>{t("넓게")}</span></div></div></fieldset>
 {inactive && <p className="inactive-note">{mode === 'original' ? t("원본 유지에서는 용지·방향·배치·여백을 변경하지 않습니다.") : t("선택한 PDF는 원본 크기를 유지합니다. 위에서 ‘모든 페이지를 지정 용지로 통일’을 선택하면 규격을 바꿀 수 있습니다.")}</p>}</>;
}
export function IndividualSettingsDialog({ pages, settings, selected, onApply, onClose }: {
    pages: PageItem[];
    settings: Settings;
    selected: string[];
    onApply: (pages: PageItem[]) => void;
    onClose: () => void;
}) {
    const chosen = pages.filter(page => selected.includes(page.id));
    const [patch, setPatch] = useState<Partial<PageSettings>>({}), [followGlobal, setFollowGlobal] = useState(false);
    const base = followGlobal ? settings : { ...settings, ...chosen[0]?.settings };
    const value = { ...base, ...patch };
    const mixed = followGlobal ? [] : mixedSettings(chosen, settings).filter(key => !(key in patch));
    const modes = chosen.map(page => sizingMode({ ...settings, ...page.settings, ...patch }));
    const modeMixed = !followGlobal && modes.some(mode => mode !== modes[0]);
    function apply() { const updated = followGlobal ? pages.map(page => selected.includes(page.id) ? { ...page, settings: undefined } : page) : pages; onApply(patchPageSettings(updated, selected, patch)); onClose(); }
    return <Modal title={t("{0}쪽 개별 설정", [chosen.length])} onClose={onClose}><p className="modal-description">{t("변경한 항목만 선택한 페이지에 적용합니다. 적용 전까지 편집 내용은 바뀌지 않아요.")}</p><SettingsFields value={value} individual mixed={mixed} modeMixed={modeMixed} kinds={[...new Set(chosen.map(page => page.kind))]} onChange={change => setPatch(previous => ({ ...previous, ...change }))}/><label className="follow-global"><input type="checkbox" checked={followGlobal} onChange={e => { setFollowGlobal(e.target.checked); setPatch({}); }}/>{t("개별 설정을 지우고 전체 기본 설정 따르기")}</label><div className="modal-footer"><button className="button secondary" onClick={onClose}>{t("취소")}</button><button className="button primary" onClick={apply} disabled={!followGlobal && !Object.keys(patch).length}>{t("선택한 {0}쪽에 적용", [chosen.length])}</button></div></Modal>;
}
