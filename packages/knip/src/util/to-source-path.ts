import fastGlob from 'fast-glob';
import type { CompilerOptions } from 'typescript';
import type { ConfigurationChief, Workspace } from '../ConfigurationChief.js';
import { DEFAULT_EXTENSIONS } from '../constants.js';
import { debugLog } from './debug.js';
import { isDirectory } from './fs.js';
import { isInternal, join, toRelative } from './path.js';

const defaultExtensions = `.{${DEFAULT_EXTENSIONS.map(ext => ext.slice(1)).join(',')}}`;
const hasTSExt = /(?<!\.d)\.(m|c)?tsx?$/;
const hasDTSExt = /.d\.(m|c)?ts$/;
const matchExt = /(\.d)?\.(m|c)?(j|t)s$/;

export const augmentWorkspace = (workspace: Workspace, dir: string, compilerOptions: CompilerOptions) => {
  const srcDir = join(dir, 'src');
  workspace.srcDir = compilerOptions.rootDir ?? (isDirectory(srcDir) ? srcDir : dir);
  workspace.outDir = compilerOptions.outDir || workspace.srcDir;
};

export const getToSourcePathHandler = (chief: ConfigurationChief) => {
  const toSourceMapCache = new Map<string, string>();

  return (filePath: string) => {
    if (!isInternal(filePath) || hasTSExt.test(filePath)) return;
    if (toSourceMapCache.has(filePath)) return toSourceMapCache.get(filePath);
    const workspace = chief.findWorkspaceByFilePath(filePath);
    if (workspace?.srcDir && workspace.outDir) {
      if (
        (!filePath.startsWith(workspace.srcDir) && filePath.startsWith(workspace.outDir)) ||
        (workspace.srcDir === workspace.outDir && hasDTSExt.test(filePath))
      ) {
        const pattern = filePath.replace(workspace.outDir, workspace.srcDir).replace(matchExt, defaultExtensions);
        const [srcFilePath] = fastGlob.sync(pattern);
        toSourceMapCache.set(filePath, srcFilePath);
        if (srcFilePath && srcFilePath !== filePath) {
          debugLog('*', `Source mapping ${toRelative(filePath)} → ${toRelative(srcFilePath)}`);
          return srcFilePath;
        }
      }
    }
  };
};

export type ToSourceFilePath = ReturnType<typeof getToSourcePathHandler>;
