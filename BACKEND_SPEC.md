# 生产级电子科研记录系统 (ELN) - 完整后端架构与接口规格说明书

本文档是一份**面向真实生产环境**的完整电子科研记录系统 (Electronic Lab Notebook, ELN) 的后端系统规格书。
文档详尽梳理了当前前端需要对接的所有核心系统表以及 7 张具体的电池科学实验业务表（共计 15 张表），采用 **小驼峰 (camelCase)** 命名规范，并在设计上采用“逻辑关联”而非物理外键，以适应未来微服务和分库分表的横向扩展需求。

可直接将此文档交付给后端开发团队或 AI 编程助手（如 Cline / Cursor），用于从零构建高可用、高扩展的真实数据库与后端服务（如基于 Go, Java (Spring Boot) 或 Node.js (NestJS) 构建）。

---

## 一、 核心基础业务表 (System & IAM)

系统基础架构包含以下 8 张核心表，用于支撑系统的多租户组织架构、实验物资、审计与项目流转。

### 1. `users` (用户表)

存储科研人员基础账户信息。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 用户唯一标识 | **主键 (PK)** |
| `email` | VARCHAR(128) | 登录邮箱 | 唯一索引 (Unique) |
| `passwordHash` | VARCHAR(255) | 密码哈希 | |
| `fullName` | VARCHAR(64) | 用户真实姓名 (对应 name) | |
| `avatar` | VARCHAR(512) | 头像 URL | |
| `roleId` | VARCHAR(36) | 全局角色ID | 逻辑关联 `roles.id` |
| `departmentId`| VARCHAR(36) | 归属部门ID | |
| `isActive` | BOOLEAN | 账户是否启用 | 默认 true |
| `createdAt` | TIMESTAMP | 创建时间 | |

### 2. `roles` (系统角色与权限表)

存储全局的基于角色的访问控制 (RBAC) 字典。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 角色唯一标识 | **主键 (PK)** |
| `name` | VARCHAR(64) | 角色名称 (如 Owner, Admin, Editor, Viewer) | |
| `permissionList`| JSONB | 细粒度接口/菜单权限集合 | |
| `createdAt` | TIMESTAMP | 创建时间 | |

### 3. `projects` (课题组/项目表)

科研数据的最高层级组织单元。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 课题唯一标识 | **主键 (PK)** |
| `name` | VARCHAR(128) | 课题/项目名称 | |
| `description` | TEXT | 课题详情描述 | |
| `status` | VARCHAR(32) | 状态 (Active, Archived) | |
| `createdBy` | VARCHAR(36) | 创建者/负责人 (PI) ID | 逻辑关联 `users.id` |
| `createdAt` | TIMESTAMP | 创建时间 | |

### 4. `experimentCollaborators` (实验协作者关联表)

定义特定成员在某个具体实验 (Experiment) 中的局部权限，对应前端的 `collaborators` 数组。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 关联记录唯一标识 | **主键 (PK)** |
| `experimentId` | VARCHAR(36) | 实验ID | 逻辑关联 `experiments.id` |
| `userId` | VARCHAR(36) | 协作者用户ID | 逻辑关联 `users.id` |
| `role` | VARCHAR(32) | 实验内角色 (Owner, Admin, Editor, Viewer) | |
| `createdAt` | TIMESTAMP | 授权时间 | |

### 5. `experiments` (实验记录本表)

存放一次具体实验、上传批次或 SOP 记录，是 ELN 的核心实体。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 实验记录唯一标识 | **主键 (PK)** |
| `projectId` | VARCHAR(36) | 归属项目ID | 逻辑关联 `projects.id` |
| `title` | VARCHAR(255) | 实验标题/批次名 | |
| `content` | TEXT | Markdown 格式的实验笔记或 SOP | |
| `status` | VARCHAR(32) | 状态 (Draft, In Review, Approved, Archived) | |
| `metadata` | JSONB | 实验元数据 (assayType, notebookRef, deviceUsed, reagentLotId) | |
| `aiAnalysisOutput`| TEXT | 存储由 AI 生成的评估结论 (Markdown) | |
| `versionNo` | INT | 乐观锁版本号 | 并发控制，初始 1 |
| `createdBy` | VARCHAR(36) | 记录人ID | 逻辑关联 `users.id` |
| `createdAt` | TIMESTAMP | 记录创建时间 | |
| `updatedAt` | TIMESTAMP | 最后修改时间 | |

