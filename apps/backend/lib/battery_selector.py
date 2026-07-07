"""
把《挑电池规则-含优先级.docx》里的逻辑转换成 Python。

整体流程对应文档里的两大步：
1. 先按首次放电容量 QD1st 做异常值剔除：
   计算 z = (x - 均值) / 标准差，删除 abs(z) >= 2 的电池。
2. 再从剩余电池里按优先级挑选一致性最好的分组：
   高温循环 -> 4C DCR & 能效 -> 日历寿命 -> 60℃存储胀气 -> 快充时间。

一致性怎么判断：
- 先把 QD1st、GR1、FVG、KU 四个指标用全局 min/max 归一化到 0~1。
- 对一个候选子集，分别计算四个指标的极差 max - min。
- 四个极差相加，得到 score。score 越小，说明这一组越集中、一致性越好。
- 如果 score 相同，依次比较：最大单项极差、极差方差、原始行顺序。

这个文件只用 Python 标准库，不依赖 pandas/openpyxl。
可以在其他程序里 import，也可以直接处理 CSV：

    python battery_selector.py input.csv --output selected.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from typing import Any, Iterable


# 文档规定的四个一致性指标：
# QD1st = 首次放电容量；GR1 = 定容后内阻；FVG = 化成产气量；KU = 老化电压降。
DEFAULT_METRIC_COLUMNS = ("QD1st", "GR1", "FVG", "KU")

# 文档规定的挑选优先级。程序会按这个顺序一轮一轮挑，
# 前面分出去的电池会从候选池移除，不再参加后面的分组。
DEFAULT_GROUPS = (
    ("高温循环", 5),
    ("4C DCR & 能效", 3),
    ("日历寿命", 3),
    ("60℃存储胀气", 3),
    ("快充时间", 3),
)


@dataclass(frozen=True)
class GroupRule:
    """一个测试分组规则：分组名称 + 需要几支电池。"""

    name: str
    size: int


@dataclass(frozen=True)
class CandidateScore:
    """一个候选子集的评分结果，用来比较哪一组电池更一致。"""

    # 四个指标归一化极差之和；最重要，越小越好。
    score: float
    # 四个指标里最大的那个极差；用于 score 相同时打破平局。
    max_range: float
    # 四个极差的方差；用于进一步打破平局，越小说明四个指标更均衡。
    range_variance: float
    # 原始行号之和；最后兜底，保证每次运行结果可重复。
    original_order_sum: int

    def as_sort_key(self) -> tuple[float, float, float, int]:
        # Python 的 tuple 会按顺序比较，所以这里正好对应文档里的平局规则：
        # score -> 最大极差 -> 极差方差 -> 原始顺序。
        return (
            round(self.score, 12),
            round(self.max_range, 12),
            round(self.range_variance, 12),
            self.original_order_sum,
        )


def parse_group_rules(raw: str | None) -> list[GroupRule]:
    """
    解析外部传入的分组规则。

    如果不传，就使用文档里的默认优先级和数量。
    命令行传入 JSON 的例子：
        [["高温循环", 5], ["4C DCR & 能效", 3]]
    """

    if not raw:
        return [GroupRule(name, size) for name, size in DEFAULT_GROUPS]

    data = json.loads(raw)
    rules: list[GroupRule] = []
    for item in data:
        if not isinstance(item, list) or len(item) != 2:
            raise ValueError("Each group rule must be a [name, size] pair.")
        name, size = item
        rules.append(GroupRule(str(name), int(size)))
    return rules


def to_float(value: Any, column: str, row_number: int) -> float:
    """把单元格转成数字；不能转时给出具体行列，方便定位数据问题。"""

    if value is None or str(value).strip() == "":
        raise ValueError(f"Row {row_number}: column {column!r} is empty.")
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Row {row_number}: column {column!r} value {value!r} is not numeric."
        ) from exc


def prepare_records(
    rows: Iterable[dict[str, Any]],
    *,
    id_column: str,
    metric_columns: Iterable[str],
) -> list[dict[str, Any]]:
    """
    检查输入数据，并加上程序内部要用的字段。

    这里主要做三件事：
    1. 检查样品 ID 是否为空、是否重复。
    2. 检查四个指标列是否存在，并转成 float。
    3. 记录原始顺序 _original_order，后面平局时要用。
    """

    metrics = tuple(metric_columns)
    prepared: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for zero_based_index, row in enumerate(rows):
        # CSV 第 1 行是表头，所以数据行号从 2 开始，报错信息会更贴近表格。
        row_number = zero_based_index + 2
        if id_column not in row:
            raise ValueError(f"Missing ID column {id_column!r}.")

        sample_id = str(row[id_column]).strip()
        if not sample_id:
            raise ValueError(f"Row {row_number}: ID column {id_column!r} is empty.")
        if sample_id in seen_ids:
            raise ValueError(f"Row {row_number}: duplicated sample ID {sample_id!r}.")
        seen_ids.add(sample_id)

        record = dict(row)
        record[id_column] = sample_id
        record["_original_order"] = zero_based_index
        record["_removed_reason"] = ""
        for col in metrics:
            if col not in row:
                raise ValueError(f"Missing metric column {col!r}.")
            record[col] = to_float(row[col], col, row_number)
        prepared.append(record)

    return prepared


def remove_capacity_outliers(
    records: list[dict[str, Any]],
    *,
    capacity_column: str = "QD1st",
    z_threshold: float = 2.0,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    第一步：按 QD1st 的 z-score 剔除容量异常值。

    文档公式：z = (x - μ) / σ。
    因为文档没有写样本标准差修正，所以这里用总体标准差：
    variance = sum((x - mean)^2) / N。
    """

    if not records:
        return [], []

    # 只用首次放电容量 QD1st 做异常值判断，其他指标不参与这一步。
    values = [float(row[capacity_column]) for row in records]
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    std = math.sqrt(variance)

    kept: list[dict[str, Any]] = []
    removed: list[dict[str, Any]] = []

    for row, value in zip(records, values):
        copied = dict(row)
        # 如果所有容量完全相同，标准差为 0，此时没有异常值，z 记为 0。
        z_score = 0.0 if std == 0 else (value - mean) / std
        copied["capacity_z_score"] = z_score
        if abs(z_score) >= z_threshold:
            copied["_removed_reason"] = f"{capacity_column} abs(z) >= {z_threshold:g}"
            removed.append(copied)
        else:
            kept.append(copied)

    return kept, removed


