interface Metadata {
    key: string,
    identifier: string,
    data: Map<string, string>,
}

// (for now), main-specific related scope/file info.
interface EntryInfo {
    scopeKey: string, // key -> !DISubprogram
    fileKey: string, // key -> !DIFile
}

const metadataMap = new Map<string, Metadata>();
var mainEntryInfo : EntryInfo;

export function parseMetadata(code: string | undefined) {
    if (code == undefined) return;

    const metadataPattern = new RegExp(/(!\d*) = (?:distinct )?!(\w*)\((.*?)\)$/, "gm");
    const metaPropertyPattern = new RegExp(/(\w+): (?:"([^"]*)"|([^,)]*))/, "gm");
    
    const match = code.matchAll(metadataPattern);

    for (const m of match) {
        const line = m[0]; // full line
        const key = m[1]; // !000
        const identifier = m[2]; // !DI...

        // {x}: {y} pattern:
        const properties = line.matchAll(metaPropertyPattern);
        const metadata : Metadata = {
            key: key,
            identifier: identifier,
            data: new Map(),
        }

        // properties size = 4;
        // i=2 is reserved for full strings.
        // [<full>, <property>, <data>, <data>]
        for (const n of properties) {
            metadata.data.set(n[1], n[2] ? n[2] : n[3]);

            // Since it is useful to know if something is within our main file,
            // mainScopeKey contains the key to the !DISubprogram (scope)
            // that contains our main function.
            if (identifier === "DISubprogram" && metadata.data.get("name") === "main") {
                mainEntryInfo = {
                    scopeKey: key,
                    fileKey: metadata.data.get("file")!!,
                }
            }
        }
        metadataMap.set(key, metadata);
    }
    console.debug(metadataMap);
}

export function getMetadata(id: string) : Metadata | undefined {
    return metadataMap.get(id);
}

/*
* Returns T if key is apart of the main scope or main file.
*/
export function pointsToMainEntry(id: string) : boolean {
    return mainEntryInfo.fileKey === id || mainEntryInfo.scopeKey === id;
}
