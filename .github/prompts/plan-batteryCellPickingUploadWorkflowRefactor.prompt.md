# Battery Cell Picking & Upload Workflow Refactor

## Overview
Introduce cell picking as a mandatory workflow step, constrain upload order (ProcessData → Pick Cells → Other Data), and improve upload UX with conflict detection and batch tracking.

---

## Step 1 — Backend: picked_cells Entity + Auto-pick Logic

### 1a. Create `PickedCell` entity
**File:** `apps/backend/src/entities/picked-cell.entity.ts`

Fields:
- `id` (uuid PK)
- `experimentId` (uuid, index)
- `cellId` (varchar 64, index)
- `pickedBy` (varchar 16: `"auto"` | `"manual"`)
- `createdAt`

Add to `entities/index.ts`. Generate migration.

### 1b. Auto-pick logic + Auto group assignment
**File:** `apps/backend/src/data/data.service.ts`

New method `autoPickCells(experimentId, topN?)`:
1. Query ProcessData for this experimentId where fq1 and fq2 are both non-null
2. Compute `fqTotal = fq1 + fq2`
3. Sort descending by fqTotal
4. Insert into `picked_cells` with `pickedBy = "auto"`
5. **Auto-assign groups by prefix matching**: Call `GroupsService.getGroupMap()` with all picked cellIds, then create `CellGroupMember` records to link each cell to its matched group. This eliminates the manual group management step entirely.
6. Return picked cellIds + group assignments

**Group auto-assignment details:**
- Cell group rules (prefix match / manual) are still configurable in the "分组管理" page
- When auto-pick runs, the system automatically evaluates all existing prefix rules against the picked cellIds
- Cells matching a prefix group are assigned to that group via `cellGroupMember` records
- This happens transparently — no extra UI step needed

### 1c. Manual pick endpoint (unchanged)
**Route:** `POST /api/v1/experiments/:id/pick-cells`

Body: `{ cellIds: string[] }`
- Validate that cellIds exist in ProcessData for this experiment
- Insert into `picked_cells` with `pickedBy = "manual"`
- If already has auto-picked cells, replace them

### 1d. Cell ID sync to other tables
**Route:** `POST /api/v1/experiments/:id/sync-cells`

After picking, create header rows (empty data) in the 5 target tables for each picked cellId:
- CalendarLife, DcrTest, EnergyEfficiency, FastCharge, HtCycle
- **NOT** StorageSwelling (no step data, synced separately)
- Rows have `cellId`/`cellName` set, all data fields null

---

## Step 2 — Backend: Upload Flow Constraints

### 2a. Modify `uploadWorkbook`
**File:** `apps/backend/src/data/data.service.ts`

Upload rules:
- If `recordType === "ProcessData"` → allow (step S1)
- Else → check that this experiment has picked_cells records
  - If not → `400: "Must pick cells before uploading this data type"`
- Record Excel filename as the **cell identifier** (电池编号) — the filename IS the cell ID. Multiple files with different cell IDs can be uploaded together (already supports multi-file upload).

### 2b. Duplicate upload detection
Before processing upload:
- Check if data already exists for this `experimentId + recordType`
- If exists → return `409` with body: `{ conflict: true, existingCount: N }`
- Frontend confirms, then retries with `mode` parameter:
  - `overwrite`: DELETE existing rows + rawSteps, then INSERT new
  - `merge`: INSERT new rows (deduplicate by cellId)

---

## Step 3 — Backend: Experiment entity + endpoints

### 3a. Experiment entity — no new fields needed
No changes needed for filename tracking — the cell ID is extracted from the filename at upload time and stored in the business data rows' `cellId`/`cellName` columns.

### 3b. Cell pick + sync endpoints
**File:** `apps/backend/src/experiments/experiments.controller.ts`

New routes:
- `POST /api/v1/experiments/:id/pick-cells` — auto or manual pick
- `GET /api/v1/experiments/:id/picked-cells` — get picked list
- `POST /api/v1/experiments/:id/sync-cells` — sync to 5 target tables

---

## Step 4 — Frontend: ProjectDetail page (项目详情页)

### 4a. Upload modal workflow change
**Current:** 用户选 recordType → 填标题 → 上传 Excel → 完成

**New:**
1. 用户点「新建记录」
2. Modal 显示 recordType select + 标题 input + 文件上传
3. **如果是 ProcessData 以外的类型**:
   - Modal 顶部增加**警告横幅**："请先在制成的实验中挑选电池"
   - 上传按钮置灰 disabled，提示 tooltip
