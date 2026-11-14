/* Safe single-turn chat configuration for PAPERWORLD Matt.
 * The Copilot SDK "empty" mode requires availableTools to be explicit.
 * Every tool permission is also rejected by the host.
 */
'use strict';
const SYSTEM='You are Matt, the Chief of Staff of PAPERWORLD. Talk naturally with the user. '+
'Understand arbitrary creative or technical requests. You may plan and recommend the appropriate '+
'Director and Worker, but you must never claim to have delegated, researched files, changed files, '+
'or finished work. Real delegation tools are not yet available. '+
'Be concise and respond in the language the user uses.';
function createSafeSessionConfig({model,gitHubToken}={}){
 if(typeof model!=='string'||!/^[-a-z0-9.]{1,80}$/i.test(model)||
    typeof gitHubToken!=='string'||!/^gh[ou]_[A-Za-z0-9_]+$/.test(gitHubToken))
  throw Error('Invalid trusted session config');
 return {
  model,
  gitHubToken, // Session-scoped credential is essential for per-user billing.
  availableTools:[], // Required in SDK mode:'empty', zero exposed tools.
  onPermissionRequest:async()=>({kind:'reject'}),
  hooks:{onPreToolUse:async()=>({permissionDecision:'deny',
   permissionDecisionReason:'PAPERWORLD chat does not authorize tool execution'})},
  sessionLimits:{maxAiCredits:1}, // SOFT cap. GitHub $0 overage hard-stop remains mandatory.
  systemMessage:{mode:'append',content:SYSTEM}
 };
}
// Never expose error messages, stack traces, tokens or prompts.
function classifySessionError(error){
 const raw=typeof error?.message==='string'?error.message.slice(0,1200):'';
 if(/\b401\b|unauthori[sz]ed|authentication failed|token expired/i.test(raw))return 'auth_rejected';
 if(/\b403\b|forbidden|not permitted|permission denied/i.test(raw))return 'access_denied';
 if(/model.*(unavailable|not found|unsupported)|unknown model/i.test(raw))return 'model_rejected';
 if(/invalid (argument|parameter)|unknown (field|parameter)|unsupported (option|parameter)|session.*invalid/i.test(raw))return 'session_options_rejected';
 if(/timeout|timed out|deadline exceeded/i.test(raw))return 'timeout';
 if(/\b(502|503|504)\b|service unavailable|connection refused/i.test(raw))return 'upstream_unavailable';
 return 'unclassified';
}
module.exports=Object.freeze({createSafeSessionConfig,classifySessionError});
