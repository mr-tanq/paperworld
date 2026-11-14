'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSession}=require('../js/matt-conversation.js');
function store(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
test('Matt keeps owner-scoped history on the device across reloads',()=>{
 const s=store();const first=createSession({storage:s,identity:'a@example.com',clock:()=>new Date('2026-11-14T12:00:00Z').toISOString()});
 const result=first.send('Τι γίνεται με τις εργασίες;', [{status:'todo'},{status:'done'}]);
 assert.match(result.reply,/1 ανοιχτές/);assert.equal(result.history.length,2);
 const second=createSession({storage:s,identity:'a@example.com'});
 assert.equal(second.messages().length,2);
 assert.equal(createSession({storage:s,identity:'b@example.com'}).messages().length,0);
});
test('Recognized projects create inert proposals only',()=>{
 const session=createSession({storage:store(),identity:'a@example.com'});
 const result=session.send('Δεν δουλεύει το TicketSwap');
 assert.equal(result.proposal.to,'listening-director');
 assert.equal(result.proposal.state,'proposed');
 assert.equal(result.proposal.execution,'none');
 assert.equal(result.proposal.requiresHumanApproval,true);
 assert.match(result.reply,/δεν έχει σταλεί/);
});
test('No simulated agent answer, execution, or credits on arbitrary text',()=>{
 const session=createSession({storage:store(),identity:'a@example.com'});
 const result=session.send('Φτιάξε μου ένα τελείως καινούριο project');
 assert.equal(result.proposal,null);
 assert.match(result.reply,/Δεν έχω ακόμη συνδεθεί με AI/);
 assert.throws(()=>session.send(' '.repeat(10)));
 assert.throws(()=>session.send('a'.repeat(1501)));
});
test('History is capped, can be cleared, and corrupt storage does not crash',()=>{
 const s=store();const session=createSession({storage:s,identity:'a@example.com'});
 for(let i=0;i<30;i++)session.send('hello '+i);
 assert.equal(session.messages().length,50);
 session.clear();assert.equal(session.messages().length,0);
});
