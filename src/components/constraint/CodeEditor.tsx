import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Code, 
  Play, 
  RotateCcw, 
  Copy, 
  Download,
  Maximize2,
  Minimize2,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
  result?: any;
  readOnly?: boolean;
  height?: string;
}

const LANGUAGE_CONFIGS = {
  javascript: {
    label: 'JavaScript',
    defaultCode: `function solution() {
  // Write your solution here
  
}

// Test your function
console.log(solution());`,
    monacoLanguage: 'javascript'
  },
  python: {
    label: 'Python',
    defaultCode: `def solution():
    # Write your solution here
    pass

# Test your function
print(solution())`,
    monacoLanguage: 'python'
  },
  java: {
    label: 'Java',
    defaultCode: `public class Solution {
    public static void main(String[] args) {
        // Write your solution here
        
    }
    
    // Add your methods here
}`,
    monacoLanguage: 'java'
  },
  cpp: {
    label: 'C++',
    defaultCode: `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    // Write your solution here
    
    return 0;
}`,
    monacoLanguage: 'cpp'
  },
  c: {
    label: 'C',
    defaultCode: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your solution here
    
    return 0;
}`,
    monacoLanguage: 'c'
  }
};

export const CodeEditor = ({
  value,
  onChange,
  language,
  onLanguageChange,
  onSubmit,
  isSubmitting = false,
  isSubmitted = false,
  result,
  readOnly = false,
  height = '400px'
}: CodeEditorProps) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true }
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!readOnly && !isSubmitting) {
        onSubmit();
      }
    });
  };

  const insertTemplate = () => {
    const template = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS]?.defaultCode || '';
    onChange(template);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const downloadCode = () => {
    const extensions = {
      javascript: 'js',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c'
    };
    
    const extension = extensions[language as keyof typeof extensions] || 'txt';
    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solution.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  return (
    <Card variant="glass" className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Code Editor
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <Select value={language} onValueChange={onLanguageChange} disabled={readOnly}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Editor Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={insertTemplate}
                disabled={readOnly}
                title="Insert template"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={copyCode}
                title="Copy code"
              >
                <Copy className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCode}
                title="Download code"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-t">
          <Editor
            height={height}
            language={LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS]?.monacoLanguage || 'javascript'}
            value={value}
            onChange={(newValue) => onChange(newValue || '')}
            onMount={handleEditorDidMount}
            options={{
              readOnly,
              theme: 'vs-dark',
              fontSize: 14,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              parameterHints: { enabled: true },
              folding: true,
              lineNumbers: 'on',
              glyphMargin: true,
              contextmenu: true,
              mouseWheelZoom: true
            }}
          />
        </div>
        
        {/* Editor Footer */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Status Badges */}
              {isSubmitted && (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Submitted
                </Badge>
              )}
              
              {isSubmitting && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Evaluating...
                </Badge>
              )}
              
              {result && (
                <Badge 
                  variant={result.isCorrect ? "success" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {result.isCorrect ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  Score: {result.score}/100
                </Badge>
              )}
              
              {/* Code Stats */}
              <Badge variant="outline">
                {value.split('\n').length} lines
              </Badge>
              
              <Badge variant="outline">
                {value.length} chars
              </Badge>
            </div>
            
            {/* Submit Button */}
            {!readOnly && (
              <Button
                onClick={onSubmit}
                disabled={!value.trim() || isSubmitting}
                variant="neon"
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isSubmitted ? 'Resubmit' : 'Submit Solution'}
                <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">
                  Ctrl+Enter
                </kbd>
              </Button>
            )}
          </div>
          
          {/* Evaluation Result */}
          {result && (
            <div className="mt-3 p-3 rounded-lg border bg-card">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">AI Evaluation Result:</span>
                  <Badge variant={result.isCorrect ? "success" : "destructive"}>
                    {result.isCorrect ? 'Correct' : 'Incorrect'}
                  </Badge>
                </div>
                
                <div className="text-sm">
                  <span className="font-medium">Feedback:</span>
                  <p className="mt-1 text-muted-foreground">{result.feedback}</p>
                </div>
                
                {result.constraintViolations?.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium text-destructive">Constraint Violations:</span>
                    <ul className="mt-1 list-disc list-inside text-destructive">
                      {result.constraintViolations.map((violation: string, index: number) => (
                        <li key={index}>{violation}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {result.executionResult?.error && (
                  <div className="text-sm">
                    <span className="font-medium text-destructive">Execution Error:</span>
                    <pre className="mt-1 p-2 bg-destructive/10 rounded text-xs text-destructive overflow-x-auto">
                      {result.executionResult.error}
                    </pre>
                  </div>
                )}
                
                {result.executionResult?.output && (
                  <div className="text-sm">
                    <span className="font-medium">Output:</span>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {result.executionResult.output}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};