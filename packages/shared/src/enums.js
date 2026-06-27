"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_DATA_TYPES = exports.DataType = exports.InventoryStatus = exports.ProjectStatus = exports.ExperimentStatus = exports.RoleName = void 0;
exports.isDataType = isDataType;
var RoleName;
(function (RoleName) {
    RoleName["Owner"] = "Owner";
    RoleName["Admin"] = "Admin";
    RoleName["Editor"] = "Editor";
    RoleName["Viewer"] = "Viewer";
})(RoleName || (exports.RoleName = RoleName = {}));
var ExperimentStatus;
(function (ExperimentStatus) {
    ExperimentStatus["Draft"] = "Draft";
    ExperimentStatus["InReview"] = "In Review";
    ExperimentStatus["Approved"] = "Approved";
    ExperimentStatus["Archived"] = "Archived";
})(ExperimentStatus || (exports.ExperimentStatus = ExperimentStatus = {}));
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["Active"] = "Active";
    ProjectStatus["Archived"] = "Archived";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
var InventoryStatus;
(function (InventoryStatus) {
    InventoryStatus["InStock"] = "In Stock";
    InventoryStatus["LowStock"] = "Low Stock";
    InventoryStatus["OutOfStock"] = "Out of Stock";
})(InventoryStatus || (exports.InventoryStatus = InventoryStatus = {}));
var DataType;
(function (DataType) {
    DataType["Process"] = "process";
    DataType["Calendar"] = "calendar";
    DataType["Swelling"] = "swelling";
    DataType["Efficiency"] = "efficiency";
    DataType["Dcr"] = "dcr";
    DataType["FastCharge"] = "fastcharge";
    DataType["HtCycle"] = "htcycle";
})(DataType || (exports.DataType = DataType = {}));
exports.ALL_DATA_TYPES = [
    DataType.Process,
    DataType.Calendar,
    DataType.Swelling,
    DataType.Efficiency,
    DataType.Dcr,
    DataType.FastCharge,
    DataType.HtCycle,
];
function isDataType(value) {
    return exports.ALL_DATA_TYPES.includes(value);
}
//# sourceMappingURL=enums.js.map