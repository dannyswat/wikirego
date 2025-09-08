import { baseApiUrl } from "../../common/baseApi";

export interface UploadDiagramRequest {
  id: string;
  diagram: string;
  svg: string;
  png: string;
}

export interface UploadDiagramResponse {
  id: string;
  diagramSvgUrl: string;
  diagramPngUrl: string;
}

export async function uploadDiagram(
  request: UploadDiagramRequest
): Promise<UploadDiagramResponse> {
  const res = await fetch(baseApiUrl + "/editor/diagram/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error("Failed to upload diagram");
  }
  const data = await res.json();
  return data;
}

export async function uploadImage(
  file: File,
  id: string
): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append("upload", file);
  formData.append("id", id);

  const res = await fetch(baseApiUrl + "/editor/ckeditor/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("Failed to upload image");
  }
  const data = await res.json();
  return { imageUrl: data.url };
}

export async function rebuildThumbnails() {
  const res = await fetch(baseApiUrl + "/editor/ckeditor/upload/regeneratethumbnail", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to rebuild thumbnails");
  }
  return await res.json();
}