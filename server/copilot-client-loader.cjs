/* Matt SDK bootstrap diagnostics: only fixed stage labels may be logged.
 * Never print caught exceptions, stack traces, OAuth credentials, or messages.
 */
'use strict';
const STAGES=Object.freeze({
 import:'sdk_import',
 export:'sdk_export',
 constructor:'client_construct'
});
async function createCopilotClient(options,{loadSdk=()=>import('@github/copilot-sdk'),
 report=stage=>console.warn('[PAPERWORLD Matt bootstrap]',stage)}={}){
 let sdk;
 try{sdk=await loadSdk()}
 catch(_){report(STAGES.import);throw Error('copilot_client_factory_failed')}
 const CopilotClient=sdk?.CopilotClient||sdk?.default?.CopilotClient;
 if(typeof CopilotClient!=='function'){
  report(STAGES.export);throw Error('copilot_client_factory_failed');
 }
 try{return new CopilotClient(options)}
 catch(_){report(STAGES.constructor);throw Error('copilot_client_factory_failed')}
}
module.exports=Object.freeze({createCopilotClient,STAGES});