### 6. `inventory` (实验室物资库存表)

管理实验室试剂、细胞系等物资库存状态。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 物资唯一标识 | **主键 (PK)** |
| `name` | VARCHAR(128) | 物资名称 | |
| `type` | VARCHAR(64) | 类型 (Reagent, CellLine, Buffer 等) | |
| `lotNumber` | VARCHAR(64) | 批号 | |
| `quantity` | VARCHAR(64) | 余量/规格 | |
| `storageLocation`| VARCHAR(128)| 存放位置 | |
| `purity` | VARCHAR(64) | 纯度 | |
| `status` | VARCHAR(32) | 状态 (In Stock, Low Stock, Out of Stock) | |
| `lastUsedAt` | TIMESTAMP | 最后使用时间 | |
| `createdAt` | TIMESTAMP | 录入时间 | |

### 7. `attachments` (文件与附件资源表)

存储报告、原始 PDF 以及解析失败的脏数据文件路径。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 附件记录标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 关联实验ID | 逻辑关联 `experiments.id` |
| `fileName` | VARCHAR(255) | 文件名 | |
| `filePath` | VARCHAR(512) | OSS/S3 物理存储路径 | |
| `fileSize` | INT | 文件大小(Bytes) | |
| `mimeType` | VARCHAR(128) | 文件类型 | |
| `uploadedBy` | VARCHAR(36) | 上传人 | 逻辑关联 `users.id` |
| `createdAt` | TIMESTAMP | 上传时间 | |

### 8. `versionHistory` (实验版本历史审计表)

防篡改核心，对应前端的 `VersionHistory`，每次保存时写入完整快照 (Snapshot)。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 版本历史标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 关联实验ID | 逻辑关联 `experiments.id` |
| `versionNumber`| INT | 当前版本号序列 | |
| `changeSummary`| VARCHAR(255) | 变更摘要说明 | |
| `snapshot` | JSONB | JSON深拷贝序列化的完整快照 (含 dataMatrix) | |
| `updatedBy` | VARCHAR(36) | 操作人 | 逻辑关联 `users.id` |
| `updatedAt` | TIMESTAMP | 发生时间 | |

---

## 二、 业务实验数据表 (Battery / Lab Data Models)

为了应对电芯不同工序流转中产生的高度专业化结构数据，以下梳理了 7 张具体的实验解析表。设计上将时间序列表（如日历寿命、胀气）从宽表拍平为**纵向高维表 (Vertical Tables)**，极大提升关系型数据库（如 PostgreSQL/MySQL）的检索与扩展效率。

### 9. `processData` (制程数据表)

