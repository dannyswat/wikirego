import { ModataCanvas, useDiagramStore } from "modatatool";
import type { DiagramSchema, ModataCanvasRef } from "modatatool";
import "/node_modules/modatatool/dist/modatatool.css";
import "@xyflow/react/dist/style.css";
import "./DataModelModal.css";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { uploadDataModel } from "./uploadApi";

interface DataModelModalProps {
  dataModelUrl: string;
  onClose: (imageUrl: string, shouldInsert?: boolean) => void;
}

export default function DataModelModal({
  dataModelUrl,
  onClose,
}: DataModelModalProps) {
  const [id, setId] = useState(() =>
    dataModelUrl ? getIdFromDataModelUrl(dataModelUrl) : undefined
  );
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<ModataCanvasRef>(null);

  const { data } = useQuery<DiagramSchema>({
    queryKey: ["datamodel", id],
    queryFn: async () => {
      const res = await fetch(`/api/editor/datamodel/source/${id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch data model");
      }
      return await res.json();
    },
    enabled: !!id,
    staleTime: 0,
  });

  function handleClose() {
    onClose("", false);
  }

  async function handleSave(saveAsNew: boolean = false) {
    const schema = useDiagramStore.getState().toDiagramSchema();
    if (!schema.nodes || schema.nodes.length === 0) return;

    setSaving(true);
    try {
      const blob = await canvasRef.current!.exportPng();
      const pngDataUrl = await blobToDataUrl(blob);
      const schemaJson = JSON.stringify(schema);
      const dataModelId = saveAsNew
        ? crypto.randomUUID()
        : id ?? crypto.randomUUID();

      const result = await uploadDataModel({
        id: dataModelId,
        schema: schemaJson,
        png: pngDataUrl,
      });

      setId(result.id);
      onClose(result.dataModelPngUrl, saveAsNew);
    } catch (error) {
      console.error("Error saving data model:", error);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900 z-[10100]">
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', width: '100%' }}>
        {(data || !id) && (
          <ModataCanvas
            ref={canvasRef}
            data={data}
            persistInLocalStorage={false}
          />
        )}
      </div>
      <div className="p-2 flex-shrink-0">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="ms-3 px-4 py-2 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          Save New
        </button>
        <button
          onClick={handleClose}
          className="ms-3 px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

function getIdFromDataModelUrl(url: string): string {
  const urlWithoutQuery = url.split("?")[0];
  const urlParts = urlWithoutQuery.split("/");
  const id = urlParts[urlParts.length - 1].split(".")[0];
  return id;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