4. 上传成功后：
   - ProcessData → toast "上传成功 → 下一步：挑选电池"
     - Modal 底部新增按钮：「去挑选电池」跳转到该实验详情页
   - 其他类型 → 正常关闭

### 4b. Experiment list row changes
**List view** 每行新增：
- 状态旁增加 **cellPicked** 指示：
  - ✅ "已挑选" — 绿色
  - ⚠️ "待挑选" — 黄色（只有 ProcessData 类型显示）
  - （其他类型无指标，因为没 ProcessData 就没有挑选概念）

**Grid view** 卡片新增：
- cellPicked 状态在 status badge 旁边

### 4c. Tab count badge enhancement
"实验 & 记录" tab 旁的数字 show `已选/总数` 格式：
- `实验 & 记录 (12)` → `实验 & 记录 (8/12)` 其中 8=cellPicked 实验数

### 4d. New i18n keys
| Key | EN | ZH |
|-----|-----|-----|
| `pick_cells_title` | Pick Cells | 挑选电池 |
| `pick_cells_auto` | Auto Pick | 自动挑选 |
| `pick_cells_manual` | Manual Pick | 手动挑选 |
| `pick_cells_hint` | Select cells for subsequent testing | 选择电池用于后续测试 |
| `picked_count` | {{count}} cells picked | 已选 {{count}} 个电池 |
| `pick_next_step` | Next: Pick Cells | 下一步：挑选电池 |
| `not_picked_yet` | Pending pick | 待挑选 |
| `cells_picked` | Picked | 已挑选 |
| `conflict_title` | Duplicate Data Detected | 检测到已有同类型数据 |
| `conflict_overwrite` | Overwrite | 覆盖 |
| `conflict_merge` | Merge | 合并 |
| `conflict_desc` | This experiment already has {{count}} rows. Overwrite or merge? | 此实验已有 {{count}} 行数据。覆盖还是合并？ |
| `no_cells_upload_first` | Upload ProcessData first before picking cells | 请先上传制成数据再进行电池挑选 |
| `syncing_cells` | Syncing cells... | 正在同步电池... |

### 4e. Upload modal layout (示意图)

```
┌─────────────────────────────────────────┐
│  新建记录                          [✕]  │
├─────────────────────────────────────────┤
│  ⚠️ 此类型需要先挑选电池               │  ← 非 ProcessData 显示
│                                         │
│  类型: [日历寿命 ▾]                     │
│        ℹ️ Step工作表需包含: 工步号...   │
│  标题: [___________]                    │
│                                         │
│  上传原始数据                           │
│  ┌─────────────────────────────────┐   │
│  │      拖拽或点击上传              │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│              [取消]  [创建记录]         │  ← 非 ProcessData 无选择时 disabled
│  或          [取消]  [去挑选电池]       │  ← ProcessData 上传成功后
└─────────────────────────────────────────┘
```

---

## Step 5 — Frontend: ExperimentDetail page (实验详情页)

### 5a. Header 布局保持不变
```
┌──────────────────────────────────────────────────────┐
│  NMC811 Test   [制成数据]          [编辑] [删除] [导出 ▾] │
│  Updated Jul 1, 2026 · v1                          │
└──────────────────────────────────────────────────────┘
```

### 5b. Picked Cells 区域（新增，仅 ProcessData 实验显示）

```
┌──────────────────────────────────────────────────────┐
│  🔋 已挑选电池 (8)                    [自动挑选] [手动挑选] │
│                                                      │
│  ┌─A-001─┐ ┌─A-002─┐ ┌─A-003─┐ ...                   │
│  │ fq=12.3 │ │ fq=11.8 │ │ fq=10.5 │                  │
│  └────────┘ └────────┘ └────────┘                     │
│                                                      │
│  □ 同步到: [日历寿命] [4C DCR] [能量效率] [快充] [高温循环] │
└──────────────────────────────────────────────────────┘
```

- 每个电池小卡片：cellId + fqTotal
- 自动/手动切换按钮
- 同步按钮：一键将 picked cellIds 写入 5 张目标表
- 同步后目标表自动出现空行（cellId 已填入）

### 5c. 非 ProcessData 实验的 Picked Cells 只读展示

```
┌──────────────────────────────────────────────────────┐
│  🔋 选用电池: A-001, A-002, A-003, A-005, A-008     │
│  ℹ️ 从制成数据同步，共 5 个电池                       │
└──────────────────────────────────────────────────────┘
```

- 只读 tag 列表，不可编辑
- 显示来源（制成数据的哪个实验）

### 5d. 数据表格区域（增强）

