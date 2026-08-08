import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Move,
  ArrowRight,
  Check,
  Square,
  CheckSquare,
  Sparkles,
  Link2,
  Unlink,
  RotateCcw,
  Network,
  Type,
  LayoutGrid,
  Lock,
  Unlock
} from 'lucide-react';

export interface MindMapTodo {
  id: string;
  text: string;
  completed: boolean;
}

export interface MindMapNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  shape: 'rectangle' | 'square' | 'rounded' | 'header';
  color: 'cyan' | 'fuchsia' | 'emerald' | 'amber' | 'purple';
  todos: MindMapTodo[];
  notes?: string;
  isLocked?: boolean;
}

export interface MindMapConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  color?: string;
}

export interface ResizingState {
  nodeId: string;
  side: 'e' | 'w' | 'n' | 's' | 'se' | 'sw' | 'ne' | 'nw';
  startMouseX: number;
  startMouseY: number;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
}

interface MindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTasksToMain?: (tasks: string[]) => void;
}

import {
  saveMindMapNodes,
  saveMindMapConnections,
  fetchServerData,
  MINDMAP_NODES_KEY,
  MINDMAP_CONNS_KEY
} from '../utils/storage';

const DEFAULT_NODES: MindMapNode[] = [
  {
    id: 'node_root',
    x: 100,
    y: 120,
    width: 280,
    height: 220,
    title: '🎯 هدف اصلی پروژه (Main Goal)',
    shape: 'header',
    color: 'fuchsia',
    todos: [
      { id: 't1', text: 'طراحی نقشه ذهنی و بوم کارها', completed: true },
      { id: 't2', text: 'دسته‌بندی وظایف کلیدی', completed: false },
    ],
    notes: 'پروژه تمرکز ویندوز',
  },
  {
    id: 'node_sub1',
    x: 480,
    y: 50,
    width: 250,
    height: 200,
    title: '⚡ فاز اول: برنامه‌ریزی',
    shape: 'rectangle',
    color: 'cyan',
    todos: [
      { id: 't3', text: 'بررسی پیش‌نیازها', completed: true },
      { id: 't4', text: 'تنظیم تایمر تمرکز', completed: false },
    ],
  },
  {
    id: 'node_sub2',
    x: 480,
    y: 300,
    width: 250,
    height: 200,
    title: '🚀 فاز دوم: اجرا و توسعه',
    shape: 'square',
    color: 'emerald',
    todos: [
      { id: 't5', text: 'تست چک‌باکس‌ها در دیاگرام', completed: false },
      { id: 't6', text: 'بررسی اتصال فلش‌ها', completed: false },
    ],
  },
];

const DEFAULT_CONNS: MindMapConnection[] = [
  { id: 'conn_1', fromNodeId: 'node_root', toNodeId: 'node_sub1', color: '#06b6d4' },
  { id: 'conn_2', fromNodeId: 'node_root', toNodeId: 'node_sub2', color: '#10b981' },
];

