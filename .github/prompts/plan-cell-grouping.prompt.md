## Plan: 电池分组功能 + 分组图表改进

**TL;DR**: 实现项目级别的电池分组系统（前缀自动匹配 / 手动指定），新增 `cell_groups` 数据表与 CRUD API，重构所有 7 类图表使用统一分组配色，改造 DataSummary 使用数据库驱动的分组。

**已确认的设计决策**:
- DCR / 能效图：保留每个电芯独立柱子（像现在），按分组统一颜色
- 分组管理 UI：独立页面 (`/projects/:projectId/groups`)，非 Modal

---

## 一、架构设计

### 核心决策
- **分组粒度**: 项目级别（`projectId` 外键），同一项目下所有实验共享分组
- **匹配模式**: 前缀自动匹配 + 手动指定（覆盖自动分配）
- **颜色方案**: 固定 15 色调色板，按分组注册顺序分配，所有图表保持一致
- **分辨策略**: 动态分辨（存规则，查询时计算），不存预计算的 member 行
- **分组管理入口**: 独立路由页面 `/projects/:projectId/groups`，在项目详情页通过侧边栏/导航入口进入

### 数据模型 (新表)

```
cell_groups (电池分组定义表)
  id              UUID PK
  projectId       UUID     — 逻辑关联 projects.id, INDEX
  name            VARCHAR(64)  — 分组名称 (如 "方案A", "对照组")
  color           VARCHAR(9)   — hex 色值 (如 "#1d74f5")
  sortOrder       INT 默认 0   — 排序权重
  matchMode       VARCHAR(16)  — 'prefix' | 'manual'
  matchValue      VARCHAR(128) — prefix 模式下存前缀值
  createdAt       TIMESTAMP

cell_group_members (手动分组电芯表)
  id              UUID PK
  groupId         UUID — 逻辑关联 cell_groups.id, INDEX
  cellIdentifier  VARCHAR(128) — cellName 或 cellId
  createdAt       TIMESTAMP
```

### 颜色调色板 (在 @eln/shared 中定义)

```typescript
GROUP_PALETTE = [
  '#1d74f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
]
```

未分组电芯统一使用灰色 `#9ca3af`。

---

## 二、实施步骤

### Phase 1: 后端 — 数据模型 + CRUD

*步骤 1-3 可并行*

1. **新建 entity**: `apps/backend/src/entities/cell-group.entity.ts`
   - `@Entity('cellGroup')`, 字段：id, projectId, name, color, sortOrder, matchMode, matchValue, createdAt
   - 对应更新 `src/entities/index.ts` barrel export

2. **新建 entity**: `apps/backend/src/entities/cell-group-member.entity.ts`
   - `@Entity('cellGroupMember')`, 字段：id, groupId, cellIdentifier, createdAt
   - 对应更新 barrel export

3. **新建 migration**: 运行 `pnpm --filter @eln/backend run typeorm:generate` 生成新 migration 文件（或手动编写包含两个新表的 migration）

4. **新建 module/service/controller**: `apps/backend/src/groups/`
   - `groups.module.ts` — 注册 TypeOrmModule.forFeature([CellGroup, CellGroupMember])
   - `groups.service.ts` — CRUD + resolve 逻辑
     - `findByProject(projectId)` — 列出项目分组
     - `create(dto)` — 创建分组（自动分配颜色）
     - `update(id, dto)` — 更新分组
     - `delete(id)` — 删除分组及其 members
     - `resolve(projectId)` — 根据项目下所有实验的 cell 数据，按 prefix 规则动态分辨电芯归属
     - `getGroupForCell(cellIdentifier, projectId)` — 查询单个 cell 的分组（先查手动成员表，未命中则按 prefix 匹配）
   - `groups.controller.ts` — REST 端点
     - `GET /api/v1/projects/:projectId/groups`
     - `POST /api/v1/projects/:projectId/groups`
     - `PUT /api/v1/projects/:projectId/groups/:id`
     - `DELETE /api/v1/projects/:projectId/groups/:id`
     - `POST /api/v1/projects/:projectId/groups/resolve` — 触发重新分辨
   - `groups/dto/` — CreateGroupDto, UpdateGroupDto (class-validator)

5. **注册模块**: 在 `apps/backend/src/app.module.ts` 中 import `GroupsModule`