def normalize_global(
    records: list[dict[str, Any]], metric_columns: Iterable[str]
) -> dict[str, dict[str, float]]:
    """
    第二步前置：用全体候选样品的 min/max 做归一化。

    注意：文档强调不能每轮重新算 min/max。
    所以这里在分组开始前一次性算好，后面所有轮次都共用同一套归一化结果。

    如果某个指标所有值都一样，说明它对区分样品没有贡献，统一记为 0。
    """

    metrics = tuple(metric_columns)
    bounds: dict[str, tuple[float, float]] = {}
    for col in metrics:
        values = [float(row[col]) for row in records]
        # 保存每个指标在全体候选样品中的全局最小值和最大值。
        bounds[col] = (min(values), max(values))

    normalized: dict[str, dict[str, float]] = {}
    for row in records:
        sample_key = str(row["_sample_key"])
        normalized[sample_key] = {}
        for col in metrics:
            min_value, max_value = bounds[col]
            if max_value == min_value:
                normalized[sample_key][col] = 0.0
            else:
                # min-max 归一化公式：(x - min) / (max - min)。
                normalized[sample_key][col] = (
                    (float(row[col]) - min_value) / (max_value - min_value)
                )
    return normalized


def score_subset(
    subset_keys: tuple[str, ...],
    normalized: dict[str, dict[str, float]],
    metric_columns: Iterable[str],
    order_by_key: dict[str, int],
) -> CandidateScore:
    """计算一个候选子集的一致性得分和平局比较指标。"""

    ranges: list[float] = []
    for col in metric_columns:
        values = [normalized[key][col] for key in subset_keys]
        # 某个指标在这个子集里的极差，越小说明这一组在该指标上越一致。
        ranges.append(max(values) - min(values))

    # 文档里的 score(S) = R_A(S) + R_B(S) + R_C(S) + R_D(S)。
    score = sum(ranges)
    max_range = max(ranges) if ranges else 0.0
    mean_range = score / len(ranges) if ranges else 0.0
    range_variance = (
        sum((value - mean_range) ** 2 for value in ranges) / len(ranges)
        if ranges
        else 0.0
    )
    # 原始顺序之和只是最后的确定性规则，不代表业务优劣。
    original_order_sum = sum(order_by_key[key] for key in subset_keys)
    return CandidateScore(score, max_range, range_variance, original_order_sum)


