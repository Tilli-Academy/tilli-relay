import { ChevronRightIcon, ChevronDownIcon, TrashIcon, UnlinkIcon, FolderIcon, PlusIcon, DownloadIcon } from "@/components/Icons";
import { MethodBadge } from "@/components/Sidebar/MethodBadge";
import { RequestInput } from "@/components/Sidebar/RequestInput";
import type { SavedRequest, CollectionWithRequests } from "@/lib/workspaceTypes";

export interface CollectionNodeProps {
  col: CollectionWithRequests;
  depth: number;
  expanded: boolean;
  activeRequestId: string | null;
  addingRequest: boolean;
  onToggle: () => void;
  onAddRequest: () => void;
  onCancelAddRequest: () => void;
  onSubmitAddRequest: (name: string, method: string, url: string) => void;
  onDelete: () => void;
  onExport: (format: "postman" | "shell") => void;
  onLoadRequest: (req: SavedRequest) => void;
  onRemoveFromCollection: (collectionId: string, requestId: string) => void;
  canWrite?: boolean;
}

export function CollectionNode({
  col,
  depth,
  expanded,
  activeRequestId,
  addingRequest,
  onToggle,
  onAddRequest,
  onCancelAddRequest,
  onSubmitAddRequest,
  onDelete,
  onExport,
  onLoadRequest,
  onRemoveFromCollection,
  canWrite = true,
}: CollectionNodeProps) {
  const ml = depth * 12;
  return (
    <div style={{ marginLeft: ml }}>
      <div className="group/col flex items-center rounded transition-colors hover:bg-surface-secondary">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-xs text-content-secondary">
          <span className="shrink-0 text-content-muted">
            {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          </span>
          <FolderIcon size={12} className="shrink-0 text-tilli/70" />
          <span className="truncate">{col.name}</span>
          <span className="ml-auto shrink-0 text-[10px] text-content-dim">{col.requests.length}</span>
        </button>
        {canWrite && (
          <button onClick={onAddRequest} title="Add request" className="shrink-0 px-1 py-1 text-content-dim opacity-0 transition-all hover:text-tilli-light group-hover/col:opacity-100">
            <PlusIcon size={12} />
          </button>
        )}
        <button onClick={() => onExport("postman")} title="Export as Postman JSON" className="shrink-0 px-1 py-1 text-content-dim opacity-0 transition-all hover:text-tilli-light group-hover/col:opacity-100">
          <DownloadIcon size={12} />
        </button>
        {canWrite && (
          <button onClick={onDelete} title="Delete collection" className="shrink-0 pr-2 py-1 text-content-dim opacity-0 transition-all hover:text-red-400 group-hover/col:opacity-100">
            <TrashIcon size={12} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="ml-3">
          {addingRequest && (
            <RequestInput onSubmit={onSubmitAddRequest} onCancel={onCancelAddRequest} />
          )}
          {col.requests.length === 0 && !addingRequest ? (
            <p className="px-2 py-1 text-[10px] text-content-dim">No requests</p>
          ) : (
            col.requests.map((cr) => (
              <div
                key={cr.id}
                className={`group flex items-center rounded transition-colors ${
                  activeRequestId === cr.request.id
                    ? "bg-surface-secondary text-tilli-light"
                    : "text-content-tertiary hover:bg-surface-tertiary hover:text-content-primary"
                }`}
              >
                <button onClick={() => onLoadRequest(cr.request)} className="flex min-w-0 flex-1 items-center truncate px-2 py-1 text-left text-xs">
                  <MethodBadge curl={cr.request.curl} />
                  <span className="truncate">{cr.request.name}</span>
                </button>
                {canWrite && (
                  <button
                    onClick={() => onRemoveFromCollection(col.id, cr.request.id)}
                    title="Remove from collection (request is kept under Requests)"
                    className="hidden shrink-0 items-center pr-2 text-content-dim transition-colors hover:text-orange-400 group-hover:flex"
                  >
                    <UnlinkIcon size={10} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
