import { simpleMode } from "@codemirror/legacy-modes/mode/simple-mode";

// https://regex101.com/r/qV1Kkn/1
export const llvm = simpleMode({
 start: [
    {regex: /;.*$/, token: "comment"},
    {regex: /!dbg/, token:"def"},
    {regex: /!DI\w*/, token:"def"},
    {regex: /!\d*/, token:"def"},
    {regex: /%[a-zA-Z_][\w.]*/, token: "atom"},
    {regex: /%[\d][\w.]*/, token: "atom"},
    {regex: /@[a-zA-Z_][\w.]*/, token: "def"},
    {regex: /\b(?:define|declare|private|constant|unnamed_addr|personality|nonnull|metadata|nocapture|zext|ugt|trunc|unreachable|undeftarget|distinct|align|to|ret|call|br|phi|load|store|add|mul|sub|icmp|fcmp|label|type|invoke|void|alloca|landingpad|extractvalue|getelementptr|inbounds|insertvalue|resume|hidden|internal|bitcast)\b/, token: "keyword"},
    {regex: /\bi\d+\b/, token: "type"},
    {regex: /\bfloatt?\b/, token: "type"},
    {regex: /\w*:/, token: "property"},
    {regex: /\d+/, token: "number"},
    {regex: /".*?"/, token: "string"},
  ]
});