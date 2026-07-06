import type { Block } from "./render";
import { renderBlock as renderCoreBlock } from "./render";

export type BlockRenderer = (block: Block) => string;

const customRenderers = new Map<string, BlockRenderer>();

export function registerBlockRenderer(type: string, renderer: BlockRenderer): void {
  customRenderers.set(type, renderer);
}

export function getBlockRenderer(type: string): BlockRenderer | undefined {
  return customRenderers.get(type);
}

export function renderPublicBlock(block: Block): string {
  const custom = customRenderers.get(block.type);
  if (custom) {
    return custom(block);
  }
  return renderCoreBlock(block);
}

export function renderPublicBlocks(blocks: Block[]): string {
  return blocks.map((block) => renderPublicBlock(block)).join("\n");
}
