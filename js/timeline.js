/* ============================================================
   COMPASSO · Timeline — motor único da linha do tempo (Sprint M)
   Nenhuma tela monta evento nenhum: tudo passa por gerar(ctx)
   aqui. app.js monta o contexto (buildTimelineContext(), reaproveitando
   S diretamente + achievements() + INSIGHTS.listarHistorico()) e só
   renderiza a lista pronta.

   Cada "coletor" transforma uma fonte de dado bruta (S.applications,
   S.weighings, ...) numa lista de eventos no formato único:
   {id, data, categoria, prioridade, titulo, descricao, icone, origem, payload}.
   Adicionar um tipo de evento novo = escrever mais um coletor e
   registrá-lo em COLLECTORS — o motor (dedup, filtro, ordenação)
   nunca muda.
   ============================================================ */

function parseNum(s){ if(s==null) return null; const n=parseFloat(String(s).replace(',','.')); return isNaN(n)?null:n; }
function isoFromDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO(){ return isoFromDate(new Date()); }
function fmtBRy(iso){ const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
function nf(n,d=1){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function dataValida(v){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }

/* Menor número = mais importante — mesma convenção do js/insights.js.
   Usado tanto pra desempate no mesmo dia quanto pra "pegar só os mais
   relevantes" quando um consumidor (ex.: PDF) precisa truncar a lista. */
const CATEGORIA_PRIORIDADE = {
  tratamento:1, dose:2, aplicacao:3, sintomas:4, peso:5,
  bioimpedancia:6, exames:7, agenda:8, conquistas:9, insights:10,
};

const COLLECTORS = [
  /* ---------- tratamento ---------- */
  function colTratamento(ctx){
    const p=ctx.profile;
    if(!p || !dataValida(p.dataInicio)) return [];
    return [{
      id:'tratamento:inicio', data:p.dataInicio, categoria:'tratamento',
      prioridade:CATEGORIA_PRIORIDADE.tratamento, titulo:'Início do tratamento',
      descricao:`Peso inicial de ${nf(p.pesoInicial)} kg.`,
      icone:'flag', origem:'profile', payload:{dataInicio:p.dataInicio, pesoInicial:p.pesoInicial},
    }];
  },
  /* ---------- aplicação / dose ---------- */
  function colAplicacoes(ctx){
    const apps=(ctx.applications||[]).filter(a=>a&&dataValida(a.date)).sort((a,b)=>a.date<b.date?-1:1);
    const out=[];
    apps.forEach((a,i)=>{
      let prevSameMed=null;
      for(let j=i-1;j>=0;j--){ if(apps[j].medicamento===a.medicamento){ prevSameMed=apps[j]; break; } }
      const d1=prevSameMed?parseNum(prevSameMed.dose):null, d2=parseNum(a.dose);
      const mudouDose = d1!=null && d2!=null && d1!==d2;
      const chave=a.id || (a.date+'|'+i);
      if(mudouDose){
        const subiu=d2>d1;
        out.push({
          id:'dose:'+chave, data:a.date, categoria:'dose', prioridade:CATEGORIA_PRIORIDADE.dose,
          titulo:'Mudança de dose',
          descricao:`${subiu?'Aumento':'Redução'} de ${esc(prevSameMed.dose)} para ${esc(a.dose)} ${esc(ctx.profile.unidade||'')} de ${esc(a.medicamento||'')}.`,
          icone:'syringe', origem:'applications', payload:{anterior:prevSameMed,atual:a},
        });
      } else {
        out.push({
          id:'aplicacao:'+chave, data:a.date, categoria:'aplicacao', prioridade:CATEGORIA_PRIORIDADE.aplicacao,
          titulo:'Aplicação registrada',
          descricao:`${esc(a.dose)} ${esc(ctx.profile.unidade||'')} de ${esc(a.medicamento||'')}${a.local?' · '+esc(a.local):''}.`,
          icone:'syringe', origem:'applications', payload:a,
        });
      }
    });
    return out;
  },
  /* ---------- peso (medidas corporais entram na descrição, não são evento à parte) ---------- */
  function colPesagens(ctx){
    const w=(ctx.weighings||[]).filter(x=>x&&dataValida(x.date)).sort((a,b)=>a.date<b.date?-1:1);
    return w.map((x,i)=>{
      const prev=w[i-1];
      const delta=prev?+(x.peso-prev.peso).toFixed(1):null;
      const medidas=['cintura','quadril','abdomen','coxa','braco'].filter(k=>x[k]!=null);
      const partes=[`${nf(x.peso)} kg`];
      if(delta!=null) partes.push(`${delta>0?'+':''}${nf(delta)} kg desde a pesagem anterior`);
      if(medidas.length) partes.push('medidas do corpo registradas');
      return {
        id:'peso:'+(x.id||(x.date+'|'+i)), data:x.date, categoria:'peso', prioridade:CATEGORIA_PRIORIDADE.peso,
        titulo:'Pesagem registrada', descricao:partes.join(', ')+'.',
        icone:'scale', origem:'weighings', payload:x,
      };
    });
  },
  /* ---------- bioimpedância ---------- */
  function colBioimpedancia(ctx){
    const b=(ctx.bio||[]).filter(x=>x&&dataValida(x.date)).sort((a,b)=>a.date<b.date?-1:1);
    const campos=[['gordura','gordura corporal','%'],['massaMagra','massa magra','kg'],['musculo','massa muscular','kg'],['agua','água corporal','%'],['visceral','gordura visceral',''],['tmb','metabolismo basal','kcal']];
    return b.map((x,i)=>{
      const partes=campos.filter(([k])=>x[k]!=null).map(([k,lbl,u])=>`${lbl} ${nf(x[k],k==='tmb'?0:1)}${u}`);
      return {
        id:'bioimpedancia:'+(x.id||(x.date+'|'+i)), data:x.date, categoria:'bioimpedancia', prioridade:CATEGORIA_PRIORIDADE.bioimpedancia,
        titulo:'Bioimpedância realizada', descricao:(partes.length?partes.join(', '):'Avaliação registrada')+'.',
        icone:'pulse', origem:'bio', payload:x,
      };
    });
  },
  /* ---------- exames ---------- */
  function colExames(ctx){
    const porTipo={};
    (ctx.exams||[]).filter(e=>e&&dataValida(e.date)).forEach(e=>{ (porTipo[e.tipo||'Exame']=porTipo[e.tipo||'Exame']||[]).push(e); });
    const out=[];
    for(const tipo in porTipo){
      const lista=porTipo[tipo].sort((a,b)=>a.date<b.date?-1:1);
      lista.forEach((e,i)=>{
        const prev=lista[i-1];
        out.push({
          id:'exames:'+(e.id||(e.date+'|'+tipo+'|'+i)), data:e.date, categoria:'exames', prioridade:CATEGORIA_PRIORIDADE.exames,
          titulo:esc(tipo),
          descricao:`${esc(e.valor)}${prev?` (anterior: ${esc(prev.valor)} em ${fmtBRy(prev.date)})`:''}.`,
          icone:'flask', origem:'exams', payload:e,
        });
      });
    }
    return out;
  },
  /* ---------- sintomas ---------- */
  function colSintomas(ctx){
    const logs=ctx.dailyLogs||{};
    const out=[];
    for(const date in logs){
      if(!dataValida(date)) continue;
      const sint=(logs[date].sintomas||[]).filter(s=>s!=='Sem sintomas');
      if(!sint.length) continue;
      out.push({
        id:'sintomas:'+date, data:date, categoria:'sintomas', prioridade:CATEGORIA_PRIORIDADE.sintomas,
        titulo:'Sintomas relatados', descricao:sint.map(esc).join(', ')+'.',
        icone:'alert', origem:'dailyLogs', payload:{date,sintomas:sint},
      });
    }
    return out;
  },
  /* ---------- agenda ---------- */
  function colAgenda(ctx){
    const hoje=todayISO();
    return (ctx.agenda||[]).filter(a=>a&&dataValida(a.date)).map((a,i)=>{
      const futuro=a.date>hoje;
      return {
        id:'agenda:'+(a.id||(a.date+'|'+i)), data:a.date, categoria:'agenda', prioridade:CATEGORIA_PRIORIDADE.agenda,
        titulo:esc(a.tipo||'Compromisso'),
        descricao:a.obs?esc(a.obs):(futuro?'Compromisso agendado.':'Compromisso registrado.'),
        icone:'cal', origem:'agenda', payload:Object.assign({futuro},a),
      };
    });
  },
  /* ---------- conquistas ---------- */
  function colConquistas(ctx){
    return (ctx.achievements||[]).filter(a=>a&&a.on&&dataValida(a.date)).map(a=>({
      id:'conquistas:'+a.t, data:a.date, categoria:'conquistas', prioridade:CATEGORIA_PRIORIDADE.conquistas,
      titulo:a.t, descricao:a.s+'.',
      icone:'medal', origem:'achievements', payload:a,
    }));
  },
  /* ---------- insights (só os de maior relevância — Atenção/Parabéns) ---------- */
  function colInsights(ctx){
    return (ctx.insightsHistorico||[]).filter(h=>h && dataValida(h.data) && (h.tipo==='atencao'||h.tipo==='parabens')).map(h=>({
      id:'insights:'+h.id+'|'+h.data, data:h.data, categoria:'insights', prioridade:CATEGORIA_PRIORIDADE.insights,
      titulo:'Insight identificado', descricao:h.text,
      icone:'spark', origem:'insights-historico', payload:h,
    }));
  },
];

/* Categoria da REGRA de insight (js/insights.js) → categoria de evento que,
   se presente na timeline, já conta a mesma história — o insight vira
   redundante e é suprimido. Só cobre os casos em que o insight restabelece
   exatamente um fato que já tem evento próprio (pesagem, bioimpedância,
   exame, conquista); interpretações sem evento equivalente (adesão,
   hidratação, proteína, correlações de sintomas) não entram aqui e
   continuam aparecendo normalmente. */
const RULE_CATEGORIA_PARA_EVENTO = {
  peso:'peso', medidas:'peso', bioimpedancia:'bioimpedancia', exames:'exames', conquista:'conquistas',
};

/* ---------- motor ---------- */
function gerar(ctx, opts){
  const eventos=[];
  const vistos=new Map();
  for(const coletor of COLLECTORS){
    let lista;
    try{ lista=coletor(ctx)||[]; }catch(e){ console.error('[Timeline] erro num coletor:', e); lista=[]; }
    for(const ev of lista){
      if(!ev || !dataValida(ev.data)) continue;
      if(vistos.has(ev.id)){ console.warn('[Timeline] id de evento duplicado, ignorando:', ev.id); continue; }
      vistos.set(ev.id, true);
      eventos.push(ev);
    }
  }
  let filtrados = eventos;
  if(opts && opts.ini && opts.fim){
    filtrados = eventos.filter(ev=>ev.data>=opts.ini && ev.data<=opts.fim);
  }
  // suprime insight redundante — só depois do filtro de período, pra decidir
  // com base no que de fato aparece nesse recorte (não no histórico inteiro)
  const categoriasPresentes = new Set(filtrados.filter(ev=>ev.categoria!=='insights').map(ev=>ev.categoria));
  filtrados = filtrados.filter(ev=>{
    if(ev.categoria!=='insights') return true;
    const alvo = RULE_CATEGORIA_PARA_EVENTO[ev.payload && ev.payload.categoria];
    return !alvo || !categoriasPresentes.has(alvo);
  });
  filtrados.sort((a,b)=>{
    if(a.data!==b.data) return a.data<b.data?-1:1;
    return a.prioridade-b.prioridade;
  });
  return filtrados;
}

const timelineApi = {gerar, totalColetores:COLLECTORS.length};

if(window.__resolveTimelineReady) window.__resolveTimelineReady(timelineApi);
else window.__timelineReady = Promise.resolve(timelineApi);
