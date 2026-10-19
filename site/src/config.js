// Marketplace identity comes from the generated catalog (marketplace.json and
// the git remote), so install commands always match the real marketplace.
import index from './generated/catalog.json';

export const MARKETPLACE = index.marketplace.name;
export const REPO_SLUG = index.marketplace.repo;
export const REPO_URL = `https://github.com/${REPO_SLUG}`;

export const KINDS = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp', 'lsp'];
export const COMPONENT_KINDS = ['skill', 'agent', 'command', 'hook', 'mcp', 'lsp'];
