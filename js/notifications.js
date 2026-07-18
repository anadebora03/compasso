/* ============================================================
   COMPASSO · Notifications — lembretes inteligentes (Sprint K)
   Camada única de decisão: nenhuma tela cria notificação
   diretamente, todas passam por checkAndNotify() aqui.

   Sem agendamento real (nenhuma API do navegador permite acordar
   o app num horário exato, offline, sem servidor — ver plano da
   Sprint K). O mecanismo é reavaliar tudo, a partir do estado
   atual do app, toda vez que checkAndNotify() é chamado — o que
   corresponde a "reagendar": não existe um timer para cancelar,
   só uma pergunta recalculada ("isso está devido agora?").
   ============================================================ */

const PREFS_KEY = 'compasso_notif_prefs_v1';
const STATE_KEY = 'compasso_notif_state_v1';

const DEFAULT_PREFS = {
  aplicacao: true, pesagem: true, agua: true, proteina: true,
  agenda: true, exames: true, caneta: true, metas: true,
  pesagemFrequencia: 'semanal', // 'semanal' | 'quinzenal' | 'mensal'
};
const FREQ_DIAS = {semanal:7, quinzenal:14, mensal:30};

function loadPrefs(){
  try{ return {...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY))||{})}; }
  catch(e){ return {...DEFAULT_PREFS}; }
}
function savePrefs(p){ try{ localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }catch(e){} }
function loadState(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }catch(e){ return {}; } }
function saveState(s){ try{ localStorage.setItem(STATE_KEY, JSON.stringify(s)); }catch(e){} }

function daysBetweenISO(a,b){
  const pa=new Date(a), pb=new Date(b);
  return Math.round((pb-pa)/86400000);
}
function isoFromDate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function todayISO(){ return isoFromDate(new Date()); }

/* Início do ciclo semanal de aplicação: a ocorrência mais recente do dia da
   semana configurado (hoje mesmo, se hoje for o dia). Usado para saber se a
   aplicação "desta semana" já foi feita, não só se hoje é o dia marcado. */
function inicioCicloAplicacao(diaAplicacao){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diffDesde = (hoje.getDay() - diaAplicacao + 7) % 7;
  const inicio = new Date(hoje); inicio.setDate(hoje.getDate()-diffDesde);
  return isoFromDate(inicio);
}

function proximoCompromisso(agenda, filtro){
  const hoje = todayISO();
  const item = (agenda||[])
    .filter(a=>filtro(a) && a.date>=hoje && daysBetweenISO(hoje,a.date)<=2)
    .sort((a,b)=>a.date<b.date?-1:1)[0];
  if(!item) return null;
  const dias = daysBetweenISO(hoje, item.date);
  const quando = dias===0?'hoje':dias===1?'amanhã':`em ${dias} dias`;
  return {item, quando};
}

/* ---------- tipos de lembrete: cada um decide, a partir de `status`
   (montado por app.js com dados já derivados — ver buildNotifStatus
   em app.js), se há algo devido agora, com texto contextual. ---------- */
