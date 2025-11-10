package lving.backend.graph

// https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling
// rust uses C++-style mangling, but it's not exact:
// - symbols prefixed with _ZN
// - for each element of path, the length comes before it
// - path is ended with 'E'
// - hashes come before the 'E' whose format is <length><hash>E

object Demangle {
    fun demangle(s: String): String {
        var inner = ""

        // strip ZN (or _ZN) and E
        if (s.startsWith("_ZN") && s.endsWith("E")) {
            inner = s.substring(3, s.length - 1)
        } else if (s.startsWith("ZN") && s.endsWith("E")) {
            inner = s.substring(2, s.length - 1)
        } else {
            return s
        }

        val path = StringBuilder()
        val lengthStr = StringBuilder()
        var hash = ""
        var index = 0
        var length: Int
        var c: Char

        while (index < inner.length) {
            c = inner[index]
            while (Character.isDigit(c)) {
                c = inner[index]
                if (!Character.isDigit(c)) break
                lengthStr.append(c)
                index++
                if (index >= inner.length) break
            }

            // convert length to a int:
            length = Integer.parseInt(lengthStr.toString())
            lengthStr.delete(0, lengthStr.length)

            // No longer a digit, but there's two possibilities here...
            // 1. its actually indicative of the length of an identifier
            // 2. its the length of the hash (but just saying length + 'h' doesn't mean its the hash that comes next).

            // If the length is 17 and there are 18 more characters left, this is the hash:
            if (length == 17 && (inner.length - index == 17)) {
                hash = inner.substring(index + 1)
                break
            }

            var watchingSequence = false
            val sequence = StringBuilder()
            for (i in index until index + length) {
                c = inner[i]

                // _$ denotes the start of a sequence of length (which also includes _$).
                // the underscore is not needed beyond this point.
                if (c == '_' && inner[i + 1] == '$') continue

                // . matches -> :
                if (c == '.') {
                    path.append(":")
                    continue
                }

                // $ denotes the start and end of special sequences.
                if (inner[i] == '$') {
                    if (watchingSequence) {
                        watchingSequence = false

                        // match this sequence to something with meaning:
                        // there exists one special scenario here: sequences starting with "u"
                        // are unicodes (where subsequent chars form the actual hex itself).
                        if (sequence[0] == 'u') {
                            path.append(sequence.substring(1).toInt(16).toChar())
                        } else {
                            // Pattern match the rest:
                            // this is from src/librustc_codegen/symbol_names.rs (an old version)
                            // https://git.dreamy.place/mirrors/rust/tree/src/librustc_codegen_utils/symbol_names.rs?id=40d277e3b7812d236891ec6a77fcd24279180f0e
                            val demangledSymbol = when (sequence.toString()) {
                                "SP" -> "@"
                                "BP" -> "*"
                                "RF" -> "&"
                                "LT" -> "<"
                                "GT" -> ">"
                                "LP" -> "("
                                "RP" -> ")"
                                "C" -> ","
                                else -> "???"
                            }
                            path.append(demangledSymbol)
                        }

                        sequence.delete(0, sequence.length)
                        continue
                    }
                    watchingSequence = true
                    continue
                }

                // If we're watching a sequence, we're keeping track of the chars:
                if (watchingSequence) {
                    sequence.append(inner[i])
                    continue
                }

                // Otherwise, this just goes onto the path as-is:
                path.append(c)
            }

            path.append("::")
            index += length
        }

        // remove trailing :: from path:
        path.delete(path.length - 2, path.length)
        return path.toString()
    }
}
