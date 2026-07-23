/* ============================================================
   COMPASSO · Action Plan — motor único do plano de ação (Sprint N)
   Responde uma pergunta que nenhum motor anterior responde: "o que
   merece atenção na próxima consulta?". Não recalcula regra nenhuma —
   lê e reclassifica o que js/insights.js e js/notifications.js já
   produzem, e só tem lógica própria nos dois cenários que não existem
   em lugar nenhum hoje (ausência prolongada de aplicações e
   bioimpedância antiga). Nenhuma tela monta ação diretamente: tudo
   passa por gerar(ctx) aqui.
   ============================================================ */

const STATUS_KEY = 'compasso_actionplan_status_v1';
const LIMIAR_AUSENCIA_APLICACAO_DIAS = 14;   // 2 semanas sem nenhuma aplicação registrada
const LIMIAR_BIO_ANTIGA_DIAS = 180;          // mesmo limiar de validade já usado no insights.js

function isoFromDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO(){ return isoFromDate(new Date()); }
function daysBetweenISO(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function fmtBRy(iso){ const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
function dataValida(v){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }

function loadStatus(){ try{ return JSON.parse(localStorage.getItem(STATUS_KEY)) || {}; }catch(e){ return {}; } }
function saveStatus(s){ try{ localStorage.setItem(STATUS_KEY, JSON.stringify(s)); }catch(e){} }

const ORDEM_PRIORIDADE = {alta:1, media:2, baixa:3};

/* ---------- insights → ação ----------
   Por id de regra, não por `tipo` — tipo foi desenhado pro tom de uma
   frase na tela de Insights, não pra decidir se algo é "acionável".
   Cada mapeador recebe o insight já pronto (de INSIGHTS.gerar()) e
   devolve null (não vira ação) ou {prioridade, categoria, titulo, descricao}. */
const MAPA_INSIGHT_ACAO = {
  peso_tendencia(ins){
    if(ins.tipo!=='atencao') return null; // só o caso de ganho de peso
    return {prioridade:'media', categoria:'peso', titulo:'Ganho de peso identificado',
      descricao:'Conversar com a nutricionista e o médico sobre o ganho e possíveis ajustes no tratamento.'};
  },
  peso_desaceleracao(ins){
    return {prioridade:'media', categoria:'peso', titulo:'Perda de peso desacelerando',
      descricao:'Revisar o plano alimentar e a dose com a equipe de acompanhamento.'};
  },
  peso_meta_parcial(ins){
    if(ins.tipo!=='parabens') return null; // só quando a meta foi 100% atingida
    return {prioridade:'baixa', categoria:'peso', titulo:'Meta de peso atingida',
      descricao:'Reforço positivo — nenhuma ação necessária.', acionavel:false};
  },
  adesao_semanal(ins){
    if(ins.tipo!=='atencao') return null; // só adesão baixa (<70%)
    return {prioridade:'media', categoria:'adesao', titulo:'Baixa adesão às aplicações',
      descricao:'Conversar com o médico para entender a causa da baixa adesão.'};
  },
  agua_tendencia(ins){
    return {prioridade:'media', categoria:'agua', titulo:'Hidratação abaixo do esperado',
      descricao:'Reforçar a ingestão de água com orientação da nutricionista.'};
  },
  proteina_dias_meta(ins){
    return {prioridade:'media', categoria:'proteina', titulo:'Proteína insuficiente',
      descricao:'Ajustar a estratégia de ingestão proteica com a nutricionista.'};
  },
  sintoma_constipacao(ins){
    return {prioridade:'alta', categoria:'sintomas', titulo:'Sintomas recorrentes',
      descricao:'Discutir o manejo do sintoma com o médico e a nutricionista.'};
  },
  sintoma_pos_aplicacao(ins){
    return {prioridade:'media', categoria:'sintomas', titulo:'Padrão de sintomas identificado',
      descricao:'Avaliar com o médico se o sintoma está ligado à aplicação.'};
  },
  sintoma_pos_aumento_dose(ins){
    return {prioridade:'media', categoria:'sintomas', titulo:'Padrão de sintomas identificado',
      descricao:'Avaliar com o médico se o sintoma está ligado ao aumento de dose.'};
  },
  sintoma_reduzindo(ins){
    return {prioridade:'baixa', categoria:'sintomas', titulo:'Sintomas melhorando',
      descricao:'Reforço positivo — nenhuma ação necessária.', acionavel:false};
  },
  bio_gordura(ins){
    return {prioridade:'baixa', categoria:'bioimpedancia', titulo:'Evolução positiva de composição corporal',
      descricao:'Reforço positivo — nenhuma ação necessária.', acionavel:false};
  },
  bio_massa_magra(ins){
    if(ins.tipo==='atencao') return {prioridade:'media', categoria:'bioimpedancia', titulo:'Perda de massa magra',
      descricao:'Rever proteína e treino de força com a equipe de acompanhamento.'};
    return {prioridade:'baixa', categoria:'bioimpedancia', titulo:'Evolução positiva de composição corporal',
      descricao:'Reforço positivo — nenhuma ação necessária.', acionavel:false};
  },
  medidas_cintura_peso(ins){
    return {prioridade:'baixa', categoria:'peso', titulo:'Evolução positiva de composição corporal',
      descricao:'Reforço positivo — nenhuma ação necessária.', acionavel:false};
  },
  exame_variacao(ins){
    if(ins.tipo==='atencao') return {prioridade:'alta', categoria:'exames', titulo:'Exame relevante piorou',
      descricao:'Levar o resultado para a próxima consulta médica.'};
    if(ins.tipo==='parabens') return {prioridade:'baixa', categoria:'exames', titulo:'Exame melhorou',
      descricao:'Reforço positivo — nenhuma ação necessária.', acionavel:false};
    return null; // informativo: exame fora da lista onde "menor é melhor" é seguro afirmar — não julga
  },
  // aplicacao_tempo_uso, aplicacao_dose_mudou e conquista_* não têm mapeador:
  // são informativos/celebrativos, sem decisão pendente — ficam de fora de propósito.
};

/* ---------- notificações elegíveis → ação ---------- */
const MAPA_NOTIF_ACAO = {
  pesagem: {prioridade:'media', categoria:'peso', descricao:'Registrar uma nova pesagem.'},
  agenda: {prioridade:'baixa', categoria:'agenda', descricao:null},
  exames: {prioridade:'baixa', categoria:'exames', descricao:null},
  // aplicacao (ciclo desta semana), agua/proteina (cobrança do dia), caneta (logística) e
  // metas (reforço, já coberto por insights/conquistas) ficam de fora de propósito.
};

/* ---------- coletores locais: os dois cenários que não existem em
   lugar nenhum hoje (ver Fase 1) ---------- */
function colAplicacaoAusente(ctx){
  const apps=(ctx.applications||[]).filter(a=>a&&dataValida(a.date));
  if(!apps.length) return null; // nunca aplicou não é "ausência" — é início de tratamento
  const ultima=[...apps].sort((a,b)=>a.date<b.date?1:-1)[0];
  const dias=daysBetweenISO(ultima.date, todayISO());
  if(dias<LIMIAR_AUSENCIA_APLICACAO_DIAS) return null;
  return {
    id:'aplicacao:ausencia', prioridade:'alta', categoria:'aplicacao',
    titulo:'Ausência prolongada de aplicações',
    descricao:'Retomar as aplicações ou conversar com o médico sobre o andamento do tratamento.',
    motivo:`Nenhuma aplicação registrada há ${dias} dias (última em ${fmtBRy(ultima.date)}).`,
    origem:'collector:aplicacao_ausencia', assinatura:String(dias),
  };
}
function colBioimpedanciaAntiga(ctx){
  const bio=(ctx.bio||[]).filter(b=>b&&dataValida(b.date));
  if(!bio.length) return null; // nunca fez bioimpedância não é uma regressão — fora de escopo
  const ultima=[...bio].sort((a,b)=>a.date<b.date?1:-1)[0];
  const dias=daysBetweenISO(ultima.date, todayISO());
  if(dias<LIMIAR_BIO_ANTIGA_DIAS) return null;
  return {
    id:'bioimpedancia:antiga', prioridade:'media', categoria:'bioimpedancia',
    titulo:'Bioimpedância desatualizada',
    descricao:'Agendar uma nova avaliação de bioimpedância.',
    motivo:`Última bioimpedância há ${dias} dias (em ${fmtBRy(ultima.date)}).`,
    origem:'collector:bioimpedancia_antiga', assinatura:String(dias),
  };
}

/* ---------- motor ---------- */
function gerar(ctx){
  const brutas=[];

  (ctx.insights||[]).forEach(ins=>{
    try{
      const mapear=MAPA_INSIGHT_ACAO[ins.id];
      if(!mapear) return;
      const cfg=mapear(ins);
      if(!cfg) return;
      brutas.push({
        id:'insight:'+ins.id, prioridade:cfg.prioridade, categoria:cfg.categoria,
        titulo:cfg.titulo, descricao:cfg.descricao, acionavel:cfg.acionavel!==false,
        motivo: ins.justificativa || '',
        origem:'insight:'+ins.id, assinatura:String(ins.assinatura),
      });
    }catch(e){ console.error('[ActionPlan] erro mapeando insight:', e); }
  });

  (ctx.notifElegiveis||[]).forEach(n=>{
    try{
      const cfg=MAPA_NOTIF_ACAO[n.type];
      if(!cfg) return;
      brutas.push({
        id:'notificacao:'+n.key, prioridade:cfg.prioridade, categoria:cfg.categoria,
        titulo:n.title, descricao:cfg.descricao||n.body,
        motivo:n.body,
        origem:'notification:'+n.type, assinatura:n.key,
      });
    }catch(e){ console.error('[ActionPlan] erro mapeando notificação:', e); }
  });

  [colAplicacaoAusente, colBioimpedanciaAntiga].forEach(coletor=>{
    try{ const a=coletor(ctx); if(a) brutas.push(a); }catch(e){ console.error('[ActionPlan] erro num coletor local:', e); }
  });

  // dedup por id
  const vistos=new Set();
  const dedupe=[];
  brutas.forEach(a=>{
    if(vistos.has(a.id)){ console.warn('[ActionPlan] id de ação duplicado, ignorando:', a.id); return; }
    vistos.add(a.id);
    dedupe.push(a);
  });

  // aplica status persistido — e suprime o que foi resolvido e continua com a mesma assinatura
  const statusMap=loadStatus();
  const resultado=[];
  dedupe.forEach(a=>{
    const salvo=statusMap[a.id];
    if(salvo && salvo.status==='resolvida' && salvo.assinatura===a.assinatura) return; // suprimida
    a.status = (salvo && salvo.assinatura===a.assinatura) ? salvo.status : 'nova';
    resultado.push(a);
  });

  resultado.sort((a,b)=>ORDEM_PRIORIDADE[a.prioridade]-ORDEM_PRIORIDADE[b.prioridade]);
  return resultado;
}

/* Avança/registra o status de uma ação. Recebe a própria ação (não só o id)
   porque precisa gravar a assinatura atual junto — é o que impede a ação de
   reaparecer imediatamente depois de resolvida (ver QA da Fase 1): enquanto
   a assinatura não mudar, `gerar()` mantém a mesma decisão de status.
   Também grava o conteúdo (título/descrição/motivo/categoria/origem) junto
   com o status — a ação some da lista ativa quando resolvida, mas o registro
   completo continua em compasso_actionplan_status_v1, pronto pra uma tela de
   histórico futura (listarResolvidas()) sem precisar reconstruir nada. */
function atualizarStatus(acao, novoStatus){
  if(!acao || !acao.id) return;
  const statusMap=loadStatus();
  statusMap[acao.id] = {
    status:novoStatus, assinatura:acao.assinatura, data:todayISO(),
    titulo:acao.titulo, descricao:acao.descricao, motivo:acao.motivo,
    categoria:acao.categoria, prioridade:acao.prioridade, origem:acao.origem,
  };
  saveStatus(statusMap);
}

/* Consulta das ações já resolvidas — a lista principal (gerar()) nunca as
   mostra; isso existe pra uma tela de histórico futura ter de onde ler,
   sem exigir nenhuma mudança no motor quando essa tela for construída. */
function listarResolvidas(){
  return Object.entries(loadStatus())
    .filter(([id,v])=>v.status==='resolvida')
    .map(([id,v])=>({id,...v}))
    .sort((a,b)=>a.data<b.data?1:-1);
}

const actionplanApi = {gerar, atualizarStatus, listarResolvidas};

if(window.__resolveActionplanReady) window.__resolveActionplanReady(actionplanApi);
else window.__actionplanReady = Promise.resolve(actionplanApi);