const REMINDER_TYPES = {
  /* Não olha só "hoje é o dia" — olha se a aplicação DESTA SEMANA já foi
     registrada desde o início do ciclo. Continua devido todo dia até a
     usuária registrar, não só no dia exato configurado. */
  aplicacao(status){
    if(status.diaAplicacao==null) return null;
    const inicio = inicioCicloAplicacao(status.diaAplicacao);
    if(status.ultimaAplicacaoDate && status.ultimaAplicacaoDate >= inicio) return null; // já feita neste ciclo
    const hoje = todayISO();
    const atrasada = hoje > inicio;
    return {
      key: `aplicacao-${hoje}`, // chave por dia — reaparece a cada verificação até o registro
      title: atrasada ? 'Você ainda não registrou a aplicação desta semana' : 'Hoje é o dia da sua aplicação',
      body: atrasada ? 'Sua aplicação estava marcada para esta semana e ainda não foi registrada.' : 'Não esqueça de registrar quando aplicar.',
    };
  },
  pesagem(status){
    const freqDias = FREQ_DIAS[status.pesagemFrequencia] || 7;
    if(!status.ultimaPesagemDate) return null;
    const dias = daysBetweenISO(status.ultimaPesagemDate, todayISO());
    if(dias < freqDias) return null;
    return {key:`pesagem-${todayISO()}`, title:'Hora de registrar seu peso', body:`Já fazem ${dias} dias desde sua última pesagem.`};
  },
  agua(status){
    if(!status.metaAgua) return null;
    const hora = new Date().getHours();
    if(hora < 8) return null;
    const janela = hora<12?'manha':hora<18?'tarde':'noite';
    const horasAcordado = Math.min(14, Math.max(1, hora-8)); // janela útil ~8h-22h
    const paceEsperado = Math.min(1, horasAcordado/14);
    const paceReal = status.aguaHoje / status.metaAgua;
    if(paceReal >= paceEsperado - 0.15) return null; // dentro do esperado, sem cobrança
    return {key:`agua-${todayISO()}-${janela}`, title:'Você ainda não bateu sua meta de água hoje', body:`${status.aguaHoje.toFixed(1)} de ${status.metaAgua} L registrados até agora.`};
  },
  proteina(status){
    if(!status.metaProteina) return null;
    const hora = new Date().getHours();
    if(hora < 18) return null;
    if(status.proteinaHoje >= status.metaProteina) return null;
    return {key:`proteina-${todayISO()}`, title:'Você ainda não registrou sua proteína de hoje', body:`Faltam ${Math.max(0,status.metaProteina-status.proteinaHoje)}g para bater sua meta.`};
  },
  /* Agenda e Exames são o mesmo dado (S.agenda) — o app não tem uma lista
     separada de "exames futuros", só compromissos com tipo==='Exame'. São
     dois tipos de lembrete configuráveis porque o usuário pode querer ligar
     um e desligar o outro, mas a fonte é uma só. */
  agenda(status){
    const proximo = proximoCompromisso(status.agenda, a=>a.tipo!=='Exame');
    if(!proximo) return null;
    return {key:`agenda-${proximo.item.id}`, title:`${proximo.item.tipo} ${proximo.quando}`, body: proximo.item.obs || 'Compromisso marcado na sua agenda.'};
  },
  exames(status){
    const proximo = proximoCompromisso(status.agenda, a=>a.tipo==='Exame');
    if(!proximo) return null;
    return {key:`exames-${proximo.item.id}`, title:`Exame agendado ${proximo.quando}`, body: proximo.item.obs || 'Você tem um exame marcado na agenda.'};
  },
  caneta(status){
    if(!status.pen || status.pen.rest > 2) return null;
    return {key:`caneta-${status.pen.id}-${status.pen.rest}`, title:'Sua caneta está acabando', body: status.pen.rest<=0 ? 'Sua caneta atual chegou ao fim — hora de providenciar uma nova.' : `Faltam ${status.pen.rest} aplicações para terminar esta caneta.`};
  },
  metas(status){
    for(const a of (status.achievements||[])){
      if(a.on) return {key:`metas-${a.t}`, title:`Conquista desbloqueada: ${a.t}`, body:a.s};
    }
    if(status.metaAgua && status.aguaHoje>=status.metaAgua){
      return {key:`metas-agua-${todayISO()}`, title:'Meta de água batida hoje 🎉', body:'Você bebeu água suficiente hoje. Continue assim!'};
    }
    if(status.metaProteina && status.proteinaHoje>=status.metaProteina){
      return {key:`metas-proteina-${todayISO()}`, title:'Meta de proteína batida hoje 🎉', body:'Você bateu sua meta de proteína de hoje.'};
    }
    return null;
  },
};

/* Prioridade: quanto menor, mais importante. Usada para escolher UMA entre
   várias notificações elegíveis ao mesmo tempo (ver checkAndNotify) — não
   para ordenar exibição simultânea, porque só uma é mostrada por vez. */
const PRIORIDADE = {aplicacao:1, caneta:2, agenda:3, exames:3, pesagem:4, agua:5, proteina:5, metas:6};

