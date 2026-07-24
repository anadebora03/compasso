/* ============================================================
   COMPASSO · Companheiro de tratamento GLP-1 (protótipo NutriEase)
   v1.0.0 — Release Candidate
   Arquivo único, sem dependências externas.
   Persistência: localStorage com fallback em memória.
   Insights: motor local baseado em regras (descritivo, nunca
   prescritivo) — camada pronta para ser trocada pela IA do
   backend NutriEase no futuro.
   ============================================================ */

/* ---------- storage seguro (localStorage + fallback) ---------- */
const store = (()=>{
  let mem={}, ok=false;
  try{const k='__c__';localStorage.setItem(k,'1');localStorage.removeItem(k);ok=true;}catch(e){ok=false;}
  return{
    get(k){ if(ok){try{return localStorage.getItem(k);}catch(e){}} return k in mem?mem[k]:null; },
    set(k,v){ if(ok){try{localStorage.setItem(k,v);return true;}catch(e){}} mem[k]=v;return false; }
  };
})();
const KEY='compasso_state_v1';
let S = load();

function load(){
  try{const raw=store.get(KEY); if(raw) return JSON.parse(raw);}catch(e){}
  return null;
}
let DB=null; // API de sincronização (js/database.js), resolvida de forma assíncrona no boot
let NOTIF=null; // API de lembretes (js/notifications.js), idem
let INSIGHTS=null; // API de análise (js/insights.js), idem
let TIMELINE=null; // API da linha do tempo (js/timeline.js), idem
let ACTIONPLAN=null; // API do plano de ação (js/actionplan.js), idem
let LICENSE=null; // API de licenciamento (js/license.js), idem
let FEATURES=null; // catálogo de recursos do motor de licenciamento — nunca strings soltas
function persistLocal(){
  try{ if(!store.set(KEY,JSON.stringify(S))) toast('Salvo nesta sessão (armazenamento local indisponível aqui)'); }
  catch(e){ toast('Não foi possível salvar (armazenamento cheio)'); }
}
function save(){
  persistLocal();
  if(DB) DB.onLocalSave();
  if(NOTIF && S) NOTIF.checkAndNotify(buildNotifStatus());
}

/* ---------- helpers ---------- */
const WD=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const WDs=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const pad=n=>String(n).padStart(2,'0');
function todayISO(d=new Date()){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseISO(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
function fmtBR(iso){const d=parseISO(iso);return pad(d.getDate())+'/'+pad(d.getMonth()+1);}
function fmtBRy(iso){const d=parseISO(iso);return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();}
const MESES_ABR=['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.'];
function fmtDateLong(iso){const d=parseISO(iso);return `${d.getDate()} de ${MESES_ABR[d.getMonth()]} de ${d.getFullYear()}`;}
function daysBetween(a,b){return Math.round((parseISO(b)-parseISO(a))/864e5);}
function daysAgo(iso){return Math.round((new Date().setHours(0,0,0,0)-parseISO(iso))/864e5);}
function nf(n,d=1){return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function plural(n,singular,pluralForm){return n===1?singular:(pluralForm||singular+'s');}

function toast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='.3s';setTimeout(()=>t.remove(),300);},2200);
}

/* ---------- derived data ---------- */
function sortedWeigh(){return[...S.weighings].sort((a,b)=>a.date<b.date?-1:1);}
function currentWeight(){const w=sortedWeigh();return w.length?w[w.length-1].peso:S.profile.pesoInicial;}
function lost(){return +(S.profile.pesoInicial-currentWeight()).toFixed(1);}
function lostPct(){return S.profile.pesoInicial?(lost()/S.profile.pesoInicial*100):0;}
function imc(){const h=S.profile.altura/100;return h?currentWeight()/(h*h):0;}
function imcClass(v){
  if(!v) return '';
  if(v<18.5) return 'Abaixo do peso';
  if(v<25) return 'Peso normal';
  if(v<30) return 'Sobrepeso';
  if(v<35) return 'Obesidade I';
  if(v<40) return 'Obesidade II';
  return 'Obesidade III';
}
function daysTreat(){return daysAgo(S.profile.dataInicio)+1;}
function lastApp(){const a=[...S.applications].sort((x,y)=>x.date<y.date?-1:1);return a.length?a[a.length-1]:null;}

function nextAppInfo(){
  const wd=S.profile.diaAplicacao; // 0-6
  const now=new Date(); now.setHours(0,0,0,0);
  let diff=(wd-now.getDay()+7)%7;
  // se aplicou hoje, próxima é daqui 7
  const la=lastApp();
  if(diff===0 && la && la.date===todayISO()) diff=7;
  const next=new Date(now); next.setDate(now.getDate()+diff);
  return {days:diff,date:todayISO(next),weekday:WD[wd]};
}
function ringProgress(){ // 0..1 quanto já passou da semana
  const d=nextAppInfo().days; return (7-d)/7;
}
function penRemaining(){
  const p=S.pen; if(!p||!p.capacidadeMg||!p.doseMg) return null;
  const total=Math.floor(p.capacidadeMg/p.doseMg);
  const rest=Math.max(0,total-(p.usadas||0));
  return {total,rest,frac:total?rest/total:0};
}

/* ---------- example data ---------- */
function seedExample(){
  const start=new Date(); start.setDate(start.getDate()-118);
  const startISO=todayISO(start);
  const profile={nome:'Débora',medicamento:'Mounjaro',doseAtual:'7,5',unidade:'mg',
    diaAplicacao:5,dataInicio:startISO,pesoInicial:96,pesoMeta:72,altura:165,
    metaAgua:3,metaProteina:100};
  const weighings=[]; const w0=96;
  const pts=[[0,96],[14,93.2],[28,91.1],[42,89.4],[56,87.6],[70,86.0],[84,84.9],[98,83.7],[112,82.4]];
  pts.forEach(([off,pw],i)=>{
    const d=new Date(start);d.setDate(start.getDate()+off);
    weighings.push({date:todayISO(d),peso:pw,
      cintura:98-i*1.6,quadril:112-i*1.1,braco:34-i*.35,coxa:62-i*.7,abdomen:104-i*1.7,foto:null});
  });
  const applications=[]; const meds='Mounjaro'; let dose=['2,5','2,5','2,5','2,5','5','5','5','5','7,5','7,5','7,5','7,5','7,5','7,5','7,5','7,5','7,5'];
  const sites=['Abdômen','Coxa direita','Coxa esquerda','Braço direito','Braço esquerdo'];
  for(let i=0;i<17;i++){const d=new Date(start);d.setDate(start.getDate()+i*7);
    applications.push({date:todayISO(d),dose:dose[i]||'7,5',medicamento:meds,local:sites[i%5]});}
  const dailyLogs={};
  for(let i=0;i<25;i++){const d=new Date();d.setDate(d.getDate()-i);
    const iso=todayISO(d);const dApp=(6-d.getDay()+7)%7; // dias desde sexta
    const sint=[]; if(dApp<=1&&Math.random()<.7)sint.push('Náusea'); if(Math.random()<.25)sint.push('Constipação'); if(!sint.length&&Math.random()<.5)sint.push('Sem sintomas');
    dailyLogs[iso]={sintomas:sint,agua:1.6+Math.random()*1.5,proteina:Math.round(70+Math.random()*40),
      exercicios:Math.random()<.5?['Caminhada']:[],humor:3+Math.round(Math.random()*2),
      apetite:dApp<=2?'Muito baixo':'Baixo',fomeEmocional:Math.random()<.3?'Ansiedade':'Nenhuma'};
  }
  const exams=[{date:startISO,tipo:'Hemoglobina glicada',valor:'6,2%'},{date:todayISO(new Date()),tipo:'Hemoglobina glicada',valor:'5,4%'},
    {date:startISO,tipo:'Triglicerídeos',valor:'180 mg/dL'}];
  const agenda=[{date:todayISO(new Date(Date.now()+9*864e5)),tipo:'Consulta',obs:'Retorno nutricional'}];
  const bd=off=>{const d=new Date(start);d.setDate(start.getDate()+off);return todayISO(d);};
  const bio=[
    {date:bd(0),  gordura:42.0, massaMagraPct:58.0, musculo:52.9, agua:44.5, visceral:12, tmb:1520},
    {date:bd(56), gordura:38.4, massaMagraPct:61.6, musculo:51.3, agua:47.0, visceral:10, tmb:1478},
    {date:bd(112),gordura:35.1, massaMagraPct:64.9, musculo:50.8, agua:48.9, visceral:9,  tmb:1451},
  ];
  return {profile,weighings,applications,dailyLogs,exams,agenda,bio,
    pen:{capacidadeMg:60,doseMg:7.5,usadas:5},created:startISO};
}
function blankState(p){
  return {profile:p,weighings:[{id:crypto.randomUUID(),date:p.dataInicio,peso:p.pesoInicial}],applications:[],dailyLogs:{},
    exams:[],agenda:[],bio:[],pen:{capacidadeMg:0,doseMg:0,usadas:0},created:p.dataInicio};
}

/* ============================================================
   ROUTER / RENDER
   ============================================================ */
let TAB='inicio', SUB=null;
function go(tab,sub=null){closeSheet();TAB=tab;SUB=sub;render();window.scrollTo(0,0);}

/* ---------- Tema claro/escuro ---------- */
let THEME=(store.get('compasso_theme_v1')||'dark');
document.documentElement.setAttribute('data-theme',THEME);
function toggleTheme(){
  THEME=THEME==='dark'?'light':'dark';
  store.set('compasso_theme_v1',THEME);
  document.documentElement.setAttribute('data-theme',THEME);
  render();
}

/* Telas já migradas pra identidade Quiet Premium (navy). As demais usam
   .screen.legacy pra manter o visual claro original até sua própria Sprint. */
const QP_TABS=['inicio','aplicacao','evolucao','diario','proteina'];
let EV_TAB='peso';
function evSetTab(t){EV_TAB=t;render();}
function render(){
  const app=document.getElementById('app');
  if(!S){ app.innerHTML=obView(); return; }
  const premiumScreen=QP_TABS.includes(TAB)||(TAB==='mais'&&(SUB===null||['relatorio','insights','planoacao','timeline','conquistas','stats','calc','exames','agenda','bio','jornada'].includes(SUB)))||TAB==='premium';
  app.innerHTML = topView() + `<div class="screen ${premiumScreen?'':'legacy'}" id="scr"></div>` + navView();
  const scr=document.getElementById('scr');
  let html='';
  if(TAB==='inicio') html=inicioView();
  else if(TAB==='aplicacao') html=aplicacaoView();
  else if(TAB==='evolucao') html=evolucaoView();
  else if(TAB==='diario') html=diarioView();
  else if(TAB==='mais') html=SUB?maisSubView(SUB):maisView();
  else if(TAB==='proteina') html=proteinaView();
  else if(TAB==='premium') html=premiumView();
  scr.innerHTML=html;
}

