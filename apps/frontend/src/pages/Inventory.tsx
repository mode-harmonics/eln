import React, { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Pagination } from "../components/Pagination";
import { ViewToggle } from "../components/ViewToggle";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";
import { TextInput, FormSelect } from "../components/FormFields";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/Card";
import { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/Table";
import { cn } from "../lib/utils";
import { useViewMode } from "../hooks/useViewMode";
import { usePermissions } from "../hooks/usePermissions";
import { api, ApiError } from "../lib/api";
import type { InventoryItem } from "../types";
import { Popconfirm } from "../components/Popconfirm";

export function Inventory() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewMode, setViewMode] = useViewMode("inventory_view_mode", "list");

  useEffect(() => {
    fetchInventory();
  }, [currentPage, pageSize, searchQuery]);

  const fetchInventory = () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(currentPage));
    queryParams.append("limit", String(pageSize));
    if (searchQuery.trim()) {
      queryParams.append("search", searchQuery.trim());
    }

    api.get<{ items: any[]; total: number }>(`/api/v1/inventory?${queryParams.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotalItems(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载库存失败"))
      .finally(() => setLoading(false));
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const type = (form.elements.namedItem("type") as HTMLSelectElement).value;
    const quantity = (form.elements.namedItem("quantity") as HTMLInputElement).value;
    const lotNumber = (form.elements.namedItem("lotNumber") as HTMLInputElement).value;
    const purity = (form.elements.namedItem("purity") as HTMLInputElement).value;
    const storageLocation = (form.elements.namedItem("storageLocation") as HTMLInputElement).value;
    const status = (form.elements.namedItem("status") as HTMLSelectElement).value;

    try {
      await api.post("/api/v1/inventory", {
        name,
        type,
        quantity,
        lotNumber,
        purity,
        storageLocation,
        status,
        lastUsedAt: new Date(),
      });
      fetchInventory();
      setIsModalOpen(false);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "添加物品失败");
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const form = e.currentTarget as HTMLFormElement;
    const name = (form.elements.namedItem("edit-name") as HTMLInputElement).value;
    const type = (form.elements.namedItem("edit-type") as HTMLSelectElement).value;
    const quantity = (form.elements.namedItem("edit-quantity") as HTMLInputElement).value;
    const lotNumber = (form.elements.namedItem("edit-lotNumber") as HTMLInputElement).value;
    const purity = (form.elements.namedItem("edit-purity") as HTMLInputElement).value;
    const storageLocation = (form.elements.namedItem("edit-storageLocation") as HTMLInputElement).value;
    const status = (form.elements.namedItem("edit-status") as HTMLSelectElement).value;

    try {
      await api.put(`/api/v1/inventory/${editingItem.id}`, {
        name,
        type,
        quantity,
        lotNumber,
        purity,
        storageLocation,
        status,
      });
      fetchInventory();
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "修改物品失败");
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await api.delete(`/api/v1/inventory/${id}`);
      fetchInventory();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "删除失败");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("inventory")}</h1>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => { setSearchQuery(searchInput); setCurrentPage(1); }}
            placeholder={t("search")}
          />
          <div className="flex items-center gap-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} className="hidden sm:flex" />
            {hasPermission("data:write") && (
              <Button size="sm" onClick={() => setIsModalOpen(true)}>
                {t("add_item")}
              </Button>
            )}
          </div>
        </div>

        {viewMode === "list" ? (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lot / Purity</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  {hasPermission("data:write") && <TableHead className="text-right sticky right-0 z-20 bg-white">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="text-[13px] font-medium text-gray-900">{item.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] text-gray-500">{item.type}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] text-gray-900">{item.lotNumber || "N/A"}</div>
                      <div className="text-[11px] text-gray-500">{item.purity || "N/A"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] text-gray-900">{item.quantity}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] text-gray-500">{item.storageLocation || "N/A"}</div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                        item.status === 'In Stock' ? 'bg-[#f0f9f4] text-[#1e8b4e]' :
                        item.status === 'Low Stock' ? 'bg-[#fff8e6] text-[#b28200]' :
                        'bg-[#fbeef0] text-[#cb202d]'
                      )}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.lastUsedAt ? format(new Date(item.lastUsedAt), "MMM d, yyyy") : "Never"}
                    </TableCell>
                    {hasPermission("data:write") && (
                      <TableCell className="text-right space-x-3 sticky right-0 z-10 bg-white group-hover:bg-gray-50">
                        <Button variant="text" onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }} className="!text-[#1d74f5] hover:!text-blue-700">
                          Edit
                        </Button>
                        <Popconfirm
                          title="确定要删除该物品吗？"
                          onConfirm={() => handleDeleteItem(item.id)}
                        >
                          <Button variant="text" className="!text-red-650 hover:!text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </Popconfirm>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col relative group">
                {hasPermission("data:write") && (
                  <Popconfirm
                    title="确定要删除该物品吗？"
                    onConfirm={() => handleDeleteItem(item.id)}
                    placement="left"
                  >
                    <Button variant="text" className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 !text-gray-400 hover:!text-red-600 z-10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Popconfirm>
                )}
                <CardHeader>
                  <div>
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription>{item.type}</CardDescription>
                  </div>
                  <span className={cn(
                    "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
                    item.status === 'In Stock' ? 'bg-[#f0f9f4] text-[#1e8b4e]' :
                    item.status === 'Low Stock' ? 'bg-[#fff8e6] text-[#b28200]' :
                    'bg-[#fbeef0] text-[#cb202d]'
                  )}>
                    {item.status}
                  </span>
                </CardHeader>

                <CardContent className="grid grid-cols-2 gap-y-4 gap-x-2 mt-2 mb-6">
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Lot / Purity</div>
                    <div className="font-medium text-gray-800">{item.lotNumber || "N/A"} <span className="text-gray-500 font-normal">({item.purity || "N/A"})</span></div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Quantity</div>
                    <div className="font-medium text-gray-800">{item.quantity}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Location</div>
                    <div>{item.storageLocation || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Last Used</div>
                    <div>{item.lastUsedAt ? format(new Date(item.lastUsedAt), "MMM d, yyyy") : "Never"}</div>
                  </div>
                </CardContent>

                {hasPermission("data:write") && (
                  <CardFooter className="justify-end w-full">
                    <Button variant="text" onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }} className="!text-[#1d74f5] hover:!text-blue-700">
                      Edit Item
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        )}
        {totalItems > pageSize && (
        <div className="flex justify-end pt-4 border-t border-gray-100">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Inventory Item"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button size="sm" type="submit" form="modal-inventory-form">Add Item</Button>
          </>
        }>
        <form id="modal-inventory-form" onSubmit={handleAddItem} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Item Name</label>
            <input id="name" type="text" required className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" placeholder="e.g. Lithium Cobalt Oxide" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="type">Type</label>
              <FormSelect id="type" className="w-full">
                <option>Cathode Active Material</option>
                <option>Anode Active Material</option>
                <option>Electrolyte</option>
                <option>Separator</option>
              </FormSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="quantity">Quantity</label>
              <input id="quantity" type="text" required className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" placeholder="e.g. 500g" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lotNumber">Lot Number</label>
              <input id="lotNumber" type="text" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" placeholder="e.g. LOT123" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="purity">Purity</label>
              <input id="purity" type="text" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" placeholder="e.g. 99.9%" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="storageLocation">Storage Location</label>
              <input id="storageLocation" type="text" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" placeholder="e.g. Shelf A4" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="status">Status</label>
              <FormSelect id="status" className="w-full">
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </FormSelect>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={isEditModalOpen && !!editingItem} onClose={() => setIsEditModalOpen(false)} title="Edit Inventory Item"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button size="sm" type="submit" form="modal-inventory-edit-form">Save Changes</Button>
          </>
        }>
        <form id="modal-inventory-edit-form" onSubmit={handleUpdateItem} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-name">Item Name</label>
            <input id="edit-name" type="text" required className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" defaultValue={editingItem?.name} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-type">Type</label>
              <FormSelect id="edit-type" className="w-full" defaultValue={editingItem?.type}>
                <option>Cathode Active Material</option>
                <option>Anode Active Material</option>
                <option>Electrolyte</option>
                <option>Separator</option>
              </FormSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-quantity">Quantity</label>
              <input id="edit-quantity" type="text" required className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" defaultValue={editingItem?.quantity} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-lotNumber">Lot Number</label>
              <input id="edit-lotNumber" type="text" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" defaultValue={editingItem?.lotNumber || ""} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-purity">Purity</label>
              <input id="edit-purity" type="text" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" defaultValue={editingItem?.purity || ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-storageLocation">Storage Location</label>
              <input id="edit-storageLocation" type="text" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors" defaultValue={editingItem?.storageLocation || ""} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-status">Status</label>
              <FormSelect id="edit-status" className="w-full" defaultValue={editingItem?.status}>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </FormSelect>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