export const MindMapModal: React.FC<MindMapModalProps> = ({ isOpen, onClose, onSyncTasksToMain }) => {
  const [nodes, setNodes] = useState<MindMapNode[]>(() => {
    try {
      const saved = localStorage.getItem(MINDMAP_NODES_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_NODES;
    } catch {
      return DEFAULT_NODES;
    }
  });

  const [connections, setConnections] = useState<MindMapConnection[]>(() => {
    try {
      const saved = localStorage.getItem(MINDMAP_CONNS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CONNS;
    } catch {
      return DEFAULT_CONNS;
    }
  });

  // Canvas Pan & Zoom state
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1);
  const [zoomInput, setZoomInput] = useState('100');

  useEffect(() => {
    setZoomInput(Math.round(zoom * 100).toString());
  }, [zoom]);

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setZoomInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 300) {
      setZoom(parsed / 100);
    }
  };

  const handleZoomInputBlur = () => {
    let parsed = parseInt(zoomInput, 10);
    if (isNaN(parsed)) parsed = 100;
    parsed = Math.min(Math.max(parsed, 20), 250);
    setZoom(parsed / 100);
    setZoomInput(parsed.toString());
  };
  const [isPanning, setIsPanning] = useState(false);
  const [startPanMouse, setStartPanMouse] = useState({ x: 0, y: 0 });

  // Node Dragging & Resizing state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingState, setResizingState] = useState<ResizingState | null>(null);

  // Connection Creation State
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  // Selected Node for editing or quick actions
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // New todo input state per node
  const [newTodoTexts, setNewTodoTexts] = useState<Record<string, string>>({});

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalWrapperRef = useRef<HTMLDivElement>(null);

  // Fullscreen listener
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (modalWrapperRef.current?.requestFullscreen) {
        modalWrapperRef.current.requestFullscreen().catch((err) => {
          console.error('Fullscreen request error:', err);
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => console.error(err));
      } else {
        setIsFullscreen(false);
      }
    }
  };

  // Save to localStorage & Server JSON files
  useEffect(() => {
    saveMindMapNodes(nodes);
  }, [nodes]);

  useEffect(() => {
    saveMindMapConnections(connections);
  }, [connections]);

  // Sync from Server JSON on mount/open
  useEffect(() => {
    async function syncServerMindMap() {
      const serverNodes = await fetchServerData<MindMapNode[]>(MINDMAP_NODES_KEY);
      if (serverNodes && Array.isArray(serverNodes) && serverNodes.length > 0) {
        setNodes(serverNodes);
      }
      const serverConns = await fetchServerData<MindMapConnection[]>(MINDMAP_CONNS_KEY);
      if (serverConns && Array.isArray(serverConns)) {
        setConnections(serverConns);
      }
    }
    syncServerMindMap();
  }, []);

  // Center Canvas View
  const handleResetView = () => {
    setPan({ x: 150, y: 120 });
    setZoom(1);
  };

  // Zoom Helpers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.3));

  // Canvas Mouse Down (Start Pan or deselect)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).getAttribute('data-canvas-bg') === 'true') {
      setIsPanning(true);
      setStartPanMouse({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
      if (connectingFromId) setConnectingFromId(null);
    }
  };

  // Global Mouse Move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvasX = (e.clientX - pan.x) / zoom;
      const canvasY = (e.clientY - pan.y) / zoom;
      setMouseCanvasPos({ x: canvasX, y: canvasY });

      if (isPanning) {
        setPan({
          x: e.clientX - startPanMouse.x,
          y: e.clientY - startPanMouse.y,
        });
      } else if (resizingState) {
        const dx = (e.clientX - resizingState.startMouseX) / zoom;
        const dy = (e.clientY - resizingState.startMouseY) / zoom;

        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== resizingState.nodeId) return n;

            let newWidth = resizingState.startWidth;
            let newHeight = resizingState.startHeight;
            let newX = resizingState.startX;
            let newY = resizingState.startY;

            const side = resizingState.side;

            // Right edge (Width)
            if (side === 'e' || side === 'se' || side === 'ne') {
              newWidth = Math.max(160, resizingState.startWidth + dx);
            }
            // Left edge (Width + X position)
            if (side === 'w' || side === 'sw' || side === 'nw') {
              newWidth = Math.max(160, resizingState.startWidth - dx);
              newX = resizingState.startX + (resizingState.startWidth - newWidth);
            }
            // Bottom edge (Height)
            if (side === 's' || side === 'se' || side === 'sw') {
              newHeight = Math.max(120, resizingState.startHeight + dy);
            }
            // Top edge (Height + Y position)
            if (side === 'n' || side === 'ne' || side === 'nw') {
              newHeight = Math.max(120, resizingState.startHeight - dy);
              newY = resizingState.startY + (resizingState.startHeight - newHeight);
            }

            return {
              ...n,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          })
        );
      } else if (draggingNodeId) {
        const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
        const newY = (e.clientY - pan.y) / zoom - dragOffset.y;

        setNodes((prev) =>
          prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
        );
      }
    },
    [isPanning, startPanMouse, pan, zoom, draggingNodeId, dragOffset, resizingState]
  );

  // Global Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingState(null);
  };

  // Node Resize Drag Start
  const handleResizeMouseDown = (
    node: MindMapNode,
    side: 'e' | 'w' | 'n' | 's' | 'se' | 'sw' | 'ne' | 'nw',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedNodeId(node.id);
    setResizingState({
      nodeId: node.id,
      side,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: node.width,
      startHeight: node.height,
      startX: node.x,
      startY: node.y,
    });
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.25), 2.5));
  };

  // Add Node
  const handleAddNode = (shape: MindMapNode['shape'] = 'rectangle', color: MindMapNode['color'] = 'fuchsia') => {
    // Position exactly in the center of current visible canvas viewport
    const container = containerRef.current;
    const viewWidth = container?.clientWidth || window.innerWidth;
    const viewHeight = container?.clientHeight || (window.innerHeight - 64);

    const nodeWidth = shape === 'square' ? 220 : 270;
    const nodeHeight = 210;

    const canvasCenterX = (viewWidth / 2 - pan.x) / zoom;
    const canvasCenterY = (viewHeight / 2 - pan.y) / zoom;

    // Small cascade offset if multiple nodes exist
    const cascadeOffset = (nodes.length % 5) * 15;

    const newNode: MindMapNode = {
      id: `node_${Date.now()}`,
      x: canvasCenterX - nodeWidth / 2 + cascadeOffset,
      y: canvasCenterY - nodeHeight / 2 + cascadeOffset,
      width: nodeWidth,
      height: nodeHeight,
      title: shape === 'header' ? 'عنوان جدید (New Category)' : 'کار / نود جدید (New Task Node)',
      shape,
      color,
      todos: [
        { id: `t_${Date.now()}_1`, text: 'اولین آیتم لیست کارها', completed: false },
      ],
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Delete Node
  const handleDeleteNode = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromNodeId !== id && c.toNodeId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (connectingFromId === id) setConnectingFromId(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (node: MindMapNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);

    if (connectingFromId) {
      if (connectingFromId !== node.id) {
        // Connect connectingFromId -> node.id
        const exists = connections.some(
          (c) =>
            (c.fromNodeId === connectingFromId && c.toNodeId === node.id) ||
            (c.fromNodeId === node.id && c.toNodeId === connectingFromId)
        );

        if (!exists) {
          const newConn: MindMapConnection = {
            id: `conn_${Date.now()}`,
            fromNodeId: connectingFromId,
            toNodeId: node.id,
            color: '#d946ef',
          };
          setConnections((prev) => [...prev, newConn]);
        }
      }
      setConnectingFromId(null);
      return;
    }

    // Start node position drag
    setDraggingNodeId(node.id);
    const mouseCanvasX = (e.clientX - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - pan.y) / zoom;
    setDragOffset({
      x: mouseCanvasX - node.x,
      y: mouseCanvasY - node.y,
    });
  };

  // Add todo to a node
  const handleAddTodoToNode = (nodeId: string) => {
    const text = newTodoTexts[nodeId]?.trim();
    if (!text) return;

    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            todos: [...n.todos, { id: `t_${Date.now()}`, text, completed: false }],
          };
        }
        return n;
      })
    );

    setNewTodoTexts((prev) => ({ ...prev, [nodeId]: '' }));
  };

  // Toggle todo completion
  const handleToggleTodo = (nodeId: string, todoId: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            todos: n.todos.map((t) => (t.id === todoId ? { ...t, completed: !t.completed } : t)),
          };
        }
        return n;
      })
    );
  };

  // Delete todo from node
  const handleDeleteTodo = (nodeId: string, todoId: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            todos: n.todos.filter((t) => t.id !== todoId),
          };
        }
        return n;
      })
    );
  };

  // Update Node Title
  const handleUpdateTitle = (nodeId: string, title: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title } : n)));
  };

  // Toggle Node Lock State
  const handleToggleLockNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isLocked: !n.isLocked } : n))
    );
  };

  // Calculate Connection Endpoints (Exact outer rectangle border anchors)
  const getRectangleEdge = (node: MindMapNode, targetPoint: { x: number; y: number }) => {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const dx = targetPoint.x - cx;
    const dy = targetPoint.y - cy;

    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    const hw = node.width / 2;
    const hh = node.height / 2;

    const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);

    return {
      x: cx + dx * scale,
      y: cy + dy * scale,
    };
  };

  const getConnectionEndpoints = (fromNodeId: string, toNodeId: string) => {
    const fromNode = nodes.find((n) => n.id === fromNodeId);
    const toNode = nodes.find((n) => n.id === toNodeId);

    if (!fromNode || !toNode) {
      return { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } };
    }

    const c1 = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };

    const p1 = c1; // Starts from exact center of node 1
    const p2 = getRectangleEdge(toNode, c1); // Connects to edge of node 2

    return { p1, p2 };
  };

  // Delete Connection
  const handleDeleteConnection = (connId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connId));
  };

  // Sync tasks to main app if needed
  const handleSyncTasks = () => {
    if (!onSyncTasksToMain) return;
    const allTaskTexts: string[] = [];
    nodes.forEach((n) => {
      n.todos.forEach((t) => {
        if (!t.completed) {
          allTaskTexts.push(`${n.title}: ${t.text}`);
        }
      });
    });
    onSyncTasksToMain(allTaskTexts);
    alert('کارهای فعال دیاگرام به لیست تمرکز اصلی منتقل شدند!');
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalWrapperRef}
      className="fixed inset-0 z-[99999] flex flex-col bg-[#070212] text-fuchsia-100 select-none overflow-hidden font-sans"
    >
      {/* Top Cyberpunk Toolbar */}
      <header className="h-16 px-4 sm:px-6 bg-[#0d0221]/95 border-b border-fuchsia-900/60 flex items-center justify-between gap-4 backdrop-blur-md z-20">
        {/* Left: Title & Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.5)]">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 flex items-center gap-2">
              <span>Mind Map & Diagram Canvas (نقشه ذهنی کارها)</span>
            </h2>
            <p className="text-[11px] text-fuchsia-300/80 hidden sm:block">
              بوم بی‌نهایت دیاگرام با قابلیت ساخت مستطیل/مربع، اتصال فلش‌ها، و چک‌باکس لیست کارها
            </p>
          </div>
        </div>

        {/* Center Actions: Add Shapes, Connections */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Fullscreen Button - First item before rectangle */}
          <button
            onClick={handleToggleFullscreen}
            className={`px-3 py-1.5 rounded-xl transition border text-xs font-bold flex items-center gap-1.5 ${
              isFullscreen
                ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.5)]'
                : 'bg-[#150533] hover:bg-fuchsia-950 border-fuchsia-800/60 text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
            }`}
            title={isFullscreen ? 'خروج از حالت تمام صفحه' : 'حالت تمام صفحه (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />}
            <span className="hidden sm:inline">{isFullscreen ? 'خروج تمام‌صفحه' : 'تمام‌صفحه'}</span>
          </button>

          {/* Add Rectangle */}
          <button
            onClick={() => handleAddNode('rectangle', 'fuchsia')}
            className="px-3 py-1.5 rounded-xl bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-700/60 text-fuchsia-100 text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(217,70,239,0.2)]"
            title="افزودن نود مستطیل"
          >
            <Plus className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="hidden md:inline">+ مستطیل</span>
          </button>

          {/* Add Square */}
          <button
            onClick={() => handleAddNode('square', 'cyan')}
            className="px-3 py-1.5 rounded-xl bg-[#150533] hover:bg-fuchsia-950 border border-cyan-800/60 text-cyan-200 text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            title="افزودن نود مربع"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">+ مربع</span>
          </button>

          {/* Add Header Category */}
          <button
            onClick={() => handleAddNode('header', 'emerald')}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-xs font-bold transition flex items-center gap-1.5"
            title="افزودن عنوان یا دسته‌بندی اصلی"
          >
            <Type className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">+ دسته اصلی</span>
          </button>

          {/* Connect Mode Status */}
          {connectingFromId && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 text-xs font-extrabold animate-pulse flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" />
              <span>روی نود مقصد کلیک کنید...</span>
              <button
                onClick={() => setConnectingFromId(null)}
                className="p-0.5 hover:bg-amber-500/40 rounded text-amber-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Sync Tasks */}
          {onSyncTasksToMain && (
            <button
              onClick={handleSyncTasks}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white text-xs font-extrabold transition flex items-center gap-1 shadow-md"
              title="انتقال کارهای دیاگرام به لیست اصلی"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              <span className="hidden lg:inline">همگام‌سازی با لیست</span>
            </button>
          )}
        </div>

        {/* Right Controls: Zoom & Close */}
        <div className="flex items-center gap-2">
          {/* Zoom controls with Manual Keyboard Input */}
          <div className="flex items-center bg-[#150533] border border-fuchsia-800/60 rounded-xl p-0.5 shadow-[0_0_10px_rgba(217,70,239,0.15)]">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-fuchsia-900/60 rounded-lg text-fuchsia-300 transition"
              title="کوچکنمایی (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center bg-[#0d0221] px-1.5 py-0.5 rounded-lg border border-fuchsia-800/50 focus-within:border-cyan-400 transition">
              <input
                type="number"
                value={zoomInput}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleZoomInputBlur();
                  }
                }}
                className="w-9 text-center text-cyan-300 font-mono text-[12px] font-extrabold bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="میزان زوم (تایپ دستی درصد زوم)"
              />
              <span className="text-cyan-400 text-[10px] font-bold">%</span>
            </div>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-fuchsia-900/60 rounded-lg text-fuchsia-300 transition"
              title="بزرگنمایی (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="p-2 rounded-xl bg-[#150533] hover:bg-fuchsia-950 border border-fuchsia-800/60 text-fuchsia-300 transition"
            title="بازگشت به مرکز بوم"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 transition shadow-[0_0_10px_rgba(225,29,72,0.3)]"
            title="بستن بوم"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Infinite Interactive Canvas Container */}
      <div
        ref={containerRef}
        data-canvas-bg="true"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#090314] bg-[radial-gradient(#d946ef_1.5px,transparent_1.5px)] [background-size:32px_32px]"
      >
        {/* Infinite Transformed World Layer */}
        <div
          data-canvas-bg="true"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '10000px',
            height: '10000px',
          }}
          className="absolute top-0 left-0 pointer-events-none"
        >
          {/* SVG Layer for Connecting Arrow Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <defs>
              <marker
                id="arrowhead-fuchsia"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#d946ef" />
              </marker>
              <marker
                id="arrowhead-cyan"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
              </marker>
            </defs>

            {connections.map((conn) => {
              const { p1, p2 } = getConnectionEndpoints(conn.fromNodeId, conn.toNodeId);

              // Calculate control points for smooth bezier curve connecting outer boundaries
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;

              let cx1 = p1.x + dx * 0.4;
              let cy1 = p1.y + dy * 0.1;
              let cx2 = p2.x - dx * 0.4;
              let cy2 = p2.y - dy * 0.1;

              if (Math.abs(dy) > Math.abs(dx)) {
                cx1 = p1.x + dx * 0.1;
                cy1 = p1.y + dy * 0.4;
                cx2 = p2.x - dx * 0.1;
                cy2 = p2.y - dy * 0.4;
              }

              const pathData = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;

              return (
                <g key={conn.id} className="pointer-events-auto group">
                  {/* Invisible wide path for easy clicking/hovering */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConnection(conn.id);
                    }}
                  />
                  {/* Visible Glow Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={conn.color || '#d946ef'}
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    markerEnd="url(#arrowhead-fuchsia)"
                    className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.6)] group-hover:stroke-cyan-400 group-hover:stroke-width-4"
                  />
                  {/* Delete connection badge on hover */}
                  <circle
                    cx={midX}
                    cy={midY}
                    r="12"
                    fill="#150533"
                    stroke="#d946ef"
                    strokeWidth="1.5"
                    className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConnection(conn.id);
                    }}
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    textAnchor="middle"
                    fill="#f43f5e"
                    fontSize="10"
                    fontWeight="bold"
                    className="cursor-pointer opacity-0 group-hover:opacity-100 pointer-events-none"
                  >
                    ✕
                  </text>
                </g>
              );
            })}

            {/* Live active connection line following cursor when connection mode is active */}
            {connectingFromId && (() => {
              const fromNode = nodes.find((n) => n.id === connectingFromId);
              if (!fromNode) return null;
              const c1 = { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 };
              const p2 = mouseCanvasPos;

              const dx = p2.x - c1.x;
              const dy = p2.y - c1.y;

              const cx1 = c1.x + dx * 0.4;
              const cy1 = c1.y + dy * 0.1;
              const cx2 = p2.x - dx * 0.4;
              const cy2 = p2.y - dy * 0.1;

              const pathData = `M ${c1.x} ${c1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;

              return (
                <g className="pointer-events-none">
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                    markerEnd="url(#arrowhead-fuchsia)"
                    className="drop-shadow-[0_0_12px_rgba(245,158,11,0.9)]"
                  />
                  <circle cx={c1.x} cy={c1.y} r="6" fill="#f59e0b" />
                  <circle cx={p2.x} cy={p2.y} r="7" fill="#f59e0b" className="animate-ping opacity-75" />
                </g>
              );
            })()}
          </svg>

          {/* Interactive Mind Map Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isConnecting = connectingFromId === node.id;

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
                onMouseDown={(e) => handleNodeMouseDown(node, e)}
                className={`absolute top-0 left-0 rounded-2xl pointer-events-auto flex flex-col backdrop-blur-md transition-shadow duration-200 border group ${
                  node.color === 'cyan'
                    ? 'bg-[#09182d]/90 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                    : node.color === 'emerald'
                    ? 'bg-[#062419]/90 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : node.color === 'amber'
                    ? 'bg-[#291e03]/90 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : 'bg-[#150533]/90 border-fuchsia-500/60 shadow-[0_0_20px_rgba(217,70,239,0.2)]'
                } ${
                  isSelected
                    ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#090314] shadow-[0_0_30px_rgba(6,182,212,0.5)] z-10'
                    : ''
                } ${isConnecting ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
              >
                {/* 4 Edge Resizing Handles (Top/Bottom adjust height, Left/Right adjust width) */}
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'n', e)}
                  className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-2 bg-cyan-400 border border-[#090314] rounded-full cursor-ns-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر ارتفاع از بالا (Resize Height Top)"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 's', e)}
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-2 bg-cyan-400 border border-[#090314] rounded-full cursor-ns-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر ارتفاع از پایین (Resize Height Bottom)"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'w', e)}
                  className={`absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 h-10 w-2 bg-cyan-400 border border-[#090314] rounded-full cursor-ew-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر طول/عرض از چپ (Resize Width Left)"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'e', e)}
                  className={`absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 h-10 w-2 bg-cyan-400 border border-[#090314] rounded-full cursor-ew-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر طول/عرض از راست (Resize Width Right)"
                />

                {/* 4 Corner Resizing Handles */}
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'se', e)}
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 bg-cyan-400 border-2 border-[#090314] rounded-full translate-x-1/2 translate-y-1/2 cursor-se-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'sw', e)}
                  className={`absolute bottom-0 left-0 w-3.5 h-3.5 bg-cyan-400 border-2 border-[#090314] rounded-full -translate-x-1/2 translate-y-1/2 cursor-sw-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'ne', e)}
                  className={`absolute top-0 right-0 w-3.5 h-3.5 bg-cyan-400 border-2 border-[#090314] rounded-full translate-x-1/2 -translate-y-1/2 cursor-ne-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'nw', e)}
                  className={`absolute top-0 left-0 w-3.5 h-3.5 bg-cyan-400 border-2 border-[#090314] rounded-full -translate-x-1/2 -translate-y-1/2 cursor-nw-resize shadow-[0_0_10px_#22d3ee] z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />

                {/* Node Title Bar & Controls */}
                <div className="p-2.5 border-b border-fuchsia-900/50 flex items-center justify-between gap-2 bg-[#0d0221]/80 rounded-t-2xl cursor-grab active:cursor-grabbing">
                  <input
                    type="text"
                    value={node.title}
                    onChange={(e) => handleUpdateTitle(node.id, e.target.value)}
                    className="bg-transparent text-[12px] font-extrabold text-fuchsia-100 outline-none w-full border-b border-transparent focus:border-fuchsia-400 transition"
                  />

                  {/* Connect, Lock & Delete Node Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingFromId(connectingFromId === node.id ? null : node.id);
                      }}
                      className={`p-1 rounded-lg border transition ${
                        isConnecting
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-fuchsia-950 hover:bg-fuchsia-900 text-cyan-300 border-fuchsia-800/60'
                      }`}
                      title="اتصال این نود به نود دیگر"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleToggleLockNode(node.id, e)}
                      className={`p-1 rounded-lg border transition ${
                        node.isLocked
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 hover:bg-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                          : 'bg-fuchsia-950 hover:bg-fuchsia-900 text-fuchsia-300 border-fuchsia-800/60'
                      }`}
                      title={node.isLocked ? 'باز کردن قفل افزودن کار جدید' : 'قفل کردن افزودن کار جدید'}
                    >
                      {node.isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleDeleteNode(node.id, e)}
                      className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition"
                      title="حذف نود"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Node Body: List of Todos with Checkboxes */}
                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2 overflow-hidden min-h-0">
                  <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 min-h-0">
                    {node.todos.map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#0d0221]/60 border border-fuchsia-900/40 hover:border-fuchsia-700/50 transition group/item"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => handleToggleTodo(node.id, todo.id)}
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition ${
                              todo.completed
                                ? 'bg-emerald-500 text-black font-bold'
                                : 'border border-fuchsia-600 hover:border-cyan-400'
                            }`}
                          >
                            {todo.completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <span
                            className={`text-[12px] font-medium truncate ${
                              todo.completed ? 'line-through text-fuchsia-400/50' : 'text-fuchsia-100'
                            }`}
                          >
                            {todo.text}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteTodo(node.id, todo.id)}
                          className="text-rose-400/60 hover:text-rose-300 opacity-0 group-hover/item:opacity-100 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Todo Form - Hidden when node is locked */}
                  {!node.isLocked && (
                    <div className="pt-2 border-t border-fuchsia-900/40 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newTodoTexts[node.id] || ''}
                        onChange={(e) =>
                          setNewTodoTexts((prev) => ({ ...prev, [node.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTodoToNode(node.id);
                          }
                        }}
                        placeholder="+ افزودن کار جدید..."
                        className="flex-1 px-2.5 py-1 text-[12px] rounded-lg bg-[#0d0221] border border-fuchsia-800/60 text-fuchsia-100 placeholder-fuchsia-400/40 outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() => handleAddTodoToNode(node.id)}
                        className="p-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Helper Bar */}
        <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto bg-[#0d0221]/90 backdrop-blur-md border border-fuchsia-800/60 rounded-2xl p-3 shadow-2xl flex items-center gap-4 text-xs text-fuchsia-300 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-cyan-400" />
            <span>جابه‌جایی نودها و بوم (Drag & Pan)</span>
          </div>
          <div className="hidden sm:block border-l border-fuchsia-800/60 h-4" />
          <div className="hidden sm:flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-emerald-400" />
            <span>تغییر اندازه: کشیدن دایره‌های ۴ گوشه نودها</span>
          </div>
          <div className="hidden sm:block border-l border-fuchsia-800/60 h-4" />
          <div className="hidden sm:flex items-center gap-2">
            <Link2 className="w-4 h-4 text-fuchsia-400" />
            <span>برای اتصال، دکمه زنجیر نود A و B را بزنید</span>
          </div>
        </div>
      </div>
    </div>
  );
};