/* ---------- Topbar ---------- */
function greeting(){const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';}
function topView(){
  const titles={inicio:'',aplicacao:'',evolucao:'',diario:'',mais:''};
  return `<div class="top">
    <div class="brand">
      ${logoSVG(22)}
      <div><h1>Compasso</h1><div class="greet">${greeting()}, ${esc(S.profile.nome)}</div></div>
    </div>
    <button class="badge-ico" onclick="toggleTheme()" aria-label="Alternar tema">${icon(THEME==='dark'?'sun':'moon')}</button>
  </div>`;
}

/* ---------- Bottom nav ---------- */
function navView(){
  const t=(id,lbl,ic)=>`<button class="${TAB===id?'on':''}" onclick="go('${id}')">${icon(ic)}<span>${lbl}</span></button>`;
  return `<div class="nav">
    ${t('inicio','Início','home')}
    ${t('aplicacao','Aplicação','syringe')}
    <button aria-label="Novo registro" style="position:relative;flex:1" onclick="openSheet('menuadd')">
      <span class="fab">${icon('plus',true)}</span><span style="margin-top:30px;color:var(--accent-light);font-size:10px;font-weight:700">Registrar</span>
    </button>
    ${t('evolucao','Evolução','chart')}
    ${t('mais','Mais','grid')}
  </div>`;
}

/* ============================================================
   TELA · INÍCIO
   ============================================================ */
function inicioView(){
  const na=nextAppInfo(); const prog=ringProgress();
  const dl=daysBetween(todayISO(),na.date);
  const pen=penRemaining();
  const l=lost(); const dir=l>=0?'down':'up';
  const goalRemain=+(currentWeight()-S.profile.pesoMeta).toFixed(1);
  const imcVal=imc();
  return `
  <div class="hero">
    <div class="glow-b"></div>
    <div class="lbl">Próxima aplicação</div>
    <div class="name">${esc(S.profile.medicamento)}</div>
    <div class="ringwrap">
      <div class="ring">${ringSVG(prog,S.profile.doseAtual,S.profile.unidade)}</div>
      <div class="next">
        <div class="big">${na.days===0?'Hoje':na.days+(na.days===1?' dia':' dias')}</div>
        <div class="cap">${na.days===0?'Dia de aplicar 💧':na.weekday+', '+fmtBR(na.date)}</div>
        <span class="med">Dose ${esc(S.profile.doseAtual)} ${esc(S.profile.unidade)}</span>
      </div>
    </div>
  </div>

  <div class="grid2">
    <div class="stat-tile2">
      <div class="k">Peso atual</div>
      <div class="v">${nf(currentWeight())}<small> kg</small></div>
      <span class="delta2 ${dir}">${l>=0?'−':'+'}${nf(Math.abs(l))} kg · ${nf(Math.abs(lostPct()))}%</span>
    </div>
    <div class="stat-tile2">
      <div class="k">Faltam p/ meta</div>
      <div class="v">${goalRemain>0?nf(goalRemain):'0,0'}<small> kg</small></div>
      <span class="delta2 down">Meta ${nf(S.profile.pesoMeta)} kg</span>
    </div>
  </div>

  <div class="grid3">
    <div class="stat-tile2"><div class="k">Tratamento</div><div class="v" style="font-size:20px">${daysTreat()}<small> dias</small></div></div>
    <div class="stat-tile2"><div class="k">Aplicações</div><div class="v" style="font-size:20px">${S.applications.length}</div></div>
    <div class="stat-tile2"><div class="k">IMC</div><div class="v" style="font-size:20px">${nf(imcVal)}</div>${imcVal?`<small style="display:block;font-size:9.5px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tx-3);margin-top:2px">${imcClass(imcVal)}</small>`:''}</div>
  </div>

  ${pen?`<div class="gcard tight">
    <div class="between"><span class="eyebrow2" style="margin:0">Caneta atual</span>
    ${pen.rest<=1?'<span class="pill" style="background:var(--warn2-soft);color:var(--warn2)">Acabando</span>':''}</div>
    <div class="pen2 ${pen.rest<=1?'low':''}"><span style="width:${Math.max(6,pen.frac*100)}%"></span></div>
    <div class="between"><span class="muted" style="font-size:13px;color:var(--tx-2)">Restam <b style="color:var(--tx-1)">${pen.rest}</b> de ${pen.total} aplicações</span>
    <button class="btn-pill btn-sm ghost" onclick="openSheet('caneta')">Editar</button></div>
    ${pen.rest<=1?'<div style="font-size:12px;margin-top:8px;color:var(--tx-3)">🔔 Sua caneta acaba na próxima aplicação. Vale comprar a próxima.</div>':''}
  </div>`:''}

  <div class="gcard tight chart-card">
    <div class="between" style="margin-bottom:10px"><span class="eyebrow2" style="margin:0">Evolução do peso</span>
    <button class="link-more" onclick="go('evolucao')">Ver mais${icon('chevron')}</button></div>
    ${lineChartPremium(sortedWeigh().map(w=>({x:w.date,y:w.peso})),S.profile.pesoMeta)}
  </div>

  ${topInsight()}
  `;
}
function topInsight(){
  if(FEATURES && LICENSE && !LICENSE.can(FEATURES.INSIGHTS)){
    return `<div class="gcard tight" style="margin-top:14px">
      <div class="eyebrow2">Insights automáticos</div>
      <div class="insight2"><span class="ico">${icon('medal')}</span>
      <p>Padrões identificados automaticamente nos seus registros — recurso Premium.<span class="care">Assine pra desbloquear.</span></p></div>
      <button class="btn-pill block ghost btn-sm" onclick="go('premium')">Ver planos Premium</button></div>`;
  }
  const ctx=buildInsightContext(S.profile.dataInicio, todayISO());
  const ins=INSIGHTS ? INSIGHTS.gerar(ctx,{registrarHistorico:false}) : [];
  if(!ins.length){
    return `<div class="gcard tight" style="margin-top:14px">
      <div class="eyebrow2">Acompanhamento</div>
      <div class="insight2"><span class="ico">${icon('steth')}</span>
      <p>Mantenha seu acompanhamento médico e nutricional em dia — são eles que conduzem seu tratamento com segurança.<span class="care">O Compasso complementa, não substitui, a sua equipe de saúde.</span></p></div>
      <button class="btn-pill block ghost btn-sm" onclick="go('mais','insights')">Ver insights</button></div>`;
  }
  const i=ins[0];
  const toneCls=i.tone==='amber'?'warn':i.tone==='rose'?'danger':'';
  const care=[i.justificativa,i.care].filter(Boolean).join(' ');
  return `<div class="gcard tight" style="margin-top:14px">
    <div class="eyebrow2">Insight da semana</div>
    <div class="insight2 ${toneCls}"><span class="ico">${icon(i.icon||'spark')}</span>
    <p>${i.text}${care?`<span class="care">${care}</span>`:''}</p></div>
    <button class="btn-pill block ghost btn-sm" onclick="go('mais','insights')">Ver todos os insights</button></div>`;
}

/* ============================================================
   TELA · APLICAÇÃO
   ============================================================ */
function aplicacaoView(){
  const apps=[...S.applications].sort((a,b)=>a.date<b.date?1:-1);
  const pen=penRemaining();
  const na=nextAppInfo();
  return `
  <div class="scr-title">Aplicação</div>
  <div class="scr-sub">Registro semanal, rodízio de locais e controle das canetas.</div>

  <div class="gcard">
    <div class="between"><span class="eyebrow2" style="margin:0">Próxima dose</span><span class="pill" style="background:var(--accent-soft);color:var(--accent-light)">${na.days===0?'Hoje':na.weekday}</span></div>
    <div class="row" style="margin-top:14px;gap:14px">
      <div class="badge-glow" style="width:48px;height:48px;flex:0 0 48px">${icon('syringe')}</div>
      <div><div style="font-weight:700;font-size:16px;color:var(--tx-1)">${esc(S.profile.medicamento)} · ${esc(S.profile.doseAtual)} ${esc(S.profile.unidade)}</div>
      <div style="font-size:13px;color:var(--tx-3);margin-top:2px">${na.days===0?'Dia de aplicar':'Em '+na.days+' '+plural(na.days,'dia','dias')+' · '+fmtBRy(na.date)}</div></div>
    </div>
    <button class="btn-pill block" style="margin-top:16px" onclick="openSheet('aplicar')">${icon('plus',true)} Registrar aplicação</button>
  </div>

  <div class="gcard">
    <div class="eyebrow2">Rodízio dos locais</div>
    <p style="font-size:13px;color:var(--tx-2);margin:-6px 0 8px">Alterne para não aplicar sempre no mesmo lugar. ${lastApp()?'Último: <b style="color:var(--tx-1)">'+esc(lastApp().local)+'</b>.':''}</p>
    ${bodyMapSVG(lastApp()?lastApp().local:null,null,false,true)}
  </div>

  ${pen?`<div class="gcard tight">
    <div class="between"><span class="eyebrow2" style="margin:0">Caneta atual</span><button class="btn-pill btn-sm ghost" onclick="openSheet('caneta')">Editar</button></div>
    <div class="pen2 ${pen.rest<=1?'low':''}" style="margin-top:12px"><span style="width:${Math.max(6,pen.frac*100)}%"></span></div>
    <div class="grid3" style="margin:12px 0 0">
      <div class="stat-tile2"><div class="k">Caneta</div><div class="v" style="font-size:18px">${nf(S.pen.capacidadeMg,0)}<small> mg</small></div></div>
      <div class="stat-tile2"><div class="k">Dose</div><div class="v" style="font-size:18px">${nf(S.pen.doseMg,S.pen.doseMg%1?1:0)}<small> mg</small></div></div>
      <div class="stat-tile2"><div class="k">Restam</div><div class="v" style="font-size:18px;color:${pen.rest<=1?'var(--warn2)':'var(--accent-light)'}">${pen.rest}</div></div>
    </div>
  </div>`:`<div class="gcard center"><p style="font-size:13px;color:var(--tx-2)">Configure sua caneta para acompanhar quantas aplicações restam.</p><button class="btn-pill block ghost" onclick="openSheet('caneta')">Configurar caneta</button></div>`}

  <div class="gcard">
    <div class="eyebrow2">Histórico de aplicações</div>
    <div class="hist-list">
      ${apps.length?apps.slice(0,12).map(a=>`<div class="hist-item">
        <div class="badge-glow">${icon('syringe')}</div>
        <div><div class="t">${esc(a.local)}</div><div class="s">${fmtBRy(a.date)} · ${esc(a.medicamento)}</div></div>
        <div class="r">${esc(a.dose)} ${esc(S.profile.unidade)}</div></div>`).join('')
        :'<p class="center" style="font-size:13px;padding:8px 0;color:var(--tx-3)">Nenhuma aplicação registrada ainda.</p>'}
    </div>
  </div>`;
}

/* ============================================================
   TELA · EVOLUÇÃO
   ============================================================ */
function imcSeries(){
  const h=S.profile.altura/100; if(!h) return [];
  return sortedWeigh().map(w=>({x:w.date,y:+(w.peso/(h*h)).toFixed(1)}));
}
/* Progresso rumo à meta de peso, em % — usado no card "Sua evolução" (Evolução > Peso).
   Fórmula: (quanto já foi perdido) / (quanto falta perder do início até a meta) × 100.
     ini   = peso inicial cadastrado no perfil (S.profile.pesoInicial)
     meta  = peso meta cadastrado no perfil (S.profile.pesoMeta)
     atual = peso mais recente registrado (currentWeight())
   Casos de borda:
     - total<=0 (meta igual ou maior que o peso inicial, ou pesoInicial ausente) → retorna 0,
       pois não há uma jornada de perda válida pra medir progresso.
     - resultado sempre limitado a [0,100]: perdeu mais que a meta não deve passar de 100%,
       e ganho de peso (atual > ini) não deve virar percentual negativo.
   Ajustar aqui a fórmula é suficiente — o único consumidor é evEvolutionCard(). */
function goalProgressPct(){
  const ini=S.profile.pesoInicial, meta=S.profile.pesoMeta, atual=currentWeight();
  const total=ini-meta;
  if(!total||total<=0) return 0;
  const perdido=ini-atual;
  return Math.max(0,Math.min(100,Math.round(perdido/total*100)));
}
function evEvolutionCard(){
  const pct=goalProgressPct();
  return `<div class="gcard tight" style="margin-top:14px">
    <div class="eyebrow2">Sua evolução</div>
    <p style="font-size:14px;font-weight:600;color:var(--tx-1);margin:0 0 3px">${pct>0?'Você está no caminho certo!':'Vamos começar sua jornada!'}</p>
    <p style="font-size:12.5px;color:var(--tx-3);margin:0 0 12px">Continue assim para alcançar sua meta.</p>
    <div class="row" style="gap:10px">
      <div class="bar-glass" style="flex:1"><span style="width:${Math.max(3,pct)}%"></span></div>
      <span style="font-size:12.5px;font-weight:700;color:var(--accent-light);font-variant-numeric:tabular-nums">${pct}%</span>
    </div>
  </div>`;
}
function evPesoTab(w){
  const l=lost(), lp=lostPct();
  return `
  <div class="gcard tight">${lineChartPremium(w.map(x=>({x:x.date,y:x.peso})),S.profile.pesoMeta)}</div>
  <div class="grid3">
    <div class="stat-tile2"><div class="k">Peso atual</div><div class="v" style="font-size:20px">${nf(currentWeight())}<small> kg</small></div></div>
    <div class="stat-tile2"><div class="k">Perda total</div><div class="v" style="font-size:20px">${l>=0?'−':'+'}${nf(Math.abs(l))}<small> kg</small></div></div>
    <div class="stat-tile2"><div class="k">% Perda</div><div class="v" style="font-size:20px">${nf(Math.abs(lp))}<small>%</small></div></div>
  </div>
  ${evEvolutionCard()}`;
}
function evImcTab(){
  const cur=imc();
  return `
  <div class="gcard tight">${lineChartPremium(imcSeries(),null,'')}</div>
  <div class="grid2">
    <div class="stat-tile2"><div class="k">IMC atual</div><div class="v" style="font-size:20px">${cur?nf(cur):'—'}</div></div>
    <div class="stat-tile2"><div class="k">Classificação</div><div class="v" style="font-size:15px">${imcClass(cur)||'—'}</div></div>
  </div>`;
}
function evMedidasTab(w){
  const measures=[['cintura','Cintura'],['quadril','Quadril'],['abdomen','Abdômen'],['coxa','Coxa'],['braco','Braço']];
  return `<div class="gcard">
    ${measures.map(([k,lbl])=>{
      const withM=w.filter(x=>x[k]!=null);
      if(withM.length<1) return '';
      const f=withM[0][k], l=withM[withM.length-1][k], d=+(l-f).toFixed(1);
      return `<div class="between" style="padding:12px 0;border-bottom:1px solid var(--nv-border)">
        <div><div style="font-weight:600;font-size:14px;color:var(--tx-1)">${lbl}</div>
        <div style="font-size:12px;color:var(--tx-3)">${nf(l)} cm agora</div></div>
        <span class="delta2 ${d<=0?'down':'up'}">${d<=0?'−':'+'}${nf(Math.abs(d))} cm</span></div>`;
    }).join('')||`<p style="font-size:13px;color:var(--tx-2)">Adicione medidas em uma pesagem para ver a evolução.</p>`}
  </div>`;
}
function evolucaoView(){
  const w=sortedWeigh();
  const photos=S.weighings.filter(x=>x.foto).sort((a,b)=>a.date<b.date?-1:1);
  return `
  <div class="scr-title">Evolução</div>
  <div class="scr-sub">Peso, medidas e fotos. Às vezes o peso trava, mas as medidas seguem mudando.</div>

  <div class="seg-glass">
    <button class="${EV_TAB==='peso'?'on':''}" onclick="evSetTab('peso')">Peso</button>
    <button class="${EV_TAB==='imc'?'on':''}" onclick="evSetTab('imc')">IMC</button>
    <button class="${EV_TAB==='medidas'?'on':''}" onclick="evSetTab('medidas')">Medidas</button>
  </div>

  ${EV_TAB==='peso'?evPesoTab(w):EV_TAB==='imc'?evImcTab():evMedidasTab(w)}

  <button class="btn-pill block" style="margin-top:16px" onclick="openSheet('pesar')">${icon('plus',true)} Nova pesagem</button>

  <div class="gcard tight" style="margin-top:16px;cursor:pointer" onclick="go('mais','bio')">
    <div class="row">
      <div class="badge-glow">${icon('pulse')}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:15px;color:var(--tx-1)">Bioimpedância</div>
      <div style="font-size:12.5px;color:var(--tx-3);margin-top:1px">${(S.bio&&S.bio.length)?'Última: '+nf((()=>{const b=[...S.bio].sort((a,c)=>a.date<c.date?1:-1)[0];return b.gordura;})())+'% de gordura':'Registre sua composição corporal'}</div></div>
      <div style="color:var(--tx-3)">${icon('chevron')}</div>
    </div>
  </div>

  <div class="gcard" style="margin-top:16px">
    <div class="between"><span class="eyebrow2" style="margin:0">Fotos de evolução</span>
    <button class="btn-pill btn-sm ghost" onclick="openSheet('pesar')">Adicionar</button></div>
    ${photos.length?`<div class="gallery" style="margin-top:12px">
      ${photos.length>=2?`<div class="photo"><img src="${photos[0].foto}" alt="Foto de evolução antes, ${fmtBR(photos[0].date)}"><span class="cap">Antes · ${fmtBR(photos[0].date)}</span></div>
      <div class="photo"><img src="${photos[photos.length-1].foto}" alt="Foto de evolução agora, ${fmtBR(photos[photos.length-1].date)}"><span class="cap">Agora · ${fmtBR(photos[photos.length-1].date)}</span></div>`
      :`<div class="photo"><img src="${photos[0].foto}" alt="Foto de evolução, ${fmtBR(photos[0].date)}"><span class="cap">${fmtBR(photos[0].date)}</span></div>`}
    </div>`:`<p style="font-size:13px;padding:10px 0;color:var(--tx-3);text-align:center">Nenhuma foto ainda. Uma foto por mês já mostra bastante diferença.</p>`}
  </div>`;
}

/* ============================================================
   TELA · DIÁRIO (registro do dia)
   ============================================================ */
const SINTOMAS=['Náusea','Azia','Vômito','Constipação','Diarreia','Dor de cabeça','Fadiga','Gases','Sem sintomas'];
const EXERC=['Caminhada','Musculação','Corrida','Bike','Yoga','Natação'];
const APET=['Muito baixo','Baixo','Normal','Alto','Muito alto'];
const FOME=['Ansiedade','Tédio','Fome','Tristeza','Nenhuma'];
const HUMORS=['😞','😕','😐','🙂','😄'];

function todayLog(){
  const iso=todayISO();
  if(!S.dailyLogs[iso]) S.dailyLogs[iso]={sintomas:[],agua:0,proteina:0,exercicios:[],humor:0,apetite:'',fomeEmocional:''};
  const L=S.dailyLogs[iso];
  if(!L.prot) L.prot={ovo:0,frango:0,carne:0,peixe:0,queijo:0,iogurte:0,leite:0,outros:L.proteina||0};
  return L;
}
function diarioView(){
  const L=todayLog();
  const glasses=Math.round((L.agua||0)/0.25);
  const metaGlasses=Math.round(S.profile.metaAgua/0.25);
  return `
  <div class="scr-title">Diário de hoje</div>
  <div class="scr-sub">${WD[new Date().getDay()]}, ${fmtBRy(todayISO())} · leva menos de um minuto.</div>

  <div class="gcard">
    <h3>Como você está?</h3>
    <div class="mood-row">
      ${HUMORS.map((e,i)=>`<button type="button" class="mood-btn ${L.humor===i+1?'active':''}" onclick="setHumor(${i+1})" style="font-size:22px">${e}</button>`).join('')}
    </div>
  </div>

  <div class="gcard">
    <h3>Sintomas</h3>
    <div class="chips">
      ${SINTOMAS.map(s=>`<button class="chip-glass ${s!=='Sem sintomas'?'rose':''} ${L.sintomas.includes(s)?'active':''}" onclick="toggleSint('${s}')">${s}</button>`).join('')}
    </div>
  </div>

  <div class="gcard">
    <div class="between"><h3 class="mb0">Água</h3><span class="muted" style="font-weight:800">${nf(L.agua||0)} / ${nf(S.profile.metaAgua)} L</span></div>
    <div class="waterrow" style="margin-top:12px">
      ${Array.from({length:metaGlasses}).map((_,i)=>dropSVG(i<glasses,i)).join('')}
    </div>
    <div class="quickrow">
      <button class="btn-pill btn-sm ghost" onclick="addWater(0.25)">+ 1 copo (250 ml)</button>
      <button class="btn-pill btn-sm ghost neutral" onclick="addWater(-0.25)">− copo</button>
    </div>
  </div>

  <div class="gcard">
    <div class="between"><h3 class="mb0">Meta proteica</h3><span class="muted" style="font-weight:800">${L.proteina||0} / ${S.profile.metaProteina} g</span></div>
    ${proteinBar(L.proteina||0,S.profile.metaProteina)}
    <div class="muted" style="font-size:12.5px;margin:2px 0 12px">${Math.round(Math.min(100,(L.proteina||0)/S.profile.metaProteina*100))}% da meta atingida hoje</div>
    <button class="btn-pill block ghost" onclick="go('proteina')">${icon('plus',true)} Registrar por alimento</button>
  </div>

  <div class="gcard">
    <h3>Exercício</h3>
    <div class="chips">${EXERC.map(e=>`<button class="chip-glass ${L.exercicios.includes(e)?'active':''}" onclick="toggleEx('${e}')">${e}</button>`).join('')}</div>
  </div>

  <div class="gcard">
    <h3>Apetite hoje</h3>
    <div class="chips">${APET.map(a=>`<button class="chip-glass ${L.apetite===a?'active':''}" onclick="setApet('${a}')">${a}</button>`).join('')}</div>
  </div>

  <div class="gcard">
    <h3>Vontade de comer por…</h3>
    <div class="chips">${FOME.map(f=>`<button class="chip-glass ${f!=='Nenhuma'?'rose':''} ${L.fomeEmocional===f?'active':''}" onclick="setFome('${f}')">${f}</button>`).join('')}</div>
  </div>`;
}

/* ============================================================
   TELA · MAIS (hub)
   ============================================================ */
function maisView(){
  /* Mesmas 10 funcionalidades de sempre (mesmos ids/onclick de go('mais',id)),
     agora só reorganizadas em grupos temáticos — nenhuma foi removida,
     renomeada ou teve o destino alterado. */
  const grupos=[
    ['Minha jornada',[
      {id:'jornada',t:'Minha jornada',s:'Resumo automático da sua evolução',ic:'spark',amber:true},
      {id:'timeline',t:'Linha do tempo',s:'Todos os eventos em ordem',ic:'clock'},
      {id:'conquistas',t:'Conquistas',s:'Marcos do tratamento',ic:'medal',amber:true},
      {id:'insights',t:'Insights',s:'Padrões cruzados dos seus registros',ic:'chart'},
      {id:'planoacao',t:'Plano de ação',s:'O que revisar na próxima consulta',ic:'flag'},
    ]],
    ['Saúde',[
      {id:'bio',t:'Bioimpedância',s:'Composição corporal ao longo do tempo',ic:'pulse'},
      {id:'exames',t:'Exames',s:'Guarde e acompanhe resultados',ic:'flask'},
      {id:'stats',t:'Estatísticas',s:'Números do seu tratamento',ic:'grid'},
      {id:'calc',t:'Calculadora',s:'Quanto falta para cada meta',ic:'calc'},
    ]],
    ['Relatórios',[
      {id:'relatorio',t:'Relatório de Evolução',s:'Gere um PDF do seu progresso',ic:'doc',amber:true},
    ]],
    ['Agenda',[
      {id:'agenda',t:'Agenda',s:'Consultas, exames e retornos',ic:'cal'},
    ]],
  ];
  const row=(ic,t,s,onclick,amber)=>`<button type="button" class="mais-item" onclick="${onclick}">
    <span class="badge-glow${amber?' amber':''}">${icon(ic)}</span>
    <span class="mais-item-text"><span class="mais-item-t">${t}</span><span class="mais-item-s">${s}</span></span>
    <span class="mais-item-chevron">${icon('chevron')}</span>
  </button>`;
  return `
  <div class="scr-title">Mais</div>
  <div class="scr-sub">Sua jornada em detalhe.</div>
  ${grupos.map(([label,items])=>`
  <div class="gcard mais-group">
    ${items.length>1?`<div class="eyebrow2">${label}</div>`:''}
    <div class="mais-list">${items.map(it=>row(it.ic,it.t,it.s,`go('mais','${it.id}')`,it.amber)).join('')}</div>
  </div>`).join('')}
  <div class="gcard mais-group">
    <div class="mais-list">${row('gear','Configurações e dados','Perfil, metas e preferências do app',"openSheet('perfil')")}</div>
  </div>`;
}
function maisSubView(sub){
  const back=`<button class="btn btn-outline btn-sm" onclick="go('mais')" style="margin-bottom:14px">${icon('chevron',false,true)} Voltar</button>`;
  const backPremium=`<button class="btn-pill btn-sm ghost neutral" onclick="go('mais')" style="margin-bottom:14px">${icon('chevron',false,true)} Voltar</button>`;
  if(sub==='jornada') return backPremium+journeyView();
  if(sub==='insights') return backPremium+renderComGate(FEATURES?.INSIGHTS, insightsView);
  if(sub==='planoacao') return backPremium+renderComGate(FEATURES?.ACTION_PLAN, planoAcaoView);
  if(sub==='conquistas') return backPremium+achView();
  if(sub==='timeline') return backPremium+renderComGate(FEATURES?.TIMELINE, timelineView);
  if(sub==='bio') return backPremium+bioView();
  if(sub==='relatorio') return relatorioView(); /* cabeçalho próprio (Quiet Premium), sem o "Voltar" legado */
  if(sub==='stats') return backPremium+statsView();
  if(sub==='calc') return backPremium+calcView();
  if(sub==='exames') return backPremium+examesView();
  if(sub==='agenda') return backPremium+agendaView();
  return back;
}

function journeyView(){
  const l=lost(); const pct=lostPct();
  const measWith=S.weighings.filter(x=>x.cintura!=null).sort((a,b)=>a.date<b.date?-1:1);
  const cinturaDelta=measWith.length>=2?(measWith[0].cintura-measWith[measWith.length-1].cintura).toFixed(1):null;
  const txt=`Você iniciou o tratamento em ${fmtBRy(S.profile.dataInicio)} com ${nf(S.profile.pesoInicial)} kg. `+
    `Após ${daysTreat()} dias, já ${l>=0?'perdeu':'variou'} ${nf(Math.abs(l))} kg (${nf(Math.abs(pct))}% do peso inicial), `+
    `realizou ${S.applications.length} aplicações de ${esc(S.profile.medicamento)} e chegou à dose de ${esc(S.profile.doseAtual)} ${esc(S.profile.unidade)}. `+
    (cinturaDelta&&cinturaDelta>0?`Sua cintura reduziu cerca de ${nf(cinturaDelta)} cm no período. `:'')+
    `${l>=0&&currentWeight()>S.profile.pesoMeta?`Faltam ${nf(currentWeight()-S.profile.pesoMeta)} kg para sua meta de ${nf(S.profile.pesoMeta)} kg.`:'Você alcançou sua meta de peso.'}`;
  return `
  <div class="scr-title" style="margin-bottom:14px">Minha jornada</div>
  <div class="gcard journey">
    ${logoSVG(30)}
    <p class="q" style="margin-top:14px">${txt}</p>
    <div class="sig">Resumo gerado automaticamente</div>
  </div>
  <p class="muted center" style="font-size:12.5px;margin-top:14px">Você pode mostrar este resumo na próxima consulta.</p>
  <button class="btn-pill block" onclick="shareJourney()">${icon('share',true)} Copiar resumo</button>`;
}

/* ---------- card fixo: acompanhamento profissional ---------- */
function careCard(){
  const cons=[...(S.agenda||[])].filter(a=>/consulta|retorno/i.test(a.tipo)).sort((a,b)=>a.date<b.date?-1:1);
  const upcoming=cons.find(a=>daysBetween(todayISO(),a.date)>=0);
  const past=[...cons].reverse().find(a=>daysBetween(todayISO(),a.date)<0);
  let line='';
  if(upcoming){const d=daysBetween(todayISO(),upcoming.date);
    line=d===0?'📅 Você tem uma consulta marcada para hoje.':`📅 Sua próxima consulta é em ${d} ${plural(d,'dia','dias')}, em ${fmtBRy(upcoming.date)}.`;}
  else if(past){const d=Math.abs(daysBetween(todayISO(),past.date));
    if(d>=45) line=`📅 Faz ${d} dias desde seu último retorno. Considere agendar uma nova consulta.`;}
  else line='📅 Você ainda não tem consultas registradas na agenda.';
  return `<div class="gcard" style="border:1.5px solid var(--accent)">
    <div class="row" style="gap:12px;align-items:flex-start">
      <div class="badge-glow">${icon('steth')}</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:14px;margin-bottom:5px;color:var(--tx-1)">Seu tratamento é conduzido por profissionais</div>
        <p style="margin:0;font-size:13px;line-height:1.55;color:var(--tx-2)">O Compasso organiza seus registros, mas quem conduz o tratamento é a sua equipe de saúde. O <b>acompanhamento médico</b> é essencial para avaliar dose, prescrição e segurança; o <b>acompanhamento nutricional</b> garante proteína adequada, preservação da massa magra e o manejo dos sintomas ao longo do uso do análogo de GLP-1.</p>
        ${line?`<p style="margin:11px 0 0;font-size:12.5px;font-weight:700;color:var(--tx-1)">${line}</p>`:''}
        <button class="btn-pill btn-sm ghost" style="margin-top:12px" onclick="openSheet('compromisso')">${icon('cal',true)} Agendar consulta</button>
      </div>
    </div>
  </div>`;
}

function insightsView(){
  const ctx=buildInsightContext(S.profile.dataInicio, todayISO());
  const ins=INSIGHTS ? INSIGHTS.gerar(ctx) : [];
  return `<div class="scr-title" style="margin-bottom:6px">Insights</div>
  <div class="scr-sub">Padrões observados nos seus registros. Servem para você se conhecer melhor e não substituem a orientação do seu médico e nutricionista.</div>
  ${careCard()}
  ${ins.length?ins.map(i=>{const care=[i.justificativa,i.care].filter(Boolean).join(' ');
    const toneCls=i.tone==='amber'?'warn':i.tone==='rose'?'danger':'';
    return `<div class="insight2 ${toneCls}"><span class="ico">${icon(i.icon||'spark')}</span>
    <p>${i.text}${care?`<span class="care">${care}</span>`:''}</p></div>`;}).join('')
    :'<div class="gcard center muted" style="font-size:13px">Registre alguns dias no diário para começarmos a encontrar padrões.</div>'}`;
}

const PLANO_TONE={alta:'danger',media:'amber',baixa:''};
const PLANO_STATUS_LABEL={nova:'Nova',em_acompanhamento:'Em acompanhamento',resolvida:'Resolvida'};
function planoAcaoView(){
  const acoes=ACTIONPLAN ? ACTIONPLAN.gerar(buildActionPlanContext()) : [];
  return `<div class="scr-title" style="margin-bottom:6px">Plano de ação</div>
  <div class="scr-sub">O que revisar na próxima consulta, a partir dos seus registros. Não substitui a orientação do seu médico e nutricionista.</div>
  <div class="gcard mt14"><div class="hist-list">
    ${acoes.length?acoes.map(a=>`<div class="hist-item">
      <div class="badge-glow ${PLANO_TONE[a.prioridade]}">${icon('flag')}</div>
      <div><div class="t">${esc(a.titulo)}</div><div class="s">${esc(a.motivo)} ${esc(a.descricao)}</div></div>
      <div class="r" style="font-size:11px">${a.acionavel===false?'':PLANO_STATUS_LABEL[a.status]+(a.status!=='resolvida'?`<br><button class="btn-pill btn-sm ghost neutral" style="margin-top:4px" onclick="avancarStatusAcao('${esc(a.id)}')">Avançar</button>`:'')}</div>
    </div>`).join('')
      :'<p class="muted center" style="font-size:13px;padding:8px 0">Nenhuma ação pendente no momento — tudo em dia.</p>'}
  </div></div>`;
}
function avancarStatusAcao(id){
  if(!ACTIONPLAN) return;
  const acao=ACTIONPLAN.gerar(buildActionPlanContext()).find(a=>a.id===id);
  if(!acao) return;
  const proximo = acao.status==='nova' ? 'em_acompanhamento' : 'resolvida';
  ACTIONPLAN.atualizarStatus(acao, proximo);
  render();
}

/* ---------- gating (Sprint P — licenciamento) ----------
   Nenhuma tela verifica plano diretamente: renderComGate() é o único
   ponto que decide entre mostrar a tela real ou o aviso Premium
   contextual. Falha aberto (mostra a tela) se LICENSE ainda não
   carregou — nunca bloqueia por causa de uma inicialização lenta. */
function renderComGate(feature, montarTela){
  if(!LICENSE || LICENSE.can(feature)) return montarTela();
  return premiumGateView(feature);
}
const FEATURE_BENEFICIO={
  timeline:{titulo:'Linha do tempo', desc:'Veja toda a sua jornada organizada em uma linha do tempo única — aplicações, pesagens, exames e conquistas, tudo em ordem.'},
  insights:{titulo:'Insights automáticos', desc:'Padrões identificados automaticamente nos seus registros, sem precisar analisar nada manualmente.'},
  actionPlan:{titulo:'Plano de ação', desc:'Saiba exatamente o que revisar na próxima consulta, priorizado pra você.'},
  reports:{titulo:'Relatórios em PDF', desc:'Gere relatórios completos da sua evolução pra levar ao médico ou nutricionista.'},
  backup:{titulo:'Backup em nuvem', desc:'Seus dados protegidos e sincronizados entre dispositivos.'},
};
function premiumGateView(feature){
  const b=FEATURE_BENEFICIO[feature]||{titulo:'Recurso Premium', desc:'Esse recurso faz parte do plano Premium do Compasso.'};
  return `<div class="gcard center" style="padding:32px 20px">
    <div class="badge-glow amber" style="margin:0 auto 14px">${icon('medal')}</div>
    <div class="scr-title" style="font-size:19px;margin-bottom:6px">${esc(b.titulo)}</div>
    <p class="muted" style="font-size:13.5px;margin-bottom:18px">${esc(b.desc)}</p>
    <button class="btn-pill block" onclick="go('premium')">Ver planos Premium</button>
  </div>`;
}

/* Preços placeholder — decisão de negócio, trivial de trocar aqui quando
   definida. Sem cobrança real nesta sprint (ver assinarPlano()). */
const PRECOS={monthly:'R$ 29,90/mês', yearly:'R$ 239,90/ano'};
let PREMIUM_VALIDANDO=false;
function premiumView(){
  const plano=LICENSE?LICENSE.getPlan():'free';
  const status=LICENSE?LICENSE.getStatus():'active';
  const beneficios=['Linha do tempo','Insights automáticos','Plano de ação','Relatórios em PDF','Backup em nuvem','Recursos futuros inclusos'];
  return `
  <div class="ap-head ap-head-screen">
    <button type="button" class="ap-back" onclick="go('mais')" aria-label="Voltar">${CAL_CHEV_L}</button>
    <span class="ap-title">Compasso Premium</span>
    <span class="ap-head-spacer"></span>
  </div>
  <p class="scr-sub">Desbloqueie todo o potencial do seu acompanhamento.</p>

  ${plano!=='free'?`<div class="gcard tight" style="margin-bottom:14px"><div class="between">
    <div><div class="eyebrow2" style="margin:0">Seu plano atual</div><div style="font-size:15px;font-weight:700;color:var(--tx-1);margin-top:4px">${plano==='monthly'?'Premium Mensal':'Premium Anual'}</div></div>
    <span class="badge-ico" style="${status==='active'?'background:var(--accent-soft);color:var(--accent)':'background:var(--warn2-soft);color:var(--warn2)'}">${icon('check')}</span>
  </div></div>`:''}

  <div class="gcard tight" style="margin-bottom:14px">
    <div class="eyebrow2">O que você desbloqueia</div>
    ${beneficios.map(b=>`<div class="row" style="gap:10px;padding:8px 0"><span style="color:var(--accent-light)">${icon('check')}</span><span style="font-size:13.5px;color:var(--tx-2)">${esc(b)}</span></div>`).join('')}
  </div>

  <div class="gcard tight" style="border:1.5px solid var(--accent);position:relative;margin-bottom:14px">
    <span style="position:absolute;top:-10px;right:14px;font-size:10.5px;font-weight:800;color:var(--tx-1);background:var(--accent);padding:3px 10px;border-radius:999px">MAIS POPULAR</span>
    <div class="eyebrow2">Premium Anual</div>
    <div style="font-size:22px;font-weight:800;color:var(--tx-1);margin:4px 0 2px">${PRECOS.yearly}</div>
    <p style="font-size:12.5px;color:var(--tx-3);margin-bottom:14px">Equivale a menos por mês do que o plano mensal.</p>
    <button class="btn-pill block" onclick="assinarPlano('yearly')">Assinar plano anual</button>
  </div>

  <div class="gcard tight" style="margin-bottom:14px">
    <div class="eyebrow2">Premium Mensal</div>
    <div style="font-size:22px;font-weight:800;color:var(--tx-1);margin:4px 0 2px">${PRECOS.monthly}</div>
    <p style="font-size:12.5px;color:var(--tx-3);margin-bottom:14px">Cancele quando quiser.</p>
    <button class="btn-pill block ghost neutral" onclick="assinarPlano('monthly')">Assinar plano mensal</button>
  </div>

  <button class="btn-pill block ghost neutral" onclick="restaurarCompraPremium()">${PREMIUM_VALIDANDO?'Validando…':'Restaurar compra'}</button>
  <p class="muted center" style="font-size:11.5px;margin-top:14px">A cobrança ainda não está disponível nesta versão do app.</p>`;
}
function assinarPlano(plano){
  toast('Assinatura ainda não disponível nesta versão — em breve!');
}
async function restaurarCompraPremium(){
  if(!LICENSE || PREMIUM_VALIDANDO) return;
  PREMIUM_VALIDANDO=true; render();
  const resultado=await LICENSE.refresh();
  PREMIUM_VALIDANDO=false;
  atualizarPermissaoDeSync();
  toast(resultado.plan!=='free' ? 'Assinatura restaurada!' : 'Nenhuma assinatura encontrada.');
  render();
}

function achView(){
  const list=achievements();
  return `<div class="scr-title" style="margin-bottom:6px">Conquistas</div>
  <div class="scr-sub">${list.filter(a=>a.on).length} de ${list.length} desbloqueadas.</div>
  <div class="ach">${list.map(a=>`<div class="medal ${a.on?'on':''}">
    <div class="ic">${a.ic}</div><div class="mt">${a.t}</div><div class="ms">${a.s}</div></div>`).join('')}</div>`;
}

function timelineView(){
  const TONE_POR_CATEGORIA={tratamento:'amber',dose:'amber',conquistas:'amber'};
  const ev=TIMELINE ? TIMELINE.gerar(buildTimelineContext()) : [];
  const ordenado=[...ev].reverse(); // motor devolve cronológico ascendente; tela mostra mais recente primeiro
  return `<div class="scr-title" style="margin-bottom:14px">Linha do tempo</div>
  <div class="gcard"><div class="tl">
    ${ordenado.slice(0,40).map(e=>{
      const futuro = e.categoria==='agenda' && e.payload && e.payload.futuro;
      const tone = futuro ? 'future' : (TONE_POR_CATEGORIA[e.categoria]||'');
      const badge = futuro ? (()=>{const d=daysBetween(todayISO(),e.data);
        return ` <span class="faint" style="font-weight:700">· ${d===1?'amanhã':'em '+d+'d'}</span>`;})() : '';
      return `<div class="ev ${tone}"><div class="d">${fmtBRy(e.data)}</div><div class="txt">${e.titulo} · ${e.descricao}${badge}</div></div>`;
    }).join('')
      ||'<p class="muted center" style="font-size:13px;padding:8px 0">Ainda não há eventos suficientes para montar a linha do tempo.</p>'}
  </div></div>`;
}

function statsView(){
  const waterTotal=Object.values(S.dailyLogs).reduce((s,l)=>s+(l.agua||0),0);
  const photos=S.weighings.filter(x=>x.foto).length;
  const doses=S.applications.map(a=>parseFloat(String(a.dose).replace(',','.'))).filter(n=>!isNaN(n));
  const avgDose=doses.length?doses.reduce((a,b)=>a+b,0)/doses.length:0;
  const cards=[
    ['Dias em tratamento',daysTreat()],
    ['Peso perdido',nf(lost())+' kg'],
    ['Total de aplicações',S.applications.length],
    ['Dose média',nf(avgDose,avgDose%1?1:0)+' '+S.profile.unidade],
    ['Pesagens registradas',S.weighings.length],
    ['Água acumulada',nf(waterTotal,0)+' L'],
    ['Fotos registradas',photos],
    ['IMC atual',nf(imc())],
  ];
  if(S.bio&&S.bio.length){const last=[...S.bio].sort((a,b)=>a.date<b.date?1:-1)[0];
    if(last.gordura!=null)cards.push(['Gordura corporal',nf(last.gordura)+'%']);
    if(last.massaMagraPct!=null)cards.push(['Massa muscular',nf(last.massaMagraPct)+'%']);}
  return `<div class="scr-title" style="margin-bottom:14px">Estatísticas</div>
  <div class="grid2">${cards.map(([k,v])=>`<div class="stat-tile2"><div class="k">${k}</div><div class="v" style="font-size:22px">${v}</div></div>`).join('')}</div>`;
}

function calcView(){
  const cw=currentWeight(); const h=S.profile.altura/100;
  const targets=[
    ['Sua meta',S.profile.pesoMeta],
    ['IMC 24,9 (limite saudável)',h?+(24.9*h*h).toFixed(1):null],
    ['5% do peso inicial',+(S.profile.pesoInicial*0.95).toFixed(1)],
    ['10% do peso inicial',+(S.profile.pesoInicial*0.90).toFixed(1)],
  ];
  return `<div class="scr-title" style="margin-bottom:6px">Calculadora</div>
  <div class="scr-sub">Quanto falta para cada objetivo, a partir de ${nf(cw)} kg.</div>
  <div class="gcard"><div class="hist-list">
    ${targets.map(([k,t])=>{if(t==null)return'';const d=+(cw-t).toFixed(1);
      return `<div class="hist-item"><div class="badge-glow ${d<=0?'':'amber'}">${d<=0?icon('check'):icon('flag')}</div>
      <div><div class="t">${k}</div><div class="s">Alvo: ${nf(t)} kg</div></div>
      <div class="r" style="color:${d<=0?'var(--accent)':'var(--tx-1)'}">${d<=0?'Alcançado':'faltam '+nf(d)+' kg'}</div></div>`;}).join('')}
  </div></div>`;
}

function examesView(){
  const ex=[...S.exams].sort((a,b)=>a.date<b.date?1:-1);
  const byType={}; ex.forEach(e=>{(byType[e.tipo]=byType[e.tipo]||[]).push(e);});
  return `<div class="scr-title" style="margin-bottom:6px">Exames</div>
  <div class="scr-sub">Guarde resultados e acompanhe a evolução.</div>
  <button class="btn-pill block" onclick="openSheet('exame')">${icon('plus',true)} Novo exame</button>
  <div class="gcard mt14"><div class="hist-list">
    ${ex.length?ex.map(e=>`<div class="hist-item"><div class="badge-glow">${icon('flask')}</div>
      <div><div class="t">${esc(e.tipo)}</div><div class="s">${fmtBRy(e.date)}</div></div>
      <div class="r">${esc(e.valor)}</div></div>`).join('')
      :'<p class="muted center" style="font-size:13px;padding:8px 0">Nenhum exame guardado ainda.</p>'}
  </div></div>`;
}

function agendaView(){
  const ag=[...S.agenda].sort((a,b)=>a.date<b.date?-1:1).filter(a=>daysAgo(a.date)<=0||true);
  return `<div class="scr-title" style="margin-bottom:6px">Agenda</div>
  <div class="scr-sub">Consultas, exames e retornos.</div>
  <button class="btn-pill block" onclick="openSheet('compromisso')">${icon('plus',true)} Novo compromisso</button>
  <div class="gcard mt14"><div class="hist-list">
    ${ag.length?ag.map(a=>{const d=daysBetween(todayISO(),a.date);
      return `<div class="hist-item"><div class="badge-glow ${d<0?'':'amber'}">${icon('cal')}</div>
      <div><div class="t">${esc(a.tipo)}</div><div class="s">${esc(a.obs||'')}</div></div>
      <div class="r" style="font-size:12px">${fmtBRy(a.date)}<br><span style="font-weight:700;color:var(--tx-3)">${d===0?'hoje':d>0?'em '+d+'d':Math.abs(d)+'d atrás'}</span></div></div>`;}).join('')
      :'<p class="muted center" style="font-size:13px;padding:8px 0">Nenhum compromisso agendado.</p>'}
  </div></div>`;
}

/* ============================================================
   INSIGHTS — motor centralizado em js/insights.js (Sprint L).
   insightsView()/topInsight() consomem via INSIGHTS.gerar();
   nenhuma regra de análise vive mais aqui.
   ============================================================ */

/* ============================================================
   CONQUISTAS
   ============================================================ */
function achievements(){
  const l=lost(); const dt=daysTreat(); const na=S.applications.length;
  const firstPhoto=S.weighings.find(x=>x.foto);
  const mk=(cond,ic,t,s,date)=>({on:!!cond,ic,t,s,date:cond?date:null});
  const w=sortedWeigh();
  const dateAtLoss=kg=>{for(const x of w){if(S.profile.pesoInicial-x.peso>=kg)return x.date;}return null;};
  const startPlus=d=>{const dt2=new Date(parseISO(S.profile.dataInicio));dt2.setDate(dt2.getDate()+d);return todayISO(dt2);};
  return [
    mk(l>=1,'🌱','Primeiro kg','−1 kg alcançado',dateAtLoss(1)),
    mk(l>=5,'🎯','−5 kg','Marco importante',dateAtLoss(5)),
    mk(l>=10,'🏆','−10 kg','Grande conquista',dateAtLoss(10)),
    mk(dt>=30,'📅','Primeiro mês','30 dias de tratamento',startPlus(30)),
    mk(dt>=90,'🔥','3 meses','Consistência',startPlus(90)),
    mk(dt>=180,'💎','6 meses','Persistência',startPlus(180)),
    mk(dt>=100,'💯','100 dias','Cem dias de jornada',startPlus(100)),
    mk(firstPhoto,'📸','Primeira foto','Registro visual',firstPhoto?firstPhoto.date:null),
  ];
}

/* Snapshot só-leitura para js/notifications.js — reaproveita as mesmas funções
   derivadas já usadas pelas telas. Lê S.dailyLogs[hoje] diretamente (não usa
   todayLog(), que cria o registro do dia se não existir — isso poluiria S com
   um dailyLog vazio toda vez que o app abrisse, mesmo sem o usuário ter feito
   nada, e isso seria sincronizado como um registro real na Sprint J). */
function buildNotifStatus(){
  const L = (S.dailyLogs && S.dailyLogs[todayISO()]) || {};
  const w = sortedWeigh();
  const la = lastApp();
  return {
    diaAplicacao: S.profile.diaAplicacao,
    ultimaAplicacaoDate: la ? la.date : null,
    ultimaPesagemDate: w.length ? w[w.length-1].date : null,
    aguaHoje: L.agua||0, metaAgua: S.profile.metaAgua,
    proteinaHoje: L.proteina||0, metaProteina: S.profile.metaProteina,
    agenda: S.agenda||[],
    pen: penRemaining(),
    achievements: achievements(),
  };
}

/* ============================================================
   SHEETS (modais de registro)
   ============================================================ */
let SHEET=null, tmp={};
function openSheet(id){SHEET=id;tmp={};renderSheet();}
function closeSheet(){const b=document.getElementById('bd');if(b)b.remove();SHEET=null;}
function renderSheet(){
  let old=document.getElementById('bd'); if(old)old.remove();
  if(!SHEET)return;
  const bd=document.createElement('div');bd.className='backdrop-glass';bd.id='bd';
  bd.onclick=e=>{if(e.target===bd)closeSheet();};
  bd.innerHTML=`<div class="sheet-glass"><div class="grab"></div>${sheetBody(SHEET)}</div>`;
  document.body.appendChild(bd);
  bindSheet(SHEET);
}
function sheetBody(id){
  if(id==='menuadd') return `<h2>Registrar</h2><p class="sub">O que você quer anotar agora?</p>
    <div class="quickrow" style="grid-template-columns:1fr 1fr;gap:10px">
      <button class="btn-pill" onclick="closeSheet();openSheet('aplicar')">${icon('syringe',true)} Aplicação</button>
      <button class="btn-pill ghost neutral" onclick="closeSheet();openSheet('pesar')">${icon('scale',true)} Pesagem</button>
      <button class="btn-pill ghost neutral" onclick="closeSheet();go('diario')">${icon('book',true)} Diário</button>
      <button class="btn-pill ghost neutral" onclick="closeSheet();openSheet('exame')">${icon('flask',true)} Exame</button>
    </div>`;
  if(id==='aplicar'){
    tmp.local=tmp.local||(lastAppNext());
    tmp.date=tmp.date||todayISO();
    tmp.weekStart=tmp.weekStart||apMonday(tmp.date);
    tmp.humor=tmp.humor||todayLog().humor||0;
    const meds=['Ozempic','Wegovy','Mounjaro','Zepbound','Saxenda','Outro'];
    const medIdx=Math.max(0,meds.indexOf(S.profile.medicamento));
    return `<div class="ap-head">
        <button type="button" class="ap-back" onclick="closeSheet()" aria-label="Fechar">${CAL_CHEV_L}</button>
        <span class="ap-title">Nova aplicação</span>
        <span class="ap-head-spacer"></span>
      </div>
      ${apCalendarHTML()}
      <div class="glass-field">
        <label>Medicamento</label>
        ${comboField('ap-med','pill',meds.map(m=>({value:m,label:m})),medIdx)}
      </div>
      <div class="glass-field"><label for="ap-dose">Dose aplicada</label>
        <label class="field-wrap" for="ap-dose"><input id="ap-dose" value="${esc(S.profile.doseAtual)}" inputmode="decimal" style="font-size:19px;font-weight:600" placeholder="0,0"><span style="color:var(--tx-3);font-size:13px;white-space:nowrap">${esc(S.profile.unidade)}</span></label>
      </div>
      <div class="ap-section">
        <div class="eyebrow2">Local da aplicação</div>
        <div class="gcard tight">${bodyMapSVG(lastApp()?lastApp().local:null,tmp.local,true,true)}
          <div class="center" style="font-size:13px;margin-top:6px;color:var(--tx-2)">Selecionado: <b id="ap-localtxt" style="color:var(--accent-light)">${esc(tmp.local)}</b></div></div>
      </div>
      <div class="ap-section">
        <div class="eyebrow2">Como está se sentindo?</div>
        <div class="mood-row">
          ${MOOD_LABELS.map((lbl,i)=>`<button type="button" class="mood-btn ${tmp.humor===i+1?'active':''}" id="mood-${i+1}" onclick="apSetHumor(${i+1})">${moodIcon(i+1)}<span>${lbl}</span></button>`).join('')}
        </div>
      </div>
      <div class="glass-field"><label for="ap-obs">Observações (opcional)</label>
        <label class="field-wrap area" for="ap-obs"><textarea id="ap-obs" rows="2" placeholder="Como você se sentiu hoje?"></textarea></label>
      </div>
      <label class="row" style="gap:8px;margin:2px 0 18px;font-size:13px;color:var(--tx-2)"><input type="checkbox" id="ap-pen" checked style="width:auto;accent-color:var(--accent)"> Descontar 1 aplicação da caneta atual</label>
      <button class="btn-pill block" onclick="saveApp()">Salvar aplicação</button>`;
  }
  if(id==='pesar'){
    return `<h2>Nova pesagem</h2><p class="sub">Peso, medidas e uma foto (opcional).</p>
      <div class="glass-field-2"><div class="glass-field"><label for="pw-date">Data</label><label class="field-wrap" for="pw-date"><input type="date" id="pw-date" value="${todayISO()}"></label></div>
      <div class="glass-field"><label for="pw-peso">Peso (kg)</label><label class="field-wrap" for="pw-peso"><input id="pw-peso" inputmode="decimal" placeholder="${nf(currentWeight())}"></label></div></div>
      <div id="pw-hint" style="font-size:12px;color:var(--warn2);margin:-10px 0 14px;display:none"></div>
      <div class="eyebrow2" style="margin:6px 0 8px">Medidas (cm) · opcional</div>
      <div class="glass-field-2"><div class="glass-field"><label for="pw-cintura">Cintura</label><label class="field-wrap" for="pw-cintura"><input id="pw-cintura" inputmode="decimal"></label></div>
      <div class="glass-field"><label for="pw-quadril">Quadril</label><label class="field-wrap" for="pw-quadril"><input id="pw-quadril" inputmode="decimal"></label></div></div>
      <div class="glass-field-2"><div class="glass-field"><label for="pw-abdomen">Abdômen</label><label class="field-wrap" for="pw-abdomen"><input id="pw-abdomen" inputmode="decimal"></label></div>
      <div class="glass-field"><label for="pw-coxa">Coxa</label><label class="field-wrap" for="pw-coxa"><input id="pw-coxa" inputmode="decimal"></label></div></div>
      <div class="glass-field"><label for="pw-braco">Braço</label><label class="field-wrap" for="pw-braco"><input id="pw-braco" inputmode="decimal"></label></div>
      <div class="glass-field"><label for="pw-foto">Foto de evolução (opcional)</label><label class="field-wrap" for="pw-foto" style="cursor:pointer"><span id="pw-foto-label">Escolher foto</span><input type="file" accept="image/*" id="pw-foto" style="display:none" onchange="document.getElementById('pw-foto-label').textContent=this.files[0]?this.files[0].name:'Escolher foto'"></label></div>
      <button id="pw-save-btn" class="btn-pill block" onclick="savePesagem()">Salvar pesagem</button>`;
  }
  if(id==='caneta'){
    return `<h2>Controle da caneta</h2><p class="sub">Acompanhe quantas aplicações ainda restam.</p>
      <div class="glass-field-2"><div class="glass-field"><label for="pn-cap">Capacidade (mg)</label><label class="field-wrap" for="pn-cap"><input id="pn-cap" inputmode="decimal" value="${S.pen.capacidadeMg||''}" placeholder="ex: 60"></label></div>
      <div class="glass-field"><label for="pn-dose">Dose semanal (mg)</label><label class="field-wrap" for="pn-dose"><input id="pn-dose" inputmode="decimal" value="${S.pen.doseMg||''}" placeholder="ex: 7,5"></label></div></div>
      <div class="glass-field"><label for="pn-used">Aplicações já feitas com esta caneta</label><label class="field-wrap" for="pn-used"><input id="pn-used" inputmode="numeric" value="${S.pen.usadas||0}"></label></div>
      <button class="btn-pill block" onclick="savePen()">Salvar caneta</button>`;
  }
  if(id==='exame'){
    const tipos=['Hemoglobina glicada','Colesterol total','Triglicerídeos','Vitamina D','Vitamina B12','Ferritina','TSH','Outro'];
    return `<h2>Novo exame</h2><p class="sub">Guarde o resultado para acompanhar a evolução.</p>
      <div class="glass-field"><label for="ex-tipo">Exame</label><label class="field-wrap" for="ex-tipo"><select id="ex-tipo">${tipos.map(t=>`<option>${t}</option>`).join('')}</select></label></div>
      <div class="glass-field-2"><div class="glass-field"><label for="ex-date">Data</label><label class="field-wrap" for="ex-date"><input type="date" id="ex-date" value="${todayISO()}"></label></div>
      <div class="glass-field"><label for="ex-val">Resultado</label><label class="field-wrap" for="ex-val"><input id="ex-val" placeholder="ex: 5,4%"></label></div></div>
      <button class="btn-pill block" onclick="saveExame()">Salvar exame</button>`;
  }
  if(id==='compromisso'){
    const tipos=['Consulta','Exame','Retorno','Renovar receita','Comprar caneta'];
    return `<h2>Novo compromisso</h2><p class="sub">Nunca perca um retorno ou uma receita vencendo.</p>
      <div class="glass-field"><label for="cp-tipo">Tipo</label><label class="field-wrap" for="cp-tipo"><select id="cp-tipo">${tipos.map(t=>`<option>${t}</option>`).join('')}</select></label></div>
      <div class="glass-field"><label for="cp-date">Data</label><label class="field-wrap" for="cp-date"><input type="date" id="cp-date" value="${todayISO()}"></label></div>
      <div class="glass-field"><label for="cp-obs">Observação</label><label class="field-wrap" for="cp-obs"><input id="cp-obs" placeholder="opcional"></label></div>
      <button class="btn-pill block" onclick="saveCompromisso()">Agendar</button>`;
  }
  if(id==='bio'){
    return `<h2>Nova bioimpedância</h2><p class="sub">Preencha os campos que sua balança ou exame informar. Todos são opcionais.</p>
      <div class="glass-field"><label for="bi-date">Data</label><label class="field-wrap" for="bi-date"><input type="date" id="bi-date" value="${todayISO()}"></label></div>
      <div class="glass-field-2"><div class="glass-field"><label for="bi-gordura">Gordura corporal (%)</label><label class="field-wrap" for="bi-gordura"><input id="bi-gordura" inputmode="decimal" placeholder="ex: 35,1"></label></div>
      <div class="glass-field"><label for="bi-massaMagraPct">Massa muscular (%)</label><label class="field-wrap" for="bi-massaMagraPct"><input id="bi-massaMagraPct" inputmode="decimal" placeholder="ex: 58,0"></label></div></div>
      <div class="glass-field-2"><div class="glass-field"><label for="bi-musculo">Massa muscular (kg)</label><label class="field-wrap" for="bi-musculo"><input id="bi-musculo" inputmode="decimal" placeholder="opcional"></label></div>
      <div class="glass-field"><label for="bi-agua">Água corporal (%)</label><label class="field-wrap" for="bi-agua"><input id="bi-agua" inputmode="decimal" placeholder="opcional"></label></div></div>
      <div class="glass-field-2"><div class="glass-field"><label for="bi-visceral">Gordura visceral</label><label class="field-wrap" for="bi-visceral"><input id="bi-visceral" inputmode="decimal" placeholder="nível"></label></div>
      <div class="glass-field"><label for="bi-tmb">Metabolismo basal (kcal)</label><label class="field-wrap" for="bi-tmb"><input id="bi-tmb" inputmode="numeric" placeholder="opcional"></label></div></div>
      <button class="btn-pill block" onclick="saveBio()">Salvar bioimpedância</button>`;
  }
  if(id==='perfil') return configuracoesView();
  if(id==='confirmarReset') return `<h2>Excluir todos os dados?</h2><p class="sub">Isso exclui permanentemente tudo o que você registrou no Compasso — pesagens, aplicações, diário, exames e configurações. Esta ação não pode ser desfeita.</p>
    <button class="btn-pill block ghost neutral" onclick="openSheet('perfil')">Cancelar</button>
    <button class="btn-pill block danger" style="margin-top:10px" onclick="confirmarResetAll()">Excluir tudo</button>`;
  return '';
}

/* ============================================================
   CONFIGURAÇÕES — tela composta por seções independentes.
   Cada seção é uma função isolada que devolve o conteúdo interno
   de um cfgGroup(); para adicionar uma seção nova (ex.: Conta,
   Privacidade, Integrações), crie uma função cfgXSecao() e inclua
   uma linha cfgGroup('Rótulo', cfgXSecao(...)) em configuracoesView(),
   sem tocar nas seções existentes.
   ============================================================ */
function cfgGroup(label,bodyHtml,extraStyle){
  return `<div class="gcard tight"${extraStyle?` style="${extraStyle}"`:''}>
    <div class="eyebrow2">${label}</div>
    ${bodyHtml}
  </div>`;
}
function cfgPerfilSecao(p,ic,meds,medIdx){
  return `<div class="glass-field"><label for="pf-nome">Nome</label>
      <label class="field-wrap" for="pf-nome">${ic('user')}<input id="pf-nome" value="${esc(p.nome)}"></label></div>
    <div class="glass-field-2">
      <div class="glass-field"><label>Medicamento</label>${comboField('pf-med','pill',meds.map(m=>({value:m,label:m})),medIdx)}</div>
      <div class="glass-field"><label for="pf-dose">Dose atual</label>
        <label class="field-wrap" for="pf-dose"><input id="pf-dose" value="${esc(p.doseAtual)}" inputmode="decimal"><span style="color:var(--tx-3);font-size:13px;white-space:nowrap">${esc(p.unidade)}</span></label></div>
    </div>
    <div class="glass-field"><label>Dia da aplicação</label>${comboField('pf-dia','cal',WD.map((d,i)=>({value:String(i),label:d})),p.diaAplicacao)}</div>
    <div class="glass-field-2">
      <div class="glass-field"><label>Início do tratamento</label>
        <div class="field-wrap static">${ic('cal')}<span class="csel-value">${fmtBRy(p.dataInicio)}</span></div></div>
      <div class="glass-field"><label>Peso inicial</label>
        <div class="field-wrap static">${ic('scale')}<span class="csel-value">${nf(p.pesoInicial)} kg</span></div></div>
    </div>`;
}
function cfgPreferenciasSecao(p,ic){
  return `<div class="glass-field-2">
      <div class="glass-field"><label for="pf-altura">Altura (cm)</label>
        <label class="field-wrap" for="pf-altura">${ic('ruler')}<input id="pf-altura" inputmode="numeric" value="${p.altura}"></label></div>
      <div class="glass-field"><label for="pf-meta">Peso meta (kg)</label>
        <label class="field-wrap" for="pf-meta">${ic('target')}<input id="pf-meta" inputmode="decimal" value="${p.pesoMeta}"></label></div>
    </div>
    <div class="glass-field-2">
      <div class="glass-field"><label for="pf-agua">Meta de água (L)</label>
        <label class="field-wrap" for="pf-agua"><input id="pf-agua" inputmode="decimal" value="${p.metaAgua}"></label></div>
      <div class="glass-field"><label for="pf-prot">Meta de proteína (g)</label>
        <label class="field-wrap" for="pf-prot"><input id="pf-prot" inputmode="numeric" value="${p.metaProteina}"></label></div>
    </div>`;
}
const PLANO_LABEL={free:'Gratuito',monthly:'Premium Mensal',yearly:'Premium Anual'};
function cfgAssinaturaSecao(){
  const plano=LICENSE?LICENSE.getPlan():'free';
  const dias=LICENSE?LICENSE.daysRemaining():null;
  return `<button type="button" class="mais-item" onclick="go('premium')">
      <span class="badge-glow">${icon('medal')}</span>
      <span class="mais-item-text"><span class="mais-item-t">${PLANO_LABEL[plano]||'Gratuito'}</span><span class="mais-item-s">${plano==='free'?'Conheça os planos Premium':(dias!=null?`Renova em ${dias} dia${dias===1?'':'s'}`:'Gerenciar assinatura')}</span></span>
    </button>`;
}
function cfgDadosSecao(){
  return `<button type="button" id="logout-btn" class="mais-item" onclick="doLogout()">
      <span class="badge-glow">${icon('down')}</span>
      <span class="mais-item-text"><span class="mais-item-t">Sair da conta</span><span class="mais-item-s">Encerra sua sessão neste dispositivo</span></span>
    </button>
    <button type="button" class="mais-item danger" onclick="resetAll()">
      <span class="badge-glow danger">${icon('alert')}</span>
      <span class="mais-item-text"><span class="mais-item-t">Excluir todos os dados</span><span class="mais-item-s">Exclui permanentemente tudo o que você registrou</span></span>
    </button>`;
}
const NOTIF_TOGGLES=[
  {id:'aplicacao',ic:'syringe',t:'Aplicação',s:'Lembrete no dia configurado'},
  {id:'pesagem',ic:'scale',t:'Pesagem',s:'Conforme a frequência abaixo'},
  {id:'agua',ic:'drop',t:'Água',s:'Distribuído ao longo do dia'},
  {id:'proteina',ic:'flag',t:'Proteína',s:'Se a meta do dia ainda não foi batida'},
  {id:'agenda',ic:'cal',t:'Agenda',s:'Consultas, retornos e outros compromissos'},
  {id:'exames',ic:'flask',t:'Exames',s:'Exames marcados na agenda'},
  {id:'caneta',ic:'gear',t:'Caneta',s:'Quando estiver perto de acabar'},
  {id:'metas',ic:'medal',t:'Metas',s:'Parabéns ao bater uma meta ou conquista'},
];
function notifFreqField(freqAtual){
  const opts=[{value:'semanal',label:'Semanal'},{value:'quinzenal',label:'Quinzenal'},{value:'mensal',label:'Mensal'}];
  const idx=Math.max(0,opts.findIndex(o=>o.value===freqAtual));
  return `<div class="csel">
    <button type="button" class="field-wrap csel-trigger" onclick="toggleCombo('notif-freq')">
      ${obIcon('cal')}<span class="csel-value" id="cselval-notif-freq">${opts[idx].label}</span>${OB_CHEV_DOWN}
    </button>
    <select id="notif-freq" class="csel-native" tabindex="-1">${opts.map((o,i)=>`<option value="${o.value}" ${i===idx?'selected':''}>${o.label}</option>`).join('')}</select>
    <div class="csel-panel" id="cselpanel-notif-freq">${opts.map((o,i)=>`<div class="csel-opt ${i===idx?'sel':''}" onclick="pickCombo('notif-freq',${i});setNotifFreq('${o.value}')">${o.label}</div>`).join('')}</div>
  </div>`;
}
function setNotifFreq(freq){
  if(!NOTIF) return;
  const prefs=NOTIF.loadPrefs(); prefs.pesagemFrequencia=freq; NOTIF.savePrefs(prefs);
}
function toggleNotifPref(key,val){
  if(!NOTIF) return;
  const prefs=NOTIF.loadPrefs(); prefs[key]=val; NOTIF.savePrefs(prefs);
}
function cfgNotificacoesSecao(){
  const prefs = NOTIF ? NOTIF.loadPrefs() : {aplicacao:true,pesagem:true,agua:true,proteina:true,agenda:true,exames:true,caneta:true,metas:true,pesagemFrequencia:'semanal'};
  const permissao = NOTIF ? NOTIF.permission : 'unsupported';
  const permBanner = permissao==='granted' ? '' : `
    <button type="button" id="ativar-notif-btn" class="mais-item" onclick="ativarNotificacoes()">
      <span class="badge-glow amber">${icon('bell')}</span>
      <span class="mais-item-text"><span class="mais-item-t">Ativar notificações</span><span class="mais-item-s">${permissao==='denied'?'Bloqueadas no navegador — ative nas configurações do dispositivo':'Toque para permitir lembretes do Compasso'}</span></span>
    </button>`;
  return `${permBanner}
    ${NOTIF_TOGGLES.map(x=>`<label class="mais-item" style="cursor:pointer">
        <span class="badge-glow">${icon(x.ic)}</span>
        <span class="mais-item-text"><span class="mais-item-t">${x.t}</span><span class="mais-item-s">${x.s}</span></span>
        <input type="checkbox" ${prefs[x.id]?'checked':''} onchange="toggleNotifPref('${x.id}',this.checked)" style="width:20px;height:20px;flex:0 0 auto;accent-color:var(--accent)">
      </label>`).join('')}
    <div class="glass-field" style="margin-top:14px"><label>Frequência da pesagem</label>${notifFreqField(prefs.pesagemFrequencia)}</div>`;
}
async function ativarNotificacoes(){
  if(!NOTIF) return;
  await withAuthBtn('ativar-notif-btn','Ativando…',async()=>{
    await NOTIF.requestPermission();
  });
  render();
}
/* Seções futuras (Conta, Privacidade, Integrações) entram aqui como
   cfgContaSecao(), cfgPrivacidadeSecao(), cfgIntegracoesSecao() —
   sem lógica própria enquanto as funcionalidades não existirem. */
function configuracoesView(){
  const p=S.profile, ic=obIcon;
  const meds=['Ozempic','Wegovy','Mounjaro','Zepbound','Saxenda','Outro'];
  const medIdx=Math.max(0,meds.indexOf(p.medicamento));
  return `<h2>Configurações</h2><p class="sub">Seu perfil, preferências e dados em um só lugar.</p>

    ${cfgGroup('Assinatura',cfgAssinaturaSecao())}

    ${cfgGroup('Perfil',cfgPerfilSecao(p,ic,meds,medIdx),'margin-top:14px')}
    ${cfgGroup('Preferências',cfgPreferenciasSecao(p,ic))}

    <button class="btn-pill block" onclick="savePerfil()">Salvar alterações</button>

    ${cfgGroup('Notificações',cfgNotificacoesSecao(),'margin-top:14px')}

    ${cfgGroup('Dados',cfgDadosSecao(),'margin-top:14px;margin-bottom:2px')}

    <p class="muted center" style="font-size:11.5px;margin-top:14px">Compasso v1.0.0</p>`;
}
function lastAppNext(){ // sugere próximo local no rodízio
  const order=['Abdômen','Coxa direita','Coxa esquerda','Braço direito','Braço esquerdo'];
  const la=lastApp(); if(!la)return order[0];
  const i=order.indexOf(la.local); return order[(i+1)%order.length];
}

/* ---------- calendário em faixa semanal (sheet "aplicar") ---------- */
function apMonday(iso){
  const d=parseISO(iso); const wd=d.getDay(); const diff=(wd===0?-6:1-wd);
  d.setDate(d.getDate()+diff); return todayISO(d);
}
function apCalendarHTML(){
  const start=parseISO(tmp.weekStart);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return todayISO(d);});
  const mid=parseISO(days[3]);
  const label=MESES_LONGOS[mid.getMonth()]+' '+mid.getFullYear();
  const today=todayISO();
  return `<div class="gcard tight ap-cal" id="ap-calwrap">
    <div class="between" style="margin-bottom:12px">
      <button type="button" class="cal-nav" onclick="apCalNav(-1)" aria-label="Semana anterior">${CAL_CHEV_L}</button>
      <span class="cal-title">${label}</span>
      <button type="button" class="cal-nav" onclick="apCalNav(1)" aria-label="Próxima semana">${CAL_CHEV_R}</button>
    </div>
    <div class="ap-week">${days.map(iso=>{
      const d=parseISO(iso); const sel=iso===tmp.date, isToday=iso===today;
      return `<button type="button" class="ap-day ${sel?'sel':''} ${isToday&&!sel?'today':''}" onclick="apPickDay('${iso}')">
        <span class="wd">${WDs[d.getDay()]}</span><span class="dnum">${d.getDate()}</span>
      </button>`;
    }).join('')}</div>
  </div>`;
}
function apCalNav(dir){
  const d=parseISO(tmp.weekStart); d.setDate(d.getDate()+dir*7); tmp.weekStart=todayISO(d);
  const wrap=document.getElementById('ap-calwrap'); if(wrap) wrap.outerHTML=apCalendarHTML();
}
function apPickDay(iso){
  tmp.date=iso;
  const wrap=document.getElementById('ap-calwrap'); if(wrap) wrap.outerHTML=apCalendarHTML();
}
function apSetHumor(n){
  tmp.humor=n;
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('active'));
  const b=document.getElementById('mood-'+n); if(b)b.classList.add('active');
}