记录电芯出厂前各阶段的基础工艺参数（如重量、厚度、极耳长度等）。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cellId` | VARCHAR(64) | 电芯唯一编码 (batteryId) | |
| `m0`, `m1`, `m2` | DECIMAL | 化成前等重量阶段测量参数 | |
| `v0`, `v1` | DECIMAL | 各阶段电压参数 (V0, V1) | |
| `fu0`, `fr0` | DECIMAL | 化成前工序电压与内阻 | |
| `fq1`, `fq2` | DECIMAL | 化成阶段容量参数 | |
| `fu1`, `fr1`, `fu2`, `fr2` | DECIMAL | 化成中后段电压与内阻 | |
| `m3`, `m4` | DECIMAL | 注液/二封后重量阶段参数 | |
| `gu0`, `gr0` | DECIMAL | 分容前电压与内阻 | |
| `gqc1`, `gqd1`, `gqc2` | DECIMAL | 分容段充电、放电容量参数 | |
| `gu1`, `gr1` | DECIMAL | 分容后出货电压与内阻 | |
| `picked` | BOOLEAN | 是否被筛选选中 (良品判定) | |
| `createdAt` | TIMESTAMP | 记录解析时间 | |

### 10. `calendarLife` (日历寿命数据表)

记录电芯在特定时间节点（0d, 7d, 14d 等）下的多维指标。动态解析横向表头生成对应天数的字段。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cellName` | VARCHAR(64) | 电芯唯一编码 | |
| `isHorizontal`| BOOLEAN | 标记是否为横向铺开的数据 | |
| `dayCount` | INT | 测量天数 (0, 7, 14, 21, 28, 35, 42 等) | 通过动态字段如 q_0d 拍平 |
| `q` | DECIMAL | 测量容量 (如 q_0d, q_7d) | |
| `dq` | DECIMAL | 相比首圈损失/残余容量差 (dq_7d) | |
| `ddcr` | DECIMAL | 放电直流内阻 (ddcr_0d, ddcr_7d) | |
| `cdcr` | DECIMAL | 充电直流内阻 (cdcr_0d, cdcr_7d) | |
| `u` | DECIMAL | 测量电压 (u_0d, u_7d) | |
| `r` | DECIMAL | 测量交流内阻 (r_0d, r_7d) | |
| `createdAt` | TIMESTAMP | | |
**内置计算逻辑 (Post-processing fallback)**：

1. **缺失 0d 容量补齐**: 如果 `q_0d` 缺失（为0），向后寻找第一个有值的 `q_Xd` 覆盖作为基准。
2. **DCR 互补**: `ddcr_Xd` 与 `cdcr_Xd` 如果其中一方为0，则互相拷贝备份；
3. **初始内阻与电压容错**: 如果 `r_0d` 或 `u_0d` 为0，向后拷贝 `r_Xd`、`u_Xd` 作为初值。
4. **损失率计算**: 如果 `dq_Xd` 缺失，依据 `((q_Xd - q_0d) / q_0d) * 100` 自动计算补偿。

### 11. `storageSwelling` (60℃存储胀气数据表)

监测高温存储周期内的电芯气胀体积膨胀率，同日历寿命类似提取。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cellName` | VARCHAR(64) | 电芯唯一编码 | |
| `qd1st` | DECIMAL | 首圈/初始参考容量 (qd_1st) | |
| `dayCount` | INT | 存储测量天数 | |
| `v` | DECIMAL | 该时间点的气胀体积 (如 v_0d, v_7d) | |
| `createdAt` | TIMESTAMP | | |

### 12. `energyEfficiency` (能效数据表)

测算充放电能量转化效率 (Energy Efficiency)。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cellName` | VARCHAR(64) | 电芯唯一编码 | |
| `de` | DECIMAL | 放电能量 (Discharge Energy) | |
| `ce` | DECIMAL | 充电能量 (Charge Energy) | |
| `notes` | VARCHAR(255) | 异常备注说明 | |
| `createdAt` | TIMESTAMP | | |

### 13. `dcrTest` (4C DCR 直流内阻数据表)

记录高倍率脉冲下的电压与电流降维响应。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cellName` | VARCHAR(64) | 电芯唯一编码 | |
| `q0` | DECIMAL | 测试 SOC 点前容量 | |
| `du0`, `du1` | DECIMAL | 放电脉冲前电压，放电脉冲后电压| |
| `di` | DECIMAL | 放电脉冲电流 | |
| `cu0`, `cu1` | DECIMAL | 充电脉冲前电压，充电脉冲后电压| |
| `ci` | DECIMAL | 充电脉冲电流 | |
| `createdAt` | TIMESTAMP | | |

### 14. `fastCharge` (快充时间工步表)

记录阶梯式快充各个恒流阶梯段 (Step) 的具体耗时与参数，具有父子层次。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cellName` | VARCHAR(64) | 电芯唯一编码 | |
| `c0` | DECIMAL | 标称容量 (通常 3.0 或自定义)| |
| `providedFastChargeTime` | DECIMAL | 解析出的实际快充时间总计 (Min)| |
| `steps` | JSONB | 存放数组：`[{ stepNo, rate, cutOffVoltage, current, stepCapacity, stepTime }]` | 横向结构折叠 |
| `createdAt` | TIMESTAMP | | |

