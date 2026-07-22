/* ============================================================
   COMPASSO · License — motor único de licenciamento (Sprint P)
   Nenhuma tela verifica plano diretamente — tudo passa pelas 8
   funções expostas em LICENSE. Catálogo de recursos centralizado
   em FEATURES, nunca strings soltas.

   LICENSE_CONFIG.ENABLED=false é o mecanismo central desta sprint: com
   ele desligado, can()/hasPremium() sempre liberam tudo, mas o resto do
   motor (status, trial, grace, expiração) continua calculado por trás
   normalmente — ligar a régua de verdade, quando existir loja integrada,
   é mudar essa única flag. Nenhuma tela muda. LICENSE_CONFIG existe como
   objeto (não constantes soltas) de propósito: TRIAL_ENABLED já mora
   aqui, e é onde SANDBOX/DEBUG entrariam no futuro sem espalhar mais
   flags pelo arquivo.
   ============================================================ */

const STORAGE_KEY = 'compasso_license_v1';
const LICENSE_CONFIG = {
  ENABLED: false,        // enforcement real desligado nesta sprint — ver cabeçalho acima
  TRIAL_ENABLED: false,  // arquitetura pronta, decisão de negócio de ligar fica pra depois
};
const TRIAL_DIAS = 7;
const GRACE_DIAS = 3;          // dias de tolerância offline/falha de cobrança antes de expirar de fato

const FEATURES = Object.freeze({
  TIMELINE: 'timeline',
  INSIGHTS: 'insights',
  ACTION_PLAN: 'actionPlan',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
  EXPORT: 'export',
  BACKUP: 'backup',
});
/* Os 5 benefícios que a tela Premium anuncia — não uma escolha solta,
   é literalmente a lista de benefícios do briefing da sprint. */
const PREMIUM_FEATURES = new Set([
  FEATURES.TIMELINE, FEATURES.INSIGHTS, FEATURES.ACTION_PLAN, FEATURES.REPORTS, FEATURES.BACKUP,
]);

function nowISO(){ return new Date().toISOString(); }

function modeloPadrao(){
  return {plan:'free', status:'active', startedAt:null, expiresAt:null, lastValidation:nowISO(), source:'local', version:1};
}
function iniciarTrialSeAtivo(m){
  if(!LICENSE_CONFIG.TRIAL_ENABLED) return m;
  const inicio=new Date();
  const fim=new Date(inicio); fim.setDate(fim.getDate()+TRIAL_DIAS);
  return Object.assign({}, m, {status:'trial', startedAt:inicio.toISOString(), expiresAt:fim.toISOString()});
}
function salvarModelo(m){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); }catch(e){} }
function lerModelo(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(raw && raw.version===1) return raw;
  }catch(e){}
  const inicial=iniciarTrialSeAtivo(modeloPadrao());
  salvarModelo(inicial);
  return inicial;
}

/* Mitigação parcial (não uma solução) pra QA nº 1: sem servidor, não
   dá pra impedir de verdade o desbloqueio via relógio do aparelho —
   só a validação de recibo assinado (loja/RevenueCat) resolve isso.
   O que dá pra fazer localmente: nunca deixar lastValidation andar
   pra trás, e não conceder o benefício da dúvida (grace) se o
   relógio atual está antes da última validação já observada. */
function relogioSuspeito(m){
  if(!m.lastValidation) return false;
  return Date.now() < new Date(m.lastValidation).getTime();
}

function calcularStatus(m){
  const agora=new Date();
  if(m.plan==='free'){
    if(m.status==='trial' && m.expiresAt && agora<=new Date(m.expiresAt) && !relogioSuspeito(m)) return 'trial';
    return 'active'; // free simples, ou trial que já expirou -> decai pro plano gratuito
  }
  if(!m.expiresAt) return 'active'; // fonte 'manual' sem data definida
  const exp=new Date(m.expiresAt);
  if(agora<=exp) return 'active';
  if(relogioSuspeito(m)) return 'expired'; // sem o benefício da dúvida com relógio adulterado
  const limiteGraca=new Date(exp); limiteGraca.setDate(limiteGraca.getDate()+GRACE_DIAS);
  return agora<=limiteGraca ? 'grace' : 'expired';
}

function getStatus(){ return calcularStatus(lerModelo()); }
function getPlan(){ return lerModelo().plan; }
function hasPremium(){
  if(!LICENSE_CONFIG.ENABLED) return true;
  const m=lerModelo();
  const status=calcularStatus(m);
  if(m.plan==='free') return status==='trial';
  return status==='active' || status==='grace';
}
function can(feature){
  if(!LICENSE_CONFIG.ENABLED) return true;
  if(!PREMIUM_FEATURES.has(feature)) return true;
  return hasPremium();
}
function getExpiration(){ return lerModelo().expiresAt; }
function daysRemaining(){
  const m=lerModelo();
  if(!m.expiresAt) return null;
  const dias=Math.ceil((new Date(m.expiresAt)-new Date())/86400000);
  return dias>0?dias:0;
}
function isTrial(){ return getStatus()==='trial'; }

/* Único ponto que, no futuro, chamaria o SDK da loja/RevenueCat pra
   revalidar de verdade. Hoje não existe fonte remota — só relê o
   estado local e atualiza lastValidation (nunca voltando no tempo).
   "Restaurar compra" e a checagem oportunista em boot()/
   visibilitychange chamam isso mesmo, sem caminho separado. */
async function refresh(){
  const m=lerModelo();
  const agora=nowISO();
  if(agora>m.lastValidation) m.lastValidation=agora;
  salvarModelo(m);
  return {ok:true, plan:m.plan, status:calcularStatus(m)};
}

const licenseApi = {getStatus, getPlan, hasPremium, can, getExpiration, daysRemaining, isTrial, refresh, FEATURES};

if(window.__resolveLicenseReady) window.__resolveLicenseReady(licenseApi);
else window.__licenseReady = Promise.resolve(licenseApi);