/* ---------- saves ---------- */
function saveApp(){
  const date=tmp.date||todayISO(), dose=val('ap-dose'), med=val('ap-med'), local=tmp.local, obs=val('ap-obs');
  if(!date||!dose){toast('Preencha data e dose');return;}
  S.applications.push({id:crypto.randomUUID(),date,dose,medicamento:med,local,obs});
  if(document.getElementById('ap-pen').checked && S.pen.capacidadeMg) S.pen.usadas=(S.pen.usadas||0)+1;
  S.profile.doseAtual=dose; S.profile.medicamento=med;
  if(tmp.humor) todayLog().humor=tmp.humor;
  if(date===todayISO() && NOTIF) NOTIF.cancelAplicacaoHoje();
  save();closeSheet();toast('Aplicação registrada 💧');render();
}
function savePesagem(){
  const date=val('pw-date'), peso=numBR(val('pw-peso'));
  if(!date||!peso){toast('Informe data e peso');return;}
  const prev=S.weighings.find(w=>w.date===date);
  const rec={id:(prev&&prev.id)||crypto.randomUUID(),date,peso};
  ['cintura','quadril','abdomen','coxa','braco'].forEach(k=>{const v=numBR(val('pw-'+k));if(v)rec[k]=v;});
  const file=document.getElementById('pw-foto').files[0];
  const finish=()=>{ // substitui pesagem do mesmo dia se existir
    S.weighings=S.weighings.filter(w=>w.date!==date); S.weighings.push(rec);
    if(date===todayISO() && NOTIF) NOTIF.cancelPesagemHoje();
    save();closeSheet();toast('Pesagem salva');render();
  };
  if(file){
    const btn=document.getElementById('pw-save-btn');
    if(btn){ btn.disabled=true; btn.textContent='Processando foto…'; }
    toast('Processando foto…');
    downscale(file,700,dataUrl=>{rec.foto=dataUrl;finish();});
  } else finish();
}
function savePen(){
  const prevId=S.pen&&S.pen.id;
  S.pen={id:prevId||crypto.randomUUID(),capacidadeMg:numBR(val('pn-cap'))||0,doseMg:numBR(val('pn-dose'))||0,usadas:parseInt(val('pn-used'))||0};
  save();closeSheet();toast('Caneta atualizada');render();
}
function saveExame(){
  const tipo=val('ex-tipo'),date=val('ex-date'),valor=val('ex-val');
  if(!valor){toast('Informe o resultado');return;}
  S.exams.push({id:crypto.randomUUID(),tipo,date,valor});save();closeSheet();toast('Exame guardado');render();
}
function saveCompromisso(){
  S.agenda.push({id:crypto.randomUUID(),tipo:val('cp-tipo'),date:val('cp-date'),obs:val('cp-obs')});
  save();closeSheet();toast('Compromisso agendado');render();
}
function saveBio(){
  if(!S.bio)S.bio=[];
  const date=val('bi-date');
  const prev=S.bio.find(b=>b.date===date);
  const rec={id:(prev&&prev.id)||crypto.randomUUID(),date};
  ['gordura','massaMagraPct','musculo','agua','visceral','tmb'].forEach(k=>{const v=numBR(val('bi-'+k));if(v!=null)rec[k]=v;});
  if(Object.keys(rec).length<3){toast('Preencha ao menos um valor');return;}
  S.bio=S.bio.filter(b=>b.date!==date); S.bio.push(rec);
  save();closeSheet();toast('Bioimpedância registrada');render();
}
function savePerfil(){
  const p=S.profile;
  p.nome=val('pf-nome')||p.nome; p.medicamento=val('pf-med'); p.doseAtual=val('pf-dose');
  p.diaAplicacao=parseInt(val('pf-dia')); p.altura=parseInt(val('pf-altura'))||p.altura;
  p.pesoMeta=numBR(val('pf-meta'))||p.pesoMeta; p.metaAgua=numBR(val('pf-agua'))||p.metaAgua;
  p.metaProteina=parseInt(val('pf-prot'))||p.metaProteina;
  save();closeSheet();toast('Configurações salvas');render();
}
function resetAll(){
  openSheet('confirmarReset');
}
function confirmarResetAll(){
  S=null;store.set(KEY,'');closeSheet();go('inicio');
}