### 15. `htCycle` (高温循环数据表)

长周期衰减验证数据（以循环周次为时间轴，反转拍平为按 cycleNo 组织的行，列为各电芯容量）。
| 字段名 | 类型 | 说明 | 约束 / 逻辑关联 |
|:---|:---|:---|:---|
| `id` | VARCHAR(36) | 数据行标识 | **主键 (PK)** |
| `experimentId`| VARCHAR(36) | 归属批次/实验ID | 逻辑关联 `experiments.id` |
| `cycle` | INT | 循环周次 (如 100, 200...) | **检索键** |
| `caps` | JSONB | 数据字典。键为 `batteryId`，值为容量；键为 `batteryId_ret` 值为保持率 (如 `{"A001": 2.15, "A001_ret": 99.5}`) | |
| `createdAt` | TIMESTAMP | | |

---

## 三、 完整后端 API 接口目录 (API Endpoints)

建议采用标准化 RESTful 设计，统一定义 `/api/v1/` 为前缀。所有非公开接口需在 HTTP Header 中携带 `Authorization: Bearer <JWT_TOKEN>`。

### 3.1 身份与权限控制体系 (Authentication & IAM)

| Method | Endpoint             | Description      | 核心逻辑                          |
| :----- | :------------------- | :--------------- | :-------------------------------- |
| POST   | `/api/v1/auth/login` | 用户登录         | 返回 JWT Token 及角色。           |
| GET    | `/api/v1/users/me`   | 获取当前用户信息 | 返回基础信息和菜单权限。          |
| GET    | `/api/v1/roles`      | 获取系统角色矩阵 | 供 Admin 配置全局接口及操作许可。 |

### 3.2 课题与实验室管理 (Projects Management)

| Method | Endpoint                       | Description  | 核心逻辑                                                         |
| :----- | :----------------------------- | :----------- | :--------------------------------------------------------------- |
| GET    | `/api/v1/projects`             | 列表查询课题 | 根据用户可见权限返回项目。                                       |
| POST   | `/api/v1/projects`             | 创建新课题   | 落库 `projects` 并写入创建者。                                   |
| PUT    | `/api/v1/projects/:id/members` | 调整项目成员 | 批量 UPSERT `experimentCollaborators` 分配项目内的所有实验权限。 |

### 3.3 实验记录本与数据管理 (Experiments)

| Method | Endpoint                         | Description          | 核心逻辑                                    |
| :----- | :------------------------------- | :------------------- | :------------------------------------------ |
| GET    | `/api/v1/experiments/:id`        | 获取实验详请与数据   | 查询 `experiments` 及关联的 `attachments`。 |
| PUT    | `/api/v1/experiments/:id`        | 暂存编辑 (Auto-save) | 验证 `versionNo`，并发保护机制。            |
| POST   | `/api/v1/experiments/:id/submit` | 提交复核 (Review)    | 锁定实验并更新 `status`。                   |

### 3.4 科学数据解析管道 (Data ETL)

| Method | Endpoint                    | Description        | 核心逻辑                                                              |
| :----- | :-------------------------- | :----------------- | :-------------------------------------------------------------------- |
| POST   | `/api/v1/data/upload`       | 批量导入 Excel     | 在后端解析并分类插入至 `processData`, `calendarLife`, 等 7 张业务表。 |
| GET    | `/api/v1/data/:type/:expId` | 查询特定业务表数据 | `type` 支持 process/calendar/swelling 等，返回该实验对应的行集合。    |

### 3.5 AI 中台引擎 (AI Gateway)

| Method | Endpoint                       | Description         | 核心逻辑                                             |
| :----- | :----------------------------- | :------------------ | :--------------------------------------------------- |
| POST   | `/api/v1/ai/analyze-data`      | 自动化数据统计/拟合 | 调用 Python 数据服务进行异常点计算、标准曲线拟合。   |
| POST   | `/api/v1/ai/generate-insights` | 大模型洞察结论生成  | 调用 Gemini/OpenAI 生成洞察并通过 SSE 流式推给前端。 |
