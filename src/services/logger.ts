import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/** The shared "Fuuz" output channel (created lazily). */
export function fuuzChannel(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel('Fuuz');
  return channel;
}

/** Append a timestamped line to the Fuuz output channel. */
export function fuuzLog(message: string): void {
  fuuzChannel().appendLine(`${new Date().toISOString()}  ${message}`);
}
