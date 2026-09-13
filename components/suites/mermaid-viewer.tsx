"use client";

import {
  Download,
  FileCode2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton, copyText } from "@/components/copy-button";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  mermaidViewerDefaultSample,
  mermaidViewerSamples,
} from "@/lib/mermaid-samples";
import { pasteAnythingStorageKeys } from "@/lib/tools";
import {
  detectDiagramType,
  diagramTypeLabel,
  extractMermaidSource,
  fitTransform,
  formatZoomPercent,
  mermaidErrorMessage,
  zoomAroundPoint,
  type Point,
} from "@/lib/mermaid-utils";

type PaneMode = "split" | "editor" | "viewer";

const ZOOM_STEP = 1.18;
const ACCEPT = ".mmd,.md,.markdown,.txt,text/plain,text/markdown";

let mermaidReady = false;
let mermaidRenderId = 0;

async function loadMermaid() {
  const mermaid = (await import("mermaid")).default;
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: 'Arial, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
      themeVariables: {
        background: "#fcfbf7",
        primaryColor: "#eae9e3",
        primaryTextColor: "#171c19",
        primaryBorderColor: "#171c19",
        lineColor: "#171c19",
        secondaryColor: "#f5f4ef",
        tertiaryColor: "#fcfbf7",
        mainBkg: "#fcfbf7",
        nodeBorder: "#171c19",
        clusterBkg: "#eae9e3",
        clusterBorder: "#9ca19c",
        titleColor: "#171c19",
        edgeLabelBackground: "#f5f4ef",
        actorBkg: "#eae9e3",
        actorBorder: "#171c19",
        actorTextColor: "#171c19",
        signalColor: "#171c19",
        labelBoxBkgColor: "#eae9e3",
        labelBoxBorderColor: "#171c19",
        labelTextColor: "#171c19",
        loopTextColor: "#171c19",
        noteBkgColor: "#f2dfd8",
        noteTextColor: "#a53b28",
        noteBorderColor: "#e0543a",
        pie1: "#e0543a",
        pie2: "#455c76",
        pie3: "#566b53",
        pie4: "#6d5872",
        pie5: "#a53b28",
        pie6: "#171c19",
        git0: "#e0543a",
        git1: "#455c76",
        git2: "#566b53",
        git3: "#6d5872",
      },
      flowchart: {
        htmlLabels: false,
        curve: "basis",
        padding: 12,
      },
    });
    mermaidReady = true;
  }
  return mermaid;
}

