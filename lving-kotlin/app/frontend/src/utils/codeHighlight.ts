import { getEditorView, highlight, removeHighlight, scrollIntoView} from "../components/CodeMirrorEditor"
import { getMetadata, pointsToMainEntry } from "./metadata.ts"

interface RustLocInfo {
    filename: string,
    line: string,
}

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

    const irView = getEditorView("IR_EDITOR");
    const rustView = getEditorView("RUST_EDITOR");
    if (!irView || !rustView) return;

    // Not trusting !dbg's number at all for IR lookup.
    const codeSplit = code.split("!dbg ")
    const text = codeSplit[0]

    var lineStart = CodeStrings.IR_CODE.indexOf(text);
    var lineEnd = lineStart + text.length - 1;
    console.debug(getLineNumber(lineStart, CodeStrings.IR_CODE), "->", getLineNumber(lineEnd, CodeStrings.IR_CODE));

    // IR Highlight:
    highlight(
        irView,
        nodeId,
        getLineNumber(lineStart, CodeStrings.IR_CODE),
        getLineNumber(lineEnd, CodeStrings.IR_CODE)
    );
    scrollIntoView(irView, getLineNumber(lineStart, CodeStrings.IR_CODE));

    // We are only able to highlight rust code if the IR line has !dbg.
    if (!code.includes("!dbg")) return;

    // For the Rust highlight, we need to derive the real dbgId from the IR text, not the node's code.
    // Since it is confirmed by this point we have !dbg, we split by ! and grab the final entry.
    const irLine = CodeStrings.IR_CODE.substring(lineStart, lineStart + code.length);
    const irLineSplit = irLine.split("!")
    const dbgID = '!' + irLineSplit[irLineSplit.length-1].trim();

    // get metadata if we are tracking it.
    const metadata = getMetadata(dbgID);
    if (!metadata) return;

    // Only interested in DILocalVariable and DILocation:
    if (!["DILocation", "DILocalVariable"].includes(metadata.identifier)) return;

    var info : RustLocInfo | null = null;
    var filename : string | undefined;
    var locationKey : string | undefined;

    // For DILocalVariable, the properties has file and line already.
    if (metadata.identifier === "DILocalVariable") {
        // Although the file must be resolved:
        locationKey = metadata.data.get("file")!!;
        filename = resolveDIFile(locationKey);

    // DILocation has line, but it has scope which we need to derive file off of.
    } else {
        locationKey = metadata.data.get("scope")!!;
        filename = resolveFileFromScope(locationKey);
    }

    // If we failed to resolve the file, ignore.
    if (!filename) return;

    // I suppose that filename doesn't really make sense since we're only dealing with 1 file atm.
    info = { 
        filename: filename,
        line: metadata.data.get("line")!!,
    }

    // Only interested in highlighting main right now:
    console.log(locationKey);
    if (!pointsToMainEntry(locationKey)) return;

    // Rust highlight:
    highlight(
        rustView,
        nodeId,
        parseInt(info.line),
        parseInt(info.line),
    );
    scrollIntoView(rustView, parseInt(info.line));
    console.log(info);
}

/*
* Where key is a !000 linking to a DIScope, return the filename.
*/
const resolveFileFromScope = (key: string): string | undefined => {
    const scope = getMetadata(key);
    if (!scope) return;

    const fileKey = scope.data.get("file");
    if (!fileKey) return;

    return resolveDIFile(fileKey);
}

/*
* Where key is a !000 linking to a DIFile, return the filename.
*/
const resolveDIFile = (key: string): string | undefined => {
    const file = getMetadata(key);
    if (!file) return;

    return file.data.get("filename");
}


export function removeHighlightNode(nodeId: string) {
    removeHighlight(getEditorView("IR_EDITOR")!!, nodeId);
    removeHighlight(getEditorView("RUST_EDITOR")!!, nodeId);
}
