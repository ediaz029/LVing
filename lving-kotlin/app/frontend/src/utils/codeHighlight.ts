import { getEditorView, highlight, removeHighlight } from "../components/CodeMirrorEditor"

export class CodeStrings {
    public static RUST_CODE: string = '';
    public static IR_CODE: string = '';
}

export function highlightCorrespondingCode(nodeId: string, code: string) {
    /* 
    * NOTE: Since the CPG parses the LLVM code again, the debug metadata IDs become
    * scrambled. I work around this for now by searching through the IR for the node's
    * code match and just strip out the !dbg <000> part.
    * 
    * The proper thing here would be to either update our IR text we serve
    * or update each node's code property. Both of which would require
    * updating the CPG's language frontend for LLVM.
    */
    const getLineNumber = (i: number, s: string) => {
        return s.substring(0, i).split("\n").length;
    }

    // Not trusting !dbg's number at all.
    const text = code.split("!dbg")[0]
    console.log(code);

    var lineStart = CodeStrings.IR_CODE.indexOf(text);
    var lineEnd = CodeStrings.IR_CODE.lastIndexOf(text);
    console.log(getLineNumber(lineStart, CodeStrings.IR_CODE), "->", getLineNumber(lineEnd, CodeStrings.IR_CODE));

    const view = getEditorView("IR_EDITOR");
    if (!view) return;
    highlight(view, nodeId, getLineNumber(lineStart, CodeStrings.IR_CODE), getLineNumber(lineEnd, CodeStrings.IR_CODE));
}
