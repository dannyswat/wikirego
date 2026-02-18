import { Plugin, ButtonView } from "ckeditor5";
import dataModelIcon from "../../assets/datamodel.svg?raw";

export class DataModel extends Plugin {
  static get pluginName() {
    return "DataModelPlugin";
  }

  init() {
    const editor = this.editor;
    const t = editor.t;

    editor.ui.componentFactory.add("dataModelPlugin", (locale) => {
      const view = new ButtonView(locale);

      view.set({
        label: t("Insert/Update Data Model"),
        icon: dataModelIcon,
        tooltip: true,
      });

      this.listenTo(view, "execute", () => {
        const element = editor.model.document.selection.getSelectedElement();
        if (element) {
          const src = element.getAttribute("src");
          if (
            src &&
            typeof src === "string" &&
            src.includes("/media/uml/")
          ) {
            editor.fire("openDataModelModal", src);
            return;
          }
        }
        editor.fire("openDataModelModal");
      });

      return view;
    });
  }
}
