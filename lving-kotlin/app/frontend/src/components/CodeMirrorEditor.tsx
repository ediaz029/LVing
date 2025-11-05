import { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { EditorState } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { rust } from '@codemirror/lang-rust';

interface CodeMirrorEditorProps {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  language?: 'rust' | 'plain';
  height?: string;
}

export function CodeMirrorEditor({
  value,
  readOnly = false,
  onChange,
  language = 'rust',
  height = '600px'
}: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
    ];

    if (language === 'rust') {
      extensions.push(rust());
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

    viewRef.current = view;

    return () => {
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

