/* ============================================================
   COMPASSO · Auth — Supabase Auth
   Cadastro, login, logout, recuperação de senha e sessão.
   Carregado como módulo; expõe as funções para o app.js (script
   clássico) via window.__authReady, no mesmo padrão da ponte
   já usada por window.__supabaseReady em js/supabase.js.
   ============================================================ */
import { supabase } from './supabase.js';

function traduzErro(err){
  const code = (err && err.code || '').toLowerCase();
  const msg = ((err && err.message) || String(err) || '').toLowerCase();
  if(code==='email_not_confirmed' || msg.includes('email not confirmed') || msg.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if(code==='invalid_credentials' || msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if(code==='user_already_exists' || msg.includes('already registered') || msg.includes('already exists')) return 'Este e-mail já está cadastrado.';
  if(code==='weak_password' || (msg.includes('password') && (msg.includes('short') || msg.includes('6') || msg.includes('weak')))) return 'A senha precisa ter pelo menos 6 caracteres.';
  if(code==='email_address_invalid' || (msg.includes('email') && msg.includes('invalid'))) return 'Informe um e-mail válido.';
  if(code==='over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde um momento e tente novamente.';
  if(msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'Sem conexão com o servidor. Verifique sua internet.';
  if(code==='session_expired' || (msg.includes('session') && msg.includes('expired'))) return 'Sua sessão expirou. Faça login novamente.';
  return 'Não foi possível concluir. Tente novamente em instantes.';
}

export async function signUp(email,password){
  try{
    const {data,error}=await supabase.auth.signUp({email,password});
    if(error) return {ok:false,error:traduzErro(error)};
    return {ok:true,precisaConfirmarEmail:!data.session};
  }catch(e){ return {ok:false,error:traduzErro(e)}; }
}

export async function signIn(email,password){
  try{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) return {ok:false,error:traduzErro(error)};
    return {ok:true,session:data.session};
  }catch(e){ return {ok:false,error:traduzErro(e)}; }
}

export async function signOut(){
  try{
    const {error}=await supabase.auth.signOut();
    if(error) return {ok:false,error:traduzErro(error)};
    return {ok:true};
  }catch(e){ return {ok:false,error:traduzErro(e)}; }
}

export async function resetPasswordForEmail(email){
  try{
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
    if(error) return {ok:false,error:traduzErro(error)};
    return {ok:true};
  }catch(e){ return {ok:false,error:traduzErro(e)}; }
}

/* Usada na tela de definir nova senha, após o usuário clicar no link do e-mail de recuperação. */
export async function updatePassword(password){
  try{
    const {error}=await supabase.auth.updateUser({password});
    if(error) return {ok:false,error:traduzErro(error)};
    return {ok:true};
  }catch(e){ return {ok:false,error:traduzErro(e)}; }
}

export function onAuthStateChange(cb){
  return supabase.auth.onAuthStateChange(cb);
}

export { supabase };

const authApi={signUp,signIn,signOut,resetPasswordForEmail,updatePassword,onAuthStateChange};
if(window.__resolveAuthReady) window.__resolveAuthReady(authApi);
else window.__authReady=Promise.resolve(authApi);
