import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  BlockQuote,
  Bold,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  Strikethrough,
  Undo,
  Image,
  ImageUpload,
  SimpleUploadAdapter,
  Table,
  TableProperties,
  TableToolbar,
  FontColor,
  ImageInsert,
  ImageBlock,
  Underline,
  WordCount,
  FontSize,
  TodoList,
  Alignment,
  ImageCaption,
  ImageStyle,
  ImageResize,
  ImageToolbar,
} from "ckeditor5";

import { FullScreen } from "./FullScreenPlugin";
import { Diagram } from "./DiagramPlugin"; // Import the new plugin
import { ImageBrowser } from "./ImageBrowserPlugin"; // Import the image browser plugin
import { SimplePasteCleanup } from "./SimplePasteCleanupPlugin";
import { useRef, useState } from "react";
import DiagramModal from "./DiagramModal";
import ImageBrowserModal from "./ImageBrowserModal";

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export function HtmlEditor({ content, onChange }: Props) {
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isImageBrowserModalOpen, setIsImageBrowserModalOpen] = useState(false);
  const [diagramUrl, setDiagramUrl] = useState<string>();
  const editorRef = useRef<ClassicEditor>();

  return (
    <>
      <CKEditor
        onReady={(editor) => {
          if (!editor) return;
          editorRef.current = editor;
          editor.on("openDiagramModal", (_, args) => {
            setDiagramUrl(args && typeof args === "string" ? args : undefined);
            setIsDiagramModalOpen(true);
          });
          editor.on("openImageBrowserModal", () => {
            setIsImageBrowserModalOpen(true);
          });
        }}
        editor={ClassicEditor}
        data={content}
        config={{
          toolbar: {
            items: [
              "heading",
              "fontSize",
              "|",
              "fontcolor",
              "bold",
              "italic",
              "underline",
              "strikethrough",
              "link",
              "alignment",
              "|",
              "imageUpload",
              "imageBrowser",
              "diagramPlugin",
              "|",
              "bulletedList",
              "numberedList",
              "todoList",
              "|",
              "insertTable",
              "|",
              "blockQuote",
              "code",
              "codeBlock",
              "|",
              "undo",
              "redo",
              "fullScreen",
            ],
            shouldNotGroupWhenFull: true,
          },
          plugins: [
            Essentials,
            Bold,
            Italic,
            Paragraph,
            Undo,
            Underline,
            FontSize,
            Alignment,
            Heading,
            Link,
            List,
            Image,
            ImageUpload,
            BlockQuote,
            WordCount,
            Strikethrough,
            Code,
            CodeBlock,
            SimpleUploadAdapter,
            ImageBlock,
            ImageCaption,
            ImageToolbar,
            Table,
            TableProperties,
            TableToolbar,
            FontColor,
            ImageInsert,
            ImageStyle,
            ImageResize,
            TodoList,
            FullScreen,
            ImageBrowser, // Add the image browser plugin
            Diagram, // Add the plugin to the plugins list
            SimplePasteCleanup, // Add the paste cleanup plugin
          ],
          simpleUpload: {
            uploadUrl: "/api/editor/ckeditor/upload",
            withCredentials: true,
          },
          link: {
            addTargetToExternalLinks: true,
            decorators: {
              openInNewTab: {
                attributes: {
                  target: "_blank",
                },
                label: "Open in a new tab",
                mode: "manual",
              },
            },
          },
          table: {
            contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
          },
          image: {
            resizeUnit: "px",
            toolbar: [
              "imageTextAlternative",
              "|",
              "imageStyle:alignLeft",
              "imageStyle:full",
              "imageStyle:alignRight",
            ],
            styles: {
              options: ["full", "alignLeft", "alignRight"],
            },
          },
          fontColor: {
            colorPicker: {
              format: "hex",
            },
          },
        }}
        onChange={(_, editor) => onChange(editor.data.get())}
      />
      {isDiagramModalOpen && (
        <DiagramModal
          diagramUrl={diagramUrl ?? ""}
          onClose={(imageUrl: string | undefined, shouldInsert?: boolean) => {
            setIsDiagramModalOpen(false);
            if (!imageUrl) return;
            const editor = editorRef.current;
            if (editor) {
              editor.model.change((writer) => {
                const imageElement = writer.createElement("imageBlock", {
                  src: imageUrl + "?t=" + Date.now(),
                });

                if (shouldInsert) {
                  // Insert new diagram at the current selection
                  const insertAt =
                    editor.model.document.selection.getFirstPosition();
                  if (insertAt) {
                    editor.model.insertContent(imageElement, insertAt);
                  } else {
                    // Fallback: insert at end of document
                    editor.model.insertContent(imageElement);
                  }
                } else {
                  // Update existing diagram - delete current selection and insert
                  const insertAt =
                    editor.model.document.selection.getFirstPosition();
                  if (insertAt) {
                    editor.model.deleteContent(editor.model.document.selection);
                    editor.model.insertContent(imageElement, insertAt);
                  } else {
                    // Fallback if selection is not clear
                    editor.model.insertContent(imageElement);
                  }
                }
              });
            }
          }}
        />
      )}
      {isImageBrowserModalOpen && (
        <ImageBrowserModal
          onClose={(selectedImageUrl?: string) => {
            setIsImageBrowserModalOpen(false);
            if (!selectedImageUrl) return;
            const editor = editorRef.current;
            if (editor) {
              editor.model.change((writer) => {
                const imageElement = writer.createElement("imageBlock", {
                  src: selectedImageUrl + "?t=" + Date.now(),
                });

                // Insert the image at the current selection or at the end of the selection's first range.
                const insertAt =
                  editor.model.document.selection.getFirstPosition();
                if (insertAt) {
                  editor.model.deleteContent(editor.model.document.selection);
                  editor.model.insertContent(imageElement, insertAt);
                } else {
                  // Fallback if selection is not clear, e.g., insert at end of document
                  editor.model.insertContent(imageElement);
                }
              });
            }
          }}
        />
      )}
    </>
  );
}
