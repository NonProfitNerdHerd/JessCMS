import { registerPluginBlockRenderer } from "../../theme/hooks";
import { renderFormBlock } from "./render";

export function registerFormsBuilderPlugin(): void {
  registerPluginBlockRenderer("form", renderFormBlock);
}