**无数据但已挑选：**
```
┌─ 数据表格 ──── [汇总 | 原始] ──── 5 行 ───────┐
├───────────────────────────────────────────────┤
│  cellId    │ Q0  │ DU0 │ DU1 │ DI  │ ...     │
│  A-001     │  —  │  —  │  —  │  —  │         │
│  A-002     │  —  │  —  │  —  │  —  │         │
│  ...                                          │
├───────────────────────────────────────────────┤
│  ℹ️ 显示已挑选电池的空行，上传原始数据后自动填充  │
└───────────────────────────────────────────────┘
```

**无数据且未挑选（非 ProcessData）：**
```
┌─ 数据表格 ──── [汇总 | 原始] ─────────────────┐
├───────────────────────────────────────────────┤
│  ⚠️ 请先在制成的实验中挑选电池                   │
└───────────────────────────────────────────────┘
```

**有数据：** 保持现状不变。

### 5e. 上传区域（ProcessData 实验详情页新增）

图表下方增加上传入口：
```
┌─ 上传原始数据 ──────────────────────────────────┐
│  ┌──────────────────────────────────────────┐   │
│  │     📤 拖拽或点击上传 Excel 文件          │   │
│  │     Step / Cycle 工作表，多个文件可多选    │   │
│  └──────────────────────────────────────────┘   │
│  [已选: step-calendar.xlsx, step-dcr.xlsx]       │
└─────────────────────────────────────────────────┘
```

上传后触发覆盖/合并检查 (Step 2b 的 409 响应)。

---

## Step 6 — Frontend: ExperimentTables empty state

### 6a. `ExperimentTables.tsx` 改动
**File:** `apps/frontend/src/components/ExperimentTables.tsx`

Each table component (ProcessDataTable, CalendarLifeTable, etc.) currently shows either data or a spinner.

**New:** when data is empty AND picked cells exist:
- Render ONE row per picked cellId with only the cellId/cellName column filled
- All data columns show `—` (em dash)
- Row is grayed out (`text-gray-300`)
- Row cannot be edited or deleted (no action buttons)

When data is empty AND NO picked cells exist (non-ProcessData, step S3 not reached):
- Show centered message: "请先在制成的实验中挑选电池"

### 6b. Edit row modal — computed field block

Already done in previous commit. Confirm: computed fields (blue label + `(计算)`) are disabled in edit mode.

---

## Step 7 — Frontend: Conflict Modal component

### 7a. New reusable component
**File:** `apps/frontend/src/components/ConflictModal.tsx` (new)

Props: `open`, `onClose`, `onOverwrite`, `onMerge`, `existingCount`, `recordType`

```
┌─────────────────────────────────────┐
│  检测到已有同类型数据           [✕]  │
├─────────────────────────────────────┤
│                                     │
│  ⚠️ 此实验已有 12 行「日历寿命」数据 │
│                                     │
│  请选择处理方式：                    │
│                                     │
│  [覆盖]  删除旧数据，重新导入       │
│  [合并]  保留旧数据，追加新数据      │
│                                     │
├─────────────────────────────────────┤
│              [取消]                 │
└─────────────────────────────────────┘
```

- `onOverwrite`: POST with `mode=overwrite`
- `onMerge`: POST with `mode=merge`
- `onClose`: cancel upload

---

## Step 8 — Frontend: CellPicker component

### 8a. Component layout
**File:** `apps/frontend/src/components/CellPicker.tsx` (new)

```
┌─ 电池挑选 ──────────────────────────────────┐
│                                              │
│  [自动挑选 Top N: [___]] [手动选择]           │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ ☑ A-001  fq=12.34Ah  ceFirst=95.2%  │    │
│  │ ☑ A-002  fq=11.80Ah  ceFirst=94.8%  │    │
│  │ ☐ A-003  fq=10.50Ah  ceFirst=93.1%  │    │
│  │ ☐ A-004  fq=9.87Ah   ceFirst=91.5%  │    │
│  │ ...                                  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  已选: 2 个电池                               │
│  ┌─ 同步 ───────────────────────────────┐    │
│  │ ☑ 日历寿命  ☑ 4C DCR  ☑ 能量效率     │    │
│  │ ☑ 快充时间  ☑ 高温循环               │    │
│  └──────────────────────────────────────┘    │
│                                              │
│            [取消]  [确认挑选 & 同步]           │
└──────────────────────────────────────-────────┘
```

- Sortable list: by fqTotal descending
- Auto-pick: fills Top N (default all)
- Manual: user clicks checkboxes
- "确认挑选 & 同步": calls `POST /pick-cells` → `POST /sync-cells`
- **分组自动完成**：挑选电池后，系统根据已有 prefix 规则自动将电池归入对应 CellGroup，无需用户手动操作
- Syncing progress indicator

