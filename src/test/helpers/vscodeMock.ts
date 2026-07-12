/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Minimal in-process `vscode` module mock for unit tests.
 *
 * The extension's services `import * as vscode from 'vscode'`, which has no
 * implementation outside the VS Code host. This patches Node's module loader so
 * `require('vscode')` resolves to a lightweight stub with just enough surface to
 * construct and exercise the services under test. Import this module BEFORE the
 * module under test so the loader patch is in place when its top-level
 * `require('vscode')` runs.
 */

// --- shared, resettable state ------------------------------------------------

const config = new Map<string, Map<string, any>>();
const commands = new Map<string, (...args: any[]) => any>();
const messages: { kind: 'info' | 'warn' | 'error'; text: string }[] = [];
const quickPicks: any[] = [];

/** Clear config + recorded calls between tests. */
export function resetVscodeMock(): void {
  config.clear();
  commands.clear();
  messages.length = 0;
  quickPicks.length = 0;
}

export function setConfigValue(section: string, key: string, value: any): void {
  if (!config.has(section)) config.set(section, new Map());
  config.get(section)!.set(key, value);
}

export function recordedMessages(): typeof messages {
  return messages;
}
export function recordedQuickPicks(): any[] {
  return quickPicks;
}
export function getCommand(id: string): ((...args: any[]) => any) | undefined {
  return commands.get(id);
}

// --- the stub ----------------------------------------------------------------

class EventEmitter<T = any> {
  private listeners = new Set<(e: T) => void>();
  event = (listener: (e: T) => void) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire = (e?: T) => { for (const l of [...this.listeners]) l(e as T); };
  dispose = () => this.listeners.clear();
}

class TreeItem {
  label: any;
  collapsibleState: any;
  constructor(label: any, collapsibleState?: any) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

class ThemeColor { constructor(public id: string) {} }
class ThemeIcon { constructor(public id: string, public color?: any) {} }

class FileSystemError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
  static FileNotFound(): FileSystemError { return new FileSystemError('FileNotFound'); }
}

function uriFrom(p: string): any {
  return { fsPath: p, path: p, scheme: 'file', toString: () => p, with: () => uriFrom(p) };
}

const Uri = {
  file: (p: string) => uriFrom(p),
  parse: (s: string) => uriFrom(s),
  joinPath: (base: any, ...parts: string[]) => uriFrom([base?.fsPath ?? base?.path ?? '', ...parts].join('/')),
};

function getConfiguration(section: string) {
  if (!config.has(section)) config.set(section, new Map());
  const store = config.get(section)!;
  return {
    get: (key: string, def?: any) => (store.has(key) ? store.get(key) : def),
    update: async (key: string, value: any) => {
      if (value === undefined) store.delete(key);
      else store.set(key, value);
    },
    has: (key: string) => store.has(key),
    inspect: () => undefined,
  };
}

const disposable = { dispose: () => undefined };

const window = {
  showInformationMessage: (text: string, ..._rest: any[]) => { messages.push({ kind: 'info', text }); return Promise.resolve(undefined); },
  showWarningMessage: (text: string, ..._rest: any[]) => { messages.push({ kind: 'warn', text }); return Promise.resolve(undefined); },
  showErrorMessage: (text: string, ..._rest: any[]) => { messages.push({ kind: 'error', text }); return Promise.resolve(undefined); },
  showQuickPick: (items: any, _opts?: any) => { quickPicks.push(items); return Promise.resolve(undefined); },
  showInputBox: (_opts?: any) => Promise.resolve(undefined),
  registerTreeDataProvider: () => disposable,
  registerWebviewViewProvider: () => disposable,
  createTreeView: () => ({ message: undefined, dispose: () => undefined, onDidChangeVisibility: new EventEmitter().event }),
  createStatusBarItem: () => ({ text: '', tooltip: '', command: undefined as any, color: undefined as any, backgroundColor: undefined as any, show: () => undefined, hide: () => undefined, dispose: () => undefined }),
  createOutputChannel: () => ({ appendLine: () => undefined, append: () => undefined, show: () => undefined, clear: () => undefined, dispose: () => undefined }),
  createTerminal: () => ({ show: () => undefined, sendText: () => undefined, dispose: () => undefined }),
  withProgress: (_opts: any, task: any) => task({ report: () => undefined }, { isCancellationRequested: false, onCancellationRequested: () => disposable }),
  showTextDocument: () => Promise.resolve(undefined),
  activeTextEditor: undefined as any,
};

const workspace = {
  getConfiguration,
  workspaceFolders: undefined as any,
  onDidChangeConfiguration: () => disposable,
  registerTextDocumentContentProvider: () => disposable,
  openTextDocument: () => Promise.resolve({ uri: uriFrom('/doc') }),
  asRelativePath: (uri: any) => (typeof uri === 'string' ? uri : uri?.fsPath ?? ''),
  fs: {
    readFile: () => Promise.reject(new FileSystemError('FileNotFound')),
    writeFile: () => Promise.resolve(),
    createDirectory: () => Promise.resolve(),
    readDirectory: () => Promise.resolve([]),
    stat: () => Promise.reject(new FileSystemError('FileNotFound')),
    delete: () => Promise.resolve(),
  },
};

const commandsApi = {
  registerCommand: (id: string, fn: (...args: any[]) => any) => { commands.set(id, fn); return disposable; },
  executeCommand: (_id: string, ..._args: any[]) => Promise.resolve(undefined),
};

const vscodeStub: any = {
  EventEmitter,
  TreeItem,
  ThemeColor,
  ThemeIcon,
  FileSystemError,
  Uri,
  window,
  workspace,
  commands: commandsApi,
  languages: { setTextDocumentLanguage: () => Promise.resolve(undefined) },
  env: { clipboard: { writeText: () => Promise.resolve() }, openExternal: () => Promise.resolve(true) },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
  FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  // `lm` deliberately absent so the MCP-provider registration is skipped.
};

// --- install the loader patch (once) ----------------------------------------

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mod: any = require('module');
if (!Mod.__fuuzVscodePatched) {
  const realLoad = Mod._load;
  Mod._load = function (request: string, ...rest: any[]) {
    if (request === 'vscode') return vscodeStub;
    return realLoad.call(this, request, ...rest);
  };
  Mod.__fuuzVscodePatched = true;
}

export { vscodeStub, EventEmitter };

// --- test doubles ------------------------------------------------------------

/** A fake SecretStorage backed by an in-memory map. */
export function makeSecretStorage() {
  const m = new Map<string, string>();
  const emitter = new EventEmitter<void>();
  return {
    get: async (k: string) => m.get(k),
    store: async (k: string, v: string) => { m.set(k, v); },
    delete: async (k: string) => { m.delete(k); },
    onDidChange: emitter.event,
    _map: m,
  } as any;
}

/** A fake ExtensionContext with in-memory globalState + secrets. */
export function makeContext() {
  const gs = new Map<string, any>();
  return {
    secrets: makeSecretStorage(),
    subscriptions: [] as any[],
    extensionUri: Uri.file('/ext'),
    globalState: {
      get: (k: string, d?: any) => (gs.has(k) ? gs.get(k) : d),
      update: async (k: string, v: any) => { if (v === undefined) gs.delete(k); else gs.set(k, v); },
      keys: () => [...gs.keys()],
    },
    workspaceState: {
      get: (k: string, d?: any) => d,
      update: async () => undefined,
      keys: () => [],
    },
  } as any;
}
