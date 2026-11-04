import { t } from './i18n';
import { Modal } from './components';
const libraries=[
  {name:'rhwptopdf 0.2.2',license:'MIT + Apache-2.0; dependency licenses incl. MPL-2.0',role:'HWP·HWPX를 PDF로 변환',source:'https://github.com/sanguneo/rhwptopdf/tree/v0.2.2',notices:['rhwptopdf-LICENSE.txt','rhwptopdf-NOTICE.txt','rhwptopdf-dependencies.txt']},
  {name:'@matbee/libreoffice-converter 2.7.2 / LibreOffice',license:'MPL-2.0 + bundled third-party licenses',role:'DOCX·PPTX·XLSX를 PDF로 변환',source:'https://github.com/matbeedotcom/libreoffice-document-converter/tree/v2.7.2',notices:['MPL-2.0.txt','libreoffice-NOTICES.html','SOURCES.txt']},
  {name:'Noto Sans KR / Noto Serif KR',license:'SIL Open Font License 1.1',role:'문서 변환용 한글 대체 글꼴',source:'https://github.com/notofonts/noto-cjk/tree/f8d157532fbfaeda587e826d4cd5b21a49186f7c',notices:['NotoSansKR-OFL.txt','NotoSerifKR-OFL.txt']}
];
export function OpenSourceLicenses({onClose}:{onClose:()=>void}){
  const base=import.meta.env.BASE_URL;
  return <Modal title={t('오픈소스 라이선스')} wide onClose={onClose}>
    <p className="modal-description">{t('모아PDF는 아래 오픈소스를 사용합니다. 각 소프트웨어의 저작권과 라이선스는 해당 권리자에게 있으며, 라이선스 원문과 소스 출처를 제공합니다.')}</p>
    <div className="license-list">{libraries.map(library=><section className="license-card" key={library.name}>
      <h3>{library.name}</h3><p>{t(library.role)}</p><small>{library.license}</small>
      <div className="license-links"><a href={library.source} target="_blank" rel="noreferrer">{t('원본 소스')}</a>{library.notices.map(name=><a key={name} href={base+'licenses/'+name} target="_blank" rel="noreferrer">{name}</a>)}</div>
    </section>)}</div>
    <p className="help-note">{t('MPL 적용 구성요소는 원본 상태로 사용하며, 해당 소스와 빌드 패치의 위치는 소스 안내에 공개합니다. 문서 변환 엔진의 라이선스가 모아PDF 전체에 동일하게 적용되는 것은 아닙니다.')}</p>
    <a className="button secondary" href={base+'third-party-notices.txt'} target="_blank" rel="noreferrer">{t('전체 의존성 라이선스·저작권 고지')}</a>
    <p className="help-note">{t('앱·엔진·글꼴의 라이선스는 사용자가 불러오는 문서의 저작권을 변경하지 않습니다.')}</p>
  </Modal>;
}
