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
  Layout,
  Save,
  Minimize2,
} from "lucide-react";

interface ElementData {
  selector: string; // Editor selector (with data-rybbit-id)
  productionSelector: string; // Production selector for code generation
  tagName: string;
  textContent: string;
  innerHTML: string;
  computedStyles: CSSStyleDeclaration | null;
  // Parsed style values
  display: string;
  width: string;
  height: string;
  maxWidth: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  textAlign: string;
  textDecoration: string;
  color: string;
  backgroundColor: string;
  borderWidth: string;
  borderStyle: string;
  borderColor: string;
  borderRadius: string;
  boxShadow: string;
  opacity: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  flexWrap: string;
  gap: string;
}

interface VisualEditorProps {
  targetUrl: string;
  initialCode?: string;
  onSave: (code: string) => void;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

export function VisualEditor({
  targetUrl,
  initialCode,
  onSave,
  onClose,
  isMinimized,
  onToggleMinimize,
}: VisualEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedElement, setSelectedElement] = useState<ElementData | null>(null);
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [changeCount, setChangeCount] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);

  // Element state
  const [visibility, setVisibility] = useState(true);

  // Content state
  const [textContent, setTextContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTarget, setLinkTarget] = useState("_self");

  // Layout state
  const [display, setDisplay] = useState("block");
  const [flexDirection, setFlexDirection] = useState("row");
  const [justifyContent, setJustifyContent] = useState("flex-start");
  const [alignItems, setAlignItems] = useState("stretch");
  const [flexWrap, setFlexWrap] = useState("nowrap");
  const [marginTop, setMarginTop] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingRight, setPaddingRight] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);
  const [paddingLeft, setPaddingLeft] = useState(0);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [maxWidth, setMaxWidth] = useState("");

  // Typography state
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState("400");
  const [lineHeight, setLineHeight] = useState(1.5);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [textTransform, setTextTransform] = useState("none");
  const [textAlign, setTextAlign] = useState("left");
  const [textDecoration, setTextDecoration] = useState("none");

  // Colors & effects state
  const [textColor, setTextColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("#000000");
  const [borderRadius, setBorderRadius] = useState(0);
  const [boxShadowX, setBoxShadowX] = useState(0);
  const [boxShadowY, setBoxShadowY] = useState(0);
  const [boxShadowBlur, setBoxShadowBlur] = useState(0);
  const [boxShadowSpread, setBoxShadowSpread] = useState(0);
  const [boxShadowColor, setBoxShadowColor] = useState("#000000");
  const [opacity, setOpacity] = useState(100);

  // Parse and apply initial code when iframe loads
  useEffect(() => {
    if (!initialCode || !iframeReady || !iframeRef.current) return;

    const iframeDoc = iframeRef.current.contentDocument;
    if (!iframeDoc) return;

    console.log("Visual Editor: Applying initial code", initialCode);

    try {
      // Parse the initialCode to extract changes
      const parsedChanges: Record<string, any> = {};

      // Match patterns like:
      // document.querySelector('selector').style.property = 'value';
      // document.querySelector('selector').textContent = 'value';
      const styleRegex = /document\.querySelector\(['"](.+?)['"]\)\.style\.(\w+)\s*=\s*['"](.+?)['"]/g;
      const textContentRegex = /document\.querySelector\(['"](.+?)['"]\)\.textContent\s*=\s*['"](.+?)['"]/g;
      const innerHTMLRegex = /document\.querySelector\(['"](.+?)['"]\)\.innerHTML\s*=\s*['"](.+?)['"]/g;

      let match;

      // Parse style changes
      while ((match = styleRegex.exec(initialCode)) !== null) {
        const [, selector, property, value] = match;
        if (!parsedChanges[selector]) {
          parsedChanges[selector] = {};
        }
        parsedChanges[selector][property] = value;

        // Apply to iframe
        const element = iframeDoc.querySelector(selector) as HTMLElement;
        if (element) {
          (element.style as any)[property] = value;
        }
      }

      // Parse textContent changes
      while ((match = textContentRegex.exec(initialCode)) !== null) {
        const [, selector, value] = match;
        if (!parsedChanges[selector]) {
          parsedChanges[selector] = {};
        }
        parsedChanges[selector].textContent = value;

        // Apply to iframe
        const element = iframeDoc.querySelector(selector) as HTMLElement;
        if (element) {
          element.textContent = value;
        }
      }

      // Parse innerHTML changes
      while ((match = innerHTMLRegex.exec(initialCode)) !== null) {
        const [, selector, value] = match;
        if (!parsedChanges[selector]) {
          parsedChanges[selector] = {};
        }
        parsedChanges[selector].innerHTML = value;

        // Apply to iframe
        const element = iframeDoc.querySelector(selector) as HTMLElement;
        if (element) {
          element.innerHTML = value;
        }
      }

      // Update state with parsed changes
      setChanges(parsedChanges);

      // Calculate and set change count
      const totalChanges = Object.keys(parsedChanges).reduce(
        (sum, sel) => sum + Object.keys(parsedChanges[sel]).length,
        0
      );
      setChangeCount(totalChanges);

      console.log("Visual Editor: Loaded existing changes", { parsedChanges, totalChanges });
    } catch (error) {
      console.error("Visual Editor: Error parsing initial code", error);
    }
  }, [initialCode, iframeReady]);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;

    const handleLoad = () => {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      const iframeWin = iframe.contentWindow;
      if (!iframeDoc || !iframeWin) return;

      console.log("Visual Editor: Iframe loaded and ready");

      // Inject styles for hover and selection
      const style = iframeDoc.createElement("style");
      style.textContent = `
        .rybbit-hover {
          outline: 2px dashed #3b82f6 !important;
          outline-offset: 2px !important;
          cursor: pointer !important;
        }
        .rybbit-selected {
          outline: 2px solid #10b981 !important;
          outline-offset: 2px !important;
        }
      `;
      iframeDoc.head.appendChild(style);

      // Combined click handler: prevent navigation AND handle selection
      iframeDoc.addEventListener("click", (e: any) => {
        // Prevent all navigation
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        if (!target) return;

        console.log("Visual Editor: Element clicked", target.tagName, target.className);

        // Remove previous selection
        iframeDoc.querySelectorAll(".rybbit-selected").forEach((el) => {
          el.classList.remove("rybbit-selected");
        });

        // Add selection to clicked element
        target.classList.add("rybbit-selected");

        // Extract element data - USE IFRAME WINDOW FOR COMPUTED STYLES
        const computedStyles = iframeWin.getComputedStyle(target);
        const selector = generateSelector(target); // Editor selector with data-rybbit-id
        const productionSelector = generateProductionSelector(target); // Production selector for code

        console.log("Visual Editor: Selectors", { editor: selector, production: productionSelector });

        const elementData: ElementData = {
          selector,
          productionSelector,
          tagName: target.tagName.toLowerCase(),
          textContent: target.textContent || "",
          innerHTML: target.innerHTML || "",
          computedStyles,
          display: computedStyles.display,
          width: computedStyles.width,
          height: computedStyles.height,
          maxWidth: computedStyles.maxWidth,
          marginTop: computedStyles.marginTop,
          marginRight: computedStyles.marginRight,
          marginBottom: computedStyles.marginBottom,
          marginLeft: computedStyles.marginLeft,
          paddingTop: computedStyles.paddingTop,
          paddingRight: computedStyles.paddingRight,
          paddingBottom: computedStyles.paddingBottom,
          paddingLeft: computedStyles.paddingLeft,
          fontFamily: computedStyles.fontFamily,
          fontSize: computedStyles.fontSize,
          fontWeight: computedStyles.fontWeight,
          lineHeight: computedStyles.lineHeight,
          letterSpacing: computedStyles.letterSpacing,
          textTransform: computedStyles.textTransform,
          textAlign: computedStyles.textAlign,
          textDecoration: computedStyles.textDecoration,
          color: computedStyles.color,
          backgroundColor: computedStyles.backgroundColor,
          borderWidth: computedStyles.borderWidth,
          borderStyle: computedStyles.borderStyle,
          borderColor: computedStyles.borderColor,
          borderRadius: computedStyles.borderRadius,
          boxShadow: computedStyles.boxShadow,
          opacity: computedStyles.opacity,
          flexDirection: computedStyles.flexDirection,
          justifyContent: computedStyles.justifyContent,
          alignItems: computedStyles.alignItems,
          flexWrap: computedStyles.flexWrap,
          gap: computedStyles.gap,
        };

        setSelectedElement(elementData);
        populateControls(elementData);
      }, true); // Use capture phase

      // Prevent form submissions
      iframeDoc.addEventListener("submit", (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);

      // Prevent right-click context menu
      iframeDoc.addEventListener("contextmenu", (e) => {
        e.preventDefault();
      }, true);

      // Hover effects
      iframeDoc.addEventListener("mouseover", (e: any) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("rybbit-selected")) return;
        target.classList.add("rybbit-hover");
      });

      iframeDoc.addEventListener("mouseout", (e: any) => {
        const target = e.target as HTMLElement;
        target.classList.remove("rybbit-hover");
      });

      // Mark iframe as ready
      console.log("Visual Editor: Marking iframe as ready");
      setIframeReady(true);
    };

    iframe.addEventListener("load", handleLoad);

    // If iframe already loaded (cached), trigger handleLoad manually
    if (iframe.contentDocument?.readyState === "complete") {
      handleLoad();
    }

    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, []);

  // Generate CSS selector for element (editor use - with data attribute)
  const generateSelector = (element: HTMLElement): string => {
    // If element already has our data attribute, use it
    if (element.hasAttribute('data-rybbit-id')) {
      return `[data-rybbit-id="${element.getAttribute('data-rybbit-id')}"]`;
    }

    // Add unique data attribute to element
    const uniqueId = `rybbit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    element.setAttribute('data-rybbit-id', uniqueId);
    return `[data-rybbit-id="${uniqueId}"]`;
  };

  // Generate production-safe CSS selector for code generation
  const generateProductionSelector = (element: HTMLElement): string => {
    // 1. Try ID first (most reliable)
    if (element.id) {
      return `#${element.id}`;
    }

    // 2. Try to find a simple, unique class (no special chars)
    if (element.className) {
      const classes = element.className
        .split(" ")
        .filter((c) => {
          // Filter out rybbit classes and complex classes with special chars
          return c &&
                 !c.startsWith("rybbit-") &&
                 !/[:\[\]\\\/\(\)\@\&]/.test(c); // No special characters
        });

      // Try each simple class to see if it's unique
      for (const cls of classes) {
        const selector = `.${cls}`;
        const iframeDoc = element.ownerDocument;
        if (iframeDoc && iframeDoc.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }

      // If no unique class, use first simple class with nth-of-type
      if (classes.length > 0) {
        const parent = element.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (el) => el.tagName === element.tagName
          );
          const index = siblings.indexOf(element) + 1;
          return `.${classes[0]}:nth-of-type(${index})`;
        }
        return `.${classes[0]}`;
      }
    }

    // 3. Fallback: use tag name with nth-of-type
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (el) => el.tagName === element.tagName
      );
      const index = siblings.indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
    }

    // 4. Last resort: just tag name
    return element.tagName.toLowerCase();
  };

  // Populate controls from selected element
  const populateControls = (data: ElementData) => {
    // Element
    setVisibility(data.computedStyles?.display !== "none");

    // Content
    setTextContent(data.textContent);
    setHtmlContent(data.innerHTML);

    // Layout
    setDisplay(data.display);
    setFlexDirection(data.flexDirection || "row");
    setJustifyContent(data.justifyContent || "flex-start");
    setAlignItems(data.alignItems || "stretch");
    setFlexWrap(data.flexWrap || "nowrap");
    setMarginTop(parsePx(data.marginTop));
    setMarginRight(parsePx(data.marginRight));
    setMarginBottom(parsePx(data.marginBottom));
    setMarginLeft(parsePx(data.marginLeft));
    setPaddingTop(parsePx(data.paddingTop));
    setPaddingRight(parsePx(data.paddingRight));
    setPaddingBottom(parsePx(data.paddingBottom));
    setPaddingLeft(parsePx(data.paddingLeft));
    setWidth(data.width);
    setHeight(data.height);
    setMaxWidth(data.maxWidth);

    // Typography
    setFontSize(parsePx(data.fontSize));
    setFontWeight(data.fontWeight || "400");
    setLineHeight(parseFloat(data.lineHeight) / parsePx(data.fontSize) || 1.5);
    setLetterSpacing(parsePx(data.letterSpacing));
    setTextTransform(data.textTransform || "none");
    setTextAlign(data.textAlign || "left");
    setTextDecoration(data.textDecoration.split(" ")[0] || "none");

    // Colors & effects
    setTextColor(rgbToHex(data.color));
    setBackgroundColor(rgbToHex(data.backgroundColor));
    setBorderWidth(parsePx(data.borderWidth));
    setBorderStyle(data.borderStyle || "solid");
    setBorderColor(rgbToHex(data.borderColor));
    setBorderRadius(parsePx(data.borderRadius));

    // Parse box shadow
    if (data.boxShadow && data.boxShadow !== "none") {
      const shadowParts = data.boxShadow.match(/(-?\d+\.?\d*)px/g);
      if (shadowParts && shadowParts.length >= 4) {
        setBoxShadowX(parsePx(shadowParts[0]));
        setBoxShadowY(parsePx(shadowParts[1]));
        setBoxShadowBlur(parsePx(shadowParts[2]));
        setBoxShadowSpread(parsePx(shadowParts[3]));
      }
    }

    setOpacity(Math.round(parseFloat(data.opacity) * 100));
  };

  // Helper functions
  const parsePx = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : Math.round(num);
  };

  const rgbToHex = (rgb: string): string => {
    if (!rgb || rgb === "rgba(0, 0, 0, 0)") return "#ffffff";
    const match = rgb.match(/\d+/g);
    if (!match) return "#000000";
    const r = parseInt(match[0]).toString(16).padStart(2, "0");
    const g = parseInt(match[1]).toString(16).padStart(2, "0");
    const b = parseInt(match[2]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  };

  // Apply style change to iframe element
  const applyStyle = (property: string, value: any) => {
    if (!selectedElement || !iframeRef.current) {
      console.log("Visual Editor: applyStyle called but no element selected or iframe missing");
      return;
    }

    const iframeDoc = iframeRef.current.contentDocument;
    if (!iframeDoc) {
      console.log("Visual Editor: No iframe document");
      return;
    }

    const element = iframeDoc.querySelector(selectedElement.selector) as HTMLElement;
    if (!element) {
      console.log("Visual Editor: Element not found with selector:", selectedElement.selector);
      return;
    }

    console.log(`Visual Editor: Applying ${property} = ${value} to ${selectedElement.selector}`);

    // Apply the change to DOM first
    if (property === "textContent") {
      element.textContent = value;
    } else if (property === "innerHTML") {
      element.innerHTML = value;
    } else if (property === "display") {
      element.style.display = value;
    } else {
      (element.style as any)[property] = value;
    }

    // Track the change for code generation (use production selector)
    setChanges((prevChanges) => {
      const newChanges = { ...prevChanges };
      const prodSelector = selectedElement.productionSelector;
      if (!newChanges[prodSelector]) {
        newChanges[prodSelector] = {};
      }
      newChanges[prodSelector][property] = value;

      // Calculate total changes
      const totalChanges = Object.keys(newChanges).reduce(
        (sum, sel) => sum + Object.keys(newChanges[sel]).length,
        0
      );
      console.log(`Visual Editor: Total changes = ${totalChanges}`, newChanges);
      setChangeCount(totalChanges);

      return newChanges;
    });
  };

  // Generate JavaScript code from changes
  const generateCode = (): string => {
    const lines: string[] = [];

    for (const [selector, styles] of Object.entries(changes)) {
      for (const [property, value] of Object.entries(styles)) {
        if (property === "textContent") {
          lines.push(`document.querySelector('${selector}').textContent = '${value}';`);
        } else if (property === "innerHTML") {
          lines.push(`document.querySelector('${selector}').innerHTML = '${value}';`);
        } else {
          lines.push(`document.querySelector('${selector}').style.${property} = '${value}';`);
        }
      }
    }

    return `(function() {\n  ${lines.join("\n  ")}\n})();`;
  };

  const handleSave = () => {
    const code = generateCode();
    onSave(code);
    onClose();
  };

  if (isMinimized) {
    return (
      <Button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 z-[60] shadow-lg"
        size="lg"
      >
        <MousePointer className="w-4 h-4 mr-2" />
        Resume Visual Editor
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop - non-interactive */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />

      {/* Left Panel - Editor Controls */}
      <div className="w-96 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto relative pointer-events-auto">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Visual Editor</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onToggleMinimize}>
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            {iframeReady ? (
              <>Click elements to edit • {changeCount} change{changeCount !== 1 ? "s" : ""}</>
            ) : (
              <>Loading editor...</>
            )}
          </p>
        </div>

        {selectedElement ? (
          <Tabs defaultValue="element" className="p-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="element" className="text-xs">
                <MousePointer className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="content" className="text-xs">
                <Code className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="layout" className="text-xs">
                <Layout className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="typography" className="text-xs">
                <Type className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="colors" className="text-xs">
                <Palette className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>

            {/* Element Tab */}
            <TabsContent value="element" className="space-y-4">
              <div>
                <Label className="text-xs text-neutral-500">CSS Selector</Label>
                <Input value={selectedElement.selector} readOnly className="font-mono text-xs" />
              </div>

              <div>
                <Label className="text-xs text-neutral-500">HTML Tag</Label>
                <Input value={selectedElement.tagName} readOnly className="font-mono text-xs" />
              </div>

              <div className="flex items-center justify-between">
                <Label>Visibility</Label>
                <Switch
                  checked={visibility}
                  onCheckedChange={(checked) => {
                    setVisibility(checked);
                    applyStyle("display", checked ? "block" : "none");
                  }}
                />
              </div>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <div>
                <Label>Text Content</Label>
                <Textarea
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value);
                    applyStyle("textContent", e.target.value);
                  }}
                  rows={4}
                  placeholder="Element text content..."
                />
              </div>

              <div>
                <Label>HTML Content</Label>
                <Textarea
                  value={htmlContent}
                  onChange={(e) => {
                    setHtmlContent(e.target.value);
                    applyStyle("innerHTML", e.target.value);
                  }}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="<div>HTML content...</div>"
                />
              </div>

              {selectedElement.tagName === "a" && (
                <>
                  <div>
                    <Label>Link URL</Label>
                    <Input
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        applyStyle("href", e.target.value);
                      }}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <Label>Link Target</Label>
                    <Select value={linkTarget} onValueChange={setLinkTarget}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_self">Same Tab</SelectItem>
                        <SelectItem value="_blank">New Tab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Layout & Spacing Tab */}
            <TabsContent value="layout" className="space-y-4">
              <div>
                <Label>Display Mode</Label>
                <Select
                  value={display}
                  onValueChange={(value) => {
                    setDisplay(value);
                    applyStyle("display", value);
                  }}
                >
                  <SelectTrigger>
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

              {display === "flex" && (
                <>
                  <div>
                    <Label>Flex Direction</Label>
                    <Select
                      value={flexDirection}
                      onValueChange={(value) => {
                        setFlexDirection(value);
                        applyStyle("flexDirection", value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="row">Row</SelectItem>
                        <SelectItem value="column">Column</SelectItem>
                        <SelectItem value="row-reverse">Row Reverse</SelectItem>
                        <SelectItem value="column-reverse">Column Reverse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Justify Content</Label>
                    <Select
                      value={justifyContent}
                      onValueChange={(value) => {
                        setJustifyContent(value);
                        applyStyle("justifyContent", value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flex-start">Start</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="flex-end">End</SelectItem>
                        <SelectItem value="space-between">Space Between</SelectItem>
                        <SelectItem value="space-around">Space Around</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Align Items</Label>
                    <Select
                      value={alignItems}
                      onValueChange={(value) => {
                        setAlignItems(value);
                        applyStyle("alignItems", value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stretch">Stretch</SelectItem>
                        <SelectItem value="flex-start">Start</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="flex-end">End</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Margin (px)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      placeholder="Top"
                      value={marginTop}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setMarginTop(val);
                        applyStyle("marginTop", `${val}px`);
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Right"
                      value={marginRight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setMarginRight(val);
                        applyStyle("marginRight", `${val}px`);
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Bottom"
                      value={marginBottom}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setMarginBottom(val);
                        applyStyle("marginBottom", `${val}px`);
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Left"
                      value={marginLeft}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setMarginLeft(val);
                        applyStyle("marginLeft", `${val}px`);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Padding (px)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      placeholder="Top"
                      value={paddingTop}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPaddingTop(val);
                        applyStyle("paddingTop", `${val}px`);
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Right"
                      value={paddingRight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPaddingRight(val);
                        applyStyle("paddingRight", `${val}px`);
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Bottom"
                      value={paddingBottom}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPaddingBottom(val);
                        applyStyle("paddingBottom", `${val}px`);
                      }}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Left"
                      value={paddingLeft}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPaddingLeft(val);
                        applyStyle("paddingLeft", `${val}px`);
                      }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Font Size</Label>
                  <span className="text-sm font-medium">{fontSize}px</span>
                </div>
                <Slider
                  value={[fontSize]}
                  onValueChange={([value]) => {
                    setFontSize(value);
                    applyStyle("fontSize", `${value}px`);
                  }}
                  min={8}
                  max={72}
                  step={1}
                />
              </div>

              <div>
                <Label>Font Weight</Label>
                <Select
                  value={fontWeight}
                  onValueChange={(value) => {
                    setFontWeight(value);
                    applyStyle("fontWeight", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">Light</SelectItem>
                    <SelectItem value="400">Normal</SelectItem>
                    <SelectItem value="500">Medium</SelectItem>
                    <SelectItem value="600">Semi-Bold</SelectItem>
                    <SelectItem value="700">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Line Height</Label>
                  <span className="text-sm font-medium">{lineHeight.toFixed(1)}</span>
                </div>
                <Slider
                  value={[lineHeight]}
                  onValueChange={([value]) => {
                    setLineHeight(value);
                    applyStyle("lineHeight", value.toString());
                  }}
                  min={1.0}
                  max={3.0}
                  step={0.1}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Letter Spacing</Label>
                  <span className="text-sm font-medium">{letterSpacing}px</span>
                </div>
                <Slider
                  value={[letterSpacing]}
                  onValueChange={([value]) => {
                    setLetterSpacing(value);
                    applyStyle("letterSpacing", `${value}px`);
                  }}
                  min={-2}
                  max={10}
                  step={0.5}
                />
              </div>

              <div>
                <Label>Text Transform</Label>
                <Select
                  value={textTransform}
                  onValueChange={(value) => {
                    setTextTransform(value);
                    applyStyle("textTransform", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="uppercase">UPPERCASE</SelectItem>
                    <SelectItem value="lowercase">lowercase</SelectItem>
                    <SelectItem value="capitalize">Capitalize</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Text Align</Label>
                <Select
                  value={textAlign}
                  onValueChange={(value) => {
                    setTextAlign(value);
                    applyStyle("textAlign", value);
                  }}
                >
                  <SelectTrigger>
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

              <div>
                <Label>Text Decoration</Label>
                <Select
                  value={textDecoration}
                  onValueChange={(value) => {
                    setTextDecoration(value);
                    applyStyle("textDecoration", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                    <SelectItem value="line-through">Line Through</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Colors & Effects Tab */}
            <TabsContent value="colors" className="space-y-4">
              <div>
                <Label>Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      applyStyle("color", e.target.value);
                    }}
                    className="w-16 h-10"
                  />
                  <Input
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      applyStyle("color", e.target.value);
                    }}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label>Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => {
                      setBackgroundColor(e.target.value);
                      applyStyle("backgroundColor", e.target.value);
                    }}
                    className="w-16 h-10"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => {
                      setBackgroundColor(e.target.value);
                      applyStyle("backgroundColor", e.target.value);
                    }}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Border Width</Label>
                  <span className="text-sm font-medium">{borderWidth}px</span>
                </div>
                <Slider
                  value={[borderWidth]}
                  onValueChange={([value]) => {
                    setBorderWidth(value);
                    applyStyle("borderWidth", `${value}px`);
                  }}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>

              <div>
                <Label>Border Style</Label>
                <Select
                  value={borderStyle}
                  onValueChange={(value) => {
                    setBorderStyle(value);
                    applyStyle("borderStyle", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Border Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={borderColor}
                    onChange={(e) => {
                      setBorderColor(e.target.value);
                      applyStyle("borderColor", e.target.value);
                    }}
                    className="w-16 h-10"
                  />
                  <Input
                    value={borderColor}
                    onChange={(e) => {
                      setBorderColor(e.target.value);
                      applyStyle("borderColor", e.target.value);
                    }}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Border Radius</Label>
                  <span className="text-sm font-medium">{borderRadius}px</span>
                </div>
                <Slider
                  value={[borderRadius]}
                  onValueChange={([value]) => {
                    setBorderRadius(value);
                    applyStyle("borderRadius", `${value}px`);
                  }}
                  min={0}
                  max={50}
                  step={1}
                />
              </div>

              <div>
                <Label className="mb-2 block">Box Shadow</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12">X:</Label>
                    <Slider
                      value={[boxShadowX]}
                      onValueChange={([value]) => {
                        setBoxShadowX(value);
                        applyStyle(
                          "boxShadow",
                          `${value}px ${boxShadowY}px ${boxShadowBlur}px ${boxShadowSpread}px ${boxShadowColor}`
                        );
                      }}
                      min={-20}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{boxShadowX}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12">Y:</Label>
                    <Slider
                      value={[boxShadowY]}
                      onValueChange={([value]) => {
                        setBoxShadowY(value);
                        applyStyle(
                          "boxShadow",
                          `${boxShadowX}px ${value}px ${boxShadowBlur}px ${boxShadowSpread}px ${boxShadowColor}`
                        );
                      }}
                      min={-20}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{boxShadowY}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12">Blur:</Label>
                    <Slider
                      value={[boxShadowBlur]}
                      onValueChange={([value]) => {
                        setBoxShadowBlur(value);
                        applyStyle(
                          "boxShadow",
                          `${boxShadowX}px ${boxShadowY}px ${value}px ${boxShadowSpread}px ${boxShadowColor}`
                        );
                      }}
                      min={0}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{boxShadowBlur}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-12">Spread:</Label>
                    <Slider
                      value={[boxShadowSpread]}
                      onValueChange={([value]) => {
                        setBoxShadowSpread(value);
                        applyStyle(
                          "boxShadow",
                          `${boxShadowX}px ${boxShadowY}px ${boxShadowBlur}px ${value}px ${boxShadowColor}`
                        );
                      }}
                      min={-20}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{boxShadowSpread}</span>
                  </div>
                  <Input
                    type="color"
                    value={boxShadowColor}
                    onChange={(e) => {
                      setBoxShadowColor(e.target.value);
                      applyStyle(
                        "boxShadow",
                        `${boxShadowX}px ${boxShadowY}px ${boxShadowBlur}px ${boxShadowSpread}px ${e.target.value}`
                      );
                    }}
                    className="w-full h-10"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Opacity</Label>
                  <span className="text-sm font-medium">{opacity}%</span>
                </div>
                <Slider
                  value={[opacity]}
                  onValueChange={([value]) => {
                    setOpacity(value);
                    applyStyle("opacity", (value / 100).toString());
                  }}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-8 text-center text-neutral-500">
            <MousePointer className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click any element on the page to start editing</p>
          </div>
        )}

        {/* Save Button */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 sticky bottom-0 bg-white dark:bg-neutral-900">
          <Button onClick={handleSave} className="w-full" disabled={changeCount === 0}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes ({changeCount})
          </Button>
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 flex flex-col relative pointer-events-auto">
        <div className="p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Preview: {targetUrl}
          </p>
        </div>
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-950 relative">
          {!iframeReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-neutral-900/90 z-10">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading preview...</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={targetUrl}
            className="w-full h-full border-none"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}
