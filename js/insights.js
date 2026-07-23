/* ============================================================
   COMPASSO · Insights — motor único de análise (Sprint L)
   Nenhuma tela analisa dado nenhum: tudo passa por gerar(ctx)
   aqui. app.js monta o contexto (reaproveitando coletaDados() já
   existente) e só renderiza a lista pronta.

   Cada regra devolve um objeto completo — {id, categoria, tipo,
   prioridade, tone, icon, text, justificativa, assinatura} — ou
   null. `justificativa` é obrigatória: é a resposta a "por que
   esse insight apareceu", nunca omitida. `assinatura` é o valor
   que, ao mudar, faz o insight contar como "novo" no histórico —
   é o mecanismo contra repetição (ver gerar()).
   ============================================================ */

const HISTORICO_KEY = 'compasso_insights_historico_v1';
const HISTORICO_MAX_DIAS = 180;

function parseNum(s){ if(s==null) return null; const n=parseFloat(String(s).replace(',','.')); return isNaN(n)?null:n; }
function isoFromDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayISO(){ return isoFromDate(new Date()); }
function daysBetweenISO(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function fmtBRy(iso){ const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
function nf(n,d=1){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* Janela de análise própria de cada regra — independente do período (ini/fim)
   que a tela ou o PDF escolheram. Sem isso, uma regra recebendo o tratamento
   inteiro (caso da Home/Insights) descreveria meses como se fosse "recente".
   Cada janela é ancorada no registro mais recente do PRÓPRIO array filtrado
   (não em "hoje"), então funciona igual para a tela (período = tratamento
   todo) e para um PDF de um período passado (período = já fatiado por
   coletaDados). */
function janelaRecente(records, dias, campo='date'){
  if(!records.length) return records;
  let maisRecente = records[0][campo];
  for(const r of records){ if(r[campo]>maisRecente) maisRecente=r[campo]; }
  // "últimos N dias" = N dias corridos terminando no mais recente (inclusive dos dois lados),
  // por isso o limite é maisRecente-(N-1), não maisRecente-N — senão a janela tem N+1 dias
  // e o texto ("últimos N dias") destoa da contagem real mostrada na tela.
  const limite = new Date(maisRecente+'T00:00:00'); limite.setDate(limite.getDate()-(dias-1));
  const limiteISO = isoFromDate(limite);
  return records.filter(r=>r[campo]>=limiteISO);
}
const JANELA_PESO_DIAS = 28;            // peso: "últimas semanas"
const JANELA_PESO_RITMO_DIAS = 56;      // ritmo precisa de duas metades com dado suficiente
const JANELA_DIARIO_DIAS = 14;          // água/proteína: "últimos dias"
const JANELA_SINTOMAS_DIAS = 21;        // sintomas: "período recente"
const JANELA_SINTOMAS_RITMO_DIAS = 42;  // idem, precisa de duas metades
const VALIDADE_BIO_EXAME_DIAS = 180;    // bioimpedância/exames são esparsos — mas se a medida
                                         // mais recente já é antiga, o insight não é mais "atual"
const VALIDADE_CONQUISTA_DIAS = 21;     // "recém-desbloqueada" deixa de ser recente depois disso

function loadHistorico(){ try{ return JSON.parse(localStorage.getItem(HISTORICO_KEY)) || {}; }catch(e){ return {}; } }
function saveHistorico(h){ try{ localStorage.setItem(HISTORICO_KEY, JSON.stringify(h)); }catch(e){} }
function pruneHistorico(h){
  const limite = new Date(); limite.setDate(limite.getDate()-HISTORICO_MAX_DIAS);
  const limiteISO = isoFromDate(limite);
  for(const k of Object.keys(h)){ if(h[k].data < limiteISO) delete h[k]; }
  return h;
}

/* Exames onde "menor é melhor" é uma leitura clínica segura de se afirmar.
   Fora dessa lista (Vitamina D, TSH etc.), o ideal depende do quadro
   individual do paciente — a regra só relata a variação, sem julgar. */
const EXAME_MENOR_MELHOR = new Set(['Hemoglobina glicada','Colesterol total','Triglicerídeos']);

const RULES = [
  /* ---------- peso ---------- */
  {
    check(ctx){
      const w = janelaRecente(ctx.d.w, JANELA_PESO_DIAS);
      if(w.length<2) return null;
      const ini=w[0], fim=w[w.length-1];
      const dias = daysBetweenISO(ini.date, fim.date);
      if(dias<7) return null;
      const delta = +(fim.peso-ini.peso).toFixed(1);
      if(Math.abs(delta)<0.3) return null;
      const semanas = Math.max(1, Math.round(dias/7));
      const perdeu = delta<0;
      return {
        id:'peso_tendencia', categoria:'peso', tipo: perdeu?'informativo':'atencao', prioridade: perdeu?6:2,
        tone: perdeu?'':'amber', icon:'chart',
        text:`Você ${perdeu?'perdeu':'ganhou'} <b>${nf(Math.abs(delta))} kg</b> nas últimas ${semanas} semana${semanas>1?'s':''}.`,
        justificativa:`Baseado nas pesagens de ${fmtBRy(ini.date)} (${nf(ini.peso)} kg) e ${fmtBRy(fim.date)} (${nf(fim.peso)} kg).`,
        assinatura: delta,
      };
    },
  },
  {
    check(ctx){
      const w = janelaRecente(ctx.d.w, JANELA_PESO_RITMO_DIAS);
      if(w.length<4) return null;
      const meio=Math.floor(w.length/2);
      const primeira=w.slice(0,meio), segunda=w.slice(meio);
      if(primeira.length<2||segunda.length<2) return null;
      const ritmo=(arr)=>{ const dias=daysBetweenISO(arr[0].date,arr[arr.length-1].date)||1; return (arr[0].peso-arr[arr.length-1].peso)/dias*7; };
      const r1=ritmo(primeira), r2=ritmo(segunda);
      if(!(r1>0.05)) return null; // !(...) em vez de r1<=0.05: NaN nunca passa (comparação direta deixaria passar)
      const queda=+(r1-r2).toFixed(2);
      if(!(queda>=0.15)) return null;
      return {
        id:'peso_desaceleracao', categoria:'peso', tipo:'informativo', prioridade:5, tone:'', icon:'chart',
        text:`Seu ritmo de perda de peso desacelerou — de <b>${nf(r1)} kg/semana</b> para <b>${nf(r2)} kg/semana</b>.`,
        justificativa:`Ritmo comparado entre ${fmtBRy(primeira[0].date)}–${fmtBRy(primeira[primeira.length-1].date)} e ${fmtBRy(segunda[0].date)}–${fmtBRy(segunda[segunda.length-1].date)}.`,
        assinatura: queda,
      };
    },
  },
  {
    check(ctx){
      const {pesoInicial,pesoMeta}=ctx.profile;
      const alvo=pesoInicial-pesoMeta;
      if(!(alvo>0)) return null;
      const atual=ctx.d.pesoFimPeriod;
      if(atual==null || isNaN(atual)) return null;
      const pct=Math.round((pesoInicial-atual)/alvo*100);
      if(!(pct>=25)) return null;
      const marco = pct>=100?100:pct>=75?75:pct>=50?50:25;
      return {
        id:'peso_meta_parcial', categoria:'peso', tipo: marco>=100?'parabens':'informativo', prioridade: marco>=100?2:5,
        tone:'', icon: marco>=100?'medal':'flag',
        text: marco>=100 ? `Você atingiu sua meta de peso! 🎉` : `Você já alcançou <b>${marco}%</b> da sua meta de peso.`,
        justificativa:`Peso inicial ${nf(pesoInicial)} kg, meta ${nf(pesoMeta)} kg, peso atual ${nf(atual)} kg.`,
        assinatura: marco,
      };
    },
  },
  /* ---------- aplicação / dose ---------- */
  {
    check(ctx){
      const apps=[...ctx.allApplications].sort((a,b)=>a.date<b.date?-1:1);
      if(!apps.length) return null;
      const medAtual=apps[apps.length-1].medicamento;
      let i=apps.length-1;
      while(i>0 && apps[i-1].medicamento===medAtual) i--;
      const dataInicio=apps[i].date;
      const semanas=Math.floor(daysBetweenISO(dataInicio, todayISO())/7);
      if(!(semanas>=1)) return null;
      return {
        id:'aplicacao_tempo_uso', categoria:'aplicacao', tipo:'informativo', prioridade:7, tone:'', icon:'syringe',
        text:`Você está há <b>${semanas} semana${semanas>1?'s':''}</b> utilizando ${esc(medAtual)}.`,
        justificativa:`Primeira aplicação de ${esc(medAtual)} no histórico atual em ${fmtBRy(dataInicio)}.`,
        assinatura: semanas,
      };
    },
  },
  {
    check(ctx){
      const apps=[...ctx.allApplications].sort((a,b)=>a.date<b.date?-1:1);
      if(apps.length<2) return null;
      const ultima=apps[apps.length-1], anterior=apps[apps.length-2];
      const d1=parseNum(anterior.dose), d2=parseNum(ultima.dose);
      if(d1==null||d2==null||d1===d2) return null;
      const subiu=d2>d1;
      return {
        id:'aplicacao_dose_mudou', categoria:'aplicacao', tipo:'informativo', prioridade:6, tone:'', icon:'syringe',
        text:`Você ${subiu?'aumentou':'reduziu'} a dose na última aplicação, de <b>${esc(anterior.dose)}</b> para <b>${esc(ultima.dose)} ${esc(ctx.profile.unidade)}</b>.`,
        justificativa:`Aplicação de ${fmtBRy(anterior.date)} (${esc(anterior.dose)}) comparada com a de ${fmtBRy(ultima.date)} (${esc(ultima.dose)}).`,
        assinatura: `${anterior.dose}-${ultima.dose}-${ultima.date}`,
      };
    },
  },
  /* ---------- adesão ---------- */
  {
    check(ctx){
      const inicio=ctx.profile.dataInicio;
      const semanasTotal=Math.floor(daysBetweenISO(inicio, todayISO())/7);
      if(!(semanasTotal>=2)) return null;
      const semanasComApp=new Set();
      ctx.allApplications.forEach(a=>{
        const idx=Math.floor(daysBetweenISO(inicio,a.date)/7);
        if(idx>=0 && idx<semanasTotal) semanasComApp.add(idx);
      });
      const pct=Math.round(semanasComApp.size/semanasTotal*100);
      if(isNaN(pct)) return null;
      return {
        id:'adesao_semanal', categoria:'adesao', tipo: pct>=90?'parabens':pct>=70?'informativo':'atencao',
        prioridade: pct>=90?4:pct>=70?6:2, tone: pct<70?'amber':'', icon:'check',
        text: pct>=90 ? `Você registrou aplicações em <b>${pct}%</b> das semanas do tratamento — ótima consistência!` : `Você registrou aplicações em <b>${pct}%</b> das semanas do tratamento.`,
        justificativa:`${semanasComApp.size} de ${semanasTotal} semanas desde ${fmtBRy(inicio)} tiveram ao menos uma aplicação registrada.`,
        assinatura: pct,
      };
    },
  },
  /* ---------- hidratação ---------- */
  {
    check(ctx){
      const logs=janelaRecente(ctx.d.logs.filter(l=>l.agua>0), JANELA_DIARIO_DIAS);
      if(logs.length<6) return null;
      const meio=Math.floor(logs.length/2);
      const antes=logs.slice(0,meio), depois=logs.slice(meio);
      const media=arr=>arr.reduce((s,l)=>s+l.agua,0)/arr.length;
      const m1=media(antes), m2=media(depois);
      if(!(m1>0)) return null;
      const quedaPct=Math.round((1-m2/m1)*100);
      if(!(quedaPct>=15)) return null;
      return {
        id:'agua_tendencia', categoria:'agua', tipo:'sugestao', prioridade:3, tone:'amber', icon:'drop',
        text:`Sua média de hidratação caiu <b>${quedaPct}%</b> nos registros mais recentes, de ${nf(m1)} L para ${nf(m2)} L por dia.`,
        justificativa:`Média dos ${antes.length} primeiros dias com água registrada nos últimos ${JANELA_DIARIO_DIAS} dias comparada aos ${depois.length} mais recentes.`,
        assinatura: quedaPct,
      };
    },
  },
  /* ---------- proteína ---------- */
  {
    check(ctx){
      const logs=janelaRecente(ctx.d.logs.filter(l=>l.proteina>0), JANELA_DIARIO_DIAS);
      if(logs.length<5) return null;
      const meta=ctx.profile.metaProteina;
      if(!meta) return null;
      const bateram=logs.filter(l=>l.proteina>=meta).length;
      const pct=Math.round(bateram/logs.length*100);
      if(pct>=80) return null;
      return {
        id:'proteina_dias_meta', categoria:'proteina', tipo:'sugestao', prioridade:3, tone:'amber', icon:'spark',
        text:`Você atingiu sua meta de proteína em apenas <b>${pct}%</b> dos dias registrados nos últimos ${JANELA_DIARIO_DIAS} dias.`,
        justificativa:`${bateram} de ${logs.length} dias com proteína registrada nos últimos ${JANELA_DIARIO_DIAS} dias bateram a meta de ${meta} g.`,
        assinatura: pct,
      };
    },
  },
  /* ---------- sintomas ---------- */
  {
    check(ctx){
      const logs=janelaRecente(ctx.d.logs, JANELA_SINTOMAS_DIAS);
      const appDates=new Set(ctx.d.apps.map(a=>a.date));
      let total=0, comNausea=0;
      logs.forEach(l=>{
        const prev=isoFromDate(new Date(new Date(l.date+'T00:00:00').getTime()-864e5));
        if(appDates.has(prev)){ total++; if((l.sintomas||[]).includes('Náusea')) comNausea++; }
      });
      if(total<2 || comNausea/total<0.5) return null;
      return {
        id:'sintoma_pos_aplicacao', categoria:'sintomas', tipo:'sugestao', prioridade:3, tone:'amber', icon:'spark',
        text:`Você costuma registrar <b>náusea no dia seguinte à aplicação</b>. Refeições mais leves nesse dia podem ajudar.`,
        justificativa:`Náusea registrada em ${comNausea} de ${total} dias seguintes a uma aplicação, nos últimos ${JANELA_SINTOMAS_DIAS} dias.`,
        assinatura: `${comNausea}/${total}`,
      };
    },
  },
  {
    check(ctx){
      const logs=janelaRecente(ctx.d.logs, JANELA_SINTOMAS_DIAS);
      const dias=logs.filter(l=>(l.sintomas||[]).includes('Constipação')).length;
      if(dias<3) return null;
      return {
        id:'sintoma_constipacao', categoria:'sintomas', tipo:'atencao', prioridade:1, tone:'rose', icon:'alert',
        text:`Você relatou <b>constipação em ${dias} dias</b> nos últimos ${JANELA_SINTOMAS_DIAS} dias.`,
        justificativa:`${dias} registros de constipação entre ${logs.length} dias com diário preenchido nos últimos ${JANELA_SINTOMAS_DIAS} dias.`,
        care:'Se estiver persistindo ou piorando, vale conversar com seu médico ou nutricionista.',
        assinatura: dias,
      };
    },
  },
  {
    check(ctx){
      const apps=[...ctx.allApplications].sort((a,b)=>a.date<b.date?-1:1);
      if(!apps.length) return null;
      const refAplicacao=apps[apps.length-1].date; // âncora: aplicação mais recente do próprio histórico
      const aumentos=[];
      for(let i=1;i<apps.length;i++){
        const d1=parseNum(apps[i-1].dose), d2=parseNum(apps[i].dose);
        if(d1!=null&&d2!=null&&d2>d1 && daysBetweenISO(apps[i].date, refAplicacao)<=JANELA_SINTOMAS_RITMO_DIAS) aumentos.push(apps[i].date);
      }
      if(!aumentos.length) return null;
      const janela=ctx.d.logs.filter(l=>aumentos.some(dt=>{ const dd=daysBetweenISO(dt,l.date); return dd>=0&&dd<=3; }));
      const comNausea=janela.filter(l=>(l.sintomas||[]).includes('Náusea')).length;
      if(janela.length<2 || comNausea/janela.length<0.5) return null;
      return {
        id:'sintoma_pos_aumento_dose', categoria:'sintomas', tipo:'sugestao', prioridade:2, tone:'amber', icon:'spark',
        text:`Náusea apareceu com mais frequência nos dias seguintes a um <b>aumento de dose</b>.`,
        justificativa:`${comNausea} de ${janela.length} dias, dentro de 3 dias após um aumento de dose, tiveram náusea registrada.`,
        assinatura: `${comNausea}/${janela.length}`,
      };
    },
  },
  {
    check(ctx){
      const logs=janelaRecente(ctx.d.logs, JANELA_SINTOMAS_RITMO_DIAS);
      if(logs.length<8) return null;
      const meio=Math.floor(logs.length/2);
      const antes=logs.slice(0,meio), depois=logs.slice(meio);
      const contagem=(arr,s)=>arr.filter(l=>(l.sintomas||[]).includes(s)).length;
      const candidatos=['Náusea','Constipação','Diarreia','Fadiga','Dor de cabeça','Gases'];
      let melhor=null;
      candidatos.forEach(s=>{
        const c1=contagem(antes,s), c2=contagem(depois,s);
        if(c1>=2 && c2<c1){
          const reducaoPct=Math.round((1-c2/c1)*100);
          if(!melhor || reducaoPct>melhor.reducaoPct) melhor={sintoma:s,c1,c2,reducaoPct};
        }
      });
      if(!melhor || melhor.reducaoPct<40) return null;
      return {
        id:'sintoma_reduzindo', categoria:'sintomas', tipo:'parabens', prioridade:5, tone:'', icon:'check',
        text:`<b>${melhor.sintoma}</b> reduziu nas últimas semanas.`,
        justificativa:`Registrado em ${melhor.c1} dos primeiros ${antes.length} dias do período, e em apenas ${melhor.c2} dos ${depois.length} mais recentes.`,
        assinatura: `${melhor.sintoma}-${melhor.reducaoPct}`,
      };
    },
  },
  /* ---------- bioimpedância ---------- */
  {
    check(ctx){
      const b=[...(ctx.d.bio||[])].sort((x,y)=>x.date<y.date?-1:1);
      if(b.length<2) return null;
      if(daysBetweenISO(b[b.length-1].date, todayISO())>VALIDADE_BIO_EXAME_DIAS) return null; // avaliação antiga não é mais "atual"
      const g0=b[0].gordura, g1=b[b.length-1].gordura;
      if(g0==null || g1==null) return null; // campo ausente não é 0 — tratar como 0 fabricaria uma variação falsa
      const dFat=+(g1-g0).toFixed(1);
      if(!(dFat<-0.3)) return null;
      return {
        id:'bio_gordura', categoria:'bioimpedancia', tipo:'parabens', prioridade:5, tone:'', icon:'pulse',
        text:`Seu percentual de gordura corporal caiu <b>${nf(Math.abs(dFat))} pontos</b> no período.`,
        justificativa:`De ${nf(b[0].gordura)}% em ${fmtBRy(b[0].date)} para ${nf(b[b.length-1].gordura)}% em ${fmtBRy(b[b.length-1].date)}.`,
        assinatura: dFat,
      };
    },
  },
  {
    check(ctx){
      const b=[...(ctx.d.bio||[])].sort((x,y)=>x.date<y.date?-1:1);
      if(b.length<2) return null;
      if(daysBetweenISO(b[b.length-1].date, todayISO())>VALIDADE_BIO_EXAME_DIAS) return null; // avaliação antiga não é mais "atual"
      const m0=b[0].massaMagra, m1=b[b.length-1].massaMagra;
      if(m0==null || m1==null) return null; // campo ausente não é 0 — tratar como 0 fabricaria uma variação falsa
      const dLean=+(m1-m0).toFixed(1);
      if(!(Math.abs(dLean)>=1)) return null;
      const aumentou=dLean>0;
      return {
        id:'bio_massa_magra', categoria:'bioimpedancia', tipo: aumentou?'parabens':'atencao', prioridade: aumentou?5:1,
        tone: aumentou?'':'amber', icon:'pulse',
        text: aumentou ? `Sua massa magra aumentou <b>${nf(dLean)} kg</b> no período.` : `Sua massa magra reduziu cerca de <b>${nf(Math.abs(dLean))} kg</b> no período.`,
        justificativa:`De ${nf(b[0].massaMagra)} kg em ${fmtBRy(b[0].date)} para ${nf(b[b.length-1].massaMagra)} kg em ${fmtBRy(b[b.length-1].date)}.`,
        care: aumentou ? null : 'Priorizar proteína e treino de força ajuda a preservar músculo. Se a perda continuar, vale conversar com seu nutricionista e médico.',
        assinatura: dLean,
      };
    },
  },
  /* ---------- medidas ---------- */
  {
    check(ctx){
      const w=janelaRecente(ctx.d.w.filter(x=>x.cintura!=null), JANELA_PESO_DIAS);
      if(w.length<2) return null;
      const ini=w[0], fim=w[w.length-1];
      if(!ini.peso||!fim.peso||!ini.cintura||!fim.cintura) return null;
      const pctPeso=(ini.peso-fim.peso)/ini.peso*100;
      const pctCintura=(ini.cintura-fim.cintura)/ini.cintura*100;
      if(pctPeso<=0.5||pctCintura<=0.5) return null;
      if(pctCintura-pctPeso<3) return null;
      return {
        id:'medidas_cintura_peso', categoria:'medidas', tipo:'parabens', prioridade:5, tone:'', icon:'flag',
        text:`Sua cintura reduziu proporcionalmente mais rápido que o peso.`,
        justificativa:`Cintura: ${nf(pctCintura)}% de redução (${nf(ini.cintura)}→${nf(fim.cintura)} cm). Peso: ${nf(pctPeso)}% de redução (${nf(ini.peso)}→${nf(fim.peso)} kg), entre ${fmtBRy(ini.date)} e ${fmtBRy(fim.date)}.`,
        assinatura: Math.round(pctCintura-pctPeso),
      };
    },
  },
  /* ---------- exames ---------- */
  {
    check(ctx){
      const porTipo={};
      (ctx.d.exams||[]).forEach(e=>{ (porTipo[e.tipo]=porTipo[e.tipo]||[]).push(e); });
      const candidatos=[];
      for(const tipo in porTipo){
        const listaCompleta=porTipo[tipo].sort((a,b)=>a.date<b.date?-1:1);
        if(listaCompleta.length<2) continue;
        if(daysBetweenISO(listaCompleta[listaCompleta.length-1].date, todayISO())>VALIDADE_BIO_EXAME_DIAS) continue; // exame antigo não é mais "recente"
        const lista=listaCompleta.slice(-2); // "comparações recentes": só os 2 exames mais novos desse tipo
        const v1=parseNum(lista[0].valor), v2=parseNum(lista[lista.length-1].valor);
        if(v1==null||v2==null||v1===v2) continue;
        candidatos.push({tipo,lista,v1,v2});
      }
      if(!candidatos.length) return null;
      candidatos.sort((a,b)=> a.lista[a.lista.length-1].date < b.lista[b.lista.length-1].date ? 1 : -1);
      const {tipo,lista,v1,v2}=candidatos[0];
      const subiu=v2>v1;
      let tipoInsight='informativo', tone='', pr=6, direcao=subiu?'aumentou':'reduziu';
      if(EXAME_MENOR_MELHOR.has(tipo)){
        direcao = subiu?'aumentou':'apresentou melhora';
        tipoInsight = subiu?'atencao':'parabens'; tone=subiu?'rose':''; pr=subiu?2:5;
      }
      return {
        id:'exame_variacao', categoria:'exames', tipo:tipoInsight, prioridade:pr, tone, icon:'flask',
        text:`<b>${esc(tipo)}</b> ${direcao}, de ${esc(lista[0].valor)} para ${esc(lista[lista.length-1].valor)}.`,
        justificativa:`Comparando o exame de ${fmtBRy(lista[0].date)} com o de ${fmtBRy(lista[lista.length-1].date)}.`,
        assinatura: `${tipo}-${v1}-${v2}`,
      };
    },
  },
  /* ---------- conquistas ---------- */
  {
    check(ctx){
      const desbloqueadas=(ctx.achievements||[]).filter(a=>a.on&&a.date).sort((a,b)=>a.date<b.date?1:-1);
      if(!desbloqueadas.length) return null;
      const a=desbloqueadas[0];
      if(daysBetweenISO(a.date, todayISO())>VALIDADE_CONQUISTA_DIAS) return null; // "recém-desbloqueada" deixa de valer depois da janela
      return {
        id:'conquista_'+a.t, categoria:'conquista', tipo:'parabens', prioridade:4, tone:'', icon:'medal',
        text:`Parabéns! Você desbloqueou a conquista <b>${esc(a.t)}</b>.`,
        justificativa:`${esc(a.s)}, em ${fmtBRy(a.date)}.`,
        assinatura: a.t,
      };
    },
  },
];

/* ---------- motor ---------- */
function gerar(ctx, opts){
  const registrar = !opts || opts.registrarHistorico!==false;
  const historico = registrar ? loadHistorico() : null;
  const resultado = [];
  for(const regra of RULES){
    let insight;
    try{ insight = regra.check(ctx); }catch(e){ console.error('[Insights] erro numa regra:', e); insight=null; }
    if(!insight) continue;
    resultado.push(insight);
    if(registrar){
      const assinatura = String(insight.assinatura);
      const anterior = historico[insight.id];
      if(!anterior || anterior.assinatura!==assinatura){
        historico[insight.id] = {assinatura, text:insight.text, categoria:insight.categoria, tipo:insight.tipo, data:todayISO()};
      }
    }
  }
  if(registrar) saveHistorico(pruneHistorico(historico));
  resultado.sort((a,b)=>a.prioridade-b.prioridade);
  return resultado;
}
function listarHistorico(){
  return Object.entries(loadHistorico())
    .map(([id,v])=>({id,...v}))
    .sort((a,b)=>a.data<b.data?1:-1);
}

const insightsApi = {gerar, listarHistorico, totalRegras:RULES.length};

if(window.__resolveInsightsReady) window.__resolveInsightsReady(insightsApi);
else window.__insightsReady = Promise.resolve(insightsApi);