/* ---------- exibição ---------- */
async function show(title, body, key){
  try{
    if(typeof Notification==='undefined' || Notification.permission!=='granted') return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg && reg.showNotification) await reg.showNotification(title, {body, tag:key, icon:'icons/icon-192.png', badge:'icons/icon-192.png'});
    else new Notification(title, {body, tag:key});
    return true;
  }catch(e){ console.error('[Notificações] falha ao exibir:', e); return false; }
}

async function requestPermission(){
  if(typeof Notification==='undefined') return 'unsupported';
  if(Notification.permission==='granted' || Notification.permission==='denied') return Notification.permission;
  try{ return await Notification.requestPermission(); }
  catch(e){ return 'denied'; }
}

/* ---------- ponto de entrada único ----------
   Gera todos os lembretes elegíveis, ordena por prioridade e mostra só o
   mais importante — nunca vários de uma vez ao abrir o app. Os demais
   elegíveis não são marcados no dedup, então continuam elegíveis e podem
   aparecer (o mais importante entre eles) na próxima verificação. */
async function checkAndNotify(status){
  const prefs = loadPrefs();
  let state = loadState();
  const elegiveis = [];
  for(const [type, check] of Object.entries(REMINDER_TYPES)){
    if(!prefs[type]) continue;
    const due = check({...status, pesagemFrequencia:prefs.pesagemFrequencia});
    if(!due) continue;
    if(state[due.key]) continue; // já mostrado — evita repetir a mesma notificação
    elegiveis.push({type, ...due});
  }
  if(!elegiveis.length) return;
  elegiveis.sort((a,b)=>(PRIORIDADE[a.type]||9)-(PRIORIDADE[b.type]||9));
  const escolhida = elegiveis[0];
  const shown = await show(escolhida.title, escolhida.body, escolhida.key);
  if(shown){
    state[escolhida.key] = todayISO();
    saveState(limparState(state));
  }
}

/* Limpeza simples: só remove marcações antigas dos tipos que recriam uma
   chave nova todo dia (aplicação/pesagem/água/proteína/metas diárias) —
   essas, sem limpeza, cresceriam para sempre. As chaves permanentes
   (agenda/exames/caneta/conquistas, identificadas pelo item, não pela
   data) nunca são removidas por idade: apagar "metas-Primeiro kg" depois
   de 60 dias faria a conquista ser parabenizada de novo, o que é errado —
   e agenda/exames/caneta já não repetem sozinhos (a condição de disparo
   deles depende do estado atual do item, não da marcação antiga). */
const PRUNE_PREFIXES = ['aplicacao-','pesagem-','agua-','proteina-','metas-agua-','metas-proteina-'];
const STATE_MAX_DIAS = 60;
function limparState(state){
  const limite = new Date(); limite.setDate(limite.getDate()-STATE_MAX_DIAS);
  const limiteISO = isoFromDate(limite);
  for(const k of Object.keys(state)){
    if(PRUNE_PREFIXES.some(p=>k.startsWith(p)) && state[k] < limiteISO) delete state[k];
  }
  return state;
}

/* Marca um lembrete como resolvido sem precisar que ele tenha sido exibido
   (ex.: usuário registra a aplicação antes de qualquer notificação aparecer —
   não existe timer para cancelar, só o dedup a ajustar). */
function cancel(key){
  const state = loadState();
  if(!state[key]){ state[key]=todayISO(); saveState(state); }
}
function cancelAplicacaoHoje(){ cancel(`aplicacao-${todayISO()}`); }
function cancelPesagemHoje(){ cancel(`pesagem-${todayISO()}`); }

const notifApi = {checkAndNotify, requestPermission, cancel, cancelAplicacaoHoje, cancelPesagemHoje, loadPrefs, savePrefs, get permission(){ return typeof Notification!=='undefined'?Notification.permission:'unsupported'; }};

if(window.__resolveNotificationsReady) window.__resolveNotificationsReady(notifApi);
else window.__notificationsReady = Promise.resolve(notifApi);
