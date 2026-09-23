/** Black-box review: real HTTP, no Nest imports, mocks, or direct DB assertions.
 * Run only against a disposable, migrated and seeded review database.
 * ELN_REVIEW_ALLOW_WRITES=yes node apps/backend/test/independent-api-review.mjs
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
const base = process.env.ELN_REVIEW_URL || 'http://127.0.0.1:3309';
if (process.env.ELN_REVIEW_ALLOW_WRITES !== 'yes' || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('Requires ELN_REVIEW_ALLOW_WRITES=yes and a disposable localhost server.');
}
const results = [];
const prefix = `review-${Date.now()}`;
const tokens = {};
const users = {};
const operations = new Set();
const schema = await (await fetch(`${base}/api/docs-json`)).json();
const documentedOperations = Object.entries(schema.paths).flatMap(([path, methods]) => Object.keys(methods).filter(method => ['get','post','put','patch','delete'].includes(method)).map(method => ({ method: method.toUpperCase(), path })));
async function req(method, path, role, body) {
  const route = `/api/v1${path.split('?')[0]}`;
  const documented = documentedOperations.find(item => item.method === method && new RegExp(`^${item.path.replace(/\{[^}]+\}/g,'[^/]+')}$`).test(route));
  if (documented) operations.add(`${method} ${documented.path}`);
  const headers = role ? { Authorization: `Bearer ${tokens[role]}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api/v1${path}`, {
    method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, contentType: response.headers.get('content-type'), data: data?.success === true && 'data' in data ? data.data : data };
}
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.message }); }
  console.log(`${results.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`);
}
const status = (r, expected) => assert.ok([expected].flat().includes(r.status), `HTTP ${r.status}; expected ${expected}`);
const hasSecret = value => value && typeof value === 'object' && (Object.hasOwn(value, 'passwordHash') || Object.values(value).some(hasSecret));
async function project() { const r = await req('POST', '/projects', 'pi', { name: `${prefix}-${randomUUID().slice(0, 6)}` }); status(r, 201); return r.data; }
async function experiment(projectId) { const r = await req('POST', `/projects/${projectId}/experiments`, 'pi', { title: prefix, assayType: 'ProcessData' }); status(r, 201); return r.data; }
for (const role of ['pi', 'editor', 'viewer', 'admin']) {
  const r = await req('POST', '/auth/login', undefined, { username: role, password: process.env.ELN_REVIEW_PASSWORD || 'Password123!' });
  status(r, 200); assert.ok(r.data.accessToken); tokens[role] = r.data.accessToken; users[role] = r.data.user;
  results.push({ name: `login ${role}`, pass: true });
}
await check('wrong password is 401', async () => status(await req('POST', '/auth/login', null, { username: 'pi', password: 'wrong-password' }), 401));
await check('unknown login field is 400', async () => status(await req('POST', '/auth/login', null, { username: 'pi', password: 'wrong', extra: true }), 400));
for (const path of ['/projects', '/users/me', '/inventory', '/workflow/templates', '/notifications', '/temp-files', '/search?q=test']) {
  await check(`anonymous denied ${path}`, async () => status(await req('GET', path), 401));
}
for (const path of ['/users/me', '/projects', '/inventory?page=1&limit=10', '/roles', '/users?page=1&limit=10&withRole=true', '/workflow/templates', '/workflow/tasks', '/notifications', '/notifications/unread-count', '/search?q=review']) {
  await check(`owner GET ${path}`, async () => status(await req('GET', path, 'pi'), 200));
}
await check('project create unknown field is 400', async () => status(await req('POST', '/projects', 'pi', { name: prefix, unexpected: 1 }), 400));
await check('viewer cannot create project', async () => status(await req('POST', '/projects', 'viewer', { name: prefix }), 403));
await check('empty project name rejected', async () => status(await req('POST', '/projects', 'pi', { name: '' }), 400));
await check('invalid project status rejected', async () => status(await req('POST', '/projects', 'pi', { name: prefix, status: 'not-a-status' }), 400));
const p = await project(); const exp = await experiment(p.id);
await check('project list contains no passwordHash', async () => { const r = await req('GET', '/projects', 'pi'); status(r, 200); assert.equal(Boolean(hasSecret(r.data)), false, 'passwordHash key found (value withheld)'); });
await check('project detail contains no passwordHash', async () => { const r = await req('GET', `/projects/${p.id}`, 'pi'); status(r, 200); assert.equal(Boolean(hasSecret(r.data)), false, 'passwordHash key found (value withheld)'); });
await check('non-member project detail denied', async () => status(await req('GET', `/projects/${p.id}`, 'editor'), 403));
await check('non-member nested experiment list denied', async () => status(await req('GET', `/projects/${p.id}/experiments`, 'editor'), [403, 404]));
await check('non-member project update denied', async () => status(await req('PUT', `/projects/${p.id}`, 'editor', { description: 'unauthorized review update' }), [403, 404]));
await check('search hides non-member project', async () => { const r = await req('GET', `/search?q=${encodeURIComponent(p.name)}`, 'viewer'); status(r, 200); assert.equal(JSON.stringify(r.data).includes(p.id), false, 'non-member project returned by search'); });
await check('stale experiment version rejected', async () => { const r = await req('PUT', `/experiments/${exp.id}`, 'pi', { title: prefix, versionNo: exp.versionNo }); status(r, 200); status(await req('PUT', `/experiments/${exp.id}`, 'pi', { title: prefix, versionNo: exp.versionNo }), 409); });
await check('concurrent experiment writes have one winner', async () => { const e = await experiment(p.id); const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => req('PUT', `/experiments/${e.id}`, 'pi', { title: `${prefix}-${i}`, versionNo: e.versionNo }))); assert.equal(rs.filter(r => r.status === 200).length, 1, `statuses: ${rs.map(r => r.status).join(',')}`); assert.ok(rs.every(r => [200, 409].includes(r.status))); });
const locked = await experiment(p.id);
await check('submit experiment for review', async () => status(await req('POST', `/experiments/${locked.id}/submit`, 'pi', {}), 201));
await check('submitted experiment rejects edits', async () => { const r = await req('GET', `/experiments/${locked.id}`, 'pi'); status(r, 200); status(await req('PUT', `/experiments/${locked.id}`, 'pi', { title: 'changed after submit', versionNo: r.data.versionNo }), [403, 409]); });
await check('viewer cannot approve', async () => status(await req('POST', `/experiments/${locked.id}/approve`, 'viewer', {}), 403));
await check('approve and archive happy path', async () => { status(await req('POST', `/experiments/${locked.id}/approve`, 'pi', {}), 201); status(await req('POST', `/experiments/${locked.id}/archive`, 'pi', {}), 201); });
await check('missing upload file rejected', async () => { const form = new FormData(); form.set('experimentId', exp.id); status(await req('POST', '/data/upload', 'pi', form), 400); });
const uploadExp = await experiment(p.id);
async function upload(buffer, mode) {
  const form = new FormData(); form.set('experimentId', uploadExp.id); if (mode) form.set('mode', mode);
  form.append('files', new Blob([buffer]), 'synthetic.xlsx'); return req('POST', '/data/upload', 'pi', form);
}
const workbook = new ExcelJS.Workbook();
workbook.addWorksheet('ProcessData').addRows([['cellId','m0','m1','m2'],['REVIEW-CELL',1,3,2]]);
const workbookBytes = await workbook.xlsx.writeBuffer();
await check('Excel upload produces data and derived decimal values', async () => {
  status(await upload(workbookBytes),201);
  const r = await req('GET',`/data/process/${uploadExp.id}`,'pi'); status(r,200);
  const row = r.data.find(row=>row.cellId==='REVIEW-CELL'); assert.ok(row); assert.equal(row.mIn,'2.000000');
});
await check('existing upload requires explicit conflict choice', async () => status(await upload(workbookBytes),409));
await check('invalid overwrite preserves existing rows and attachments', async () => {
  const beforeRows = await req('GET',`/data/process/${uploadExp.id}`,'pi'); const beforeFiles = await req('GET',`/experiments/${uploadExp.id}/attachments`,'pi');
  assert.ok(beforeRows.data.length > 0, 'fixture must contain rows'); assert.ok(beforeFiles.data.length > 0, 'fixture must contain attachments');
  status(await upload(Buffer.from('not an xlsx'),'overwrite'),400);
  const afterRows = await req('GET',`/data/process/${uploadExp.id}`,'pi'); const afterFiles = await req('GET',`/experiments/${uploadExp.id}/attachments`,'pi');
  assert.deepEqual(afterRows.data,beforeRows.data,'old scientific rows changed or lost'); assert.deepEqual(afterFiles.data,beforeFiles.data,'old attachments changed or lost');
});
await check('valid overwrite replaces rather than duplicates rows', async () => {
  status(await upload(workbookBytes,'overwrite'),201);
  const r=await req('GET',`/data/process/${uploadExp.id}`,'pi'); assert.equal(r.data.filter(row=>row.cellId==='REVIEW-CELL').length,1);
});
for (const type of ['process','solution','calendar','swelling','efficiency','dcr','fastcharge','htcycle']) {
  await check(`read scientific data ${type}`, async()=>status(await req('GET',`/data/${type}/${uploadExp.id}`,'pi'),200));
}
await check('design creation produces procurement rows', async()=>{
  const parent=await project();
  const r=await req('POST',`/projects/${parent.id}/design`,'pi',{groups:[{group:'A',moleculeName:'Synthetic molecule',chineseName:'测试',cas:'review',cellCount:2,redundancyCount:0}]});status(r,201);
  const designs=await req('GET',`/projects/${parent.id}/design`,'pi');status(designs,200);assert.equal(designs.data.length,1);
  const purchases=await req('GET',`/projects/${parent.id}/procurement`,'pi');status(purchases,200);assert.ok(purchases.data.length>0);
});
await check('dashboard contains assigned pending approval',async()=>{
  const e=await experiment(p.id);status(await req('POST',`/experiments/${e.id}/submit`,'pi',{reviewerId:users.pi.id}),201);
  const r=await req('GET','/dashboard/summary','pi');status(r,200);
  assert.ok(JSON.stringify(r.data.pendingApprovals).includes(e.id),'assigned pending approval missing');
});
await check('temporary upload owner isolation', async () => {
  const form = new FormData(); form.append('files', new Blob(['review synthetic content']), `${prefix}.txt`);
  const uploaded = await req('POST', '/temp-files/upload', 'pi', form); status(uploaded, 201); const id = uploaded.data[0].id;
  try {
    const list = await req('GET', '/temp-files', 'viewer'); status(list, 200);
    const download = await req('GET', `/temp-files/${id}/download`, 'viewer');
    const removal = await req('DELETE', `/temp-files/${id}`, 'viewer');
    assert.ok(!list.data.some(f => f.id === id) && [403,404].includes(download.status) && [403,404].includes(removal.status), `listed=${list.data.some(f=>f.id===id)}, download=${download.status}, delete=${removal.status}`);
  } finally { await req('DELETE', `/temp-files/${id}`, 'pi'); }
});
let createdUser;
await check('create user response omits passwordHash', async () => { const r = await req('POST', '/users', 'pi', { username: `${prefix}-user`, fullName: 'Synthetic reviewer' }); status(r, 201); createdUser=r.data; assert.equal(Boolean(hasSecret(r.data)), false, 'passwordHash key found (value withheld)'); });
await check('update user response omits passwordHash and clears email',async()=>{ assert.ok(createdUser);const r=await req('PUT',`/users/${createdUser.id}`,'pi',{email:null,fullName:'Updated synthetic reviewer'});status(r,200);assert.equal(r.data.email,null);assert.equal(Boolean(hasSecret(r.data)),false); });
await check('password change retains login functionality',async()=>{
  assert.ok(createdUser); const login=await req('POST','/auth/login',null,{username:createdUser.username,password:'Password123!'});status(login,200);tokens.synthetic=login.data.accessToken;
  status(await req('PUT','/users/me/password','synthetic',{oldPassword:'Password123!',newPassword:'Synthetic-review-456!'}),200);
  status(await req('POST','/auth/login',null,{username:createdUser.username,password:'Synthetic-review-456!'}),200);
  status(await req('POST','/auth/login',null,{username:createdUser.username,password:'Password123!'}),401);
});
await check('disabled user token stops working',async()=>{status(await req('PUT',`/users/${createdUser.id}`,'pi',{isActive:false}),200);status(await req('GET','/users/me','synthetic'),401);});
await check('user null nonnullable fields rejected',async()=>status(await req('PUT',`/users/${createdUser.id}`,'pi',{fullName:null,isActive:null}),400));
await check('malformed user input returns 400', async () => status(await req('POST', '/users', 'pi', { username: `${prefix}-bad`, fullName: 12 }), 400));
await check('missing old password returns 400', async () => status(await req('PUT', '/users/me/password', 'viewer', { newPassword: 'Synthetic123!' }), 400));
await check('inventory create and decimal contract', async () => { const r = await req('POST', '/inventory', 'pi', { name: prefix, type: 'reagent', quantity: '1.250000' }); status(r, 201); const read = await req('GET', `/inventory/${r.data.id}`, 'pi'); status(read, 200); assert.equal(read.data.quantity, '1.250000'); });
await check('inventory rejects negative quantity', async () => status(await req('POST', '/inventory', 'pi', { name: prefix, type: 'reagent', quantity: '-1' }), 400));
await check('inventory rejects primary key replacement', async () => { const r = await req('POST', '/inventory', 'pi', { name: prefix, type: 'reagent' }); status(r, 201); status(await req('PUT', `/inventory/${r.data.id}`, 'pi', { id: randomUUID() }), 400); });
await check('invalid pagination returns 400', async () => status(await req('GET', '/inventory?page=-1&limit=10', 'pi'), 400));
await check('unknown experiment is 404', async () => status(await req('GET', `/experiments/${randomUUID()}`, 'pi'), 404));
await check('malformed experiment id is 400', async () => status(await req('GET', '/experiments/not-a-uuid', 'pi'), 400));
await check('experiment with comments cannot be deleted and history is preserved', async () => { const e = await experiment(p.id); status(await req('POST', `/experiments/${e.id}/comments`, 'pi', { content: 'Synthetic comment' }), 201); status(await req('DELETE', `/experiments/${e.id}`, 'pi'), 409); const r = await req('GET', `/experiments/${e.id}/comments`, 'pi'); status(r,200); assert.equal(r.data.length,1); });
await check('empty draft experiment can be deleted', async () => { const e = await experiment(p.id); status(await req('DELETE', `/experiments/${e.id}`, 'pi'),200); status(await req('GET', `/experiments/${e.id}`, 'pi'),404); });
await check('project deletion does not orphan experiments', async () => { const parent = await project(); const e = await experiment(parent.id); const deletion = await req('DELETE', `/projects/${parent.id}`, 'pi'); if ([400,409].includes(deletion.status)) return; status(deletion,200); status(await req('GET', `/experiments/${e.id}`, 'pi'),404); });
await check('referenced workflow template cannot be deleted', async () => {
  const parent = await project();
  const t = await req('POST', '/workflow/templates', 'pi', { name: prefix, steps: { nodes: [{ id: 'design', label: 'Design', builtInStep: 'design' }], edges: [] } }); status(t,201);
  status(await req('POST','/workflow/instances','pi',{ projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'design',assignedUserIds:[users.pi.id]}]}),201);
  status(await req('DELETE',`/workflow/templates/${t.data.id}`,'pi'),[400,409]);
});
await check('non-member cannot reassign workflow to themselves',async()=>{
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'design',label:'Design',builtInStep:'design'}],edges:[]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'design',assignedUserIds:[users.pi.id]}]}),201);
  status(await req('GET',`/projects/${parent.id}`,'editor'),403);
  status(await req('PUT',`/workflow/instances/${parent.id}/steps/design`,'editor',{assignedUserIds:[users.editor.id]}),[403,404]);
});
await check('role creation and permissions update',async()=>{const r=await req('POST','/roles','pi',{name:prefix,permissionList:['experiments:read']});status(r,201);status(await req('PUT',`/roles/${r.data.id}`,'pi',{permissionList:[]}),200);});
await check('mark notifications read',async()=>status(await req('PUT','/notifications/read-all','pi'),200));
for (const path of ['/users/assignable','/workflow/default-steps',`/projects/${p.id}/stats`,`/experiments/${exp.id}/collaborators`,`/experiments/${exp.id}/versions`,`/data/raw/${uploadExp.id}`,`/data/picked-cells/${p.id}`,`/data/scrapped-cells/${p.id}`,`/data/scrapped-solution-groups/${exp.id}`,`/data/solution-preparation-groups/${exp.id}`,`/projects/${p.id}/procurement/valid-groups`,`/projects/${p.id}/procurement/invalid-internalcodes`]) {
  await check(`owner read ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g,':id')}`,async()=>status(await req('GET',path,'pi'),200));
}
for (const path of [`/data/export/summary/${uploadExp.id}`,`/data/export/raw/${uploadExp.id}`,`/data/export/project/${p.id}`]) {
  await check(`Excel export ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g,':id')}`,async()=>{const r=await req('GET',path,'pi');status(r,200);assert.ok(r.contentType?.includes('spreadsheetml'));assert.ok(r.data.startsWith('PK'));});
}
for(const path of ['/ai/analyze-data','/ai/generate-insights']) await check(`AI documented placeholder ${path}`,async()=>status(await req('POST',path,'pi',{}),501));
await check('attachment upload download delete lifecycle',async()=>{
  const form=new FormData();form.append('file',new Blob(['synthetic attachment']), 'review.txt');
  const r=await req('POST',`/experiments/${exp.id}/attachments`,'pi',form);status(r,201);
  const downloaded=await req('GET',`/experiments/${exp.id}/attachments/${r.data.id}/download`,'pi');status(downloaded,200);assert.equal(downloaded.data,'synthetic attachment');
  status(await req('DELETE',`/experiments/${exp.id}/attachments/${r.data.id}`,'pi'),200);
});
await check('collaborator lifecycle',async()=>{
  status(await req('POST',`/experiments/${exp.id}/collaborators`,'pi',{userId:users.editor.id,role:'Editor'}),201);
  const r=await req('GET',`/experiments/${exp.id}/collaborators`,'pi');status(r,200);assert.ok(r.data.some(c=>c.userId===users.editor.id));
  status(await req('DELETE',`/experiments/${exp.id}/collaborators/${users.editor.id}`,'pi'),200);
});
await check('reject submitted experiment returns Draft',async()=>{
  const e=await experiment(p.id);status(await req('POST',`/experiments/${e.id}/submit`,'pi',{}),201);
  const r=await req('POST',`/experiments/${e.id}/reject`,'pi',{reason:'Synthetic review needs revisions'});status(r,201);assert.equal(r.data.status,'Draft');
});
await check('dashboard hides comments from inaccessible projects',async()=>{
  const e=await experiment(p.id); const marker=`private-comment-${prefix}`;status(await req('POST',`/experiments/${e.id}/comments`,'pi',{content:marker}),201);
  const r=await req('GET','/dashboard/summary','viewer');status(r,200);assert.equal(JSON.stringify(r.data).includes(marker),false,'inaccessible comment appears in dashboard');
});
await check('completed workflow rejects both single and batch data edits',async()=>{
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'drying_injection',label:'Drying',builtInStep:'drying_injection'}],edges:[]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'drying_injection',assignedUserIds:[users.pi.id]}]}),201);
  const e=await req('POST',`/projects/${parent.id}/experiments`,'pi',{title:prefix,assayType:'ProcessData',workflowStepName:'drying_injection'});status(e,201);
  const row=await req('POST',`/data/process/${e.data.id}`,'pi',{cellId:'REVIEW-LOCK',m0:'1'});status(row,201);
  status(await req('PUT',`/workflow/instances/${parent.id}/transition`,'pi'),200);
  const single=await req('PUT',`/data/process/${row.data.id}`,'pi',{m0:'2'});
  const batch=await req('PUT','/data/process/batch','pi',{rows:[{id:row.data.id,m0:'3'}]});
  assert.ok(single.status===403 && batch.status===403,`completed step: single=${single.status}, batch=${batch.status}; both must be 403`);
});

// Cross-entry-point regressions: authorization must protect data as well as metadata.
for (const path of [`/experiments/${exp.id}`, `/experiments/${exp.id}/comments`, `/experiments/${exp.id}/versions`, `/experiments/${exp.id}/attachments`, `/data/process/${uploadExp.id}`, `/data/export/summary/${uploadExp.id}`, `/data/export/project/${p.id}`, `/projects/${p.id}/design`, `/projects/${p.id}/procurement`, `/workflow/instances/${p.id}/steps`]) {
  await check(`outsider denied ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')}`, async () => status(await req('GET', path, 'editor'), [403,404]));
}
await check('cross-project mixed batch is rejected before changing accessible row', async () => {
  const own = await req('POST','/projects','editor',{name:`${prefix}-editor`}); status(own,201);
  const e = await req('POST',`/projects/${own.data.id}/experiments`,'editor',{title:prefix,assayType:'ProcessData'});status(e,201);
  const row = await req('POST',`/data/process/${e.data.id}`,'editor',{cellId:'OWN',m0:'1'});status(row,201);
  const foreign = (await req('GET',`/data/process/${uploadExp.id}`,'pi')).data[0];assert.ok(foreign);
  status(await req('PUT','/data/process/batch','editor',{rows:[{id:row.data.id,m0:'9'},{id:foreign.id,m0:'9'}]}),403);
  const read = await req('GET',`/data/process/${e.data.id}`,'editor');status(read,200);assert.equal(read.data[0].m0,'1.000000');
});
await check('attachment cannot be accessed through a different experiment path', async () => {
  const file = (await req('GET',`/experiments/${uploadExp.id}/attachments`,'pi')).data[0];assert.ok(file);
  status(await req('GET',`/experiments/${exp.id}/attachments/${file.id}/download`,'pi'),404);
  status(await req('DELETE',`/experiments/${exp.id}/attachments/${file.id}`,'pi'),404);
  status(await req('GET',`/experiments/${uploadExp.id}/attachments/${file.id}/download`,'pi'),200);
});
await check('non-draft scientific data rejects create batch delete and attachments', async () => {
  const e=await experiment(p.id);const row=await req('POST',`/data/process/${e.id}`,'pi',{cellId:'LOCKED',m0:'1'});status(row,201);
  status(await req('POST',`/experiments/${e.id}/submit`,'pi',{}),201);
  status(await req('POST',`/data/process/${e.id}`,'pi',{cellId:'NEW'}),[403,409]);
  status(await req('PUT','/data/process/batch','pi',{rows:[{id:row.data.id,m0:'8'}]}),[403,409]);
  status(await req('DELETE',`/data/process/${row.data.id}`,'pi'),[403,409]);
  const form=new FormData();form.append('file',new Blob(['synthetic']), 'locked.txt');
  status(await req('POST',`/experiments/${e.id}/attachments`,'pi',form),[403,409]);
  const read=await req('GET',`/data/process/${e.id}`,'pi');status(read,200);assert.equal(read.data.length,1);assert.equal(read.data[0].m0,'1.000000');
});
await check('concurrent submissions have one transition and one matching history', async () => {
  const e=await experiment(p.id);
  const rs=await Promise.all(Array.from({length:6},()=>req('POST',`/experiments/${e.id}/submit`,'pi',{})));
  assert.equal(rs.filter(r=>r.status===201).length,1);assert.ok(rs.every(r=>[201,409].includes(r.status)));
  const history=await req('GET',`/experiments/${e.id}/versions`,'pi');status(history,200);assert.equal(history.data.length,1);assert.equal(history.data[0].versionNumber,2);
  const approvals=await Promise.all([req('POST',`/experiments/${e.id}/approve`,'pi',{}),req('POST',`/experiments/${e.id}/reject`,'pi',{reason:'Concurrent review'})]);
  assert.equal(approvals.filter(r=>r.status===201).length,1);assert.equal(approvals.filter(r=>r.status===409).length,1);
  const final=await req('GET',`/experiments/${e.id}/versions`,'pi');assert.equal(final.data.length,2);
});
await check('assigned reviewer reads and approves only assigned experiment', async () => {
  const parent=await project();const e=await experiment(parent.id);const sibling=await experiment(parent.id);
  status(await req('POST',`/experiments/${e.id}/submit`,'pi',{reviewerId:users.admin.id}),201);
  status(await req('GET',`/experiments/${e.id}`,'admin'),200);
  status(await req('GET',`/experiments/${sibling.id}`,'admin'),403);
  status(await req('PUT',`/projects/${parent.id}`,'admin',{description:'reviewer escalation'}),403);
  const pending=await req('GET','/dashboard/summary','admin');assert.ok(JSON.stringify(pending.data.pendingApprovals).includes(e.id));
  status(await req('POST',`/experiments/${e.id}/approve`,'admin',{}),201);
});
await check('completed workflow also rejects creating new data and editing metadata', async () => {
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'drying_injection',label:'Drying',builtInStep:'drying_injection'}],edges:[]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'drying_injection',assignedUserIds:[users.pi.id]}]}),201);
  const e=await req('POST',`/projects/${parent.id}/experiments`,'pi',{title:prefix,assayType:'ProcessData',workflowStepName:'drying_injection'});status(e,201);
  status(await req('PUT',`/workflow/instances/${parent.id}/transition`,'pi',{expectedStepName:'wrong-step'}),409);
  status(await req('PUT',`/workflow/instances/${parent.id}/transition`,'pi',{expectedStepName:'drying_injection'}),200);
  status(await req('POST',`/data/process/${e.data.id}`,'pi',{cellId:'NEW'}),403);
  status(await req('PUT',`/experiments/${e.data.id}`,'pi',{versionNo:1,title:'Locked edit'}),403);
});
await check('workflow visibility grants read without write or reassignment', async () => {
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'drying_injection',label:'Drying',builtInStep:'drying_injection'}],edges:[]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'drying_injection',assignedUserIds:[users.pi.id],visibleToUserIds:[users.editor.id]}]}),201);
  const e=await req('POST',`/projects/${parent.id}/experiments`,'pi',{title:prefix,assayType:'ProcessData',workflowStepName:'drying_injection'});status(e,201);
  status(await req('GET',`/experiments/${e.data.id}`,'editor'),200);
  status(await req('POST',`/data/process/${e.data.id}`,'editor',{cellId:'DENIED'}),403);
  status(await req('PUT',`/workflow/instances/${parent.id}/steps/drying_injection`,'editor',{assignedUserIds:[users.editor.id]}),403);
});
for(const endpoint of ['/projects','/inventory','/users','/roles','/notifications']) {
  await check(`invalid pagination matrix ${endpoint}`,async()=>{
    for(const query of ['page=0','page=-1','page=1.5','limit=0','limit=1001','page=abc','page=1&page=2']) status(await req('GET',`${endpoint}?${query}`,'pi'),400);
  });
}
await check('invalid workflow UUID returns 400',async()=>{
  const parent=await project();status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:'not-uuid',assignments:[]}),400);
});
await check('nonempty experiment with scientific rows cannot be deleted',async()=>status(await req('DELETE',`/experiments/${uploadExp.id}`,'pi'),409));

await check('inventory update and deletion lifecycle',async()=>{
  const r=await req('POST','/inventory','pi',{name:prefix,type:'test',quantity:'1'});status(r,201);
  status(await req('PUT',`/inventory/${r.data.id}`,'pi',{quantity:'2.5',lastUsedAt:null}),200);
  const read=await req('GET',`/inventory/${r.data.id}`,'pi');assert.equal(read.data.quantity,'2.500000');
  status(await req('DELETE',`/inventory/${r.data.id}`,'pi'),200);status(await req('GET',`/inventory/${r.data.id}`,'pi'),404);
});
await check('disabled synthetic user can be removed',async()=>{assert.ok(createdUser);status(await req('DELETE',`/users/${createdUser.id}`,'pi'),200);});
await check('project members validation and owner-only assignment',async()=>{
  const parent=await project();const e=await experiment(parent.id);
  status(await req('PUT',`/projects/${parent.id}/members`,'editor',{members:[{userId:users.editor.id,role:'Editor'}]}),403);
  status(await req('PUT',`/projects/${parent.id}/members`,'pi',{members:[{userId:users.editor.id,role:'Viewer'}]}),200);
  status(await req('GET',`/experiments/${e.id}`,'editor'),200);
  status(await req('PUT',`/experiments/${e.id}`,'editor',{title:'blocked',versionNo:1}),403);
});
await check('notification read is scoped to recipient',async()=>{
  const e=await experiment(p.id);status(await req('POST',`/experiments/${e.id}/submit`,'pi',{reviewerId:users.pi.id}),201);
  const r=await req('GET','/notifications','pi');const notification=r.data.items.find(n=>n.relatedExperimentId===e.id);assert.ok(notification);
  status(await req('PUT',`/notifications/${notification.id}/read`,'editor'),404);
  status(await req('PUT',`/notifications/${notification.id}/read`,'pi'),200);
});
await check('workflow template and instance read lifecycle',async()=>{
  const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'drying_injection',label:'Drying',builtInStep:'drying_injection'}],edges:[]}});status(t,201);
  status(await req('GET',`/workflow/templates/${t.data.id}`,'pi'),200);
  status(await req('PUT',`/workflow/templates/${t.data.id}`,'pi',{name:`${prefix}-updated`}),200);
  const parent=await project();status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'drying_injection',assignedUserIds:[users.pi.id]}]}),201);
  status(await req('GET',`/workflow/instances/${parent.id}`,'pi'),200);
  status(await req('GET',`/workflow/instances/${parent.id}/permissions`,'pi'),200);
});
await check('design procurement updates and dependent deletion are consistent',async()=>{
  const parent=await project();const made=await req('POST',`/projects/${parent.id}/design`,'pi',{groups:[{group:'A',moleculeName:'Synthetic A',chineseName:'合成',cas:'test',cellCount:2,redundancyCount:0}]});status(made,201);
  const designs=await req('GET',`/projects/${parent.id}/design`,'pi');const id=designs.data[0].id;
  status(await req('PUT',`/projects/${parent.id}/design/${id}`,'pi',{moleculeName:'Synthetic B'}),200);
  const purchases=await req('GET',`/projects/${parent.id}/procurement`,'pi');status(purchases,200);const purchase=purchases.data[0];assert.equal(purchase.moleculeName,'Synthetic B');
  status(await req('PUT',`/projects/${parent.id}/procurement/${purchase.id}`,'pi',{supplier:'Synthetic supplier',isValid:true}),200);
  status(await req('PUT',`/projects/${parent.id}/procurement/batch`,'pi',{items:[{id:purchase.id,batchNo:'SYNTHETIC-1'}]}),200);
  const before=(await req('GET',`/projects/${parent.id}/procurement`,'pi')).data;
  status(await req('PUT',`/projects/${parent.id}/procurement/batch`,'pi',{items:[{id:purchase.id,batchNo:'DO-NOT-COMMIT'},{id:randomUUID(),batchNo:'missing'}]}),[400,404]);
  assert.deepEqual((await req('GET',`/projects/${parent.id}/procurement`,'pi')).data,before);
  status(await req('DELETE',`/projects/${parent.id}/design/${id}`,'pi'),200);
  assert.equal((await req('GET',`/projects/${parent.id}/procurement`,'pi')).data.length,0);
});
await check('solution formula and scrap restore lifecycle',async()=>{
  const e=await experiment(p.id);status(await req('POST',`/data/solution/${e.id}`,'pi',{groupName:'A',materialName:'Synthetic solvent'}),201);
  status(await req('PATCH',`/data/solution-preparation-groups/${e.id}`,'pi',{groupName:'A',formulaInfo:'Synthetic formula'}),200);
  status(await req('POST',`/data/scrapped-solution-groups/${e.id}`,'pi',{groupName:'A',reason:'Synthetic test'}),201);
  const scraps=await req('GET',`/data/scrapped-solution-groups/${e.id}`,'pi');assert.equal(scraps.data.length,1);
  status(await req('POST',`/data/scrapped-solution-groups/${e.id}/restore`,'pi',{groupName:'A'}),201);
  assert.equal((await req('GET',`/data/scrapped-solution-groups/${e.id}`,'pi')).data.length,0);
});
await check('cell selection sync and scrap restore lifecycle',async()=>{
  const parent=await project();const e=await experiment(parent.id);status(await req('POST',`/data/process/${e.id}`,'pi',{cellId:'SYNTHETIC-A',gqd1:'1',gr1:'1'}),201);
  status(await req('POST',`/data/pick-cells/${parent.id}`,'pi',{mode:'manual',assignments:[{cellId:'SYNTHETIC-A',testType:'CalendarLife'}]}),201);
  status(await req('POST',`/data/sync-cells/${parent.id}`,'pi'),201);
  const list=await req('GET',`/projects/${parent.id}/experiments`,'pi');const target=list.data.find(e=>e.workflowStepName==='calendar_life');assert.ok(target);
  const rows=await req('GET',`/data/calendar/${target.id}`,'pi');status(rows,200);assert.equal(rows.data.length,7);
  status(await req('POST',`/data/scrapped-cells/${parent.id}`,'pi',{cellId:'SYNTHETIC-A',reason:'Synthetic'}),201);
  status(await req('POST',`/data/scrapped-cells/${parent.id}/restore`,'pi',{cellId:'SYNTHETIC-A'}),201);
});
await check('summary workbook import is exercised with real Excel',async()=>{
  const parent=await project();const summary=new ExcelJS.Workbook();
  summary.addWorksheet('数据记录-制程数据').addRows([['cellId','m0','m1','m2'],['SUMMARY-CELL',1,3,2]]);
  const form=new FormData();form.append('files',new Blob([await summary.xlsx.writeBuffer()]),'summary.xlsx');form.set('mode','merge');
  const r=await req('POST',`/data/upload-project/${parent.id}`,'pi',form);status(r,201);assert.ok(r.data.sheetsProcessed>0);
  const list=await req('GET',`/projects/${parent.id}/experiments`,'pi');status(list,200);assert.ok(list.data.length>0);
});

await check('design and procurement leaf assignees can perform only their own domain work',async()=>{
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'experiment_design',label:'Design group',builtInStep:'experiment_design'},{id:'design',label:'Design',builtInStep:'design',parentId:'experiment_design'},{id:'procurement',label:'Procurement',builtInStep:'procurement',parentId:'experiment_design'}],edges:[{from:'design',to:'procurement'}]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'design',assignedUserIds:[users.editor.id]},{stepName:'procurement',assignedUserIds:[users.admin.id]}]}),201);
  status(await req('GET',`/projects/${parent.id}/design`,'editor'),200);
  status(await req('POST',`/projects/${parent.id}/design`,'editor',{groups:[{group:'A',moleculeName:'Synthetic leaf',chineseName:'测试',cas:'leaf',cellCount:2}]}),201);
  status(await req('GET',`/projects/${parent.id}/design`,'admin'),403);
  const procurement=await req('GET',`/projects/${parent.id}/procurement`,'admin');status(procurement,200);assert.ok(procurement.data.length>0);
  status(await req('PUT',`/workflow/instances/${parent.id}/transition`,'editor',{expectedStepName:'design'}),200);
  status(await req('PUT',`/projects/${parent.id}/procurement/${procurement.data[0].id}`,'admin',{supplier:'Leaf assignee',isValid:true}),200);
});
await check('selection-only assignee can use minimal candidates and sync without direct downstream access',async()=>{
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'custom-pick',label:'Select',builtInStep:'battery_selection'}],edges:[]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'custom-pick',assignedUserIds:[users.editor.id]}]}),201);
  const e=await req('POST',`/projects/${parent.id}/experiments`,'pi',{title:prefix,assayType:'ProcessData',workflowStepName:'drying_injection'});status(e,201);
  status(await req('POST',`/data/process/${e.data.id}`,'pi',{cellId:'SELECT-A',gqd1:'1',gr1:'2',m0:'8'}),201);
  status(await req('GET',`/data/process/${e.data.id}`,'editor'),403);
  const candidates=await req('GET',`/data/selection-candidates/${parent.id}`,'editor');status(candidates,200);assert.equal(candidates.data[0].cellId,'SELECT-A');assert.ok(!('m0' in candidates.data[0]));assert.ok(!('experimentId' in candidates.data[0]));
  status(await req('POST',`/data/pick-cells/${parent.id}`,'editor',{mode:'manual',assignments:[{cellId:'SELECT-A',testType:'CalendarLife'}]}),201);
  status(await req('POST',`/data/sync-cells/${parent.id}`,'editor'),201);
  const exps=await req('GET',`/projects/${parent.id}/experiments`,'pi');const target=exps.data.find(e=>e.workflowStepName==='calendar_life');assert.ok(target);
  status(await req('POST',`/data/calendar/${target.id}`,'editor',{cellName:'BLOCKED',dayCount:0}),403);
  const rows=await req('GET',`/data/calendar/${target.id}`,'pi');const row=rows.data[0];assert.ok(row);
  status(await req('PUT',`/data/calendar/${row.id}`,'pi',{q:'3.5'}),200);
  const before=(await req('GET',`/data/calendar/${target.id}`,'pi')).data;
  status(await req('POST',`/data/sync-cells/${parent.id}`,'editor'),201);
  assert.deepEqual((await req('GET',`/data/calendar/${target.id}`,'pi')).data,before,'sync retry changed existing measurements or identities');
});

await check('empty-project summary import cannot grant step assignee whole-project completion',async()=>{
  const parent=await project();const t=await req('POST','/workflow/templates','pi',{name:prefix,steps:{nodes:[{id:'design',label:'Design',builtInStep:'design'}],edges:[]}});status(t,201);
  status(await req('POST','/workflow/instances','pi',{projectId:parent.id,templateId:t.data.id,assignments:[{stepName:'design',assignedUserIds:[users.editor.id]}]}),201);
  const summary=new ExcelJS.Workbook();summary.addWorksheet('数据记录-制程数据').addRows([['cellId','m0'],['UNAUTHORIZED',1]]);
  const form=new FormData();form.append('files',new Blob([await summary.xlsx.writeBuffer()]),'unauthorized-summary.xlsx');
  status(await req('POST',`/data/upload-project/${parent.id}`,'editor',form),403);
  assert.equal((await req('GET',`/projects/${parent.id}/experiments`,'pi')).data.length,0);
  assert.equal((await req('GET',`/workflow/instances/${parent.id}`,'pi')).data.instance.status,'Active');
});
await check('limited-role project owner cannot import unauthorized future steps',async()=>{
  const role=await req('POST','/roles','pi',{name:`${prefix}-limited`,permissionList:['experiments:read','experiments:write','workflow_step:drying_injection']});status(role,201);
  const account=await req('POST','/users','pi',{username:`${prefix}-limited`,fullName:'Synthetic limited owner',roleId:role.data.id});status(account,201);
  const login=await req('POST','/auth/login',null,{username:account.data.username,password:'Password123!'});status(login,200);tokens.limited=login.data.accessToken;
  const parent=await req('POST','/projects','limited',{name:`${prefix}-limited-project`});status(parent,201);
  const summary=new ExcelJS.Workbook();summary.addWorksheet('数据记录-制程数据').addRows([['cellId','m0'],['UNAUTHORIZED-FUTURE',1]]);
  const form=new FormData();form.append('files',new Blob([await summary.xlsx.writeBuffer()]),'limited-summary.xlsx');
  status(await req('POST',`/data/upload-project/${parent.data.id}`,'limited',form),403);
  assert.equal((await req('GET',`/projects/${parent.data.id}/experiments`,'limited')).data.length,0);
});
const report = { timestamp: new Date().toISOString(), base, runPrefix: prefix, total: results.length, passed: results.filter(r=>r.pass).length, failed: results.filter(r=>!r.pass).length, coverage:{ documented:documentedOperations.length, exercised:operations.size, operations:[...operations].sort(), unexercised:documentedOperations.map(item=>`${item.method} ${item.path}`).filter(item=>!operations.has(item)) }, results };
await mkdir('docs/reviews', {recursive:true});
await writeFile(process.env.ELN_REVIEW_OUTPUT || 'docs/reviews/2026-09-23-api-results.json', JSON.stringify(report,null,2)+'\n');
console.log(`RESULT ${report.passed}/${report.total} passed, ${report.failed} failed`);
process.exitCode = report.failed ? 1 : 0;
