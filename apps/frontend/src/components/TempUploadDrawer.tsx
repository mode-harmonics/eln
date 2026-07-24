import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Download, Trash2, FileIcon, Loader2, CloudUpload } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { toast } from "./Toast";
import { cn } from "../lib/utils";

interface TempFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface TempUploadDrawerProps {
  open: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileRow({ file, onDelete }: { file: TempFile; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDownload = () => {
    const token = localStorage.getItem("token");
    const a = document.createElement("a");
    a.href = `/api/v1/temp-files/${file.id}/download`;
    // Attach auth via a temp fetch to get a blob URL
    fetch(`/api/v1/temp-files/${file.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("下载失败"));
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/temp-files/${file.id}`);
      onDelete(file.id);
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 px-4 group hover:bg-gray-50 rounded-lg transition-colors">
      <div className="w-8 h-8 rounded-lg bg-action-subtle flex items-center justify-center shrink-0">
        <FileIcon className="w-4 h-4 text-action" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
      </div>
      <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          aria-label={`下载 ${file.name}`}
          onClick={handleDownload}
          className="p-1.5 rounded-md text-gray-400 hover:text-action hover:bg-action-subtle transition-colors"
          title="下载"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label={`删除 ${file.name}`}
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="删除"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export function TempUploadDrawer({ open, onClose }: TempUploadDrawerProps) {
  const [files, setFiles] = useState<TempFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      const data = await api.get<TempFile[]>("/api/v1/temp-files");
      setFiles(data || []);
    } catch {
      /* ignore */
    }
  }, []);

  // Load file list each time the drawer opens
  useEffect(() => {
    if (open) loadFiles();
  }, [open, loadFiles]);

  const uploadFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    setLoading(true);
    const form = new FormData();
    fileList.forEach((f) => form.append("files", f));
    try {
      const added = await api.upload<TempFile[]>("/api/v1/temp-files/upload", form);
      setFiles((prev) => [...(added || []), ...prev]);
      toast.success(`已上传 ${fileList.length} 个文件`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(Array.from(e.target.files || []));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDelete = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div role="dialog" aria-modal="true" aria-labelledby="temp-files-title" className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-action-subtle flex items-center justify-center">
              <CloudUpload className="w-4 h-4 text-action" />
            </div>
            <div>
              <h3 id="temp-files-title" className="text-sm font-semibold text-gray-900">临时文件</h3>
              <p className="text-xs text-gray-400">服务重启后自动清空</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drop zone */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div
            role="button"
            tabIndex={loading ? -1 : 0}
            aria-disabled={loading}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !loading && fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (!loading && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-all",
              dragging
                ? "border-action bg-action-subtle"
                : loading
                ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                : "border-gray-200 hover:border-action hover:bg-action-subtle/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={loading}
            />
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 text-action animate-spin" />
                <p className="text-sm font-medium text-action-muted">上传中...</p>
              </>
            ) : (
              <>
                <Upload className={cn("w-6 h-6 transition-colors", dragging ? "text-action" : "text-gray-300")} />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">点击或拖拽文件到此处</p>
                  <p className="text-xs text-gray-400 mt-0.5">支持任意文件类型，可多选</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <FileIcon className="w-8 h-8 opacity-30" />
              <p className="text-sm">暂无文件</p>
            </div>
          ) : (
            <div className="px-2 py-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1">
                文件列表 ({files.length})
              </p>
              {files.map((file) => (
                <FileRow key={file.id} file={file} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
