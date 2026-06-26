# 电子科研记录系统 (ELN)

这是一个专为现代实验室（涵盖电池研发、生物生化实验等领域）设计的 **电子科研记录系统 (Electronic Lab Notebook, ELN)**。系统提供从基础项目管理、权限控制，到海量实验仪器数据的自动化 Excel 解析提取，并内置了大模型能力，用于智能辅助科学计算与分析。

## 🌟 核心功能特性 (Features)

- **🧪 实验与课题管理 (Project & Experiment Management)**
  - 以课题组 (Project) 为核心的数据组织架构。
  - 标准化电子记录本 (ELN)，支持 Markdown 富文本编辑 SOP、实验目的和结论。
  - 完善的实验状态流转：草稿 (Draft) -> 评审中 (In Review) -> 已批准 (Approved)。

- **📊 动态海量数据中台 (Dynamic Data Matrix Engine)**
  - 告别固定的表头限制，适应各类实验（电化学、微孔板生化分析等）多变的宽表结构。
  - **强大的 Excel 解析引擎**: 支持批量导入多 Sheet 工作簿，支持多级表头自动传播匹配，包括但不限于以下业务表单：
    1. **制程数据** (Process Data)
    2. **日历寿命** (Calendar Life)
    3. **60℃存储胀气** (Storage Swelling)
    4. **能效** (Energy Efficiency)
    5. **4C DCR 直流内阻** (DCR Test)
    6. **快充时间** (Fast Charge)
    7. **高温循环** (High-temp Cycle)

- **🧠 AI 智能科学副手 (AI Scientific Assistant)**
  - 深度集成大语言模型，用于智能辅助科学计算与分析。
  - **标准曲线拟合**: 自动处理数据回归分析计算。
  - **异常值诊断**: 识别变异系数与偏差。

- **🔐 合规与安全审计 (Compliance & Audit)**
  - 严格的 **基于角色的访问控制 (RBAC)** (Owner, Admin, Editor, Viewer)。

## 🛠 技术栈 (Tech Stack)