### 8b. CellPicker 调用时机
- 在 ExperimentDetail 中嵌入：ProcessData 实验详情页的图表上方
- 或者在 ProjectDetail 的 upload modal 成功后通过 link 跳转进入

---

## Step 9 — Frontend: i18n.ts new keys

| Key | EN | ZH |
|-----|-----|-----|
| `pick_cells_title` | Pick Cells | 挑选电池 |
| `pick_cells_auto` | Auto Pick | 自动挑选 |
| `pick_cells_manual` | Manual Pick | 手动挑选 |
| `pick_cells_hint` | Select cells for subsequent testing | 选择电池用于后续测试 |
| `picked_count` | {{count}} cells picked | 已选 {{count}} 个电池 |
| `pick_next_step` | Next: Pick Cells | 下一步：挑选电池 |
| `not_picked_yet` | Pending pick | 待挑选 |
| `cells_picked` | Picked | 已挑选 |
| `conflict_title` | Duplicate Data Detected | 检测到已有同类型数据 |
| `conflict_overwrite` | Overwrite | 覆盖 |
| `conflict_merge` | Merge | 合并 |
| `conflict_desc` | This experiment already has {{count}} rows. Overwrite or merge? | 此实验已有 {{count}} 行数据。覆盖还是合并？ |
| `batch_label` | Batch {{name}} | 批次 {{name}} |
| `no_cells_upload_first` | Upload ProcessData first | 请先上传制成数据 |
| `no_cells_picked_hint` | Please pick cells in the ProcessData experiment first | 请先在制成的实验中挑选电池 |
| `syncing_cells` | Syncing cells... | 正在同步电池... |
| `sync_to_tables` | Sync to tables | 同步到 |
| `empty_row_placeholder` | No data yet | 暂无数据 |
| `upload_data_here` | Upload raw data here | 在此上传原始数据 |
| `cells_synced_hint` | Cell headers synced from pick result, upload raw data to populate values | 已从挑选结果同步电池表头，上传原始数据填充数值 |
| `pick_top_n` | Pick top | 前 |
| `pick_all` | Pick all qualified | 全部合格

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/backend/src/entities/picked-cell.entity.ts` | Picked cells table entity |
| `apps/backend/src/experiments/dto/pick-cells.dto.ts` | Pick cells request DTO |
| `apps/frontend/src/components/CellPicker.tsx` | Auto/manual cell picker UI |
| `apps/frontend/src/components/ConflictModal.tsx` | Overwrite/merge confirmation modal |

## Files to Modify

| File | Changes |
|------|---------|
| **Backend** | |
| `apps/backend/src/entities/index.ts` | Export PickedCell |
| `apps/backend/src/entities/experiment.entity.ts` | Add `cellPicked` boolean |
| `apps/backend/src/data/data.service.ts` | autoPickCells, upload constraints, conflict detection |
| `apps/backend/src/data/data.controller.ts` | Upload constraint check |
| `apps/backend/src/experiments/experiments.controller.ts` | New pick/sync endpoints |
| `apps/backend/src/experiments/experiments.service.ts` | Cell pick + sync logic |
| **Frontend — Pages** | |
| `apps/frontend/src/pages/ProjectDetail.tsx` | Upload modal workflow (4a), list/grid row status (4b), tab badge (4c) |
| `apps/frontend/src/pages/ExperimentDetail.tsx` | Picked cells section (5b/5c), upload area (5e), empty state logic (5d) |
| **Frontend — Components** | |
| `apps/frontend/src/components/ExperimentTables.tsx` | Empty state with picked cell rows (6a), computed field disable (6b) |
| **Frontend — i18n** | |
| `apps/frontend/src/i18n.ts` | 20+ new keys (Step 9) |

## Verification Checklist

1. `pnpm run build` all 3 packages pass
2. Non-ProcessData upload without picked cells → backend 400 + frontend warning
3. Cell ID extracted from upload filename, stored in business data rows
4. Same-type re-upload → 409 conflict → ConflictModal shown
5. Auto-pick returns cells with valid fq1+fq2, sorted by fqTotal descending
6. Sync-cells creates empty rows in 5 target tables with correct cellIds
7. ExperimentDetail shows picked cell tags for ProcessData experiments
8. ExperimentDetail shows "please pick cells first" for non-ProcessData without picks
9. ProjectDetail list shows cellPicked status per experiment
10. `pnpm run lint` all packages pass
