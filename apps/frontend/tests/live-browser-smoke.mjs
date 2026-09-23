/** Optional browser smoke against the disposable review API and Vite dev server. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const frontend = process.env.ELN_REVIEW_FRONTEND || 'http://127.0.0.1:5173';
if (process.env.ELN_REVIEW_ALLOW_WRITES !== 'yes' || !['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname)) {
  throw new Error('Requires ELN_REVIEW_ALLOW_WRITES=yes and a disposable localhost frontend.');
}
if (!process.env.ELN_PLAYWRIGHT_PATH || !process.env.ELN_CHROME_PATH) {
  throw new Error('Set ELN_PLAYWRIGHT_PATH and ELN_CHROME_PATH for this optional browser smoke.');
}
const { chromium } = await import(pathToFileURL(process.env.ELN_PLAYWRIGHT_PATH).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.ELN_CHROME_PATH });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let checks = 0;
function pass(label) { checks++; console.log(`PASS ${label}`); }
try {
  await page.goto(`${frontend}/login`);
  await page.locator('#username').waitFor();
  assert.equal(await page.getByText(/Quick Login|快捷登录|Password123!/).count(), 0);
  assert.equal(await page.getByRole('button', { name: /Owner \(PI\)|负责人 \(PI\)/ }).count(), 0);
  pass('login page has no test account shortcut or embedded password');

  await page.locator('#username').fill('pi');
  await page.locator('#password').fill('incorrect');
  await page.getByRole('button', { name: /登录|Sign in/ }).click();
  await page.getByText(/用户名或密码不正确|Invalid username or password/).waitFor();
  await page.locator('#password').fill(process.env.ELN_REVIEW_PASSWORD || 'Password123!');
  await page.getByRole('button', { name: /登录|Sign in/ }).click();
  await page.waitForURL('**/projects');
  await page.locator('main table').first().waitFor();
  assert.equal(await page.getByText('临时文件', { exact: true }).count(), 0);
  pass('invalid credentials are explained, valid login reaches projects, temp upload is absent');

  const projectsTable = await page.locator('main table').first().boundingBox();
  assert.ok(projectsTable && projectsTable.width > 500);
  await page.goto(`${frontend}/users`);
  await page.locator('main table').first().waitFor();
  const usersTable = await page.locator('main table').first().boundingBox();
  assert.ok(usersTable);
  assert.ok(Math.abs(projectsTable.x - usersTable.x) < 2, `list left edges: ${projectsTable.x} vs ${usersTable.x}`);
  assert.ok(Math.abs(projectsTable.width - usersTable.width) < 2, `list widths: ${projectsTable.width} vs ${usersTable.width}`);
  pass('projects and users tables align at desktop width');

  await page.getByRole('button', { name: /添加用户|Add User/i }).click();
  const userDialog = page.getByRole('dialog');
  const browserUsername = `browser-user-${randomUUID().slice(0, 8)}`;
  await userDialog.locator('#username').fill(browserUsername);
  await userDialog.locator('#name').fill('Browser test viewer');
  await userDialog.locator('#role').selectOption({ label: 'Viewer' });
  assert.equal(await userDialog.locator('#initial-password').getAttribute('required'), '');
  await userDialog.locator('#initial-password').fill('BrowserJourney123!');
  await userDialog.getByRole('button', { name: /创建|Create/i }).click();
  await userDialog.waitFor({ state: 'detached' });
  const viewerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(`${frontend}/login`);
    await viewerPage.locator('#username').fill(browserUsername);
    await viewerPage.locator('#password').fill('BrowserJourney123!');
    await viewerPage.getByRole('button', { name: /登录|Sign in/ }).click();
    await viewerPage.waitForURL('**/projects');
    assert.equal(await viewerPage.getByRole('button', { name: /新建项目|New project/i }).count(), 0);
  } finally {
    await viewerContext.close();
  }
  pass('admin creates a viewer with an explicit password; viewer logs in without create permission');

  const token = await page.evaluate(() => localStorage.getItem('token'));
  const templateName = `browser-formation-${randomUUID().slice(0, 8)}`;
  const templateResponse = await page.request.post(`${frontend}/api/v1/workflow/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: templateName, steps: { nodes: [{ id: 'formation', label: 'Formation', builtInStep: 'formation' }], edges: [] } },
  });
  assert.equal(templateResponse.status(), 201);
  const templateJson = await templateResponse.json();
  const template = templateJson?.success === true ? templateJson.data : templateJson;
  await page.goto(`${frontend}/projects`);
  await page.getByRole('button', { name: /新建项目|New project/i }).click();
  const dialog = page.getByRole('dialog');
  const projectName = `browser-project-${randomUUID().slice(0, 8)}`;
  await dialog.locator('#projectName').fill(projectName);
  await dialog.getByRole('button', { name: /下一页|Next/i }).click();
  await dialog.locator('select').selectOption(template.id);
  await dialog.locator('tbody tr').first().getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Dr\. Alice Chen/ }).click();
  await dialog.getByRole('button', { name: /创建项目|Create Project/i }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('link', { name: projectName }).click();
  assert.equal(await page.getByText('此项目未配置工作流').count(), 0);
  pass('browser wizard creates a project, assigns a worker, and opens its configured detail');

  await page.goto(`${frontend}/roles`);
  await page.getByText(/角色管理|Role Management/i).first().waitFor();
  await page.goto(`${frontend}/workflow-config`);
  await page.locator('main').getByText(/工作流|Workflow/i).first().waitFor();
  await page.goto(`${frontend}/dashboard`);
  await page.locator('main').getByText(/仪表盘|Dashboard/i).first().waitFor();
  await page.goto(`${frontend}/inventory`);
  await page.locator('main').getByText(/库存|Inventory/i).first().waitFor();
  await page.goto(`${frontend}/profile`);
  await page.locator('main').getByText(/我的主页|My profile/i).first().waitFor();
  pass('roles, workflow settings, dashboard, inventory, and profile pages render');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontend}/projects`);
  await page.locator('main table').first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `mobile page horizontal overflow: ${overflow}px`);
  pass('mobile projects page keeps wide table scrolling inside the page');

  const projectsResponse = await page.request.get(`${frontend}/api/v1/projects`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(projectsResponse.status(), 200);
  const json = await projectsResponse.json();
  const projects = json?.success === true ? json.data : json;
  const items = Array.isArray(projects) ? projects : projects.items;
  const configured = items.find((item) => item.workflowStatus);
  assert.ok(configured, 'No configured project available for detail smoke');
  await page.goto(`${frontend}/projects/${configured.id}`);
  await page.locator('main').getByText(configured.name, { exact: true }).first().waitFor();
  assert.equal(await page.getByText('此项目未配置工作流').count(), 0);
  pass('configured project detail does not show the missing-workflow state');
  console.log(`RESULT ${checks}/${checks} browser checks passed`);
} finally {
  await browser.close();
}
