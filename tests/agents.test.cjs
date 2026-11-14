'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const agents=require('../js/agents.js');

test('Chief can propose a director-level investigation without executing anything',()=>{
  const task=agents.proposeHandoff({from:'matt',to:'listening-director',project:'workshop',operation:'investigate',request:'Check TicketSwap behavior'});
  assert.equal(task.state,'proposed');
  assert.equal(task.execution,'none');
  assert.equal(task.requiresHumanApproval,true);
  assert.match(agents.previewHandoff(task),/Matt.*Listening Mirror Director/);
});
test('Director can delegate to its own developer only',()=>{
  assert.equal(agents.route('listening-director','listening-developer'),true);
  assert.equal(agents.route('listening-director','pokemon-director'),false);
  assert.throws(()=>agents.proposeHandoff({from:'matt',to:'listening-developer',operation:'review',request:'Skip the director'}),/not authorized/);
});
test('No cross-project routing, unsupported or risky operations',()=>{
  assert.throws(()=>agents.proposeHandoff({from:'matt',to:'listening-director',project:'studio',operation:'plan',request:'Work'}),/Project mismatch/);
  assert.throws(()=>agents.proposeHandoff({from:'matt',to:'listening-director',operation:'deploy',request:'Publish code'}),/Unsupported operation/);
  assert.throws(()=>agents.proposeHandoff({from:'matt',to:'listening-director',operation:'plan',request:'  '}),/Invalid/);
  assert.throws(()=>agents.proposeHandoff({from:'matt',to:'listening-director',operation:'plan',request:'x'.repeat(2001)}),/oversized/);
});
test('Neither conversation nor execution is falsely implied',()=>{
  const h=agents.proposeHandoff({from:'listening-director',to:'listening-developer',operation:'review',request:'Review the report'});
  assert.equal(h.execution,'none');
  assert.equal(agents.agent('matt').role,'chief');
  assert.equal(agents.roster().length,6);
  assert.ok(Object.isFrozen(h));
});
