import { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { StateField, StateEffect, EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, ViewUpdate } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { rust } from '@codemirror/lang-rust';
import { StreamLanguage } from '@codemirror/language';
import { llvm } from '../utils/llvmIRSyntax.ts';

const registry = new Map<String, EditorView>();

// https://codemirror.net/docs/migration/#marked-text
const addMarks = StateEffect.define<{from: number, to: number, id: string}>();
const removeMarks = StateEffect.define<{id: string}>();

const markField = StateField.define({
  create() { return Decoration.none },
  update(value, tr) {
    value = value.map(tr.changes)
    for (let effect of tr.effects) {

      // insertion:
      if (effect.is(addMarks)) {
        const { from, to, id } = effect.value;
        const builder = new RangeSetBuilder<Decoration>();

        const decos: { from: number; to: number; deco: Decoration }[] = [];
        value.between(0, tr.state.doc.length, (a, b, deco) => {
          decos.push({ from: a, to: b, deco: deco })
        })

        for (let i = from; i <= to; i++) {
          const l = tr.state.doc.line(i);
          const decoration = Decoration.line({ 
            attributes: {style: 'background-color: #ffd70047'},
            id,
          });
          decos.push({ from: l.from, to: l.from, deco: decoration})
        }

        // lines must be sorted before adding to rsb
        decos.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide)
        for (const d of decos) {
          builder.add(d.from, d.from, d.deco);
        }

        return builder.finish();
      }

      // removal:
      if (effect.is(removeMarks)) {
        const { id } = effect.value;
        const builder = new RangeSetBuilder<Decoration>();
        value.between(0, tr.state.doc.length, (a, b, deco) => {
          if (deco.spec && deco.spec.id !== id) {
            builder.add(a, b, deco);
          }
        });
        return builder.finish();
      }
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f)
})

/*
* Highlights lines on view: from <= n <= to given a nodeId.
*/
export function highlight(view: EditorView, id: string, from: number, to: number) {
  view.dispatch({ effects: addMarks.of({ from, to, id })});
}

/*
* Removes highlights for decoration corresponding to the given nodeId.
*/
export function removeHighlight(view: EditorView, id: string) {
  view.dispatch({ effects: removeMarks.of({ id })});
}

export function getEditorView(name: String): EditorView | undefined {
  return registry.get(name);
}

export function scrollIntoView(view: EditorView, line: number) {
  const target = view.state.doc.line(line);
  view.dispatch({ effects: EditorView.scrollIntoView(target.from, { y: "center"})})
}

interface CodeMirrorEditorProps {
  value: string;
  name: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  language?: 'rust' | 'plain' | "llvm";
  height?: string;
}

export function CodeMirrorEditor({
  value,
  name = "",
  readOnly = false,
  onChange,
  language = 'rust',
  height = '600px',
}: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
      markField,
    ];

    if (language === 'rust') {
      extensions.push(rust());
    } else if (language === "llvm") {
      extensions.push(StreamLanguage.define(llvm));
    }

    if (onChange && !readOnly) {
      extensions.push(
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        })
      );
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    registry.set(name, view);
    viewRef.current = view;

    return () => {
      registry.delete(name);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update content when value prop changes
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <Box
      ref={editorRef}
      id={name}
      border="1px solid"
      borderColor="gray.300"
      borderRadius="md"
      overflow="auto"
      height={height}
      sx={{
        '& .cm-editor': {
          height: '100%',
          fontSize: '13px',
        },
        '& .cm-scroller': {
          overflow: 'auto',
        },
        '& .cm-content': {
          fontFamily: 'monospace',
        },
      }}
    />
  );
}

