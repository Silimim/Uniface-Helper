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
        const filePath = uri.fsPath;
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
// Registra il provider di contenuto personalizzato per lo schema di URI "mycontent"
const myContentProvider = new MyContentProvider();
vscode.workspace.registerTextDocumentContentProvider('uni', myContentProvider);
// Crea un URI personalizzato per il documento
vscode.workspace.onDidOpenTextDocument(document => {
    if (path.extname(document.uri.fsPath) === '.xml') {
        const uri = vscode.Uri.parse(`uni://${document.uri.fsPath.replace('xml', 'uni')}`);
        vscode.workspace.openTextDocument(uri).then(document => {
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