/* ============================================================
   COMPASSO · Goals — motor único de metas da jornada (Sprint O)
   Não inventa métrica nova: reclassifica números que já existem
   (coletaDados(), achievements(), goalProgressPct(), daysTreat(),
   insight.assinatura) num formato único de "meta com progresso".
   Nenhuma tela calcula progresso — tudo passa por gerar(ctx) aqui.

   Duas famílias de meta, tratadas de propósito de formas diferentes:
   - DESTINO (peso-alvo, marcos de peso/tempo): têm fim, podem ficar
     'concluida'.
   - RECORRENTE (água, proteína, pesagem, adesão, exames, bio): hábito
     contínuo, nunca usa o status 'concluida' — só 'em_andamento',
     'estagnada' ou 'nao_iniciada'.
   ============================================================ */

function isoFromDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO(){ return isoFromDate(new Date()); }
function daysBetweenISO(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function addDaysISO(iso,n){ const d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return isoFromDate(d); }
function fmtBRy(iso){ const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
function nf(n,d=1){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function dataValida(v){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function clampPct(n){ return Math.max(0,Math.min(100,Math.round(n))); }

const FREQ_DIAS = {semanal:7, quinzenal:14, mensal:30};

/* ---------- destino ---------- */
function colPesoAlvo(ctx){
  const p=ctx.profile;
  if(!((p.pesoInicial-p.pesoMeta)>0)) return [];
  const w=[...(ctx.weighings||[])].filter(x=>x&&dataValida(x.date)).sort((a,b)=>a.date<b.date?-1:1);
  if(!w.length) return [];
  const atual=w[w.length-1].peso;
  const pct=ctx.pesoProgressoPct; // já vem pronto de goalProgressPct() — não recalcula a fórmula
  const concluida=atual<=p.pesoMeta;
  const ganhando=(ctx.insights||[]).some(i=>i.id==='peso_tendencia'&&i.tipo==='atencao');
  const desacelerando=(ctx.insights||[]).some(i=>i.id==='peso_desaceleracao');
  const estagnada=!concluida&&(ganhando||desacelerando);
  const status=concluida?'concluida':estagnada?'estagnada':(pct>0?'em_andamento':'nao_iniciada');
  const falta=+(atual-p.pesoMeta).toFixed(1);
  return [{
    id:'peso:alvo', categoria:'peso', titulo:'Peso-alvo',
    // tendencia é sobre o progresso RUMO À META, não o peso em si: 'subindo' = indo bem
    progresso:{atual, esperado:p.pesoMeta, tendencia: ganhando?'caindo':(desacelerando?'estavel':'subindo')},
    percentual:pct, status,
    proximaEtapa: concluida?'Meta atingida! 🎉':`Faltam ${nf(Math.max(0,falta))} kg para a meta.`,
    prioridade: status==='estagnada'?'alta':(status==='em_andamento'&&pct>=90?'alta':(status==='concluida'?'baixa':'media')),
    origem:'weighings',
  }];
}

const MARCOS_PESO=[['Primeiro kg',1],['−5 kg',5],['−10 kg',10]];
function colMarcosPeso(ctx){
  const w=[...(ctx.weighings||[])].filter(x=>x&&dataValida(x.date)).sort((a,b)=>a.date<b.date?-1:1);
  const atual=w.length?w[w.length-1].peso:ctx.profile.pesoInicial;
  const lost=+(ctx.profile.pesoInicial-atual).toFixed(1);
  return MARCOS_PESO.map(([titulo,limiar])=>{
    const ach=(ctx.achievements||[]).find(a=>a.t===titulo);
    const concluida=!!(ach&&ach.on);
    const pct=clampPct(lost/limiar*100);
    return {
      id:'marco:peso:'+titulo, categoria:'marco', titulo:`Marco: ${titulo}`,
      progresso:{atual:lost, esperado:limiar},
      percentual:pct, status: concluida?'concluida':(pct>0?'em_andamento':'nao_iniciada'),
      proximaEtapa: concluida?'Conquistado!':`Faltam ${nf(Math.max(0,limiar-lost))} kg.`,
      prioridade: concluida?'baixa':(pct>=80?'alta':'media'),
      origem:'achievements',
    };
  });
}

const MARCOS_TEMPO=[['Primeiro mês',30],['3 meses',90],['100 dias',100],['6 meses',180]];
function colMarcosTempo(ctx){
  const dias=ctx.diasTreat;
  return MARCOS_TEMPO.map(([titulo,limiar])=>{
    const ach=(ctx.achievements||[]).find(a=>a.t===titulo);
    const concluida=!!(ach&&ach.on);
    const pct=clampPct(dias/limiar*100);
    return {
      id:'marco:tempo:'+titulo, categoria:'marco', titulo:`Marco: ${titulo}`,
      progresso:{atual:dias, esperado:limiar},
      percentual:pct, status: concluida?'concluida':(pct>0?'em_andamento':'nao_iniciada'),
      proximaEtapa: concluida?'Conquistado!':`Faltam ${Math.max(0,limiar-dias)} dias.`,
      prioridade: concluida?'baixa':(pct>=80?'alta':'media'),
      origem:'achievements',
    };
  });
}

/* ---------- recorrentes ---------- */
function colAgua(ctx){
  const meta=ctx.profile.metaAgua, d=ctx.d;
  if(!meta || !d || !d.diasTotal) return [];
  const pct=clampPct(d.metaAguaAtingida/d.diasTotal*100);
  const estagnada=(ctx.insights||[]).some(i=>i.id==='agua_tendencia');
  const status=estagnada?'estagnada':'em_andamento';
  return [{
    id:'agua:diaria', categoria:'agua', titulo:'Hidratação diária',
    progresso:{atual:d.mediaAgua, esperado:meta, tendencia: estagnada?'caindo':'estavel'},
    percentual:pct, status,
    proximaEtapa: estagnada?'Reforce a hidratação nos próximos dias.':`Você bate a meta em ${pct}% dos dias.`,
    prioridade: estagnada?'alta':'media',
    origem:'dailyLogs',
  }];
}
function colProteina(ctx){
  const meta=ctx.profile.metaProteina, d=ctx.d;
  if(!meta || !d || !(d.mediaProt>0)) return [];
  const pct=clampPct(d.adesaoProt||0);
  const estagnada=(ctx.insights||[]).some(i=>i.id==='proteina_dias_meta');
  const status=estagnada?'estagnada':'em_andamento';
  return [{
    id:'proteina:diaria', categoria:'proteina', titulo:'Proteína diária',
    progresso:{atual:d.mediaProt, esperado:meta, tendencia: estagnada?'caindo':'estavel'},
    percentual:pct, status,
    proximaEtapa: estagnada?'Ajuste a estratégia de proteína com a nutricionista.':`Média de ${nf(d.mediaProt,0)}g por dia.`,
    prioridade: estagnada?'alta':'media',
    origem:'dailyLogs',
  }];
}
function colFrequenciaPesagem(ctx){
  const w=[...(ctx.weighings||[])].filter(x=>x&&dataValida(x.date)).sort((a,b)=>a.date<b.date?-1:1);
  if(!w.length) return [];
  const freqDias=FREQ_DIAS[(ctx.notifPrefs&&ctx.notifPrefs.pesagemFrequencia)||'semanal']||7;
  const dias=daysBetweenISO(w[w.length-1].date, todayISO());
  const pct=clampPct(dias/freqDias*100);
  const estagnada=dias>=freqDias*2;
  const status=estagnada?'estagnada':'em_andamento';
  return [{
    id:'pesagem:frequencia', categoria:'pesagem', titulo:'Regularidade de pesagem',
    progresso:{atual:dias, esperado:freqDias, tendencia: estagnada?'caindo':'estavel'},
    percentual:pct, status,
    proximaEtapa: estagnada?`Já fazem ${dias} dias — hora de se pesar de novo.`:`Última pesagem há ${dias} dia${dias===1?'':'s'}.`,
    prioridade: estagnada?'alta':'media',
    origem:'weighings',
  }];
}
function colAdesao(ctx){
  const ins=(ctx.insights||[]).find(i=>i.id==='adesao_semanal');
  if(!ins) return []; // regra não disparou ainda (< 2 semanas de tratamento) — sem base pra medir
  const pct=clampPct(Number(ins.assinatura));
  const estagnada=ins.tipo==='atencao';
  const status=estagnada?'estagnada':'em_andamento';
  return [{
    id:'adesao:semanal', categoria:'adesao', titulo:'Adesão às aplicações',
    progresso:{atual:pct, esperado:100, tendencia: estagnada?'caindo':'estavel'},
    percentual:pct, status,
    proximaEtapa: estagnada?'Converse com o médico sobre a baixa adesão.':`Você aplicou em ${pct}% das semanas.`,
    prioridade: estagnada?'alta':'media',
    origem:'insight:adesao_semanal',
  }];
}

/* Cadência inferida do próprio histórico (não existe configuração de "a cada
   quanto tempo" pra exames/bio) — com menos de 2 registros do mesmo tipo não
   há base pra inferir nada, e a meta simplesmente não aparece. */
function colExamesPeriodicos(ctx){
  const porTipo={};
  (ctx.exams||[]).filter(e=>e&&dataValida(e.date)).forEach(e=>{ (porTipo[e.tipo||'Exame']=porTipo[e.tipo||'Exame']||[]).push(e); });
  const out=[];
  for(const tipo in porTipo){
    const lista=porTipo[tipo].sort((a,b)=>a.date<b.date?-1:1);
    if(lista.length<2) continue;
    const intervalos=[];
    for(let i=1;i<lista.length;i++) intervalos.push(daysBetweenISO(lista[i-1].date,lista[i].date));
    const cadencia=Math.round(intervalos.reduce((s,d)=>s+d,0)/intervalos.length);
    if(cadencia<=0) continue;
    const ultima=lista[lista.length-1].date;
    const dias=daysBetweenISO(ultima, todayISO());
    const pct=clampPct(dias/cadencia*100);
    const estagnada=dias>=cadencia*1.5;
    const proximaData=fmtBRy(addDaysISO(ultima,cadencia));
    out.push({
      id:'exames:periodico:'+tipo, categoria:'exames', titulo:`Exame periódico: ${esc(tipo)}`,
      progresso:{atual:dias, esperado:cadencia, tendencia: estagnada?'caindo':'estavel'},
      percentual:pct, status: estagnada?'estagnada':'em_andamento',
      proximaEtapa: estagnada?`Já fazem ${dias} dias desde o último — considere repetir.`:`Próximo esperado por volta de ${proximaData}.`,
      prioridade: estagnada?'alta':'media',
      origem:'exams',
    });
  }
  return out;
}
function colBioimpedanciaPeriodica(ctx){
  const lista=(ctx.bio||[]).filter(b=>b&&dataValida(b.date)).sort((a,b)=>a.date<b.date?-1:1);
  if(lista.length<2) return [];
  const intervalos=[];
  for(let i=1;i<lista.length;i++) intervalos.push(daysBetweenISO(lista[i-1].date,lista[i].date));
  const cadencia=Math.round(intervalos.reduce((s,d)=>s+d,0)/intervalos.length);
  if(cadencia<=0) return [];
  const ultima=lista[lista.length-1].date;
  const dias=daysBetweenISO(ultima, todayISO());
  const pct=clampPct(dias/cadencia*100);
  const estagnada=dias>=cadencia*1.5;
  const proximaData=fmtBRy(addDaysISO(ultima,cadencia));
  return [{
    id:'bioimpedancia:periodica', categoria:'bioimpedancia', titulo:'Bioimpedância periódica',
    progresso:{atual:dias, esperado:cadencia, tendencia: estagnada?'caindo':'estavel'},
    percentual:pct, status: estagnada?'estagnada':'em_andamento',
    proximaEtapa: estagnada?`Já fazem ${dias} dias desde a última — considere agendar.`:`Próxima esperada por volta de ${proximaData}.`,
    prioridade: estagnada?'alta':'media',
    origem:'bio',
  }];
}

/* ---------- motor ---------- */
const COLLECTORS=[colPesoAlvo,colMarcosPeso,colMarcosTempo,colAgua,colProteina,colFrequenciaPesagem,colAdesao,colExamesPeriodicos,colBioimpedanciaPeriodica];
const ORDEM_PRIORIDADE={alta:1, media:2, baixa:3};

function gerar(ctx){
  const brutas=[];
  COLLECTORS.forEach(coletor=>{
    try{ (coletor(ctx)||[]).forEach(m=>{ if(m) brutas.push(m); }); }
    catch(e){ console.error('[Goals] erro num coletor:', e); }
  });
  const vistos=new Set();
  const resultado=[];
  brutas.forEach(m=>{
    if(vistos.has(m.id)){ console.warn('[Goals] id de meta duplicado, ignorando:', m.id); return; }
    vistos.add(m.id);
    resultado.push(m);
  });
  resultado.sort((a,b)=>ORDEM_PRIORIDADE[a.prioridade]-ORDEM_PRIORIDADE[b.prioridade]);
  return resultado;
}

const goalsApi = {gerar};

if(window.__resolveGoalsReady) window.__resolveGoalsReady(goalsApi);
else window.__goalsReady = Promise.resolve(goalsApi);
