export interface SavedRequest {
  id: string;
  name: string;
  curl: string;
}

export interface CollectionWithRequests {
  id: string;
  name: string;
  folderId: string | null;
  requests: Array<{
    id: string;
    request: SavedRequest;
  }>;
}

export interface Folder {
  id: string;
  name: string;
  collections: CollectionWithRequests[];
}