/* ---------- diário actions ---------- */
function setHumor(n){todayLog().humor=n;save();render();}
function toggleSint(s){const L=todayLog();
  if(s==='Sem sintomas'){L.sintomas=L.sintomas.includes(s)?[]:['Sem sintomas'];}
  else{L.sintomas=L.sintomas.filter(x=>x!=='Sem sintomas');
    L.sintomas.includes(s)?L.sintomas=L.sintomas.filter(x=>x!==s):L.sintomas.push(s);}
  save();render();}
function addWater(d){const L=todayLog();L.agua=Math.max(0,+((L.agua||0)+d).toFixed(2));save();render();}
function toggleEx(e){const L=todayLog();L.exercicios.includes(e)?L.exercicios=L.exercicios.filter(x=>x!==e):L.exercicios.push(e);save();render();}
function setApet(a){todayLog().apetite=a;save();render();}
function setFome(f){todayLog().fomeEmocional=f;save();render();}

function shareJourney(){
  const txt=document.querySelector('.journey .q')?.innerText||'';
  if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>toast('Resumo copiado ✓'),()=>toast(txt));}
  else toast('Copie o texto acima');
}

/* ---------- helpers de form ---------- */
function val(id){const e=document.getElementById(id);return e?e.value.trim():'';}
function numBR(s){if(!s)return null;const n=parseFloat(String(s).replace(',','.'));return isNaN(n)?null:n;}
function downscale(file,max,cb){
  const r=new FileReader();r.onload=e=>{const img=new Image();img.onload=()=>{
    let{width:w,height:h}=img;const sc=Math.min(1,max/Math.max(w,h));w*=sc;h*=sc;
    const c=document.createElement('canvas');c.width=w;c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',0.72));
  };img.src=e.target.result;};r.readAsDataURL(file);
}

/* ---------- bind ---------- */
function updatePesagemHint(){
  const date=val('pw-date');
  const hint=document.getElementById('pw-hint');
  const btn=document.getElementById('pw-save-btn');
  if(!hint||!btn)return;
  const existe=date&&S.weighings.some(w=>w.date===date);
  if(existe){
    hint.textContent='Já existe uma pesagem nesse dia — salvar vai atualizar o peso registrado, não criar um novo registro.';
    hint.style.display='block';
    btn.textContent='Atualizar pesagem';
  }else{
    hint.style.display='none';
    btn.textContent='Salvar pesagem';
  }
}
function bindSheet(id){
  if(id==='pesar'){
    updatePesagemHint();
    const dateInput=document.getElementById('pw-date');
    if(dateInput) dateInput.addEventListener('change',updatePesagemHint);
  }
  if(id==='aplicar'){
    document.querySelectorAll('#bd .bmzone2').forEach(z=>z.addEventListener('click',()=>{
      tmp.local=z.dataset.local;
      document.querySelectorAll('#bd .bmzone2').forEach(x=>x.classList.remove('sel'));
      z.classList.add('sel');
      const t=document.getElementById('ap-localtxt');if(t)t.textContent=tmp.local;
    }));
  }
}

/* ============================================================
   ONBOARDING
   ============================================================ */
