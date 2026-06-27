export declare enum RoleName {
    Owner = "Owner",
    Admin = "Admin",
    Editor = "Editor",
    Viewer = "Viewer"
}
export declare enum ExperimentStatus {
    Draft = "Draft",
    InReview = "In Review",
    Approved = "Approved",
    Archived = "Archived"
}
export declare enum ProjectStatus {
    Active = "Active",
    Archived = "Archived"
}
export declare enum InventoryStatus {
    InStock = "In Stock",
    LowStock = "Low Stock",
    OutOfStock = "Out of Stock"
}
export declare enum DataType {
    Process = "process",
    Calendar = "calendar",
    Swelling = "swelling",
    Efficiency = "efficiency",
    Dcr = "dcr",
    FastCharge = "fastcharge",
    HtCycle = "htcycle"
}
export declare const ALL_DATA_TYPES: DataType[];
export declare function isDataType(value: string): value is DataType;