### Phase 2: 后端 — 数据查询支持分组

6. **DataService 新增方法**: `findByTypeWithGroups(type, expId, projectId)`
   - 查原始数据行 + 调用 GroupsService.getGroupForCell 为每行附加 groupId/groupName/color
   - 新增 `GET /api/v1/data/:type/:expId?withGroups=true` 查询参数
   - 返回值结构: `{ rows: T[], groupMap: { [cellIdentifier]: { groupId, groupName, color } } }`
   - 注意：不需要新增 `/grouped-data/:type` 聚合端点（DCR/能效图保留独立柱子）

### Phase 3: 共享包

7. **@eln/shared 新增**:
   - `packages/shared/src/colors.ts` — `GROUP_PALETTE` 常量 + `getGroupColor(index)` 函数
   - `packages/shared/src/dto/group.dto.ts` — `CellGroupDto`, `CreateCellGroupDto`, `UpdateCellGroupDto`
   - 更新 `packages/shared/src/dto/index.ts` 与 `packages/shared/src/index.ts`

### Phase 4: 前端 — 分组管理页面 (独立路由)

*步骤 8-9 可并行*

8. **新建 GroupsPage 页面**: `apps/frontend/src/pages/Groups.tsx`
   - 独立路由 `/projects/:projectId/groups`
   - 页面内容：
     - 面包屑导航：项目 → 分组管理
     - 现有分组列表（名称 + 色块 + 匹配规则 + 操作按钮）
     - "添加分组"表单：名称、匹配模式 (前缀/手动)、前缀值
     - 手动模式：搜索并勾选电芯
     - 删除分组确认
   - CRUD 调用 `/api/v1/projects/:projectId/groups` 端点

9. **新建 hooks**: `apps/frontend/src/hooks/useGroups.ts`
   - `useGroups(projectId)` — 获取分组列表，缓存到 state
   - 返回 `{ groups, loading, getCellGroup(cellIdentifier), refresh }`

10. **更新前端路由**: `apps/frontend/src/App.tsx`
    - 新增 `<Route path="projects/:projectId/groups" element={<Groups />} />` 在 ProtectedRoute 内
    - 新增 `<Route path="projects/:projectId" element={<ProjectDetail />} />`

11. **更新导航**: `apps/frontend/src/components/Layout.tsx` 或 `ProjectDetail.tsx`
    - 添加侧边栏/工具栏入口跳转到分组管理页面

### Phase 5: 前端 — 图表重构

12. **新建 ChartColorContext 或工具函数**:
    - `apps/frontend/src/utils/chartColors.ts` — 导入 `GROUP_PALETTE`，提供 `getGroupColor(groupName, groups)` 保证跨图表颜色一致

13. **重写 ExperimentChart.tsx** (13.1-13.7):
    - 接收 `groups: CellGroupDto[]` prop
    - **13.1 CalendarLife — 容量保持/恢复图 (柱形图)**
      - X 轴: dayCount, 每个 dayCount 下按 cellName 分组
      - 同组 cell 使用相同颜色，不同组使用不同颜色
      - 两个子图切换: qRetention / qRecovery
    - **13.2 CalendarLife — DCR 增长图 (折线图)**
      - X 轴: dayCount, Y 轴: ddcrGrowth / cdcrGrowth
      - 每个 cellName 一条折线，颜色按分组
    - **13.3 StorageSwelling — 产气变化图 (折线图)**
      - X 轴: dayCount, Y 轴: vg
      - 每个 cellName 一条折线，颜色按分组
    - **13.4 DcrTest — DCR 图 (柱形图)**
      - X 轴: cellName（保留现有布局），按分组统一颜色
      - Y 轴: ddcr / cdcr 双柱
      - 同组 cell 使用相同颜色，不同组使用不同颜色
    - **13.5 EnergyEfficiency — 能效图 (柱形图)**
      - X 轴: cellName（保留现有布局），按分组统一颜色
      - Y 轴: de / ce 双柱（或 ee 单柱）
      - 同组 cell 使用相同颜色，不同组使用不同颜色
    - **13.6 HtCycle — 循环图 (带平滑线的散点图)**
      - X 轴: cycle, Y 轴: capacityRetention
      - 每个 cellName 一条线，颜色按分组
      - 使用 `type="monotone"` 的 `<Line>` 组件
    - **13.7 ProcessData — 保持现有逻辑，可选分组着色**

