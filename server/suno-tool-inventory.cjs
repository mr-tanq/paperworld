/* A bounded projection of tools/list for the owner. Schema values, annotations
 * and tool results are never copied into the report. */
'use strict';
const TYPES=['string','number','integer','boolean','array','object','null'];
const FIELD_NAME=/^[a-zA-Z0-9_.-]{1,80}$/;
const MAX_DEPTH=5,MAX_NODES=2500,MAX_PROPERTIES=64;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function toolInventory(message,protocolVersion){
 let remaining=MAX_NODES;
 const tools=message.result.tools.map(tool=>{
  let omittedStructure=false;
  function shape(schema,depth){
   if(!isObject(schema)||depth>MAX_DEPTH||remaining===0){
    omittedStructure=true;return null;
   }
   remaining--;
   const declared=Array.isArray(schema.type)?schema.type:[schema.type];
   const types=TYPES.filter(type=>declared.includes(type));
   const result={types};
   if(Object.hasOwn(schema,'type')&&!types.length)omittedStructure=true;
   if(isObject(schema.properties)){
    const keys=Object.keys(schema.properties);
    if(keys.length>MAX_PROPERTIES)omittedStructure=true;
    const required=new Set(Array.isArray(schema.required)?schema.required:[]);
    result.fields=[];
    for(const name of keys.slice(0,MAX_PROPERTIES)){
     if(!FIELD_NAME.test(name)){omittedStructure=true;continue}
     if(remaining===0){omittedStructure=true;break}
     result.fields.push({name,required:required.has(name),
      shape:shape(schema.properties[name],depth+1)});
    }
   }else if(Object.hasOwn(schema,'properties'))omittedStructure=true;
   if(Object.hasOwn(schema,'items'))result.items=shape(schema.items,depth+1);
   for(const keyword of ['anyOf','oneOf','allOf']){
    if(!Object.hasOwn(schema,keyword))continue;
    const variants=schema[keyword];
    if(!Array.isArray(variants)){omittedStructure=true;continue}
    if(variants.length>8)omittedStructure=true;
    result[keyword]=variants.slice(0,8).map(variant=>shape(variant,depth+1));
   }
   if(['$ref','$dynamicRef','prefixItems','patternProperties','dependentSchemas',
       'if','then','else','not'].some(keyword=>Object.hasOwn(schema,keyword))||
      isObject(schema.additionalProperties))omittedStructure=true;
   return result;
  }
  const input=shape(tool.inputSchema,0);
  return {name:tool.name,input,omittedStructure};
 });
 return {protocolVersion,toolCount:tools.length,toolContracts:'unverified',tools};
}
module.exports=Object.freeze({toolInventory});
