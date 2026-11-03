import {$,esc,field,files,action,status,download,copy,persist,restore,canvas,readImage,toBlob,teardown} from '../ui.js';
import {marked} from '../vendor/vendor.js';
import DOMPurify from '../vendor/purify.js';
const markdownCSS='body{max-width:900px;margin:24px auto;padding:0 24px;font:16px/1.75 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#28282f;overflow-wrap:anywhere}img{max-width:100%}pre{overflow:auto;background:#f3f4f8;padding:18px;border-radius:8px}code{font-family:Consolas,monospace;background:#f3f4f8}blockquote{border-left:3px solid #a6b1cd;padding-left:16px;color:#737e96}table{border-collapse:collapse}td,th{border:1px solid #dce1eb;padding:8px 12px}a{color:#5b6eae}hr{border:0;border-top:1px solid #dce1eb}';
export function markdown(root) {
  root.innerHTML=`<section class="panel"><div class="row">${field('mdName','Имя файла','text','document.md')}${files('mdImport','.md,.markdown,.txt',false)}</div><div class="markdown-toolbar" role="toolbar" aria-label="Форматирование Markdown">${[['bold','Жирный'],['italic','Курсив'],['heading','Заголовок'],['link','Ссылка'],['code','Код'],['quote','Цитата'],['list','Список'],['task','Задачи'],['table','Таблица']].map(([id,label])=>`<button data-md="${id}">${label}</button>`).join('')}<label class="button">Картинка<input id="mdImage" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div><div class="actions"><button id="saveMD" class="primary">Скачать MD</button><button id="saveMDHTML">Скачать HTML</button><button id="copyMD">Копировать</button><label><input id="mdSync" type="checkbox" checked> Синхронная прокрутка</label></div><p id="mdInfo" class="muted"></p><p class="muted">Черновик сохраняется в этом браузере. Изображения с устройства встраиваются в документ; внешние картинки в предпросмотре отключены. Лимит — 2 млн символов. Ctrl/Cmd+S — скачать MD; Ctrl/Cmd+B/I — оформление.</p></section><div class="markdown-workspace"><section><h2>Markdown</h2><textarea id="mdSource" class="code" spellcheck="false" aria-label="Исходный Markdown"></textarea></section><section id="mdPreviewPanel"><div class="md-preview-heading"><h2>Предпросмотр</h2><div class="actions"><button id="mdFullscreen">Полный экран</button><button id="mdPip">Картинка в картинке</button></div></div><iframe id="mdPreview" title="Предпросмотр Markdown" sandbox="allow-same-origin"></iframe></section></div>`;
  const saved=restore('markdown',{});$('mdName').value=saved.name||'document.md';$('mdSource').value=saved.text||'# Новый документ\n\n**Markdown** с живым предпросмотром.\n\n- [ ] Первый пункт\n- [x] Готовый пункт\n\n| Столбец | Значение |\n| --- | --- |\n| Пример | 42 |';let prepared='';let timer;let saveTimer;let pipWindow=null;let pipPreview=null;let disposed=false;
  function html(){
    const clean=DOMPurify.sanitize(marked.parse($('mdSource').value,{gfm:true}),{USE_PROFILES:{html:true},FORBID_TAGS:['script','style','iframe','object','embed','form','link','meta','base'],ALLOW_DATA_ATTR:false});
    const doc=new DOMParser().parseFromString(clean,'text/html');
    for(const image of doc.querySelectorAll('img')){if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(image.getAttribute('src')||'')){const label=doc.createElement('span');label.textContent=`[Внешняя картинка: ${image.alt||'без подписи'}]`;image.replaceWith(label);}}
    for(const anchor of doc.querySelectorAll('a')){anchor.removeAttribute('target');anchor.setAttribute('rel','noopener noreferrer');}
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><title>${esc($('mdName').value)}</title><style>${markdownCSS}</style></head><body>${doc.body.innerHTML}</body></html>`;
  }
  function update(){if($('mdSource').value.length>2e6){status('Документ превышает 2 млн символов. Скачай его или сократи для предпросмотра.',true);return;}prepared=html();$('mdPreview').srcdoc=prepared;if(pipPreview){pipPreview.srcdoc=prepared;}const text=$('mdSource').value;$('mdInfo').textContent=`Символов: ${[...text].length.toLocaleString('ru')}; строк: ${text.split('\n').length}.`;clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist('markdown',{name:$('mdName').value,text}),450);}
  const operations={bold:['**','**','текст'],italic:['*','*','текст'],heading:['## ','','Заголовок'],link:['[','](https://example.com)','текст ссылки'],code:['\n```\n','\n```\n','код'],quote:['> ','','цитата'],list:['- ','','пункт'],task:['- [ ] ','','задача'],table:['\n','\n','| Столбец 1 | Столбец 2 |\n| --- | --- |\n| Значение | Значение |']};
  function insert(prefix,suffix='',fallback=''){const input=$('mdSource');const from=input.selectionStart;const to=input.selectionEnd;const text=input.value.slice(from,to)||fallback;input.setRangeText(prefix+text+suffix,from,to,'select');input.focus();input.setSelectionRange(from+prefix.length,from+prefix.length+text.length);update();}
  root.querySelectorAll('[data-md]').forEach(button=>{button.onclick=()=>insert(...operations[button.dataset.md]);});
  $('mdSource').oninput=()=>{clearTimeout(timer);timer=setTimeout(update,180);};$('mdName').oninput=update;
  function filename(){const name=$('mdName').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')||'document.md';return name.replace(/\.(md|markdown|txt)$/i,'');}
  action('saveMD',()=>download(new Blob([$('mdSource').value],{type:'text/markdown;charset=utf-8'}),`${filename()}.md`));
  action('saveMDHTML',()=>{update();download(new Blob([prepared],{type:'text/html;charset=utf-8'}),`${filename()}.html`);});action('copyMD',()=>copy($('mdSource').value));
  $('mdImport').onchange=async()=>{try{const file=$('mdImport').files[0];if(!file){return;}if(file.size>4e6){throw new Error('Файл больше 4 МБ.');}const text=await file.text();if(text.length>2e6){throw new Error('Более 2 млн символов.');}persist('markdown-previous',{text:$('mdSource').value,name:$('mdName').value});$('mdSource').value=text;$('mdName').value=file.name;update();status('Документ открыт. Предыдущий черновик сохранён локально.');}catch(error){status(error.message,true);}};
  const previous=document.createElement('button');previous.textContent='Предыдущий черновик';previous.onclick=()=>{const data=restore('markdown-previous',null);if(!data){status('Предыдущего черновика нет.');return;}persist('markdown-previous',{text:$('mdSource').value,name:$('mdName').value});$('mdSource').value=data.text;$('mdName').value=data.name;update();};$('saveMD').parentElement.append(previous);
  $('mdImage').onchange=async()=>{try{const file=$('mdImage').files[0];if(!file){return;}if(file.size>15e6){throw new Error('Картинка больше 15 МБ.');}const image=await readImage(file);const ratio=Math.min(1,1000/Math.max(image.width,image.height));const c=canvas(Math.max(1,Math.round(image.width*ratio)),Math.max(1,Math.round(image.height*ratio)));c.getContext('2d').drawImage(image,0,0,c.width,c.height);image.close();const url=c.toDataURL('image/webp',.85);if($('mdSource').value.length+url.length>2e6){throw new Error('Картинка превысит лимит документа. Уменьши её заранее.');}insert(`\n![${file.name.replace(/[\[\]]/g,'')}](${url})\n`);}catch(error){status(error.message,true);}};
  function protectLinks(frame){
    frame.onload=()=>{const doc=frame.contentDocument;if(doc){doc.addEventListener('keydown',escapePreview);doc.addEventListener('click',event=>{
      const link=event.target.closest('a');if(link){event.preventDefault();status(`Ссылка: ${link.getAttribute('href')}`);}
    });}};
  }
  protectLinks($('mdPreview'));
  const previewPanel=$('mdPreviewPanel');
  let expanded=false;let hostStyle='';
  const hostFrame=window.frameElement;
  function expandPreview(value){
    expanded=value;previewPanel.classList.toggle('md-preview-expanded',value);
    if(hostFrame){
      if(value){
        hostStyle=hostFrame.style.cssText;
        for(const [name,value] of Object.entries({position:'fixed',inset:'0',width:'100vw',height:'100vh','z-index':'2147483647',background:'white'})){
          hostFrame.style.setProperty(name,value,'important');
        }
      }else{hostFrame.style.cssText=hostStyle;}
    }
    fullscreenChanged();
  }
  function escapePreview(event){if(event.key==='Escape'&&expanded){expandPreview(false);}}
  document.addEventListener('keydown',escapePreview);
  window.top.document.addEventListener('keydown',escapePreview);
  function fullscreenChanged(){
    $('mdFullscreen').textContent=(expanded||document.fullscreenElement===previewPanel)?'Выйти из полного экрана':'Полный экран';
  }
  document.addEventListener('fullscreenchange',fullscreenChanged);
  action('mdFullscreen',async()=>{
    if(expanded){expandPreview(false);return;}
    if(document.fullscreenElement===previewPanel){await document.exitFullscreen();}
    else{try{await previewPanel.requestFullscreen();}catch(error){expandPreview(true);}}
  });
  action('mdPip',async()=>{
    if(pipWindow&&!pipWindow.closed){pipWindow.close();return;}
    const api=window.top.documentPictureInPicture;
    if(!api){throw new Error('Картинка в картинке для текста недоступна. Используй настольный Chrome или Edge.');}
    const opened=await api.requestWindow({width:720,height:560});
    if(disposed){opened.close();return;}
    pipWindow=opened;
    const doc=opened.document;doc.title='Предпросмотр Markdown';
    doc.body.style.cssText='margin:0;height:100vh;background:white;overflow:hidden';
    pipPreview=doc.createElement('iframe');pipPreview.title='Предпросмотр Markdown';
    pipPreview.setAttribute('sandbox','allow-same-origin');
    pipPreview.style.cssText='display:block;width:100%;height:100%;border:0;background:white';
    protectLinks(pipPreview);doc.body.append(pipPreview);update();
    $('mdPip').textContent='Закрыть картинку в картинке';
    opened.addEventListener('pagehide',()=>{
      pipWindow=null;pipPreview=null;if(!disposed){$('mdPip').textContent='Картинка в картинке';}
    },{once:true});
  });
  $('mdSource').onscroll=()=>{if(!$('mdSync').checked){return;}const input=$('mdSource');const ratio=input.scrollTop/Math.max(1,input.scrollHeight-input.clientHeight);for(const frame of [$('mdPreview'),pipPreview]){const doc=frame?.contentDocument;if(doc){doc.documentElement.scrollTop=ratio*(doc.documentElement.scrollHeight-frame.clientHeight);}}};
  function key(event){if((event.ctrlKey||event.metaKey)&&event.code==='KeyS'){event.preventDefault();$('saveMD').click();}if(event.target===$('mdSource')&&(event.ctrlKey||event.metaKey)&&['KeyB','KeyI'].includes(event.code)){event.preventDefault();insert(...operations[event.code==='KeyB'?'bold':'italic']);}if(event.target===$('mdSource')&&event.key==='Tab'){event.preventDefault();insert('  ');}}
  document.addEventListener('keydown',key);teardown(()=>{disposed=true;if(expanded){expandPreview(false);}document.removeEventListener('keydown',escapePreview);window.top.document.removeEventListener('keydown',escapePreview);pipWindow?.close();document.removeEventListener('fullscreenchange',fullscreenChanged);clearTimeout(timer);clearTimeout(saveTimer);persist('markdown',{name:$('mdName').value,text:$('mdSource').value});document.removeEventListener('keydown',key);});update();
}
