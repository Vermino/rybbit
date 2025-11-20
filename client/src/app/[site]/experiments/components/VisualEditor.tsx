"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Eye,
  EyeOff,
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
  Layout,
  Box,
} from "lucide-react";

interface VisualEditorProps {
  targetUrl: string;
  initialCode?: string;
  onSave: (code: string) => void;
  onClose: () => void;
}

interface ElementData {
  tagName: string;
  textContent: string;
  innerHTML: string;
  id: string;
  className: string;
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  lineHeight: string;
  textAlign: string;
  display: string;
  width: string;
  height: string;
  margin: string;
  padding: string;
  border: string;
  borderRadius: string;
  opacity: string;
}

interface ElementEdit {
  selector: string;
  property: string;
  value: string;
}

export function VisualEditor({ targetUrl, initialCode = "", onSave, onClose }: VisualEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [elementData, setElementData] = useState<ElementData | null>(null);
  const [edits, setEdits] = useState<ElementEdit[]>([]);
  const [history, setHistory] = useState<ElementEdit[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Editor state
  const [isVisible, setIsVisible] = useState(true);
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState("16");
  const [fontWeight, setFontWeight] = useState("400");
  const [fontFamily, setFontFamily] = useState("inherit");
  const [lineHeight, setLineHeight] = useState("1.5");
  const [textAlign, setTextAlign] = useState("left");
  const [displayMode, setDisplayMode] = useState("block");
  const [opacity, setOpacity] = useState(100);
  const [borderRadius, setBorderRadius] = useState("0");

  useEffect(() => {
    if (initialCode) {
      // TODO: Parse initial code if provided
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

          // Prevent ALL navigation in edit mode
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

            // Get computed styles
            const computed = window.getComputedStyle(e.target);

            // Send message to parent with full element data
            const selector = generateSelector(e.target);
            window.parent.postMessage({
              type: 'rybbit-element-selected',
              selector: selector,
              element: {
                tagName: e.target.tagName.toLowerCase(),
                textContent: e.target.textContent,
                innerHTML: e.target.innerHTML,
                id: e.target.id,
                className: e.target.className,
                // Computed styles
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize,
                fontFamily: computed.fontFamily,
                fontWeight: computed.fontWeight,
                lineHeight: computed.lineHeight,
                textAlign: computed.textAlign,
                display: computed.display,
                width: computed.width,
                height: computed.height,
                margin: computed.margin,
                padding: computed.padding,
                border: computed.border,
                borderRadius: computed.borderRadius,
                opacity: computed.opacity,
              }
            }, '*');
          }, true); // Use capture phase to prevent ALL clicks

          // Prevent form submissions
          document.addEventListener('submit', function(e) {
            e.preventDefault();
          }, true);

          // Hover effect
          document.addEventListener('mouseover', function(e) {
            if (e.target.classList.contains('rybbit-selected')) return;
            e.target.classList.add('rybbit-hover');
          });

          document.addEventListener('mouseout', function(e) {
            e.target.classList.remove('rybbit-hover');
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
        const el = event.data.element;
        setElementData(el);

        // Populate editor fields
        setText(el.textContent || "");
        setHtml(el.innerHTML || "");
        setColor(rgbToHex(el.color) || "#000000");
        setBgColor(rgbToHex(el.backgroundColor) || "#ffffff");
        setFontSize(parseInt(el.fontSize) || 16);
        setFontWeight(el.fontWeight || "400");
        setFontFamily(el.fontFamily || "inherit");
        setLineHeight(parseFloat(el.lineHeight) || 1.5);
        setTextAlign(el.textAlign || "left");
        setDisplayMode(el.display || "block");
        setOpacity(parseFloat(el.opacity) * 100 || 100);
        setBorderRadius(parseInt(el.borderRadius) || 0);
        setIsVisible(el.display !== "none");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Helper function to convert RGB to HEX
  const rgbToHex = (rgb: string): string => {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return "#ffffff";
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const applyStyle = (property: string, value: string) => {
    if (!selectedElement) return;

    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const element = doc.querySelector(selectedElement);

    if (element) {
      if (property === "textContent") {
        element.textContent = value;
      } else if (property === "innerHTML") {
        element.innerHTML = value;
      } else {
        (element as HTMLElement).style[property as any] = value;
      }

      // Track edit
      const newEdit: ElementEdit = { selector: selectedElement, property, value };
      const newEdits = [...edits, newEdit];
      setEdits(newEdits);

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newEdits);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const editsToApply = history[newIndex];
      setEdits(editsToApply);
      reapplyAllEdits(editsToApply);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const editsToApply = history[newIndex];
      setEdits(editsToApply);
      reapplyAllEdits(editsToApply);
    }
  };

  const reapplyAllEdits = (editsToApply: ElementEdit[]) => {
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
          <div className="w-96 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-y-auto">
            {!selectedElement ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-neutral-500 dark:text-neutral-400">
                <MousePointer className="w-12 h-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Element Selected</h3>
                <p className="text-sm">Click on any element in the preview to start editing</p>
              </div>
            ) : (
              <Tabs defaultValue="element" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="element" className="text-xs px-2">
                    <Box className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="content" className="text-xs px-2">
                    <Type className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs px-2">
                    <Layout className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="typography" className="text-xs px-2">
                    <Type className="w-3 h-3" />
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs px-2">
                    <Palette className="w-3 h-3" />
                  </TabsTrigger>
                </TabsList>

                {/* Element Tab */}
                <TabsContent value="element" className="p-4 space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Selector</Label>
                    <code className="text-xs block p-2 bg-neutral-100 dark:bg-neutral-800 rounded mt-1">
                      {selectedElement}
                    </code>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">HTML Tag</Label>
                    <p className="text-sm mt-1 text-neutral-600 dark:text-neutral-400">
                      &lt;{elementData?.tagName}&gt;
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Visibility</Label>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        setIsVisible(checked);
                        applyStyle("display", checked ? displayMode : "none");
                      }}
                    />
                  </div>
                </TabsContent>

                {/* Content Tab */}
                <TabsContent value="content" className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="text" className="text-xs font-medium">
                      Text Content
                    </Label>
                    <Textarea
                      id="text"
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        applyStyle("textContent", e.target.value);
                      }}
                      rows={6}
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="html" className="text-xs font-medium">
                      HTML Content
                    </Label>
                    <Textarea
                      id="html"
                      value={html}
                      onChange={(e) => {
                        setHtml(e.target.value);
                        applyStyle("innerHTML", e.target.value);
                      }}
                      rows={8}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </TabsContent>

                {/* Layout & Spacing Tab */}
                <TabsContent value="layout" className="p-4 space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Display Mode</Label>
                    <Select
                      value={displayMode}
                      onValueChange={(value) => {
                        setDisplayMode(value);
                        applyStyle("display", value);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="block">Block</SelectItem>
                        <SelectItem value="inline-block">Inline Block</SelectItem>
                        <SelectItem value="flex">Flex</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="none">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Typography Tab */}
                <TabsContent value="typography" className="p-4 space-y-4">
                  <div>
                    <Label className="text-xs font-medium">Font Size</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[parseInt(fontSize.toString())]}
                        onValueChange={([value]) => {
                          setFontSize(value);
                          applyStyle("fontSize", value + "px");
                        }}
                        min={8}
                        max={72}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm w-12 text-right">{fontSize}px</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Font Weight</Label>
                    <Select
                      value={fontWeight}
                      onValueChange={(value) => {
                        setFontWeight(value);
                        applyStyle("fontWeight", value);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="300">Light (300)</SelectItem>
                        <SelectItem value="400">Normal (400)</SelectItem>
                        <SelectItem value="500">Medium (500)</SelectItem>
                        <SelectItem value="600">Semi-Bold (600)</SelectItem>
                        <SelectItem value="700">Bold (700)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Line Height</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[parseFloat(lineHeight.toString())]}
                        onValueChange={([value]) => {
                          setLineHeight(value);
                          applyStyle("lineHeight", value.toString());
                        }}
                        min={1}
                        max={3}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-sm w-12 text-right">{lineHeight}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Text Align</Label>
                    <Select
                      value={textAlign}
                      onValueChange={(value) => {
                        setTextAlign(value);
                        applyStyle("textAlign", value);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="justify">Justify</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Colors & Effects Tab */}
                <TabsContent value="colors" className="p-4 space-y-4">
                  <div>
                    <Label htmlFor="color" className="text-xs font-medium">
                      Text Color
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="color"
                        type="color"
                        value={color}
                        onChange={(e) => {
                          setColor(e.target.value);
                          applyStyle("color", e.target.value);
                        }}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={color}
                        onChange={(e) => {
                          setColor(e.target.value);
                          applyStyle("color", e.target.value);
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bgColor" className="text-xs font-medium">
                      Background Color
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="bgColor"
                        type="color"
                        value={bgColor}
                        onChange={(e) => {
                          setBgColor(e.target.value);
                          applyStyle("backgroundColor", e.target.value);
                        }}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={bgColor}
                        onChange={(e) => {
                          setBgColor(e.target.value);
                          applyStyle("backgroundColor", e.target.value);
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Border Radius</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[parseInt(borderRadius.toString())]}
                        onValueChange={([value]) => {
                          setBorderRadius(value);
                          applyStyle("borderRadius", value + "px");
                        }}
                        min={0}
                        max={50}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm w-12 text-right">{borderRadius}px</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Opacity</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[opacity]}
                        onValueChange={([value]) => {
                          setOpacity(value);
                          applyStyle("opacity", (value / 100).toString());
                        }}
                        min={0}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm w-12 text-right">{opacity}%</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Change Counter */}
            {edits.length > 0 && (
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {edits.length} change{edits.length !== 1 ? 's' : ''} made
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
