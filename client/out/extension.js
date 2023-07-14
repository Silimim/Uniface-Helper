"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const vscode = require("vscode");
const fs = require("fs");
let client;
class MyContentProvider {
    constructor() {
        this._onDidChange = new vscode.EventEmitter();
    }
    provideTextDocumentContent(uri) {
        const filePath = uri.fsPath.replace('.uni', '.xml');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const regex = /<trigger>(.*?)<\/trigger>/s;
        const match = regex.exec(fileContent);
        const content = match ? match[1] : '';
        return content;
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    update(uri) {
        this._onDidChange.fire(uri);
    }
}
const myContentProvider = new MyContentProvider();
const scheme = 'uni';
// Registra il provider di contenuto personalizzato per lo schema di URI "uni"
vscode.workspace.registerTextDocumentContentProvider(scheme, myContentProvider);
vscode.workspace.onDidOpenTextDocument(document => {
    if (path.extname(document.uri.fsPath) === '.xml') {
        const uniUri = vscode.Uri.parse(`${scheme}:${document.uri.fsPath}.uni`);
        vscode.workspace.openTextDocument(uniUri).then(document => {
            vscode.window.showTextDocument(document);
        });
    }
});
function activate(context) {
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
        }
    };
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'uniface' }],
        synchronize: {
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.uni')
        }
    };
    client = new node_1.LanguageClient('languageServerUniface', 'Language Server Uniface', serverOptions, clientOptions);
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider('language-id', {
        provideFoldingRanges(document, context, token) {
            const foldingRanges = [];
            // Find the start and end markers for each folding range
            const startRegex = /\bentry\b/;
            const endRegex = /\bend\b/;
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const startMatch = line.text.match(startRegex);
                const endMatch = line.text.match(endRegex);
                if (startMatch) {
                    const startLine = i;
                    let endLine = i;
                    // Find the end of the folding range
                    for (let j = i + 1; j < document.lineCount; j++) {
                        const nextLine = document.lineAt(j);
                        if (endMatch && nextLine.text.match(endRegex)) {
                            endLine = j;
                            break;
                        }
                    }
                    // Add the folding range to the list
                    foldingRanges.push(new vscode.FoldingRange(startLine, endLine));
                }
            }
            return foldingRanges;
        }
    }));
    client.start();
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map