const OB_ICONS={
  user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  pill:'<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M8 9v6M16 9v6"/>',
  scale:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  ruler:'<path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z"/><path d="M14.5 5 16 6.5M11 8.5 12.5 10M7.5 12 9 13.5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
};
function obIcon(name){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${OB_ICONS[name]||''}</svg>`;}
const OB_CHEV_DOWN='<svg class="csel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

/* combobox customizado — troca o <select> nativo por um painel próprio, mantendo o <select> real (oculto) como dono do valor */
function comboField(id,iconName,options,selectedIndex){
  const sel=options[selectedIndex]||options[0];
  return `<div class="csel">
    <button type="button" class="field-wrap csel-trigger" onclick="toggleCombo('${id}')">
      ${iconName?obIcon(iconName):''}<span class="csel-value" id="cselval-${id}">${esc(sel.label)}</span>${OB_CHEV_DOWN}
    </button>
    <select id="${id}" class="csel-native" tabindex="-1">${options.map((o,i)=>`<option value="${esc(o.value)}" ${i===selectedIndex?'selected':''}>${esc(o.label)}</option>`).join('')}</select>
    <div class="csel-panel" id="cselpanel-${id}">${options.map((o,i)=>`<div class="csel-opt ${i===selectedIndex?'sel':''}" onclick="pickCombo('${id}',${i})">${esc(o.label)}</div>`).join('')}</div>
  </div>`;
}
/* campo de data customizado — <input type=date> real (oculto) + calendário próprio */
function dateFieldCustom(id,iconName,isoValue){
  return `<div class="cdate">
    <button type="button" class="field-wrap csel-trigger" onclick="toggleDatePicker('${id}')">
      ${iconName?obIcon(iconName):''}<span class="csel-value" id="cdateval-${id}">${fmtDateLong(isoValue)}</span>
    </button>
    <input type="date" id="${id}" class="csel-native" tabindex="-1" value="${isoValue}">
    <div class="cdate-panel" id="cdatepanel-${id}"></div>
  </div>`;
}

function obView(){
  const ic=obIcon;
  return `<div class="ob">
    <div class="glow-wrap ob-icon">${logoHeroSVG(56)}</div>
    <h1>Compasso</h1>
    <p class="lead">Seu companheiro de tratamento com análogos de GLP-1. Aplicações, peso, medidas, sintomas e evolução — tudo em um diário inteligente que leva menos de um minuto por dia.</p>

    <div class="glass-card">
      <div class="glass-field"><label for="o-nome">Como podemos te chamar?</label>
        <label class="field-wrap" for="o-nome">${ic('user')}<input id="o-nome" placeholder="Seu nome"></label></div>
      <div class="glass-field-2">
        <div class="glass-field"><label>Medicamento</label>
          ${comboField('o-med','',['Mounjaro','Ozempic','Wegovy','Zepbound','Saxenda','Outro'].map(m=>({value:m,label:m})),0)}</div>
        <div class="glass-field"><label for="o-dose">Dose atual (mg)</label>
          <label class="field-wrap" for="o-dose"><input id="o-dose" placeholder="ex: 7,5" inputmode="decimal"></label></div>
      </div>
      <div class="glass-field"><label>Dia da aplicação</label>
        ${comboField('o-dia','cal',WD.map((d,i)=>({value:String(i),label:d})),5)}</div>
      <div class="glass-field-2">
        <div class="glass-field"><label for="o-pini">Peso inicial (kg)</label>
          <label class="field-wrap" for="o-pini">${ic('scale')}<input id="o-pini" inputmode="decimal" placeholder="ex: 96"></label></div>
        <div class="glass-field"><label for="o-pmeta">Peso meta (kg)</label>
          <label class="field-wrap" for="o-pmeta">${ic('target')}<input id="o-pmeta" inputmode="decimal" placeholder="ex: 72"></label></div>
      </div>
      <div class="glass-field-2 asym">
        <div class="glass-field"><label for="o-alt">Altura (cm)</label>
          <label class="field-wrap" for="o-alt">${ic('ruler')}<input id="o-alt" inputmode="numeric" placeholder="ex: 165"></label></div>
        <div class="glass-field"><label>Início do tratamento</label>
          ${dateFieldCustom('o-data','cal',todayISO())}</div>
      </div>
      <button class="btn-pill block" onclick="startNew()">Começar minha jornada
        ${AUTH_ARROW}
      </button>
    </div>
    <button class="btn-pill block ghost neutral" onclick="startExample()">Ver com dados de exemplo</button>
    <p class="ob-trust"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Seus dados estão seguros e protegidos</p>
    <p class="muted center" style="font-size:11.5px;margin-top:10px;line-height:1.5">O Compasso ajuda você a acompanhar seu tratamento, mas não substitui a orientação do seu médico ou nutricionista.</p>
  </div>`;
}

/* ---------- combobox / date picker customizados (dropdown do navegador substituído) ---------- */
function closeAllPopovers(){
  document.querySelectorAll('.csel-panel.open, .cdate-panel.open').forEach(p=>p.classList.remove('open'));
  document.querySelectorAll('.csel.open, .cdate.open').forEach(p=>p.classList.remove('open'));
  document.removeEventListener('click',onDocClickClosePopovers,true);
}
function onDocClickClosePopovers(e){
  if(!e.target.closest('.csel, .cdate')) closeAllPopovers();
}
function toggleCombo(id){
  const panel=document.getElementById('cselpanel-'+id);
  const wasOpen=panel.classList.contains('open');
  closeAllPopovers();
  if(!wasOpen){
    panel.classList.add('open');
    panel.closest('.csel').classList.add('open');
    setTimeout(()=>document.addEventListener('click',onDocClickClosePopovers,true),0);
  }
}
function pickCombo(id,idx){
  const native=document.getElementById(id);
  const opt=native.options[idx];
  native.value=opt.value;
  document.getElementById('cselval-'+id).textContent=opt.textContent;
  document.querySelectorAll('#cselpanel-'+id+' .csel-opt').forEach((el,i)=>el.classList.toggle('sel',i===idx));
  native.dispatchEvent(new Event('change'));
  closeAllPopovers();
}

let CAL_STATE={};
const CAL_CHEV_L='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const CAL_CHEV_R='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const MESES_LONGOS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function toggleDatePicker(id){
  const panel=document.getElementById('cdatepanel-'+id);
  const wasOpen=panel.classList.contains('open');
  closeAllPopovers();
  if(!wasOpen){
    const native=document.getElementById(id);
    const d=native.value?parseISO(native.value):new Date();
    CAL_STATE[id]={year:d.getFullYear(),month:d.getMonth()};
    renderCalendar(id);
    panel.classList.add('open');
    panel.closest('.cdate').classList.add('open');
    setTimeout(()=>document.addEventListener('click',onDocClickClosePopovers,true),0);
  }
}
function calNav(id,dir){
  const st=CAL_STATE[id];
  st.month+=dir;
  if(st.month<0){st.month=11;st.year--;}
  if(st.month>11){st.month=0;st.year++;}
  renderCalendar(id);
}
function renderCalendar(id){
  const st=CAL_STATE[id];
  const native=document.getElementById(id);
  const selectedISO=native.value;
  const todayStr=todayISO();
  const first=new Date(st.year,st.month,1);
  const startWeekday=first.getDay();
  const daysInMonth=new Date(st.year,st.month+1,0).getDate();
  let cells='';
  for(let i=0;i<startWeekday;i++) cells+='<span class="cday empty"></span>';
  for(let day=1;day<=daysInMonth;day++){
    const iso=`${st.year}-${pad(st.month+1)}-${pad(day)}`;
    const isSel=iso===selectedISO, isToday=iso===todayStr;
    cells+=`<span class="cday ${isSel?'sel':''} ${isToday&&!isSel?'today':''}" onclick="pickDate('${id}','${iso}')">${day}</span>`;
  }
  document.getElementById('cdatepanel-'+id).innerHTML=`
    <div class="cal-hdr">
      <button type="button" class="cal-nav" onclick="calNav('${id}',-1)" aria-label="Mês anterior">${CAL_CHEV_L}</button>
      <span class="cal-title">${MESES_LONGOS[st.month]} ${st.year}</span>
      <button type="button" class="cal-nav" onclick="calNav('${id}',1)" aria-label="Próximo mês">${CAL_CHEV_R}</button>
    </div>
    <div class="cal-week">${['D','S','T','Q','Q','S','S'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>`;
}
function pickDate(id,iso){
  const native=document.getElementById(id);
  native.value=iso;
  document.getElementById('cdateval-'+id).textContent=fmtDateLong(iso);
  native.dispatchEvent(new Event('change'));
  closeAllPopovers();
}
function startNew(){
  const nome=val('o-nome')||'Você';
  const pini=numBR(val('o-pini')), pmeta=numBR(val('o-pmeta')), alt=parseInt(val('o-alt'));
  if(!pini||!pmeta||!alt){toast('Preencha peso inicial, meta e altura');return;}
  const p={nome,medicamento:val('o-med'),doseAtual:val('o-dose')||'—',unidade:'mg',
    diaAplicacao:parseInt(val('o-dia')),dataInicio:val('o-data')||todayISO(),
    pesoInicial:pini,pesoMeta:pmeta,altura:alt,metaAgua:3,metaProteina:100};
  S=blankState(p);save();go('inicio');
}
function startExample(){S=seedExample();save();toast('Dados de exemplo carregados');go('inicio');}

/* ============================================================
   SVG · componentes
   ============================================================ */
/* Marca Compasso: mostrador parcial (dose) + seringa na diagonal, no lugar
   da bússola antiga. Cores por token — nunca cravadas, pra funcionar igual
   nos dois temas (tema claro precisa de seringa escura, não branca). */
function logoSVG(size=24){
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:${size}px;height:${size}px">
    <circle cx="20" cy="20" r="15" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"
      stroke-dasharray="70.5 94.2" stroke-dashoffset="7" transform="rotate(-90 20 20)"/>
    <line x1="24" y1="16" x2="30" y2="10" stroke="var(--accent)" stroke-width="1.4"/>
    <circle cx="30" cy="10" r="2.6" fill="var(--accent)"/>
    <circle cx="33.5" cy="14.5" r="1.6" fill="var(--accent-light)"/>
    <g transform="rotate(45 20 20)">
      <rect x="18.2" y="3" width="3.6" height="2.8" rx="1" fill="var(--tx-1)"/>
      <rect x="19.3" y="5.8" width="1.4" height="3.2" fill="var(--tx-1)"/>
      <rect x="16.6" y="9" width="6.8" height="2.6" rx="1.1" fill="var(--tx-1)"/>
      <rect x="17.6" y="11.5" width="4.8" height="14.5" rx="1.4" fill="var(--tx-1)"/>
      <rect x="18.3" y="14.8" width="3.4" height=".8" fill="var(--nv-bg)"/>
      <rect x="18.3" y="18.2" width="3.4" height=".8" fill="var(--nv-bg)"/>
      <rect x="18.3" y="21.6" width="3.4" height=".8" fill="var(--nv-bg)"/>
      <polygon points="18,26 22,26 20,38" fill="var(--tx-1)"/>
    </g>
  </svg>`;
}
/* Variante com efeito 3D (gradientes, brilho, sombra) — usada apenas na tela de Boas-vindas. */
function logoHeroSVG(size=84){
  const id='lh'+size;
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="welcome-icon" style="width:${size}px;height:${size}px;overflow:visible">
    <defs>
      <radialGradient id="${id}orb" cx="36%" cy="26%" r="80%">
        <stop offset="0" stop-color="rgba(255,255,255,.45)"/>
        <stop offset="55%" stop-color="rgba(255,255,255,.08)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <linearGradient id="${id}ring" x1="6" y1="3" x2="34" y2="37" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="var(--accent-light)"/>
        <stop offset="1" stop-color="var(--accent-deep)"/>
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="19" fill="url(#${id}orb)"/>
    <circle cx="20" cy="20" r="15" stroke="url(#${id}ring)" stroke-width="2.2" stroke-linecap="round"
      stroke-dasharray="70.5 94.2" stroke-dashoffset="7" transform="rotate(-90 20 20)"/>
    <line x1="24" y1="16" x2="30" y2="10" stroke="var(--accent)" stroke-width="1.4"/>
    <circle cx="30" cy="10" r="2.8" fill="var(--accent)"/>
    <circle cx="33.5" cy="14.5" r="1.7" fill="var(--accent-light)"/>
    <g transform="rotate(45 20 20)">
      <rect x="18.2" y="3" width="3.6" height="2.8" rx="1" fill="var(--tx-1)"/>
      <rect x="19.3" y="5.8" width="1.4" height="3.2" fill="var(--tx-1)"/>
      <rect x="16.6" y="9" width="6.8" height="2.6" rx="1.1" fill="var(--tx-1)"/>
      <rect x="17.6" y="11.5" width="4.8" height="14.5" rx="1.4" fill="var(--tx-1)"/>
      <rect x="18.3" y="14.8" width="3.4" height=".8" fill="var(--nv-bg)"/>
      <rect x="18.3" y="18.2" width="3.4" height=".8" fill="var(--nv-bg)"/>
      <rect x="18.3" y="21.6" width="3.4" height=".8" fill="var(--nv-bg)"/>
      <polygon points="18,26 22,26 20,38" fill="var(--tx-1)"/>
    </g>
  </svg>`;
}
function ringSVG(prog,dose,unit){
  const R=53,C=2*Math.PI*R,off=C*(1-prog);
  return `<svg viewBox="0 0 128 128" width="128" height="128" style="overflow:visible;shape-rendering:geometricPrecision">
    <defs>
      <linearGradient id="ringProgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset=".55" stop-color="#B9DCFF"/>
        <stop offset="1" stop-color="#6FB2FA"/>
      </linearGradient>
      <filter id="ringGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="64" cy="64" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7.5"/>
    <circle cx="64" cy="64" r="${R}" fill="none" stroke="url(#ringProgGrad)" stroke-width="7.5" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 64 64)" filter="url(#ringGlow)"/>
    <text x="64" y="58.5" text-anchor="middle" dominant-baseline="middle" class="center-dose tabular">${esc(dose)}</text>
    <text x="64" y="78.5" text-anchor="middle" dominant-baseline="middle" class="center-unit">${esc(unit)} / semana</text>
  </svg>`;
}
function dropSVG(filled,i){
  return `<div class="drop" onclick="setWater(${i+1})"><svg viewBox="0 0 24 30">
    <path d="M12 1 C12 1 3 12 3 19 a9 9 0 0 0 18 0 C21 12 12 1 12 1 Z"
      fill="${filled?'var(--accent)':'none'}" stroke="${filled?'var(--accent)':'var(--nv-border-strong)'}" stroke-width="2"/></svg></div>`;
}
function setWater(n){const L=todayLog();L.agua=+(n*0.25).toFixed(2);save();render();}

function bodyMapSVG(last,sel,selectable,premium){
  const zc=premium?'bmzone2':'bmzone';
  const zone=(id,label,d)=>{
    const cls=zc+(sel===label?' sel':'')+(last===label&&sel!==label?' last':'');
    return `<path class="${cls}" data-local="${label}" d="${d}" ${selectable?'':`onclick="${''}"`}/>`;
  };
  return `<div class="bodymap${premium?' premium':''}"><svg viewBox="0 0 160 260">
    <!-- corpo -->
    <path class="${premium?'bodyfill2':'bodyfill'}" d="M80 8 a14 14 0 0 1 14 14 a14 14 0 0 1 -6 11 l6 6 q14 4 16 22 l4 40 q1 8 -4 9 q-6 1 -8 -7 l-4 -28 l-2 60 l4 70 q1 8 -6 8 q-6 0 -7 -8 l-5 -55 l-5 55 q-1 8 -7 8 q-7 0 -6 -8 l4 -70 l-2 -60 l-4 28 q-2 8 -8 7 q-5 -1 -4 -9 l4 -40 q2 -18 16 -22 l6 -6 a14 14 0 0 1 -6 -11 a14 14 0 0 1 14 -14 Z"/>
    <!-- zonas -->
    ${zone('abd','Abdômen','M64 92 h32 v28 h-32 Z')}
    ${zone('brD','Braço direito','M40 70 h14 v34 h-14 Z')}
    ${zone('brE','Braço esquerdo','M106 70 h14 v34 h-14 Z')}
    ${zone('cxD','Coxa direita','M62 135 h16 v40 h-16 Z')}
    ${zone('cxE','Coxa esquerda','M82 135 h16 v40 h-16 Z')}
    <text x="80" y="106" text-anchor="middle" font-size="9" font-weight="700" fill="${premium?'var(--accent-light)':'var(--green-deep)'}" pointer-events="none">Abd.</text>
  </svg></div>`;
}

/* ============================================================
   SVG · gráfico de linha
   ============================================================ */
function lineChart(data,goal,theme){
  if(!data||data.length<2) return '<p class="muted center" style="font-size:13px;padding:16px 0">Registre mais de uma pesagem para ver o gráfico.</p>';
  const c=theme||{line:'var(--green)',dot:'var(--green)',dotLast:'var(--green-deep)',dotStroke:'#fff',goalColor:'var(--amber)',axis:'var(--ink-faint)'};
  const W=360,H=150,pL=8,pR=8,pT=14,pB=20;
  const hasGoal=goal!=null&&isFinite(goal);
  const ys=data.map(d=>d.y); let min=Math.min(...ys,hasGoal?goal:Infinity), max=Math.max(...ys,hasGoal?goal:-Infinity);
  const range=(max-min)||1; min-=range*0.12; max+=range*0.12;
  const X=i=>pL+(i/(data.length-1))*(W-pL-pR);
  const Y=v=>pT+(1-(v-min)/(max-min))*(H-pT-pB);
  let path=data.map((d,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(d.y).toFixed(1)).join(' ');
  let area=path+` L ${X(data.length-1)} ${H-pB} L ${X(0)} ${H-pB} Z`;
  const gy=Y(goal);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:4px">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.line}" stop-opacity=".22"/><stop offset="1" stop-color="${c.line}" stop-opacity="0"/></linearGradient></defs>
    ${hasGoal&&goal>min&&goal<max?`<line x1="${pL}" y1="${gy}" x2="${W-pR}" y2="${gy}" stroke="${c.goalColor}" stroke-width="1.4" stroke-dasharray="4 4"/>
      <text x="${W-pR}" y="${gy-4}" text-anchor="end" font-size="9" font-weight="700" fill="${c.goalColor}">meta ${nf(goal)}</text>`:''}
    <path d="${area}" fill="url(#ga)"/>
    <path d="${path}" fill="none" stroke="${c.line}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${data.map((d,i)=>`<circle cx="${X(i)}" cy="${Y(d.y)}" r="${i===data.length-1?4:2.5}" fill="${i===data.length-1?c.dotLast:c.dot}" stroke="${c.dotStroke}" stroke-width="1.5"/>`).join('')}
    <text x="${X(0)}" y="${H-5}" font-size="9" fill="${c.axis}">${fmtBR(data[0].x)}</text>
    <text x="${X(data.length-1)}" y="${H-5}" text-anchor="end" font-size="9" fill="${c.axis}">${fmtBR(data[data.length-1].x)}</text>
  </svg>`;
}
/* Gráfico premium (Quiet Premium) — grid discreto, linha fina, tooltip no último ponto.
   Função própria, não usada pelas telas ainda não migradas (Evolução/Bioimpedância
   continuam com lineChart() acima, inalterada). */
function smoothPath(pts){
  if(pts.length<2) return '';
  if(pts.length===2) return `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  let d=`M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    const c1x=p1.x+(p2.x-p0.x)/6, c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6, c2y=p2.y-(p3.y-p1.y)/6;
    d+=`C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }
  return d.trim();
}
function lineChartPremium(data,goal,unit='kg'){
  if(!data||data.length<2) return '<p style="font-size:13px;padding:16px 0;color:var(--tx-3);text-align:center">Registre mais de uma pesagem para ver o gráfico.</p>';
  const W=340,H=150,pL=28,pR=6,pT=16,pB=20;
  const hasGoal=goal!=null&&isFinite(goal);
  const ys=data.map(d=>d.y);
  let min=Math.min(...ys,hasGoal?goal:Infinity), max=Math.max(...ys,hasGoal?goal:-Infinity);
  const range=(max-min)||1; min-=range*0.18; max+=range*0.18;
  const X=i=>pL+(i/(data.length-1))*(W-pL-pR);
  const Y=v=>pT+(1-(v-min)/(max-min))*(H-pT-pB);
  const pts=data.map((d,i)=>({x:X(i),y:Y(d.y)}));
  const path=smoothPath(pts);
  const area=path+` L ${X(data.length-1).toFixed(1)} ${H-pB} L ${X(0).toFixed(1)} ${H-pB} Z`;

  const steps=3;
  let grid='';
  for(let i=0;i<=steps;i++){
    const v=min+(max-min)*(i/steps);
    const y=Y(v);
    grid+=`<line x1="${pL}" y1="${y.toFixed(1)}" x2="${W-pR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.045)" stroke-width=".75"/>
      <text x="${pL-7}" y="${(y+2.8).toFixed(1)}" text-anchor="end" font-size="8" font-weight="500" fill="rgba(210,222,238,.38)" font-variant-numeric="tabular-nums">${Math.round(v)}</text>`;
  }

  const gy=hasGoal?Y(goal):null;
  const last=data[data.length-1], lastX=X(data.length-1), lastY=Y(last.y);
  const dots=data.slice(0,-1).map((d,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(d.y).toFixed(1)}" r="1.8" fill="var(--accent)" opacity=".8"/>`).join('');

  const ttW=72,ttH=34,ttGap=9;
  let ttX=lastX-ttW/2;
  ttX=Math.max(2,Math.min(W-2-ttW,ttX));
  const ttY=Math.max(2,lastY-ttH-ttGap);
  const ttCx=ttX+ttW/2;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:2px;overflow:visible;shape-rendering:geometricPrecision">
    <defs><linearGradient id="chGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent)" stop-opacity=".14"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    ${hasGoal&&gy>pT&&gy<H-pB?`<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${W-pR}" y2="${gy.toFixed(1)}" stroke="var(--warn2)" stroke-width=".9" stroke-dasharray="2.5 3" opacity=".5"/>`:''}
    <path d="${area}" fill="url(#chGrad)"/>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    <line x1="${lastX.toFixed(1)}" y1="${(ttY+ttH).toFixed(1)}" x2="${lastX.toFixed(1)}" y2="${(lastY-7).toFixed(1)}" stroke="rgba(160,195,255,.4)" stroke-width="1.25"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="5" fill="var(--nv-bg)" stroke="var(--accent-light)" stroke-width="2"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="1.8" fill="var(--accent-light)"/>
    <rect x="${ttX.toFixed(1)}" y="${ttY.toFixed(1)}" width="${ttW}" height="${ttH}" rx="10" fill="#2A3B57" stroke="rgba(160,195,255,.28)" stroke-width="1"/>
    <text x="${ttCx.toFixed(1)}" y="${(ttY+14).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" font-family="var(--font-rounded)" fill="#fff">${nf(last.y)}${unit?' '+unit:''}</text>
    <text x="${ttCx.toFixed(1)}" y="${(ttY+26).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="rgba(210,222,238,.62)">${fmtBR(last.x)}</text>
    <text x="${X(0).toFixed(1)}" y="${H-4}" font-size="8.5" font-weight="500" fill="rgba(210,222,238,.38)">${fmtBR(data[0].x)}</text>
    <text x="${X(data.length-1).toFixed(1)}" y="${H-4}" text-anchor="end" font-size="8.5" font-weight="500" fill="rgba(210,222,238,.38)">${fmtBR(data[data.length-1].x)}</text>
  </svg>`;
}

/* ============================================================
   ÍCONES (SVG inline)
   ============================================================ */
function icon(name,white,flip){
  const c=white?'#fff':'currentColor';const s=`width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const P={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    syringe:'<path d="M18 2l4 4"/><path d="M15 5l4 4"/><path d="M4 20l9-9 3 3-9 9H4v-3z" transform="translate(-1 -1)"/><path d="M8.5 15.5l-3-3"/>',
    chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>',
    book:'<path d="M5 4h11a2 2 0 0 1 2 2v14"/><path d="M5 4v16h13"/><path d="M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    scale:'<path d="M12 3v3"/><rect x="4" y="6" width="16" height="15" rx="3"/><circle cx="12" cy="13" r="3"/><path d="M12 13l2-2"/>',
    spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    medal:'<circle cx="12" cy="15" r="6"/><path d="M8.5 9.5L6 3h12l-2.5 6.5"/><path d="M12 13l1 2h-2z" fill="'+c+'"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h6"/>',
    flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
    cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    chevron:'<path d="M9 6l6 6-6 6"/>',
    check:'<path d="M20 6L9 17l-5-5"/>',
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    drop:'<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
    alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    steth:'<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 16a5 5 0 0 0 5 5 4 4 0 0 0 4-4v-2"/><circle cx="19" cy="11" r="2"/>',
    doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    down:'<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
    scale2:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9l3-3 3 3"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    moon:'<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
  };
  return `<svg ${s} style="${flip?'transform:scaleX(-1)':''}">${P[name]||''}</svg>`;
}
const MOOD_LABELS=['Muito mal','Mal','Neutro','Bem','Muito bem'];
function moodIcon(level){
  const face='<circle cx="12" cy="12" r="9.2"/>';
  const parts=[
    face+'<path d="M7 9L10 10.5"/><path d="M17 9L14 10.5"/><circle cx="8.7" cy="12.3" r=".9" fill="currentColor" stroke="none"/><circle cx="15.3" cy="12.3" r=".9" fill="currentColor" stroke="none"/><path d="M7.3 17.3Q12 12.7 16.7 17.3"/>',
    face+'<circle cx="8.7" cy="11.8" r=".9" fill="currentColor" stroke="none"/><circle cx="15.3" cy="11.8" r=".9" fill="currentColor" stroke="none"/><path d="M8 16.6Q12 14.3 16 16.6"/>',
    face+'<circle cx="8.7" cy="11.6" r=".9" fill="currentColor" stroke="none"/><circle cx="15.3" cy="11.6" r=".9" fill="currentColor" stroke="none"/><path d="M8 16.3L16 16.3"/>',
    face+'<circle cx="8.7" cy="11.6" r=".9" fill="currentColor" stroke="none"/><circle cx="15.3" cy="11.6" r=".9" fill="currentColor" stroke="none"/><path d="M7.7 15.3Q12 18 16.3 15.3"/>',
    face+'<path d="M7.3 11.2Q8.9 9.6 10.5 11.2"/><path d="M13.5 11.2Q15.1 9.6 16.7 11.2"/><path d="M6.7 14.8Q12 20 17.3 14.8"/>',
  ];
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${parts[level-1]||parts[2]}</svg>`;
}

/* ============================================================
   META PROTEICA · fontes de proteína animal (estimativas)
   ============================================================ */
const PROT=[
  {id:'ovo',    emoji:'🥚', nome:'Ovos',         mode:'unit', per:6},
  {id:'frango', emoji:'🍗', nome:'Frango',       mode:'g',  per100:30},
  {id:'carne',  emoji:'🥩', nome:'Carne bovina', mode:'g',  per100:26},
  {id:'peixe',  emoji:'🐟', nome:'Peixe',        mode:'g',  per100:22},
  {id:'queijo', emoji:'🧀', nome:'Queijo',       mode:'g',  per100:22, unit:{label:'fatia',g:20}},
  {id:'iogurte',emoji:'🥣', nome:'Iogurte',      mode:'g',  per100:4,  unit:{label:'pote',g:170}},
  {id:'leite',  emoji:'🥛', nome:'Leite',        mode:'ml', per100:3.3,unit:{label:'copo',g:200}},
];
let protOpen='ovo';
function protGrams(id,qty){const s=PROT.find(p=>p.id===id);if(!s||!qty)return 0;
  return s.mode==='unit'?qty*s.per:qty/100*s.per100;}
function computeProtein(L){let t=0;PROT.forEach(s=>{t+=protGrams(s.id,L.prot[s.id]||0);});t+=(L.prot.outros||0);L.proteina=Math.round(t);return L.proteina;}
function setProt(id,qty){const L=todayLog();L.prot[id]=Math.max(0,+qty||0);computeProtein(L);save();render();}
function addProtQty(id,d){const L=todayLog();L.prot[id]=Math.max(0,(L.prot[id]||0)+d);computeProtein(L);save();render();}
function commitProt(id,v){setProt(id,numBR(v)||0);}
function toggleProtCard(id){protOpen=protOpen===id?null:id;render();}

function proteinBar(cur,goal){const n=10,f=Math.round(Math.min(1,goal?cur/goal:0)*n);
  let s='';for(let i=0;i<n;i++)s+=`<span class="psq ${i<f?'on':''}"></span>`;return `<div class="psqrow">${s}</div>`;}

function eggControl(L){
  const q=L.prot.ovo||0; let dots='';
  for(let i=0;i<12;i++)dots+=`<button class="egg ${i<q?'on':''}" onclick="setProt('ovo',${i+1===q?i:i+1})" aria-label="ovo ${i+1}">🥚</button>`;
  return `<div class="eggrow">${dots}</div>
    <div class="protresult"><b>${q} ${q===1?'ovo':'ovos'}</b> ≈ ${q*6} g de proteína</div>
    <div class="row" style="gap:8px;margin-top:10px">
      <button class="btn-pill btn-sm ghost neutral" style="flex:0 0 64px" onclick="addProtQty('ovo',-1)" aria-label="Remover um ovo">−</button>
      <button class="btn-pill btn-sm ghost" style="flex:1" onclick="addProtQty('ovo',1)">+ 1 ovo</button></div>`;
}
function gramControl(s,L){
  const q=L.prot[s.id]||0, u=s.mode==='ml'?'ml':'g';
  const quick=s.mode==='ml'?[100,200]:[50,100,150];
  return `<div class="glass-field" style="margin:0 0 10px"><label>Quantidade (${u})</label>
    <label class="field-wrap"><input inputmode="decimal" value="${q||''}" onchange="commitProt('${s.id}',this.value)" placeholder="ex: ${s.mode==='ml'?'200':'120'}"></label></div>
    <div class="chips" style="margin-bottom:12px">
      ${quick.map(g=>`<button class="chip-glass" onclick="addProtQty('${s.id}',${g})">+ ${g} ${u}</button>`).join('')}
      ${s.unit?`<button class="chip-glass" onclick="addProtQty('${s.id}',${s.unit.g})">+ 1 ${s.unit.label}</button>`:''}
      ${q?`<button class="chip-glass" onclick="setProt('${s.id}',0)">zerar</button>`:''}
    </div>
    <div class="protresult">${q?`${nf(q,0)} ${u} ≈ <b>${Math.round(protGrams(s.id,q))} g</b> de proteína`:'Adicione a quantidade consumida'}</div>`;
}
function outrosControl(L){
  const q=L.prot.outros||0;
  return `<div class="glass-field" style="margin:0 0 10px"><label>Proteína de outras fontes (g)</label>
    <label class="field-wrap"><input inputmode="numeric" value="${q||''}" onchange="commitProt('outros',this.value)" placeholder="whey, leguminosas, tofu…"></label></div>
    <div class="chips" style="margin-bottom:12px">${[10,20,30].map(g=>`<button class="chip-glass" onclick="addProtQty('outros',${g})">+ ${g} g</button>`).join('')}
      ${q?`<button class="chip-glass" onclick="setProt('outros',0)">zerar</button>`:''}</div>
    <div class="protresult">${q?`<b>${q} g</b> de outras fontes`:'Whey, leguminosas, tofu, suplementos…'}</div>`;
}
function proteinaView(){
  const L=todayLog(), goal=S.profile.metaProteina, cur=L.proteina||0;
  const pct=Math.round(Math.min(100,cur/goal*100));
  const card=s=>{const q=L.prot[s.id]||0, g=Math.round(protGrams(s.id,q)), open=protOpen===s.id;
    const qtxt=q?(s.mode==='unit'?q+' un':nf(q,0)+(s.mode==='ml'?' ml':' g')):'';
    return `<div class="gcard protcard ${open?'open':''}">
      <div class="between" onclick="toggleProtCard('${s.id}')">
        <div class="row"><span class="pemoji">${s.emoji}</span>
          <div><div style="font-weight:800;color:var(--tx-1)">${s.nome}</div>
          <div class="muted" style="font-size:12px">${q?qtxt+' · '+g+' g proteína':'toque para adicionar'}</div></div></div>
        <span class="row" style="gap:2px;font-weight:800;color:var(--accent)">${g?g+' g':''}${icon('chevron')}</span>
      </div>
      ${open?`<div class="protbody">${s.id==='ovo'?eggControl(L):gramControl(s,L)}</div>`:''}
    </div>`;};
  const outQ=L.prot.outros||0;
  return `
  <button class="btn-pill btn-sm ghost neutral" onclick="go('diario')" style="margin-bottom:12px">${icon('chevron',false,true)} Diário</button>
  <div class="scr-title" style="margin-bottom:4px">Meta proteica</div>
  <div class="scr-sub">Toque nas fontes que você comeu hoje. O app estima a proteína, sem precisar pesar tudo.</div>

  <div class="protsummary">
    <div style="font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;font-weight:700">Proteína consumida hoje</div>
    <div style="font-size:34px;font-weight:800;letter-spacing:-.02em;margin:2px 0">${cur} <span style="font-size:16px;opacity:.85">/ ${goal} g</span></div>
    ${proteinBar(cur,goal)}
    <div style="font-size:13px;opacity:.9;margin-top:6px">${pct}% da meta atingida${cur>=goal?' ✓':''}</div>
  </div>

  ${PROT.map(card).join('')}

  <div class="gcard protcard ${protOpen==='outros'?'open':''}">
    <div class="between" onclick="toggleProtCard('outros')">
      <div class="row"><span class="pemoji">➕</span>
        <div><div style="font-weight:800;color:var(--tx-1)">Outras fontes</div>
        <div class="muted" style="font-size:12px">${outQ?outQ+' g proteína':'whey, leguminosas, tofu…'}</div></div></div>
      <span class="row" style="gap:2px;font-weight:800;color:var(--accent)">${outQ?outQ+' g':''}${icon('chevron')}</span>
    </div>
    ${protOpen==='outros'?`<div class="protbody">${outrosControl(L)}</div>`:''}
  </div>

  <p class="muted center" style="font-size:11.5px;margin-top:6px;line-height:1.5">Valores médios por fonte de proteína animal. São estimativas para acompanhamento, não uma pesagem exata.</p>`;
}

/* ============================================================
   BIOIMPEDÂNCIA · composição corporal
   ============================================================ */
const BIOM=[
  {id:'gordura',   nome:'Gordura corporal',  un:'%',    better:'down'},
  {id:'massaMagraPct',nome:'Massa muscular (%)',un:'%',better:'up'},
  {id:'musculo',   nome:'Massa muscular',    un:'kg',   better:'up'},
  {id:'agua',      nome:'Água corporal',     un:'%',    better:'up'},
  {id:'visceral',  nome:'Gordura visceral',  un:'',     better:'down'},
  {id:'tmb',       nome:'Metabolismo basal', un:'kcal', better:'up'},
];
function fmtBio(v,un){if(un==='kcal')return nf(v,0);return v%1===0?nf(v,0):nf(v,1);}
function bioView(){
  if(!S.bio)S.bio=[];
  const b=[...S.bio].sort((x,y)=>x.date<y.date?-1:1);
  const premiumTheme={line:'var(--accent)',dot:'var(--accent)',dotLast:'var(--accent-light)',dotStroke:'var(--nv-bg-2)',goalColor:'var(--warn2)',axis:'var(--tx-3)'};
  if(!b.length) return `<div class="scr-title" style="margin-bottom:6px">Bioimpedância</div>
    <div class="scr-sub">Acompanhe sua composição corporal: gordura, massa muscular e água ao longo do tratamento.</div>
    <div class="gcard center"><div style="font-size:36px">🧬</div>
      <p class="muted" style="font-size:13px;margin:8px 0 14px">Nenhuma medição ainda. Registre a primeira para começar a ver a evolução.</p>
      <button class="btn-pill block" onclick="openSheet('bio')">${icon('plus',true)} Registrar bioimpedância</button></div>`;
  const first=b[0], last=b[b.length-1];
  const fatData=b.filter(x=>x.gordura!=null).map(x=>({x:x.date,y:x.gordura}));
  const leanData=b.filter(x=>x.massaMagraPct!=null).map(x=>({x:x.date,y:x.massaMagraPct}));
  return `<div class="scr-title" style="margin-bottom:6px">Bioimpedância</div>
  <div class="scr-sub">Última medição em ${fmtBRy(last.date)} · ${b.length} ${plural(b.length,'registro','registros')}.</div>

  <div class="biggrid">
    ${BIOM.map(m=>{if(last[m.id]==null)return'';
      const d=first[m.id]!=null?+(last[m.id]-first[m.id]).toFixed(1):null;
      const good=d==null?false:(m.better==='down'?d<0:d>0);
      return `<div class="stat-tile2"><div class="k">${m.nome}</div>
        <div class="v" style="font-size:21px">${fmtBio(last[m.id],m.un)}<small> ${m.un}</small></div>
        ${d!=null&&d!==0?`<span class="delta2 ${good?'down':'up'}">${d>0?'+':'−'}${fmtBio(Math.abs(d),m.un)} ${m.un}</span>`:''}</div>`;
    }).join('')}
  </div>

  ${fatData.length>=2?`<div class="gcard tight"><div class="eyebrow2">Gordura corporal (%)</div>${lineChart(fatData,null,premiumTheme)}</div>`:''}
  ${leanData.length>=2?`<div class="gcard tight"><div class="eyebrow2">Massa muscular (%)</div>${lineChart(leanData,null,premiumTheme)}</div>`:''}

  <button class="btn-pill block" onclick="openSheet('bio')">${icon('plus',true)} Nova medição</button>

  <div class="gcard mt14"><h3>Histórico</h3><div class="hist-list">
    ${[...b].reverse().map(r=>`<div class="hist-item"><div class="badge-glow">${icon('pulse')}</div>
      <div><div class="t">${fmtBRy(r.date)}</div><div class="s">${[r.gordura!=null?nf(r.gordura)+'% gordura':'',r.massaMagraPct!=null?nf(r.massaMagraPct)+'% muscular':''].filter(Boolean).join(' · ')||'—'}</div></div></div>`).join('')}
  </div></div>`;
}

/* ============================================================
   RELATÓRIO DE EVOLUÇÃO · tela de seleção + gerador de PDF
   O PDF é gerado 100% no browser via Canvas, temporário e
   descartado ao fechar a tela. Zero persistência no servidor.
   ============================================================ */

/* ----- estado do relatório ----- */
let RPeriodo='30d', RDataIni='', RDataFim='';

/* Estatísticas de resumo exibidas na pré-visualização da tela de Relatórios.
   Reaproveita 100% dos dados já coletados por coletaDados() — nenhuma fonte
   nova, apenas médias/moda simples sobre os mesmos registros usados no PDF.
   Ajustar as fórmulas aqui NÃO afeta o PDF (gerarRelatorio() chama coletaDados()
   direto, sem passar por esta função).
     pesoMedio     = média do peso nas pesagens do período
     doseMedia     = média das doses aplicadas no período
     sintomaPrincipal = sintoma mais frequente no período (moda de d.contSint)
     adesaoPlano   = aplicações feitas ÷ aplicações esperadas no período,
                     assumindo cadência semanal (1×/semana) — mesma cadência
                     usada em nextAppInfo()/S.profile.diaAplicacao. Se o app
                     passar a suportar outras cadências, ajustar "esperado" aqui. */
function resumoStats(d,ini,fim){
  const pesoMedio=d.w.length?+(d.w.reduce((s,x)=>s+x.peso,0)/d.w.length).toFixed(1):null;
  const doses=d.apps.map(a=>parseFloat(String(a.dose).replace(',','.'))).filter(n=>!isNaN(n));
  const doseMedia=doses.length?+(doses.reduce((s,n)=>s+n,0)/doses.length).toFixed(1):null;
  const sintomaPrincipal=Object.entries(d.contSint).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const diasPeriodo=daysBetween(ini,fim)+1;
  const esperado=Math.max(1,Math.round(diasPeriodo/7));
  const adesaoPlano=Math.min(100,Math.round(d.apps.length/esperado*100));
  return{pesoMedio,doseMedia,sintomaPrincipal,adesaoPlano};
}
function relatorioView(){
  const hoje=todayISO();
  const opt=[['7d','7 dias'],['15d','15 dias'],['30d','30 dias'],['custom','Personalizado']];
  const{ini,fim}=periodoRange();
  const d=coletaDados(ini,fim);
  const stats=resumoStats(d,ini,fim);
  const rows=[
    ['syringe','Aplicações',String(d.apps.length)],
    ['drop','Dose média',stats.doseMedia!=null?nf(stats.doseMedia)+' '+esc(S.profile.unidade):'—'],
    ['scale2','Peso médio',stats.pesoMedio!=null?nf(stats.pesoMedio)+' kg':'—'],
    ['down','Variação de peso',d.w.length?(d.varPeso<=0?'−':'+')+nf(Math.abs(d.varPeso))+' kg':'—'],
    ['alert','Sintomas principais',stats.sintomaPrincipal?esc(stats.sintomaPrincipal):'Nenhum registrado'],
    ['check','Adesão ao plano',stats.adesaoPlano+'%'],
  ];
  return `
  <div class="ap-head ap-head-screen">
    <button type="button" class="ap-back" onclick="go('mais')" aria-label="Voltar">${CAL_CHEV_L}</button>
    <span class="ap-title">Relatórios</span>
    <span class="ap-head-spacer"></span>
  </div>
  <div class="scr-sub">Selecione o período e gere um PDF da sua evolução para compartilhar com sua equipe de saúde.</div>

  <div class="chip-row">
    ${opt.map(([id,lbl])=>`<button class="chip-glass ${RPeriodo===id?'active':''}" onclick="setPeriodo('${id}')">${lbl}</button>`).join('')}
  </div>

  ${RPeriodo==='custom'?`
  <div class="glass-field-2" style="margin-bottom:16px">
    <div class="glass-field" style="margin-bottom:0"><label>Data inicial</label>${dateFieldCustom('r-ini','cal',RDataIni||todayISOback(30))}</div>
    <div class="glass-field" style="margin-bottom:0"><label>Data final</label>${dateFieldCustom('r-fim','cal',RDataFim||hoje)}</div>
  </div>`:`<p style="font-size:12.5px;color:var(--tx-3);margin:-8px 0 16px">${fmtBRy(ini)} – ${fmtBRy(fim)}</p>`}

  <div class="gcard tight">
    <div class="eyebrow2">Resumo do período</div>
    ${rows.map(([ic,lbl,val])=>`<div class="between" style="padding:10px 0;border-bottom:1px solid var(--nv-border)">
      <div class="row" style="gap:10px"><span style="color:var(--tx-3)">${icon(ic)}</span><span style="font-size:13.5px;color:var(--tx-2)">${lbl}</span></div>
      <span style="font-size:14px;font-weight:700;color:var(--tx-1);font-variant-numeric:tabular-nums">${val}</span>
    </div>`).join('')}
  </div>

  <div class="gcard tight" style="margin-top:16px">
    <div class="between" style="margin-bottom:10px"><span class="eyebrow2" style="margin:0">Evolução do peso</span>
    <button class="link-more" onclick="go('evolucao')">Ver gráfico${icon('chevron')}</button></div>
    ${lineChartPremium(d.w.map(x=>({x:x.date,y:x.peso})),S.profile.pesoMeta)}
  </div>

  <button id="gerar-relatorio-btn" class="btn-pill block" style="margin-top:18px;font-size:15.5px" onclick="gerarRelatorio()">
    ${icon('doc',true)} Gerar relatório em PDF
  </button>
  <p style="font-size:11.5px;margin-top:10px;line-height:1.5;color:var(--tx-3);text-align:center">O relatório é gerado no seu dispositivo. Nenhum arquivo é salvo automaticamente.</p>`;
}

function setPeriodo(id){
  RPeriodo=id;
  if(id!=='custom'){RDataIni='';RDataFim='';}
  go('mais','relatorio');
}

function todayISOback(n){const d=new Date();d.setDate(d.getDate()-n);return todayISO(d);}

function periodoRange(){
  const hoje=todayISO();
  if(RPeriodo==='7d')  return{ini:todayISOback(6), fim:hoje};
  if(RPeriodo==='15d') return{ini:todayISOback(14),fim:hoje};
  if(RPeriodo==='30d') return{ini:todayISOback(29),fim:hoje};
  const ri=document.getElementById('r-ini'), rf=document.getElementById('r-fim');
  const ini=ri?ri.value:RDataIni, fim=rf?rf.value:RDataFim;
  return{ini:ini||todayISOback(29), fim:fim||hoje};
}

/* -------- coleta de dados do período -------- */
function coletaDados(ini,fim){
  const inRange=d=>d>=ini&&d<=fim;
  const w=sortedWeigh().filter(x=>inRange(x.date));
  const apps=S.applications.filter(x=>inRange(x.date)).sort((a,b)=>a.date<b.date?-1:1);
  const logs=Object.entries(S.dailyLogs).filter(([d])=>inRange(d)).map(([d,l])=>({date:d,...l})).sort((a,b)=>a.date<b.date?-1:1);
  const bio=(S.bio||[]).filter(x=>inRange(x.date)).sort((a,b)=>a.date<b.date?-1:1);
  const exams=S.exams.filter(x=>inRange(x.date));
  // peso início/fim do período
  const allW=sortedWeigh();
  const pesoIniPeriod=w.length?w[0].peso:(allW.length?allW[0].peso:S.profile.pesoInicial);
  const pesoFimPeriod=w.length?w[w.length-1].peso:currentWeight();
  const varPeso=+(pesoFimPeriod-pesoIniPeriod).toFixed(1);
  // hidratação
  const diasAgua=logs.filter(l=>l.agua>0);
  const mediaAgua=diasAgua.length?+(diasAgua.reduce((s,l)=>s+l.agua,0)/diasAgua.length).toFixed(1):0;
  const metaAguaAtingida=diasAgua.filter(l=>l.agua>=S.profile.metaAgua).length;
  // proteína
  const diasProt=logs.filter(l=>l.proteina>0);
  const mediaProt=diasProt.length?Math.round(diasProt.reduce((s,l)=>s+l.proteina,0)/diasProt.length):0;
  const adesaoProt=S.profile.metaProteina?Math.round(mediaProt/S.profile.metaProteina*100):0;
  // sintomas
  const contSint={};
  logs.forEach(l=>(l.sintomas||[]).filter(s=>s!=='Sem sintomas').forEach(s=>{contSint[s]=(contSint[s]||0)+1;}));
  // humor médio
  const diasHumor=logs.filter(l=>l.humor>0);
  const mediaHumor=diasHumor.length?+(diasHumor.reduce((s,l)=>s+l.humor,0)/diasHumor.length).toFixed(1):0;
  // apetite
  const aOrd=['Muito baixo','Baixo','Normal','Alto','Muito alto'];
  const contAp={};logs.forEach(l=>{if(l.apetite)contAp[l.apetite]=(contAp[l.apetite]||0)+1;});
  const apetiteDom=Object.entries(contAp).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  // próxima aplicação
  const na=nextAppInfo();
  const lastAppObj=lastApp();
  return{w,apps,logs,bio,exams,pesoIniPeriod,pesoFimPeriod,varPeso,
    mediaAgua,metaAguaAtingida,diasTotal:logs.length,mediaProt,adesaoProt,
    contSint,mediaHumor,apetiteDom,na,lastAppObj};
}

/* Contexto para js/insights.js — reaproveita coletaDados() (nunca recalcula
   o que já existe). `allApplications`/`achievements` ficam fora do recorte de
   período de propósito: "há quantas semanas usando X" ou "aumentou a dose"
   são fatos sobre agora, não sobre um intervalo arbitrário de relatório. */
function buildInsightContext(ini,fim){
  return {
    d: coletaDados(ini,fim),
    profile: S.profile,
    allApplications: S.applications,
    achievements: achievements(),
  };
}

/* Contexto para js/timeline.js — ao contrário do de insights, não passa por
   coletaDados() (que filtra por período; a timeline é a narrativa inteira,
   quem quiser um recorte usa opts.ini/opts.fim de TIMELINE.gerar()). */
function buildTimelineContext(){
  return {
    profile: S.profile,
    applications: S.applications,
    weighings: S.weighings,
    exams: S.exams,
    bio: S.bio||[],
    agenda: S.agenda,
    dailyLogs: S.dailyLogs,
    achievements: achievements(),
    insightsHistorico: INSIGHTS ? INSIGHTS.listarHistorico() : [],
  };
}

/* Contexto para js/actionplan.js — não recalcula nada: lê o que INSIGHTS e
   NOTIF já produzem (chamando os dois motores de novo, mas sem reimplementar
   regra nenhuma) e só passa dado bruto pros dois coletores locais novos
   (ausência de aplicação, bioimpedância antiga). */
function buildActionPlanContext(){
  return {
    insights: INSIGHTS ? INSIGHTS.gerar(buildInsightContext(S.profile.dataInicio, todayISO()), {registrarHistorico:false}) : [],
    notifElegiveis: NOTIF ? NOTIF.listarElegiveis(buildNotifStatus()) : [],
    applications: S.applications,
    bio: S.bio||[],
  };
}

/* -------- resumo automático -------- */
function gerarResumo(d,ini,fim){
  const frases=[];

  // peso
  if(d.varPeso<0) frases.push(`No período avaliado (${fmtBRy(ini)} a ${fmtBRy(fim)}), o peso apresentou redução de ${nf(Math.abs(d.varPeso))} kg.`);
  else if(d.varPeso===0) frases.push(`No período avaliado (${fmtBRy(ini)} a ${fmtBRy(fim)}), o peso manteve-se estável.`);
  else frases.push(`No período avaliado (${fmtBRy(ini)} a ${fmtBRy(fim)}), houve variação de +${nf(d.varPeso)} kg no peso.`);

  // hidratação + proteína
  const hidTxt=d.mediaAgua>=S.profile.metaAgua*0.85?'manteve-se em nível satisfatório'
    :d.mediaAgua>0?'ficou abaixo da meta diária estabelecida':null;
  const protTxt=d.adesaoProt>=90?'a meta proteica foi bem atendida'
    :d.adesaoProt>=70?'a ingestão proteica ficou próxima da meta'
    :d.adesaoProt>0?'a ingestão proteica esteve abaixo da meta'
    :null;
  if(hidTxt&&protTxt) frases.push(`A hidratação ${hidTxt}, e ${protTxt}.`);
  else if(hidTxt) frases.push(`A hidratação ${hidTxt}.`);
  else if(protTxt) frases.push(`Quanto à alimentação, ${protTxt}.`);

  // sintomas + aplicações
  const nSint=Object.values(d.contSint).reduce((s,v)=>s+v,0);
  const sintTxt=nSint===0?'Não foram registrados sintomas relevantes no período'
    :nSint<=3?'Os sintomas registrados foram leves e ocasionais'
    :'Foram registrados sintomas com certa frequência ao longo do período';
  const appTxt=d.apps.length>0?`, com ${d.apps.length} ${plural(d.apps.length,'aplicação','aplicações')} de ${esc(S.profile.medicamento)} ${plural(d.apps.length,'realizada','realizadas')} no intervalo`:'';
  frases.push(`${sintTxt}${appTxt}.`);

  frases.push('Este relatório foi gerado automaticamente a partir dos registros do paciente e não substitui a avaliação do médico ou nutricionista responsável.');
  return frases.join(' ');
}

/* ============================================================
   GERADOR PDF CANVAS · A4 retrato, unidades em pontos (pt)
   Canvas nativo, sem bibliotecas externas.
   ============================================================ */
/* ============================================================
   buildPDF + mostrarPreview · HTML com @media print A4
   Abre numa nova aba; window.print() gera PDF A4 perfeito.
   ============================================================ */
function buildPDF(d,ini,fim){
  const p=S.profile;
  const na=d.na;
  const falta=+(currentWeight()-p.pesoMeta).toFixed(1);
  const adesaoProt=d.adesaoProt; // reaproveita o valor já calculado (com guarda correta) em coletaDados()
  const H=['','Muito baixo','Baixo','Moderado','Bom','Muito bom'];
  const diasHumor=d.logs.filter(l=>l.humor>0);
  const sintomasTodos=['Náusea','Azia','Vômito','Constipação','Diarreia','Dor de cabeça','Fadiga','Gases'];
  const comSint=sintomasTodos.filter(s=>d.contSint[s]>0);
  const tlPeriodo = TIMELINE ? TIMELINE.gerar(buildTimelineContext(),{ini,fim}) : [];
  // no relatório, só os mais relevantes do período (não todos) — mesmo princípio já usado pros insights,
  // mas reordenados de volta pra cronológico depois de escolhidos, pra continuar lendo como narrativa
  const tl = tlPeriodo.length>25
    ? [...tlPeriodo].sort((a,b)=>a.prioridade-b.prioridade).slice(0,25).sort((a,b)=>a.data<b.data?-1:1)
    : tlPeriodo;

  /* gráfico SVG inline */
  function sparkSVG(weighings){
    if(weighings.length<2) return '';
    const W=480,H=112,pl=38,pr=10,pt=16,pb=26;
    const ys=weighings.map(w=>w.peso);
    const goal=p.pesoMeta;
    const mn=Math.min(...ys,goal)-0.5, mx=Math.max(...ys)+0.5, rng=(mx-mn)||1;
    const X=i=>pl+(i/(weighings.length-1))*(W-pl-pr);
    const Y=v=>pt+(1-(v-mn)/rng)*(H-pt-pb);
    const path=weighings.map((w,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(w.peso).toFixed(1)).join(' ');
    const area=path+` L${X(weighings.length-1).toFixed(1)},${(H-pb).toFixed(1)} L${X(0).toFixed(1)},${(H-pb).toFixed(1)} Z`;
    const gy=Y(goal);
    /* y-axis labels */
    const yLabels=[mn,mn+(mx-mn)/2,mx].map(v=>{
      const cy=Y(v);
      return `<text x="${pl-4}" y="${cy+4}" text-anchor="end" font-size="8" fill="var(--gray)" font-family="Arial">${nf(v)}</text>
<line x1="${pl}" y1="${cy}" x2="${W-pr}" y2="${cy}" stroke="var(--border)" stroke-width="0.8"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;margin:12px 0 4px">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--blue)" stop-opacity=".16"/>
        <stop offset="1" stop-color="var(--blue)" stop-opacity="0"/></linearGradient></defs>
      ${yLabels}
      ${goal>mn&&goal<mx?`<line x1="${pl}" y1="${gy.toFixed(1)}" x2="${W-pr}" y2="${gy.toFixed(1)}" stroke="var(--amber)" stroke-width="1.2" stroke-dasharray="5,3"/>
        <text x="${W-pr}" y="${(gy-3).toFixed(1)}" text-anchor="end" font-size="8" fill="var(--amber)" font-family="Arial">meta ${nf(goal)}</text>`:''}
      <path d="${area}" fill="url(#rg)"/>
      <polyline points="${weighings.map((w,i)=>X(i).toFixed(1)+','+Y(w.peso).toFixed(1)).join(' ')}" fill="none" stroke="var(--blue)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
      ${weighings.map((w,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(w.peso).toFixed(1)}" r="${i===weighings.length-1?3:1.8}" fill="${i===weighings.length-1?'var(--navy)':'var(--blue)'}" stroke="#fff" stroke-width="1.2"/>`).join('')}
      <text x="${X(0).toFixed(1)}" y="${H-4}" font-size="8" fill="var(--gray)" font-family="Arial">${fmtBR(weighings[0].date)}</text>
      <text x="${X(weighings.length-1).toFixed(1)}" y="${H-4}" text-anchor="end" font-size="8" fill="var(--gray)" font-family="Arial">${fmtBR(weighings[weighings.length-1].date)}</text>
    </svg>`;
  }

  /* evolução das medidas corporais (desde o início do tratamento) */
  function pillDiff(diff,txt){
    if(diff==null) return `<span class="pill flat">—</span>`;
    return `<span class="pill ${diff<=0?'pos':'neg'}">${txt}</span>`;
  }
  function medidasSec(){
    const measures=[['cintura','Cintura'],['abdomen','Abdômen'],['quadril','Quadril'],['braco','Braço'],['coxa','Coxa']];
    const wAll=sortedWeigh();
    const rows=measures.map(([k,lbl])=>{
      const withM=wAll.filter(x=>x[k]!=null);
      if(!withM.length) return '';
      const f=withM[0][k], l=withM[withM.length-1][k];
      const single=withM.length<2;
      const diff=single?null:+(l-f).toFixed(1);
      return `<tr>
        <td>${lbl}</td>
        <td>${single?'—':nf(f)+' cm'}</td>
        <td style="font-weight:600;color:var(--navy)">${nf(l)} cm</td>
        <td>${pillDiff(diff,diff==null?'—':(diff<=0?'−':'+')+nf(Math.abs(diff))+' cm')}</td>
      </tr>`;
    }).join('');
    if(!rows) return '';
    return `<div class="section">
      <div class="section-head"><span class="dot"></span><span class="section-title">Evolução das medidas corporais</span></div>
      <p class="nota">Comparativo desde o início do tratamento (${fmtBRy(p.dataInicio)})</p>
      <div class="dt"><table><thead><tr><th style="text-align:left">Medida</th><th>Inicial</th><th>Atual</th><th>Diferença</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  }

  /* evolução da bioimpedância */
  function bioSec(){
    if(!d.bio||!d.bio.length) return '';
    const BIOM=[['gordura','Gordura corporal','%','down'],['massaMagraPct','Massa muscular (%)','%','up'],
      ['musculo','Massa muscular (kg)','kg','up'],['agua','Água corporal','%','up'],
      ['visceral','Gordura visceral','','down'],['tmb','Metabolismo basal','kcal','up']];
    const bf=d.bio[0], bl=d.bio[d.bio.length-1];
    const single=d.bio.length<2;
    const rows=BIOM.filter(([k])=>bf[k]!=null||bl[k]!=null).map(([k,lbl,u,better])=>{
      const dec=u==='kcal'?0:1;
      const vi=bf[k], va=bl[k];
      const diff=(!single&&vi!=null&&va!=null)?+(va-vi).toFixed(2):null;
      const goodDiff=diff!=null&&(better==='down'?diff>0:diff<0)?-diff:diff; // normaliza sinal do pill p/ "melhora=azul"
      return `<tr>
        <td>${lbl}</td>
        <td>${single?'—':(vi!=null?nf(vi,dec)+' '+u:'—')}</td>
        <td style="font-weight:600;color:var(--navy)">${va!=null?nf(va,dec)+' '+u:'—'}</td>
        <td>${pillDiff(goodDiff,diff==null?'—':(diff<=0?'−':'+')+nf(Math.abs(diff),dec)+' '+u)}</td>
      </tr>`;
    }).join('');
    if(!rows) return '';
    const nota=single?`1 registro no período, em ${fmtBRy(bf.date)} — comparativo indisponível.`:`Comparativo entre ${fmtBRy(bf.date)} e ${fmtBRy(bl.date)}`;
    return `<div class="section">
      <div class="section-head"><span class="dot"></span><span class="section-title">Evolução da bioimpedância</span></div>
      <p class="nota">${nota}</p>
      <div class="dt"><table><thead><tr><th style="text-align:left">Indicador</th><th>Inicial</th><th>Atual</th><th>Diferença</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  }

  /* resumo executivo — itens secundários (os 3 principais viram hero-stats abaixo) */
  const topSint=Object.entries(d.contSint).sort((a,b)=>b[1]-a[1])[0];
  const rxSecundario=[
    ['Peso inicial do período',nf(d.pesoIniPeriod)+' kg'],
    ['Peso atual',nf(d.pesoFimPeriod)+' kg'],
    ['Dose atual',esc(p.doseAtual)+' '+esc(p.unidade)],
    ['Adesão à meta proteica',d.mediaProt>0?adesaoProt+'%':'—'],
    ['Média de hidratação',(d.diasTotal>0&&d.mediaAgua>0)?nf(d.mediaAgua)+' L':'—'],
    ['Principal sintoma',topSint?`${topSint[0]} (${topSint[1]}d)`:'Nenhum registrado'],
  ];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Compasso · Relatório · ${esc(p.nome)}</title>
<style>
/* ── paleta institucional (Design System Compasso — versão impressão) ── */
:root{
  --navy:#16294A; --blue:#2E6FC9; --blue-light:#4FA0FA; --blue-soft:#EAF2FE;
  --ink:#1F2937; --gray:#64748B; --gray-soft:#94A3B8;
  --border:#E5E9F0; --bg-soft:#F7F9FC; --amber:#D99A2B; --amber-soft:#FBF1DD;
  --symptom:#C0524A; --symptom-soft:#FBEDEC; --radius:12px;
}

/* ── reset ── */
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  font-size:9pt;font-weight:400;color:var(--ink);background:#fff;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ── página A4 ── */
@page{size:A4 portrait;margin:16mm 16mm 18mm 16mm}
.page{width:100%;max-width:180mm;margin:0 auto;padding:0}

/* ── masthead + capa ── */
.masthead{display:flex;align-items:center;gap:7px;margin-bottom:28px}
.masthead span{font-size:7.5pt;font-weight:700;letter-spacing:.18em;color:var(--gray);text-transform:uppercase}
.cover{padding-bottom:22px;border-bottom:1px solid var(--border);margin-bottom:6px;page-break-inside:avoid}
.cover-kicker{font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;color:var(--blue);font-weight:700;margin-bottom:10px}
.cover-name{font-size:23pt;font-weight:700;color:var(--navy);letter-spacing:-.015em;margin-bottom:13px}
.cover-meta{display:flex;gap:24px;flex-wrap:wrap;font-size:8pt;color:var(--gray);margin-bottom:15px}
.cover-meta b{color:var(--navy);font-weight:600}
.cover-disc{font-size:7pt;color:var(--gray-soft);line-height:1.65}

/* ── seções ── */
.section{margin-top:32px;page-break-inside:avoid}
.section-head{display:flex;align-items:center;gap:8px;margin-bottom:15px}
.section-head .dot{width:5px;height:5px;border-radius:50%;background:var(--blue);flex:0 0 auto}
.section-title{font-size:10.5pt;font-weight:700;color:var(--navy);letter-spacing:-.005em}

/* ── hero stats (métricas principais em destaque) ── */
.hero-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.hero-stat{border:1px solid rgba(226,233,240,.8);border-radius:var(--radius);padding:17px 16px;
  background:var(--bg-soft);box-shadow:0 1px 2px rgba(22,41,74,.04)}
.hero-stat.accent{background:var(--blue-soft);border-color:rgba(46,111,201,.16)}
.hero-stat.accent.warn{background:var(--amber-soft);border-color:rgba(217,154,43,.18)}
.hs-label{font-size:7pt;text-transform:uppercase;letter-spacing:.05em;color:var(--gray);font-weight:600;margin-bottom:8px}
.hs-val{font-size:16.5pt;font-weight:700;color:var(--navy);letter-spacing:-.01em}
.hero-stat.accent .hs-val{color:var(--blue)}
.hero-stat.accent.warn .hs-val{color:var(--amber)}
.hs-val small{font-size:8.5pt;font-weight:500;color:var(--gray)}
.hs-sub{font-size:7pt;color:var(--gray);margin-top:6px}

/* ── card leve (grade de informações) ── */
.card{background:#fff;border:1px solid rgba(226,233,240,.8);border-radius:var(--radius);
  padding:4px 0;box-shadow:0 1px 2px rgba(22,41,74,.04)}
.kv{display:grid;grid-template-columns:1fr 1fr;background:var(--bg-soft);
  border:1px solid rgba(226,233,240,.8);border-radius:var(--radius);overflow:hidden;
  box-shadow:0 1px 2px rgba(22,41,74,.04)}
.kv.c3{grid-template-columns:1fr 1fr 1fr}
.kc{padding:13px 16px;border-bottom:1px solid var(--border)}
.kl{font-size:7pt;color:var(--gray);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}
.kv2{font-size:10pt;font-weight:700;color:var(--navy)}

/* ── hábitos (hidratação + proteína) ── */
.habit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.habit-card{border:1px solid rgba(226,233,240,.8);border-radius:var(--radius);padding:16px 17px;
  background:#fff;box-shadow:0 1px 2px rgba(22,41,74,.04)}
.habit-card .kl{margin-bottom:9px}
.habit-val{font-size:14pt;font-weight:700;color:var(--navy);margin-bottom:10px}
.habit-val small{font-size:8pt;font-weight:500;color:var(--gray)}
.barw{background:var(--border);border-radius:999px;height:5px;overflow:hidden;margin-bottom:9px}
.barf{height:100%;background:linear-gradient(90deg,var(--blue),var(--blue-light));border-radius:999px}
.habit-sub{font-size:7pt;color:var(--gray)}

/* ── bem-estar: check-in + sintomas ── */
.chip-list{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;
  background:var(--symptom-soft);border:1px solid rgba(192,82,74,.18)}
.chip-n{font-weight:700;color:var(--symptom);font-size:8.5pt}
.chip-d{font-size:7pt;color:var(--symptom);opacity:.75}

/* ── tabelas em cartão (medidas / bioimpedância) ── */
.dt{border:1px solid rgba(226,233,240,.8);border-radius:var(--radius);overflow:hidden;
  box-shadow:0 1px 2px rgba(22,41,74,.04)}
.dt table{width:100%;border-collapse:collapse}
.dt th{font-size:7pt;color:var(--gray);font-weight:700;text-transform:uppercase;letter-spacing:.03em;
  text-align:center;padding:10px 12px;border-bottom:1px solid var(--border)}
.dt th:first-child{text-align:left}
.dt td{font-size:9pt;font-weight:400;padding:11px 12px;border-bottom:1px solid var(--border);color:var(--ink);text-align:center}
.dt td:first-child{text-align:left}
.dt tbody tr:last-child td{border-bottom:none}
.dt tbody tr:nth-child(even){background:var(--bg-soft)}
.pill{display:inline-block;padding:3px 11px;border-radius:999px;font-size:8pt;font-weight:700}
.pill.pos{background:var(--blue-soft);color:var(--blue)}
.pill.neg{background:var(--amber-soft);color:var(--amber)}
.pill.flat{background:var(--bg-soft);color:var(--gray-soft)}

/* ── timeline ── */
.tl{position:relative;padding-left:16px}
.tl:before{content:"";position:absolute;left:3px;top:2px;bottom:2px;width:1px;background:var(--border)}
.te{position:relative;padding:0 0 13px;page-break-inside:avoid}
.te:before{content:"";position:absolute;left:-13.5px;top:3px;width:5px;height:5px;
  border-radius:50%;background:var(--blue);border:1.5px solid #fff;box-shadow:0 0 0 1px var(--blue)}
.te-d{font-size:7pt;font-weight:700;color:var(--blue)}
.te-t{font-size:8.5pt;font-weight:400;color:var(--ink);margin-top:2px}

/* ── resumo automático (insight) ── */
.insight{background:var(--blue-soft);border-left:3px solid var(--blue);
  padding:18px 20px;margin-top:32px;border-radius:0 var(--radius) var(--radius) 0;page-break-inside:avoid}
.insight-t{font-size:7pt;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--blue);margin-bottom:9px}
.insight p{font-size:8.5pt;font-weight:400;line-height:1.85;color:var(--ink)}

/* ── footer ── */
.ftr{margin-top:34px;padding-top:14px;border-top:1px solid var(--border);
  text-align:center;font-size:7pt;font-weight:400;color:var(--gray-soft);line-height:1.7}

/* ── nota pequena ── */
.nota{font-size:7.5pt;color:var(--gray);margin-bottom:10px}

/* ── botões (só tela, some na impressão) ── */
.fab{position:fixed;bottom:18px;right:18px;display:flex;gap:8px;z-index:99}
.fab button{padding:11px 18px;border-radius:12px;border:none;font-family:inherit;
  font-size:11pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(22,41,74,.22)}
.fp{background:var(--navy);color:#fff}
.fc{background:#fff;color:var(--navy);border:1px solid var(--border)}

/* ── print: esconde botões ── */
@media print{
  .fab{display:none!important}
  body{background:#fff}
  .section{page-break-inside:avoid}
}
</style>
</head>
<body>
<div class="page">

<!-- MASTHEAD -->
<div class="masthead">
  <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="18" stroke="var(--blue)" stroke-width="2.4"/>
    <path d="M20 6L24 20L20 34L16 20Z" fill="var(--blue-light)"/>
    <circle cx="20" cy="20" r="3" fill="var(--navy)"/>
  </svg>
  <span>Compasso</span>
</div>

<!-- CAPA -->
<div class="cover">
  <div class="cover-kicker">Relatório de evolução</div>
  <div class="cover-name">${esc(p.nome)}</div>
  <div class="cover-meta">
    <span>Período: <b>${fmtBRy(ini)} a ${fmtBRy(fim)}</b> · ${daysBetween(ini,fim)+1} dias</span>
    <span>Emitido em: <b>${fmtBRy(todayISO())}</b></span>
  </div>
  <div class="cover-disc">Este relatório é informativo e não substitui a avaliação do seu médico ou nutricionista. O Compasso é um diário pessoal de acompanhamento.</div>
</div>

<!-- RESUMO EXECUTIVO -->
<div class="section">
  <div class="section-head"><span class="dot"></span><span class="section-title">Resumo executivo</span></div>
  <div class="hero-grid" style="margin-bottom:12px">
    <div class="hero-stat accent"><div class="hs-label">Perdido desde o início</div>
      <div class="hs-val">−${nf(lost())}<small> kg</small></div>
      <div class="hs-sub">${nf(lostPct())}% do peso inicial</div></div>
    <div class="hero-stat accent ${d.varPeso>0?'warn':''}"><div class="hs-label">Variação no período</div>
      <div class="hs-val">${d.varPeso<=0?'−':'+'}${nf(Math.abs(d.varPeso))}<small> kg</small></div></div>
    <div class="hero-stat"><div class="hs-label">Aplicações no período</div>
      <div class="hs-val">${d.apps.length}</div></div>
  </div>
  <div class="kv c3">
    ${rxSecundario.map(([lbl,val])=>`<div class="kc"><div class="kl">${lbl}</div><div class="kv2">${val}</div></div>`).join('')}
  </div>
</div>

<!-- MEDICAÇÃO -->
<div class="section">
  <div class="section-head"><span class="dot"></span><span class="section-title">Medicação</span></div>
  <div class="kv">
    <div class="kc"><div class="kl">Medicamento</div><div class="kv2">${esc(p.medicamento)}</div></div>
    <div class="kc"><div class="kl">Dose atual</div><div class="kv2">${esc(p.doseAtual)} ${esc(p.unidade)}</div></div>
    <div class="kc"><div class="kl">Frequência</div><div class="kv2">1× por semana</div></div>
    <div class="kc"><div class="kl">Aplicações no período</div><div class="kv2">${d.apps.length}</div></div>
    <div class="kc"><div class="kl">Última aplicação</div><div class="kv2">${d.lastAppObj?fmtBRy(d.lastAppObj.date):'—'}</div></div>
    <div class="kc"><div class="kl">Próxima aplicação</div><div class="kv2">${na.days===0?'Hoje':WD[p.diaAplicacao]+', '+fmtBRy(na.date)}</div></div>
  </div>
</div>

<!-- PESO -->
<div class="section">
  <div class="section-head"><span class="dot"></span><span class="section-title">Evolução do peso</span></div>
  <div class="hero-grid" style="margin-bottom:12px">
    <div class="hero-stat"><div class="hs-label">Início do período</div><div class="hs-val">${nf(d.pesoIniPeriod)}<small> kg</small></div></div>
    <div class="hero-stat accent ${d.varPeso>0?'warn':''}"><div class="hs-label">Variação</div>
      <div class="hs-val">${d.varPeso<=0?'−':'+'}${nf(Math.abs(d.varPeso))}<small> kg</small></div></div>
    <div class="hero-stat"><div class="hs-label">Peso atual</div><div class="hs-val">${nf(d.pesoFimPeriod)}<small> kg</small></div></div>
  </div>
  ${d.w.length>=2?`<div class="card" style="padding:12px 12px 8px;margin-bottom:13px">${sparkSVG(d.w)}</div>`:''}
  <div class="kv">
    <div class="kc"><div class="kl">Peso inicial do tratamento</div><div class="kv2">${nf(p.pesoInicial)} kg</div></div>
    <div class="kc"><div class="kl">Peso atual</div><div class="kv2">${nf(d.pesoFimPeriod)} kg</div></div>
    <div class="kc"><div class="kl">Peso meta</div><div class="kv2">${nf(p.pesoMeta)} kg</div></div>
    <div class="kc"><div class="kl">Falta para a meta</div><div class="kv2">${falta>0?nf(falta)+' kg':'✓ Meta atingida'}</div></div>
  </div>
</div>

<!-- MEDIDAS CORPORAIS -->
${medidasSec()}

<!-- HÁBITOS DO PERÍODO (hidratação + proteína) -->
${(d.diasTotal>0||d.mediaProt>0)?`<div class="section">
  <div class="section-head"><span class="dot"></span><span class="section-title">Hábitos do período</span></div>
  <div class="habit-grid">
    ${d.diasTotal>0?`<div class="habit-card">
      <div class="kl">Hidratação</div>
      <div class="habit-val">${nf(d.mediaAgua)}<small> L/dia</small></div>
      <div class="barw"><div class="barf" style="width:${Math.min(100,p.metaAgua?d.mediaAgua/p.metaAgua*100:0)}%"></div></div>
      <div class="habit-sub">Meta ${nf(p.metaAgua)} L · ${d.metaAguaAtingida} de ${d.diasTotal} dias atingida</div>
    </div>`:''}
    ${d.mediaProt>0?`<div class="habit-card">
      <div class="kl">Proteína</div>
      <div class="habit-val">${d.mediaProt}<small> g/dia</small></div>
      <div class="barw"><div class="barf" style="width:${Math.min(100,adesaoProt)}%"></div></div>
      <div class="habit-sub">Meta ${p.metaProteina} g · ${adesaoProt}% de adesão</div>
    </div>`:''}
  </div>
</div>`:''}

<!-- BEM-ESTAR (check-in + sintomas) -->
<div class="section">
  <div class="section-head"><span class="dot"></span><span class="section-title">Bem-estar</span></div>
  ${diasHumor.length>0?`<div class="kv" style="margin-bottom:12px">
    ${d.mediaHumor>0?`<div class="kc"><div class="kl">Humor médio</div><div class="kv2">${H[Math.round(d.mediaHumor)]||'—'}</div></div>`:''}
    ${d.apetiteDom?`<div class="kc"><div class="kl">Apetite predominante</div><div class="kv2">${d.apetiteDom}</div></div>`:''}
  </div>`:''}
  <div class="kl" style="margin-bottom:9px">Sintomas registrados no período</div>
  ${comSint.length===0
    ?'<p class="nota">Nenhum sintoma registrado no período.</p>'
    :`<div class="chip-list">${comSint.map(s=>`<span class="chip"><span class="chip-n">${s}</span><span class="chip-d">${d.contSint[s]}d</span></span>`).join('')}</div>`}
</div>

<!-- BIOIMPEDÂNCIA -->
${bioSec()}

<!-- LINHA DO TEMPO -->
${tl.length?`<div class="section">
  <div class="section-head"><span class="dot"></span><span class="section-title">Linha do tempo</span></div>
  <div class="tl">${tl.map(e=>`
    <div class="te"><div class="te-d">${fmtBRy(e.data)}</div><div class="te-t">${e.titulo} — ${e.descricao}</div></div>`).join('')}
  </div>
</div>`:''}

<!-- INSIGHTS DO PERÍODO (só os mais relevantes, não todos) -->
${(()=>{
  const insPeriodo = INSIGHTS ? INSIGHTS.gerar(buildInsightContext(ini,fim),{registrarHistorico:false}).slice(0,5) : [];
  if(!insPeriodo.length) return '';
  return `<div class="section">
    <div class="section-head"><span class="dot"></span><span class="section-title">Insights do período</span></div>
    ${insPeriodo.map(i=>`<div class="insight" style="margin-bottom:10px">
      <div class="insight-t">${i.categoria}</div>
      <p>${i.text} <span style="color:var(--gray)">${i.justificativa}</span></p>
    </div>`).join('')}
  </div>`;
})()}

<!-- PLANO DE ACOMPANHAMENTO (opcional — só ações abertas e de alta prioridade) -->
${(()=>{
  const acoesAlta = ACTIONPLAN ? ACTIONPLAN.gerar(buildActionPlanContext()).filter(a=>a.prioridade==='alta' && a.status!=='resolvida') : [];
  if(!acoesAlta.length) return '';
  return `<div class="section">
    <div class="section-head"><span class="dot"></span><span class="section-title">Plano de acompanhamento</span></div>
    ${acoesAlta.map(a=>`<div class="insight" style="margin-bottom:10px">
      <div class="insight-t">${esc(a.titulo)}</div>
      <p>${esc(a.descricao)} <span style="color:var(--gray)">${esc(a.motivo)}</span></p>
    </div>`).join('')}
  </div>`;
})()}

<!-- RESUMO AUTOMÁTICO -->
<div class="insight">
  <div class="insight-t">Resumo automático</div>
  <p>${gerarResumo(d,ini,fim)}</p>
</div>

<!-- FOOTER -->
<div class="ftr">Compasso · companheiro de tratamento GLP-1<br>Relatório gerado em ${fmtBRy(todayISO())} · Este documento não substitui a avaliação do seu médico ou nutricionista.</div>

</div><!-- /page -->

<!-- BOTÕES FLUTUANTES (somem na impressão) -->
<div class="fab">
  <button class="fc" onclick="window.close()">✕ Fechar</button>
  <button class="fp" onclick="window.print()">⬇ Imprimir / Salvar PDF</button>
</div>
</body>
</html>`;
}

function mostrarPreview(html,ini,fim){
  const w=window.open('','_blank');
  if(!w){toast('Abra o app fora do Claude.ai para usar esta função');return;}
  w.document.write(html);
  w.document.close();
}

async function gerarRelatorio(){
  if(FEATURES && LICENSE && !LICENSE.can(FEATURES.REPORTS)){ go('premium'); return; }
  const{ini,fim}=periodoRange();
  if(ini>fim){toast('A data inicial deve ser anterior à final');return;}
  await withAuthBtn('gerar-relatorio-btn','Gerando…',()=>new Promise(resolve=>{
    setTimeout(()=>{
      try{
        const d=coletaDados(ini,fim);
        mostrarPreview(buildPDF(d,ini,fim),ini,fim);
      }catch(e){
        console.error(e);
        toast('Não foi possível gerar o relatório agora. Tente novamente em instantes.');
      }
      resolve();
    },80);
  }));
}

/* ============================================================
   TELA · SPLASH (breve, enquanto verifica a sessão)
   ============================================================ */
function splashView(){
  return `<div class="splash">${logoHeroSVG(56)}</div>`;
}

/* decoração de fundo — linhas fluidas, usada só na tela de Boas-vindas */
function waveSVG(){
  return `<svg class="welcome-wave" viewBox="0 0 400 180" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#4E9EF5" stop-opacity="0"/>
        <stop offset=".5" stop-color="#8FC6FF" stop-opacity=".9"/>
        <stop offset="1" stop-color="#4E9EF5" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,120 C80,60 140,160 220,90 C300,30 340,110 400,70" fill="none" stroke="url(#waveGrad)" stroke-width="1.6" opacity=".55"/>
    <path d="M0,142 C90,92 160,172 240,112 C310,62 350,132 400,96" fill="none" stroke="url(#waveGrad)" stroke-width="1.1" opacity=".32"/>
    <path d="M0,98 C70,150 150,58 230,128 C300,180 350,88 400,118" fill="none" stroke="url(#waveGrad)" stroke-width="1.1" opacity=".24"/>
  </svg>`;
}

/* ============================================================
   TELA · BOAS-VINDAS (exibida quando não há sessão Supabase ativa)
   ============================================================ */
function welcomeView(){
  return `<div class="welcome">
    <div class="welcome-glow welcome-glow-a"></div>
    <div class="welcome-glow welcome-glow-b"></div>
    ${waveSVG()}
    <div class="welcome-content">
      <div class="welcome-top">
        <div class="glow-wrap">${logoHeroSVG(84)}</div>
        <div class="welcome-word">Compasso</div>
        <div class="welcome-tag">Jornada GLP-1</div>
      </div>
      <div class="welcome-mid">
        <h1 class="welcome-title">Seu progresso.<br><span class="accent-text">Todo dia.</span></h1>
        <p class="welcome-sub">Acompanhe sua jornada com GLP-1, um dia de cada vez.</p>
      </div>
      <div class="welcome-bottom">
        <button class="btn-pill block" onclick="iniciarFluxoLogin()">Começar agora
          ${AUTH_ARROW}
        </button>
      </div>
    </div>
  </div>`;
}
/* ============================================================
   AUTENTICAÇÃO — Login, Cadastro, Recuperar senha, Nova senha
   Navegação isolada (AUTH_SCREEN), sem tocar em TAB/SUB/go().
   Reaproveita integralmente os componentes do onboarding (.ob,
   .glass-card, .glass-field, obIcon, .btn-pill) — nenhum
   componente novo.
   ============================================================ */
let AUTH_SCREEN='welcome'; // 'welcome' | 'login' | 'cadastro' | 'recuperar' | 'nova-senha'
let AUTH_MSG=null; // mensagem de sucesso exibida no lugar do formulário (ex.: "confira seu e-mail")

function emailValido(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function goAuth(screen){ AUTH_MSG=null; AUTH_SCREEN=screen; renderWelcome(); }
function authBackBtn(){
  return `<div class="row" style="margin-bottom:14px"><button type="button" class="cal-nav" onclick="goAuth('welcome')" aria-label="Voltar">${CAL_CHEV_L}</button></div>`;
}
function authMsgPanel(titulo,texto,voltarLabel,voltarScreen){
  return `<div class="ob">
    <div class="glow-wrap ob-icon">${logoHeroSVG(56)}</div>
    <h1>${titulo}</h1>
    <p class="lead">${texto}</p>
    <button type="button" class="btn-pill block" onclick="goAuth('${voltarScreen}')">${voltarLabel}</button>
  </div>`;
}
const AUTH_ARROW='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function loginView(){
  const ic=obIcon;
  return `<div class="ob">
    ${authBackBtn()}
    <div class="glow-wrap ob-icon">${logoHeroSVG(56)}</div>
    <h1>Entrar</h1>
    <p class="lead">Acesse sua conta para continuar sua jornada.</p>
    <div class="glass-card">
      <div class="glass-field"><label for="li-email">E-mail</label>
        <label class="field-wrap" for="li-email">${ic('user')}<input id="li-email" type="email" placeholder="seu@email.com" autocomplete="email"></label></div>
      <div class="glass-field"><label for="li-senha">Senha</label>
        <label class="field-wrap" for="li-senha"><input id="li-senha" type="password" placeholder="Sua senha" autocomplete="current-password"></label></div>
      <button class="btn-pill block" id="li-btn" onclick="doLogin()">Entrar ${AUTH_ARROW}</button>
    </div>
    <button type="button" class="btn-pill block ghost neutral" onclick="goAuth('recuperar')">Esqueci minha senha</button>
    <p class="center" style="font-size:12.5px;color:var(--tx-3);margin-top:18px">Não tem conta?
      <button type="button" onclick="goAuth('cadastro')" style="color:var(--accent-light);font-weight:600;background:none;border:none;padding:0;font-size:inherit;cursor:pointer">Criar conta</button>
    </p>
  </div>`;
}

function cadastroView(){
  if(AUTH_MSG) return authMsgPanel('Confira seu e-mail',AUTH_MSG,'Voltar para o login','login');
  const ic=obIcon;
  return `<div class="ob">
    ${authBackBtn()}
    <div class="glow-wrap ob-icon">${logoHeroSVG(56)}</div>
    <h1>Criar conta</h1>
    <p class="lead">Comece sua jornada com GLP-1 e acompanhe tudo em um só lugar.</p>
    <div class="glass-card">
      <div class="glass-field"><label for="cd-email">E-mail</label>
        <label class="field-wrap" for="cd-email">${ic('user')}<input id="cd-email" type="email" placeholder="seu@email.com" autocomplete="email"></label></div>
      <div class="glass-field"><label for="cd-senha">Senha</label>
        <label class="field-wrap" for="cd-senha"><input id="cd-senha" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></label></div>
      <div class="glass-field"><label for="cd-senha2">Confirmar senha</label>
        <label class="field-wrap" for="cd-senha2"><input id="cd-senha2" type="password" placeholder="Repita a senha" autocomplete="new-password"></label></div>
      <button class="btn-pill block" id="cd-btn" onclick="doSignUp()">Criar conta ${AUTH_ARROW}</button>
    </div>
    <p class="center" style="font-size:12.5px;color:var(--tx-3);margin-top:18px">Já tem conta?
      <button type="button" onclick="goAuth('login')" style="color:var(--accent-light);font-weight:600;background:none;border:none;padding:0;font-size:inherit;cursor:pointer">Entrar</button>
    </p>
  </div>`;
}

function recuperarSenhaView(){
  if(AUTH_MSG) return authMsgPanel('Verifique seu e-mail',AUTH_MSG,'Voltar para o login','login');
  const ic=obIcon;
  return `<div class="ob">
    ${authBackBtn()}
    <div class="glow-wrap ob-icon">${logoHeroSVG(56)}</div>
    <h1>Recuperar senha</h1>
    <p class="lead">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
    <div class="glass-card">
      <div class="glass-field"><label for="rs-email">E-mail</label>
        <label class="field-wrap" for="rs-email">${ic('user')}<input id="rs-email" type="email" placeholder="seu@email.com" autocomplete="email"></label></div>
      <button class="btn-pill block" id="rs-btn" onclick="doResetPassword()">Enviar link ${AUTH_ARROW}</button>
    </div>
  </div>`;
}

function novaSenhaView(){
  return `<div class="ob">
    <div class="glow-wrap ob-icon">${logoHeroSVG(56)}</div>
    <h1>Nova senha</h1>
    <p class="lead">Defina uma nova senha para sua conta.</p>
    <div class="glass-card">
      <div class="glass-field"><label for="ns-senha">Nova senha</label>
        <label class="field-wrap" for="ns-senha"><input id="ns-senha" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></label></div>
      <div class="glass-field"><label for="ns-senha2">Confirmar nova senha</label>
        <label class="field-wrap" for="ns-senha2"><input id="ns-senha2" type="password" placeholder="Repita a senha" autocomplete="new-password"></label></div>
      <button class="btn-pill block" id="ns-btn" onclick="doUpdatePassword()">Salvar nova senha ${AUTH_ARROW}</button>
    </div>
  </div>`;
}

function renderWelcome(){
  const views={welcome:welcomeView,login:loginView,cadastro:cadastroView,recuperar:recuperarSenhaView,'nova-senha':novaSenhaView};
  const view=views[AUTH_SCREEN]||welcomeView;
  document.getElementById('app').innerHTML = view();
}

function iniciarFluxoLogin(){
  goAuth('login');
}

/* ---------- handlers de autenticação ---------- */
async function withAuthBtn(btnId,textoCarregando,fn){
  const btn=document.getElementById(btnId);
  const original=btn.innerHTML;
  btn.disabled=true; btn.textContent=textoCarregando;
  try{ await fn(); }
  finally{ const b=document.getElementById(btnId); if(b){ b.disabled=false; b.innerHTML=original; } }
}
async function doLogin(){
  const email=val('li-email'), senha=val('li-senha');
  if(!email||!senha){toast('Preencha e-mail e senha');return;}
  if(!emailValido(email)){toast('Informe um e-mail válido');return;}
  await withAuthBtn('li-btn','Entrando…',async()=>{
    const auth=await window.__authReady;
    const r=await auth.signIn(email,senha);
    if(!r.ok) toast(r.error);
  });
}
async function doSignUp(){
  const email=val('cd-email'), senha=val('cd-senha'), senha2=val('cd-senha2');
  if(!email||!senha||!senha2){toast('Preencha todos os campos');return;}
  if(!emailValido(email)){toast('Informe um e-mail válido');return;}
  if(senha.length<6){toast('A senha precisa ter pelo menos 6 caracteres');return;}
  if(senha!==senha2){toast('As senhas não coincidem');return;}
  await withAuthBtn('cd-btn','Criando conta…',async()=>{
    const auth=await window.__authReady;
    const r=await auth.signUp(email,senha);
    if(!r.ok){ toast(r.error); return; }
    if(r.precisaConfirmarEmail){
      AUTH_MSG=`Enviamos um link de confirmação para ${email}. Abra seu e-mail para ativar sua conta.`;
      AUTH_SCREEN='cadastro'; renderWelcome();
    }
    // se a confirmação de e-mail estiver desabilitada no projeto, a sessão já vem criada
    // e o listener SIGNED_IN (registrarListenerAuth) leva para o app sozinho.
  });
}
async function doResetPassword(){
  const email=val('rs-email');
  if(!email){toast('Informe seu e-mail');return;}
  if(!emailValido(email)){toast('Informe um e-mail válido');return;}
  await withAuthBtn('rs-btn','Enviando…',async()=>{
    const auth=await window.__authReady;
    const r=await auth.resetPasswordForEmail(email);
    if(!r.ok){ toast(r.error); return; }
    AUTH_MSG=`Enviamos um link de recuperação para ${email}. Abra seu e-mail para redefinir sua senha.`;
    AUTH_SCREEN='recuperar'; renderWelcome();
  });
}
async function doUpdatePassword(){
  const senha=val('ns-senha'), senha2=val('ns-senha2');
  if(!senha||!senha2){toast('Preencha os dois campos');return;}
  if(senha.length<6){toast('A senha precisa ter pelo menos 6 caracteres');return;}
  if(senha!==senha2){toast('As senhas não coincidem');return;}
  await withAuthBtn('ns-btn','Salvando…',async()=>{
    const auth=await window.__authReady;
    const r=await auth.updatePassword(senha);
    if(!r.ok){ toast(r.error); return; }
    toast('Senha atualizada com sucesso');
    AUTH_SCREEN='welcome'; render();
  });
}
async function doLogout(){
  await withAuthBtn('logout-btn','Saindo…',async()=>{
    const auth=await window.__authReady;
    const r=await auth.signOut();
    if(!r.ok){ toast(r.error); return; }
    // o listener SIGNED_OUT (registrarListenerAuth) volta para a tela de boas-vindas.
  });
}

/* ---------- verificação e reação a mudanças de sessão Supabase ---------- */
async function verificarSessao(){
  try{
    const client = await Promise.race([
      window.__supabaseReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
    if(!client) return false;
    const {data} = await client.auth.getSession();
    return !!(data && data.session);
  }catch(e){
    console.error('[Boas-vindas] erro ao verificar sessão:', e);
    return false;
  }
}
async function initDatabase(){
  try{
    DB = await Promise.race([
      window.__databaseReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
    if(DB) DB.init({
      getState:()=>S,
      applyRemote:(mutate)=>{ S=mutate(S); persistLocal(); render(); },
    });
  }catch(e){
    console.error('[Sync] erro ao inicializar camada de dados:', e);
  }
}
let notifListenerBound=false;
async function initNotifications(){
  try{
    NOTIF = await Promise.race([
      window.__notificationsReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
  }catch(e){
    console.error('[Notificações] erro ao inicializar:', e);
  }
  if(NOTIF && !notifListenerBound){
    notifListenerBound = true;
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState==='visible' && S) NOTIF.checkAndNotify(buildNotifStatus());
      if(document.visibilityState==='visible' && LICENSE) LICENSE.refresh();
    });
  }
}
async function initInsights(){
  try{
    INSIGHTS = await Promise.race([
      window.__insightsReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
  }catch(e){
    console.error('[Insights] erro ao inicializar:', e);
  }
}
async function initTimeline(){
  try{
    TIMELINE = await Promise.race([
      window.__timelineReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
  }catch(e){
    console.error('[Timeline] erro ao inicializar:', e);
  }
}
async function initActionplan(){
  try{
    ACTIONPLAN = await Promise.race([
      window.__actionplanReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
  }catch(e){
    console.error('[ActionPlan] erro ao inicializar:', e);
  }
}
/* Único ponto que informa js/database.js se o backup está autorizado —
   database.js não sabe o que é LICENSE/FEATURES, só recebe um booleano.
   Chamado sempre que o estado da licença pode ter mudado. */
function atualizarPermissaoDeSync(){
  if(!DB) return;
  DB.setSyncAllowed(!FEATURES || !LICENSE || LICENSE.can(FEATURES.BACKUP));
}
async function initLicense(){
  try{
    LICENSE = await Promise.race([
      window.__licenseReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
    if(LICENSE){ FEATURES = LICENSE.FEATURES; await LICENSE.refresh(); } // revalida oportunisticamente, mesmo padrão do sync (Sprint J)
    atualizarPermissaoDeSync();
  }catch(e){
    console.error('[License] erro ao inicializar:', e);
  }
}
async function registrarListenerAuth(){
  try{
    const auth = await Promise.race([
      window.__authReady,
      new Promise(resolve=>setTimeout(()=>resolve(null), 4000)),
    ]);
    if(!auth) return;
    auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){ AUTH_MSG=null; AUTH_SCREEN='nova-senha'; renderWelcome(); }
      else if(event==='SIGNED_IN'){ AUTH_SCREEN='welcome'; if(DB) DB.setUser(session&&session.user&&session.user.id); render(); }
      else if(event==='SIGNED_OUT'){ AUTH_MSG=null; AUTH_SCREEN='welcome'; if(DB) DB.setUser(null); renderWelcome(); }
    });
  }catch(e){
    console.error('[Auth] erro ao registrar listener de sessão:', e);
  }
}

/* ---------- boot ---------- */
async function boot(){
  document.getElementById('app').innerHTML = splashView();
  await initDatabase();
  await initNotifications();
  await initInsights();
  await initTimeline();
  await initActionplan();
  await initLicense();
  await registrarListenerAuth();
  if(AUTH_SCREEN==='nova-senha'){ renderWelcome(); return; }
  const temSessao = await verificarSessao();
  if(temSessao){
    if(DB){
      const client = await window.__supabaseReady;
      const {data} = await client.auth.getSession();
      DB.setUser(data&&data.session&&data.session.user&&data.session.user.id);
    }
    render();
    if(NOTIF && S) NOTIF.checkAndNotify(buildNotifStatus());
  } else renderWelcome();
}
boot();