def select_best_subset(
    available_keys: list[str],
    *,
    normalized: dict[str, dict[str, float]],
    metric_columns: Iterable[str],
    order_by_key: dict[str, int],
    size: int,
) -> tuple[list[str], CandidateScore]:
    """枚举所有可能组合，挑出一致性最好的一组。"""

    if size <= 0:
        raise ValueError("Group size must be positive.")
    if len(available_keys) < size:
        raise ValueError(
            f"Need {size} available samples, but only {len(available_keys)} remain."
        )

    best_subset: tuple[str, ...] | None = None
    best_score: CandidateScore | None = None

    # combinations 会生成“从剩余电池中任选 size 支”的所有组合。
    # 例如 20 支里选 5 支，会把 C(20, 5) 种组合都算一遍。
    for subset in combinations(available_keys, size):
        current_score = score_subset(
            subset, normalized, metric_columns, order_by_key
        )
        current_key = current_score.as_sort_key()
        # tuple 越小，代表越符合规则：score 更小、平局项也更优。
        if best_score is None or current_key < best_score.as_sort_key():
            best_subset = subset
            best_score = current_score

    assert best_subset is not None
    assert best_score is not None
    return list(best_subset), best_score


def select_batteries(
    rows: Iterable[dict[str, Any]],
    *,
    id_column: str = "ID",
    metric_columns: Iterable[str] = DEFAULT_METRIC_COLUMNS,
    groups: Iterable[GroupRule] | None = None,
    remove_outliers: bool = True,
    min_required_count: int | None = 17,
    z_threshold: float = 2.0,
) -> dict[str, Any]:
    """
    主函数：运行完整挑电池流程。

    传入 rows 后，会依次完成：
    1. 数据检查。
    2. 可选容量异常值剔除。
    3. 全局归一化。
    4. 按优先级逐轮枚举并挑出最优子集。

    返回结构：
        {
            "assignments": 每支被选中电池的明细,
            "groups": 每个测试分组的汇总,
            "removed": 被容量异常值规则剔除的电池,
            "remaining": 分组后剩余但未使用的电池,
            "warnings": 需要人工关注的提示
        }
    """

    metrics = tuple(metric_columns)
    group_rules = list(groups) if groups is not None else parse_group_rules(None)
    # 所有分组一共要多少支电池，默认是 5 + 3 + 3 + 3 + 3 = 17。
    required_total = sum(rule.size for rule in group_rules)
    if min_required_count is None:
        min_required_count = required_total

    prepared = prepare_records(rows, id_column=id_column, metric_columns=metrics)
    for idx, row in enumerate(prepared):
        # 内部 key 不直接用样品 ID，是为了避免后面修改输出列名时影响程序逻辑。
        row["_sample_key"] = f"row-{idx}"

    if remove_outliers:
        # 文档里的“第一步”；如业务确认要跳过，可用 --skip-outlier-removal。
        candidate_pool, removed = remove_capacity_outliers(
            prepared, capacity_column=metrics[0], z_threshold=z_threshold
        )
    else:
        candidate_pool = [dict(row) for row in prepared]
        removed = []

    warnings: list[str] = []
    if len(candidate_pool) < min_required_count:
        # 文档说明：剔除后少于实验所需数量时，需要人工判断。
        warnings.append(
            "Outlier removal left fewer samples than the required count; "
            "manual decision is needed: reduce required count or wait for more batteries."
        )
    if len(candidate_pool) < required_total:
        raise ValueError(
            f"Need {required_total} samples for configured groups, "
            f"but only {len(candidate_pool)} are available."
        )

    # 归一化只做一次，后面每轮分组都共用这份 normalized。
    normalized = normalize_global(candidate_pool, metrics)
    available_keys = [str(row["_sample_key"]) for row in candidate_pool]
    record_by_key = {str(row["_sample_key"]): row for row in candidate_pool}
    order_by_key = {
        str(row["_sample_key"]): int(row["_original_order"]) for row in candidate_pool
    }

    assignments: list[dict[str, Any]] = []
    group_summaries: list[dict[str, Any]] = []

    for rule in group_rules:
        # 按优先级处理一个分组：从“当前剩余电池”中选出最优组合。
        selected_keys, selected_score = select_best_subset(
            available_keys,
            normalized=normalized,
            metric_columns=metrics,
            order_by_key=order_by_key,
            size=rule.size,
        )
        selected_set = set(selected_keys)
        # 被本轮选中的电池移出候选池，不能被后面的测试组重复使用。
        available_keys = [key for key in available_keys if key not in selected_set]

        sample_ids = [str(record_by_key[key][id_column]) for key in selected_keys]
        group_summaries.append(
            {
                "group": rule.name,
                "sample_ids": sample_ids,
                "score": selected_score.score,
                "max_range": selected_score.max_range,
                "range_variance": selected_score.range_variance,
            }
        )

        for key in selected_keys:
            row = record_by_key[key]
            # assignments 是“逐支电池明细”，方便导出 CSV 给人工检查。
            output_row = {
                "group": rule.name,
                "sample_id": row[id_column],
                "score": selected_score.score,
                "max_range": selected_score.max_range,
                "range_variance": selected_score.range_variance,
            }
            for col in metrics:
                output_row[col] = row[col]
                # 同时输出归一化后的值，方便解释为什么这几支被选中。
                output_row[f"{col}_norm"] = normalized[key][col]
            assignments.append(output_row)

    remaining = [
        {id_column: record_by_key[key][id_column], **{col: record_by_key[key][col] for col in metrics}}
        for key in available_keys
    ]

    return {
        "assignments": assignments,
        "groups": group_summaries,
        "removed": removed,
        "remaining": remaining,
        "warnings": warnings,
    }


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    """读取 CSV；utf-8-sig 可以兼容 Excel 导出的 UTF-8 BOM 文件。"""

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_assignments_csv(path: Path, assignments: list[dict[str, Any]]) -> None:
    """把最终选中的电池明细写成 CSV。"""

    if assignments:
        fieldnames = list(assignments[0].keys())
    else:
        fieldnames = ["group", "sample_id"]

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(assignments)