function triggerDownload(contents: string, filename: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function localPoint(event: { clientX: number; clientY: number }, viewport: HTMLElement): Point {
  const bounds = viewport.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function pointerDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerCenter(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function MermaidViewerSuite() {
  const [input, setInput] = useState(mermaidViewerDefaultSample.source);
  const [activeSampleId, setActiveSampleId] = useState(mermaidViewerDefaultSample.id);
  const [paneMode, setPaneMode] = useState<PaneMode>("split");
  const [fullscreen, setFullscreen] = useState(false);
  const [splitPercent, setSplitPercent] = useState(42);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [fileDrag, setFileDrag] = useState(false);
  const [svgMarkup, setSvgMarkup] = useState("");

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const fitOnRenderRef = useRef(true);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; zoom: number; pan: Point } | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; pan: Point } | null>(null);
  const frameRef = useRef(0);

  const source = useMemo(() => extractMermaidSource(input), [input]);
  const diagramType = useMemo(() => detectDiagramType(source) ?? "", [source]);
  const shownError = source ? error : "";
  const shownSvg = source ? svgMarkup : "";

  const applyTransform = useCallback((nextZoom: number, nextPan: Point) => {
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    if (stageRef.current) {
      stageRef.current.style.transform = `translate(${nextPan.x}px, ${nextPan.y}px) scale(${nextZoom})`;
    }
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      setZoom(zoomRef.current);
      setPan(panRef.current);
    });
  }, []);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    const svg = svgHostRef.current?.querySelector("svg");
    if (!viewport || !svg) {
      applyTransform(1, { x: 24, y: 24 });
      return;
    }
    let width = Number.parseFloat(svg.getAttribute("width") ?? "");
    let height = Number.parseFloat(svg.getAttribute("height") ?? "");
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      const box = svg.getBBox();
      width = box.width;
      height = box.height;
    }
    const bounds = viewport.getBoundingClientRect();
    const fitted = fitTransform(width, height, bounds.width, bounds.height);
    applyTransform(fitted.zoom, fitted.pan);
  }, [applyTransform]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (sessionStorage.getItem(pasteAnythingStorageKeys.type) !== "mermaid") return;
    const storedInput = sessionStorage.getItem(pasteAnythingStorageKeys.value);
    sessionStorage.removeItem(pasteAnythingStorageKeys.value);
    sessionStorage.removeItem(pasteAnythingStorageKeys.type);
    if (storedInput === null) return;
    const timer = window.setTimeout(() => {
      setInput(storedInput);
      setActiveSampleId("");
      fitOnRenderRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!source) {
      if (svgHostRef.current) svgHostRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const mermaid = await loadMermaid();
        await mermaid.parse(source);
        if (cancelled) return;
        mermaidRenderId += 1;
        const { svg } = await mermaid.render(`devsmithMermaid${mermaidRenderId}`, source);
        if (cancelled) return;
        if (svgHostRef.current) svgHostRef.current.innerHTML = svg;
        setSvgMarkup(svg);
        setError("");
        if (fitOnRenderRef.current) {
          fitOnRenderRef.current = false;
          window.requestAnimationFrame(() => fitToView());
        }
      } catch (caught) {
        if (cancelled) return;
        setError(mermaidErrorMessage(caught));
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fitToView, source]);

  const exitOverlay = useCallback(() => {
    setFullscreen(false);
    setPaneMode("split");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (fullscreen || paneMode !== "split")) {
        event.preventDefault();
        exitOverlay();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFullscreen((current) => !current);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        fitToView();
      }
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        const next = zoomAroundPoint(zoomRef.current, zoomRef.current * ZOOM_STEP, { x: 0, y: 0 }, panRef.current);
        const viewport = viewportRef.current;
        if (viewport) {
          const bounds = viewport.getBoundingClientRect();
          const centered = zoomAroundPoint(
            zoomRef.current,
            zoomRef.current * ZOOM_STEP,
            { x: bounds.width / 2, y: bounds.height / 2 },
            panRef.current,
          );
          applyTransform(centered.zoom, centered.pan);
        } else {
          applyTransform(next.zoom, next.pan);
        }
      }
      if (event.key === "-") {
        event.preventDefault();
        const viewport = viewportRef.current;
        if (!viewport) return;
        const bounds = viewport.getBoundingClientRect();
        const next = zoomAroundPoint(
          zoomRef.current,
          zoomRef.current / ZOOM_STEP,
          { x: bounds.width / 2, y: bounds.height / 2 },
          panRef.current,
        );
        applyTransform(next.zoom, next.pan);
      }
      if (event.shiftKey && event.key.toLowerCase() === "c" && source) {
        event.preventDefault();
        void copyText(source);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyTransform, exitOverlay, fitToView, fullscreen, paneMode, source]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.ctrlKey ? 0.012 : 0.0018;
      const next = zoomAroundPoint(
        zoomRef.current,
        zoomRef.current * Math.exp(-event.deltaY * factor),
        localPoint(event, viewport),
        panRef.current,
      );
      applyTransform(next.zoom, next.pan);
    };

    const onGesture = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & { scale?: number; clientX: number; clientY: number };
      if (event.type === "gesturestart") {
        pinchRef.current = { distance: 1, zoom: zoomRef.current, pan: panRef.current };
      }
      if (!pinchRef.current || typeof gesture.scale !== "number") return;
      const next = zoomAroundPoint(
        pinchRef.current.zoom,
        pinchRef.current.zoom * gesture.scale,
        localPoint(gesture, viewport),
        pinchRef.current.pan,
      );
      applyTransform(next.zoom, next.pan);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("gesturestart", onGesture);
    viewport.addEventListener("gesturechange", onGesture);
    viewport.addEventListener("gestureend", onGesture);
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("gesturestart", onGesture);
      viewport.removeEventListener("gesturechange", onGesture);
      viewport.removeEventListener("gestureend", onGesture);
    };
  }, [applyTransform, fullscreen, paneMode]);

  const loadSource = (value: string, sampleId = "") => {
    setInput(value);
    setActiveSampleId(sampleId);
    fitOnRenderRef.current = true;
  };

  const openText = async (file: File) => {
    loadSource(await file.text());
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void openText(file);
  };

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const move = (pointerEvent: PointerEvent) => {
      const next = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
      setSplitPercent(Math.max(25, Math.min(75, next)));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const point = localPoint(event, viewport);
    pointersRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: pointerDistance(first, second),
        zoom: zoomRef.current,
        pan: panRef.current,
      };
      dragRef.current = null;
      setPanning(false);
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pan: panRef.current,
    };
    setPanning(true);
  };

  const onViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, localPoint(event, viewport));
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = pointerDistance(first, second);
      if (distance < 1 || pinchRef.current.distance < 1) return;
      const nextZoom = pinchRef.current.zoom * (distance / pinchRef.current.distance);
      const next = zoomAroundPoint(pinchRef.current.zoom, nextZoom, pointerCenter(first, second), pinchRef.current.pan);
      applyTransform(next.zoom, next.pan);
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    applyTransform(zoomRef.current, {
      x: drag.pan.x + (event.clientX - drag.x),
      y: drag.pan.y + (event.clientY - drag.y),
    });
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) setPanning(false);
  };

  const zoomBy = (multiplier: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const next = zoomAroundPoint(
      zoomRef.current,
      zoomRef.current * multiplier,
      { x: bounds.width / 2, y: bounds.height / 2 },
      panRef.current,
    );
    applyTransform(next.zoom, next.pan);
  };

  const togglePane = (target: PaneMode, withFullscreen = false) => {
    if (withFullscreen) setFullscreen(true);
    setPaneMode((current) => (current === target && !withFullscreen ? "split" : target));
  };

  const editorsStyle =
    paneMode === "split"
      ? {
          gridTemplateColumns: `minmax(220px, ${splitPercent}fr) 7px minmax(0, ${100 - splitPercent}fr)`,
        }
      : undefined;

  return (
    <ToolShell
      slug="mermaid"
      category="データ"
      title="Mermaid Viewer"
      description="Mermaid記法をブラウザ内でプレビューします。左右ペイン、全画面、ドラッグ移動、ピンチ拡大縮小に対応します。"
      functionCount={1}
    >
      <div className="regex-samples mermaid-samples">
        <div>
          <strong>よく使うサンプル</strong>
          <span>選ぶと入力とプレビューへ反映します</span>
        </div>
        <div>
          {mermaidViewerSamples.map((sample) => (
            <button
              type="button"
              key={sample.id}
              className={activeSampleId === sample.id ? "active" : ""}
              onClick={() => loadSource(sample.source, sample.id)}
              title={sample.description}
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mermaid-workspace ${fullscreen ? "fullscreen" : ""}`}
        onDragEnter={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          setFileDrag(true);
        }}
        onDragOver={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setFileDrag(false);
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          setFileDrag(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        {fullscreen && (
          <button type="button" className="fullscreen-exit" onClick={exitOverlay}>
            <Minimize2 size={15} />
            縮小 <kbd>Esc</kbd>
          </button>
        )}

        <div className="suite-toolbar mermaid-toolbar">
          <div>
            <label className="editor-file-button">
              <Upload size={14} aria-hidden="true" />
              ファイルを開く
              <input
                type="file"
                accept={ACCEPT}
                onChange={(event) => {
                  onFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => loadSource(mermaidViewerDefaultSample.source, mermaidViewerDefaultSample.id)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              サンプルを読み込む
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setFullscreen((current) => !current)}
              title={fullscreen ? "縮小（Esc）" : "全画面表示（Ctrl/⌘+Shift+F）"}
            >
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {fullscreen ? "縮小" : "全画面"}
            </button>
            <button
              type="button"
              className="clear-button"
              onClick={() => loadSource("")}
            >
              すべて消去
            </button>
          </div>
        </div>

        <div className={`mermaid-editors pane-${paneMode}`} style={editorsStyle}>
          <section className="suite-editor input-editor">
            <header>
              <span>EDITOR</span>
              <div>
                <small>{input.length} CHARS</small>
                <CopyButton value={source} className="compact-button" />
                <button
                  type="button"
                  onClick={() => togglePane("editor")}
                  aria-label={paneMode === "editor" ? "入力欄を元に戻す" : "入力欄を広げる"}
                >
                  {paneMode === "editor" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  {paneMode === "editor" ? "元に戻す" : "広げる"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullscreen(true);
                    setPaneMode("editor");
                  }}
                  aria-label="エディタを全画面表示"
                  title="エディタ全画面（Escで戻る）"
                >
                  <Maximize2 size={13} />
                  全画面
                </button>
              </div>
            </header>
            <textarea
              id="mermaid-input"
              name="mermaid-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setActiveSampleId("");
              }}
              placeholder="flowchart TD&#10;  A[開始] --> B[完了]"
              spellCheck={false}
              aria-label="Mermaid入力"
            />
          </section>

          <div
            className="editor-resizer"
            role="separator"
            aria-label="エディタとビューワーの幅を変更"
            aria-orientation="vertical"
            aria-valuemin={25}
            aria-valuemax={75}
            aria-valuenow={Math.round(splitPercent)}
            tabIndex={paneMode === "split" ? 0 : -1}
            onPointerDown={startResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") setSplitPercent((current) => Math.max(25, current - 5));
              if (event.key === "ArrowRight") setSplitPercent((current) => Math.min(75, current + 5));
            }}
          >
            <span />
          </div>

          <section className="suite-editor mermaid-viewer">
            <header>
              <span>VIEWER</span>
              <div>
                <small>
                  {diagramTypeLabel(diagramType)} · {formatZoomPercent(zoom)}
                </small>
                <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="縮小">
                  <ZoomOut size={13} />
                </button>
                <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="拡大">
                  <ZoomIn size={13} />
                </button>
                <button type="button" onClick={fitToView} aria-label="画面に合わせる">
                  <Scan size={13} />
                  フィット
                </button>
                <button
                  type="button"
                  disabled={!shownSvg}
                  onClick={() => triggerDownload(shownSvg, "devsmith-diagram.svg", "image/svg+xml;charset=utf-8")}
                  aria-label="SVGをダウンロード"
                >
                  <Download size={13} />
                </button>
                <button
                  type="button"
                  disabled={!source}
                  onClick={() => triggerDownload(source, "devsmith-diagram.mmd", "text/plain;charset=utf-8")}
                  aria-label="Mermaidソースをダウンロード"
                >
                  <FileCode2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => togglePane("viewer")}
                  aria-label={paneMode === "viewer" ? "ビューワーを元に戻す" : "ビューワーを広げる"}
                >
                  {paneMode === "viewer" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  {paneMode === "viewer" ? "元に戻す" : "広げる"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullscreen(true);
                    setPaneMode("viewer");
                  }}
                  aria-label="ビューワーを全画面表示"
                  title="ビューワー全画面（Escで戻る）"
                >
                  <Maximize2 size={13} />
                  全画面
                </button>
              </div>
            </header>
            <div
              ref={viewportRef}
              className={`mermaid-viewport ${panning ? "is-panning" : ""} ${fileDrag ? "is-file-drag" : ""}`}
              onPointerDown={onViewportPointerDown}
              onPointerMove={onViewportPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onDoubleClick={(event) => {
                event.preventDefault();
                fitToView();
              }}
              role="application"
              aria-label="Mermaidプレビュー。ドラッグで移動、ピンチまたはホイールで拡大縮小"
            >
              {!source && (
                <div className="mermaid-empty">
                  <strong>図がありません</strong>
                  <span>左側にMermaid記法を入力するか、.mmd / .md ファイルをドロップしてください。</span>
                </div>
              )}
              {shownError && (
                <div className="mermaid-error">
                  <strong>構文を確認してください</strong>
                  <span>{shownError}</span>
                </div>
              )}
              <div
                ref={stageRef}
                className="mermaid-stage"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              >
                <div ref={svgHostRef} />
              </div>
              {fileDrag && <div className="mermaid-drop-overlay">ファイルをドロップして開く</div>}
            </div>
          </section>
        </div>

        <ToolStatus error={shownError || undefined}>
          {source
            ? `${diagramTypeLabel(diagramType)} · ${formatZoomPercent(zoom)} · ドラッグで移動 / ピンチで拡大縮小`
            : undefined}
        </ToolStatus>
      </div>

      <div className="shortcut-row">
        <span>SHORTCUTS</span>
        <span><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>F</kbd> 全画面</span>
        <span><kbd>⌘</kbd> <kbd>0</kbd> フィット</span>
        <span><kbd>⌘</kbd> <kbd>+</kbd> / <kbd>-</kbd> 拡大縮小</span>
        <span><kbd>Esc</kbd> 縮小</span>
      </div>
    </ToolShell>
  );
}