14. **更新 ExperimentDetail.tsx**:
    - 使用 `useGroups(experiment.projectId)` 获取分组
    - 传递 `groups` 给 `<ExperimentChart>` 和各 Table 组件

### Phase 6: 前端 — DataSummary 改造

15. **重构 `utils/dataSummary.ts` 的 `getGroupName`**:
    - 改为接收 `groups: CellGroupDto[]` 参数
    - 优先使用数据库中的分组配置
    - 无分组配置时回退到默认前缀逻辑

16. **更新 `components/DataSummary.tsx`**:
    - 接收 `groups` prop
    - 按分组维度聚合统计数据
    - 未分组 cells 归入 "未分组" (灰色)

### Phase 7: 测试与验证

17. **后端单元测试**: `apps/backend/src/groups/__tests__/groups.service.spec.ts`
    - CRUD 操作
    - 前缀匹配分辨逻辑
    - 手动分配逻辑

18. **前端验证**:
    - 创建 2-3 个前缀分组 → 上传 Excel → 验证 7 类图表配色一致
    - 切换手动模式 → 验证自定义分组
    - DataSummary 中验证按组统计正确

---

## 三、关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/backend/src/entities/cell-group.entity.ts` | **新建** | 分组定义实体 |
| `apps/backend/src/entities/cell-group-member.entity.ts` | **新建** | 手动分组电芯实体 |
| `apps/backend/src/entities/index.ts` | 修改 | 新增 barrel export |
| `apps/backend/src/migrations/*-AddCellGroups.ts` | **新建** | migration 文件 |
| `apps/backend/src/groups/*` | **新建目录** | module/service/controller/dto |
| `apps/backend/src/app.module.ts` | 修改 | import GroupsModule |
| `apps/backend/src/data/data.service.ts` | 修改 | 新增 findByTypeWithGroups |
| `apps/backend/src/data/data.controller.ts` | 修改 | 新增 ?withGroups 参数 |
| `packages/shared/src/colors.ts` | **新建** | GROUP_PALETTE + 工具函数 |
| `packages/shared/src/dto/group.dto.ts` | **新建** | DTO 接口定义 |
| `packages/shared/src/dto/index.ts` | 修改 | barrel export |
| `apps/frontend/src/pages/Groups.tsx` | **新建** | 分组管理独立页面 |
| `apps/frontend/src/hooks/useGroups.ts` | **新建** | 分组数据 hook |
| `apps/frontend/src/utils/chartColors.ts` | **新建** | 图表颜色工具 |
| `apps/frontend/src/App.tsx` | 修改 | 新增分组路由 |
| `apps/frontend/src/components/ExperimentChart.tsx` | **重写** | 分组图表渲染 |
| `apps/frontend/src/pages/ExperimentDetail.tsx` | 修改 | 接入 useGroups |
| `apps/frontend/src/pages/ProjectDetail.tsx` | 修改 | 添加分组管理入口 |
| `apps/frontend/src/utils/dataSummary.ts` | 修改 | getGroupName 改用数据库分组 |
| `apps/frontend/src/components/DataSummary.tsx` | 修改 | 接收 groups prop |

---

## 四、前端路由变更

```
新增:
  /projects/:projectId/groups   →  Groups 页面（分组管理）

保留:
  /projects                     →  Projects
  /projects/:projectId          →  ProjectDetail (summary/experiments tab)
  /experiments/:experimentId    →  ExperimentDetail
```

---

## 五、验证步骤

1. `pnpm --filter @eln/backend run typeorm:run` — 确保新 migration 成功
2. `pnpm run test` — 所有单元测试通过
3. 启动后端 → Swagger UI 验证新分组 CRUD 端点
4. 前端：项目详情页 → 导航到分组管理页 → 创建分组 → 上传含多前缀电芯的 Excel → 切换到各图表验证配色一致性
5. DataSummary tab → 验证按组统计正确

---

## 六、排除范围

- 不修改 ProcessData 图表的默认行为（当前已有 cellId 维度的柱形图）
- 不做跨项目的分组共享
- 不做 AI 自动分组建议（后续迭代）
- FastCharge 图表暂保持原样（当前无明确分组需求）