def build_arg_parser() -> argparse.ArgumentParser:
    """定义命令行参数；不影响 import 使用。"""

    parser = argparse.ArgumentParser(
        description=(
            "按《挑电池规则-含优先级.docx》挑选电池。"
            "输入文件必须是 CSV，至少包含 ID,QD1st,GR1,FVG,KU 五列。"
        )
    )
    parser.add_argument(
        "input",
        type=Path,
        nargs="?",
        help="待挑选电池数据 CSV，例如 battery_data.csv。",
    )
    parser.add_argument(
        "--make-template",
        type=Path,
        help="生成一个 CSV 输入模板，例如 --make-template battery_template.csv。",
    )
    parser.add_argument("--output", type=Path, help="Output selected assignment CSV.")
    parser.add_argument("--id-column", default="ID", help="Sample ID column name.")
    parser.add_argument(
        "--metrics",
        default=",".join(DEFAULT_METRIC_COLUMNS),
        help="Metric columns in order: capacity, resistance, gas, voltage drop.",
    )
    parser.add_argument(
        "--groups",
        help='JSON group rules, for example: [["高温循环",5],["日历寿命",3]]',
    )
    parser.add_argument(
        "--skip-outlier-removal",
        action="store_true",
        help="Skip QD1st z-score outlier removal.",
    )
    parser.add_argument(
        "--z-threshold",
        type=float,
        default=2.0,
        help="Remove capacity outliers when abs(z) >= this value.",
    )
    parser.add_argument(
        "--min-required-count",
        type=int,
        default=17,
        help="Warn when post-filter sample count is lower than this number.",
    )
    return parser


def write_input_template(path: Path) -> None:
    """生成一个给用户填写的输入 CSV 模板。"""

    fieldnames = ["ID", *DEFAULT_METRIC_COLUMNS]
    demo_rows = [
        {"ID": "S01", "QD1st": "", "GR1": "", "FVG": "", "KU": ""},
        {"ID": "S02", "QD1st": "", "GR1": "", "FVG": "", "KU": ""},
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(demo_rows)


def main() -> None:
    """命令行入口：读 CSV -> 调用 select_batteries -> 打印/导出结果。"""

    parser = build_arg_parser()
    args = parser.parse_args()

    if args.make_template:
        write_input_template(args.make_template)
        print(f"已生成输入模板：{args.make_template}")
        return

    if args.input is None:
        parser.print_help()
        print(
            "\n需要先准备一份电池数据 CSV。至少包含这些列："
            "ID,QD1st,GR1,FVG,KU。\n"
            "可以先运行：python battery_selector.py --make-template battery_template.csv"
        )
        return

    rows = read_csv_rows(args.input)
    metrics = tuple(col.strip() for col in args.metrics.split(",") if col.strip())
    result = select_batteries(
        rows,
        id_column=args.id_column,
        metric_columns=metrics,
        groups=parse_group_rules(args.groups),
        remove_outliers=not args.skip_outlier_removal,
        min_required_count=args.min_required_count,
        z_threshold=args.z_threshold,
    )

    if args.output:
        write_assignments_csv(args.output, result["assignments"])

    print(json.dumps(result["groups"], ensure_ascii=False, indent=2))
    if result["warnings"]:
        print("WARNINGS:")
        for warning in result["warnings"]:
            print(f"- {warning}")
    if result["removed"]:
        print("REMOVED:")
        for row in result["removed"]:
            print(f"- {row[args.id_column]}: {row['_removed_reason']}")


if __name__ == "__main__":
    main()
