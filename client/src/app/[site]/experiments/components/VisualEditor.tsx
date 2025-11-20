"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Eye,
  Code,
  MousePointer,
  Type,
  Palette,
  X,
  Save,
  Undo,
  Redo,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";

interface VisualEditorProps {
  targetUrl: string;
  initialCode?: string;
  onSave: (code: string) => void;
  onClose: () => void;
}

interface ElementEdit {
  selector: string;
  property: string;
  value: string;
  originalValue?: string;
}

export function VisualEditor({ targetUrl, initialCode = "", onSave, onClose }: VisualEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [edits, setEdits] = useState<ElementEdit[]>([]);
  const [history, setHistory] = useState<ElementEdit[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [editMode, setEditMode] = useState<"select" | "code">("select");

  // Editor state
  const [textValue, setTextValue] = useState("");
  const [cssValue, setCssValue] = useState("");
  const [htmlValue, setHtmlValue] = useState("");

  useEffect(() => {
    if (initialCode) {
      // Parse initial code if provided
      try {
        // TODO: Parse existing custom code to edits
      } catch (error) {
        console.error("Failed to parse initial code:", error);
      }
    }
  }, [initialCode]);

  const getDeviceWidth = () => {
    switch (deviceMode) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      default:
        return "100%";
    }
  };

  const injectEditorScript = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;

      // Inject CSS for element highlighting
      const style = doc.createElement("style");
      style.textContent = `
        .rybbit-hover {
          outline: 2px dashed #3b82f6 !important;
          outline-offset: 2px !important;
          cursor: pointer !important;
        }
        .rybbit-selected {
          outline: 2px solid #ef4444 !important;
          outline-offset: 2px !important;
          background-color: rgba(239, 68, 68, 0.1) !important;
        }
      `;
      doc.head.appendChild(style);

      // Inject interaction script
      const script = doc.createElement("script");
      script.textContent = `
        (function() {
          let selectedElement = null;

          // Hover effect
          document.addEventListener('mouseover', function(e) {
            if (e.target.classList.contains('rybbit-selected')) return;
            e.target.classList.add('rybbit-hover');
          });

          document.addEventListener('mouseout', function(e) {
            e.target.classList.remove('rybbit-hover');
          });

          // Click to select
          document.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Deselect previous
            if (selectedElement) {
              selectedElement.classList.remove('rybbit-selected');
            }

            // Select new
            selectedElement = e.target;
            selectedElement.classList.add('rybbit-selected');
            selectedElement.classList.remove('rybbit-hover');

            // Send message to parent
            const selector = generateSelector(e.target);
            window.parent.postMessage({
              type: 'rybbit-element-selected',
              selector: selector,
              text: e.target.textContent,
              html: e.target.innerHTML,
              css: window.getComputedStyle(e.target).cssText
            }, '*');
          });

          // Generate CSS selector for an element
          function generateSelector(element) {
            if (element.id) {
              return '#' + element.id;
            }

            if (element.className && typeof element.className === 'string') {
              const classes = element.className.split(' ').filter(c =>
                c && !c.startsWith('rybbit-')
              );
              if (classes.length > 0) {
                return element.tagName.toLowerCase() + '.' + classes.join('.');
              }
            }

            // Fallback to nth-child
            let path = [];
            let current = element;
            while (current.parentElement) {
              const parent = current.parentElement;
              const index = Array.from(parent.children).indexOf(current) + 1;
              path.unshift(current.tagName.toLowerCase() + ':nth-child(' + index + ')');
              current = parent;
              if (current.id || path.length > 5) break;
            }
            return path.join(' > ');
          }
        })();
      `;
      doc.body.appendChild(script);

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to inject editor script:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "rybbit-element-selected") {
        setSelectedElement(event.data.selector);
        setTextValue(event.data.text || "");
        setHtmlValue(event.data.html || "");
        setCssValue(event.data.css || "");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const applyEdit = (property: string, value: string) => {
    if (!selectedElement) return;

    const newEdit: ElementEdit = {
      selector: selectedElement,
      property,
      value,
    };

    const newEdits = [...edits, newEdit];
    setEdits(newEdits);

    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newEdits);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Apply to iframe
    applyEditsToIframe(newEdits);
  };

  const applyEditsToIframe = (editsToApply: ElementEdit[]) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const doc = iframe.contentDocument || iframe.contentWindow.document;

    editsToApply.forEach((edit) => {
      try {
        const element = doc.querySelector(edit.selector);
        if (element) {
          if (edit.property === "textContent") {
            element.textContent = edit.value;
          } else if (edit.property === "innerHTML") {
            element.innerHTML = edit.value;
          } else {
            (element as HTMLElement).style[edit.property as any] = edit.value;
          }
        }
      } catch (error) {
        console.error("Failed to apply edit:", error);
      }
    });
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const editsToApply = history[newIndex];
      setEdits(editsToApply);
      applyEditsToIframe(editsToApply);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const editsToApply = history[newIndex];
      setEdits(editsToApply);
      applyEditsToIframe(editsToApply);
    }
  };

  const generateCode = () => {
    let code = `(function() {\n`;

    edits.forEach((edit) => {
      code += `  var el = document.querySelector('${edit.selector}');\n`;
      code += `  if (el) {\n`;

      if (edit.property === "textContent") {
        code += `    el.textContent = ${JSON.stringify(edit.value)};\n`;
      } else if (edit.property === "innerHTML") {
        code += `    el.innerHTML = ${JSON.stringify(edit.value)};\n`;
      } else {
        code += `    el.style.${edit.property} = ${JSON.stringify(edit.value)};\n`;
      }

      code += `  }\n`;
    });

    code += `})();`;
    return code;
  };

  const handleSave = () => {
    const code = generateCode();
    onSave(code);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black bg-opacity-70 flex items-center justify-center">
      <div className="bg-white dark:bg-neutral-900 w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Visual Editor</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Click elements to edit • Experiment wizard is minimized
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={deviceMode === "desktop" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeviceMode("desktop")}
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant={deviceMode === "tablet" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeviceMode("tablet")}
              >
                <Tablet className="w-4 h-4" />
              </Button>
              <Button
                variant={deviceMode === "mobile" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeviceMode("mobile")}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex === 0}>
              <Undo className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex === history.length - 1}>
              <Redo className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
              Close
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Iframe Preview */}
          <div className="flex-1 flex items-center justify-center bg-neutral-100 dark:bg-neutral-950 p-4 overflow-auto">
            <div
              style={{
                width: getDeviceWidth(),
                height: "100%",
                maxHeight: "100%",
                transition: "width 0.3s ease",
              }}
            >
              {isLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-neutral-600 dark:text-neutral-400">Loading page...</div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={targetUrl}
                onLoad={injectEditorScript}
                className="w-full h-full bg-white rounded-lg shadow-lg"
                sandbox="allow-same-origin allow-scripts allow-forms"
                style={{ display: isLoading ? "none" : "block" }}
              />
            </div>
          </div>

          {/* Editor Panel */}
          <div className="w-80 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-y-auto">
            <Card className="border-0 rounded-none">
              <CardHeader>
                <CardTitle className="text-sm">Element Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedElement ? (
                  <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
                    <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Click on any element in the preview to start editing</p>
                  </div>
                ) : (
                  <Tabs defaultValue="text">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="text" className="text-xs">
                        <Type className="w-3 h-3 mr-1" />
                        Text
                      </TabsTrigger>
                      <TabsTrigger value="style" className="text-xs">
                        <Palette className="w-3 h-3 mr-1" />
                        Style
                      </TabsTrigger>
                      <TabsTrigger value="html" className="text-xs">
                        <Code className="w-3 h-3 mr-1" />
                        HTML
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="text" className="space-y-3">
                      <div>
                        <Label className="text-xs">Selected Element</Label>
                        <code className="text-xs block p-2 bg-neutral-100 dark:bg-neutral-800 rounded mt-1">
                          {selectedElement}
                        </code>
                      </div>
                      <div>
                        <Label htmlFor="text" className="text-xs">
                          Text Content
                        </Label>
                        <Textarea
                          id="text"
                          value={textValue}
                          onChange={(e) => setTextValue(e.target.value)}
                          rows={4}
                          className="mt-1 text-sm"
                        />
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => applyEdit("textContent", textValue)}
                        >
                          Apply Text Change
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="style" className="space-y-3">
                      <div>
                        <Label className="text-xs">Color</Label>
                        <Input
                          type="color"
                          className="mt-1 h-10"
                          onChange={(e) => applyEdit("color", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Background Color</Label>
                        <Input
                          type="color"
                          className="mt-1 h-10"
                          onChange={(e) => applyEdit("backgroundColor", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Font Size</Label>
                        <Input
                          type="text"
                          placeholder="e.g., 16px, 1.5rem"
                          className="mt-1"
                          onChange={(e) => applyEdit("fontSize", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Display</Label>
                        <select
                          className="w-full mt-1 p-2 border rounded text-sm"
                          onChange={(e) => applyEdit("display", e.target.value)}
                        >
                          <option value="">Choose...</option>
                          <option value="none">Hide</option>
                          <option value="block">Block</option>
                          <option value="flex">Flex</option>
                          <option value="inline">Inline</option>
                        </select>
                      </div>
                    </TabsContent>

                    <TabsContent value="html" className="space-y-3">
                      <div>
                        <Label htmlFor="html" className="text-xs">
                          HTML Content
                        </Label>
                        <Textarea
                          id="html"
                          value={htmlValue}
                          onChange={(e) => setHtmlValue(e.target.value)}
                          rows={8}
                          className="mt-1 text-xs font-mono"
                        />
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => applyEdit("innerHTML", htmlValue)}
                        >
                          Apply HTML Change
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}

                {edits.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <Label className="text-xs">Changes ({edits.length})</Label>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {edits.map((edit, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-2 bg-neutral-100 dark:bg-neutral-800 rounded"
                        >
                          <code className="text-blue-600 dark:text-blue-400">{edit.selector}</code>
                          <br />
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {edit.property}: {edit.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
