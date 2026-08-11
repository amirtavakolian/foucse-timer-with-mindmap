import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
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
  Unlock,
  Pencil,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Tag,
  StickyNote,
  Bold,
  Italic,
  Palette,
  ListPlus
} from 'lucide-react';
import { toPersianDigits } from '../utils/time';

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
  shape: 'rectangle' | 'square' | 'rounded' | 'header' | 'label' | 'note';
  color: 'cyan' | 'fuchsia' | 'emerald' | 'amber' | 'purple' | 'rose' | 'yellow' | 'white';
  todos: MindMapTodo[];
  notes?: string;
  isLocked?: boolean;
  fontSize?: number | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  titleFontSize?: number;
  contentFontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
}

export interface MindMapConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  color?: string;
  curveOffset?: { x: number; y: number };
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

  // Connection Dragging state
  const [draggingConnectionId, setDraggingConnectionId] = useState<string | null>(null);
  const [connectionDragStart, setConnectionDragStart] = useState<{ x: number, y: number } | null>(null);
  const [initialCurveOffset, setInitialCurveOffset] = useState<{ x: number, y: number } | null>(null);

  // Connection Creation State
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  // Selected Nodes for multi-selection, group drag, or quick actions
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const selectedNodeId = selectedNodeIds[selectedNodeIds.length - 1] || null;
  const setSelectedNodeId = (id: string | null) => setSelectedNodeIds(id ? [id] : []);

  // Selection Box state (Right-Click Drag Selection)
  const [selectionBox, setSelectionBox] = useState<{
    startCanvas: { x: number; y: number };
    currentCanvas: { x: number; y: number };
  } | null>(null);

  // Right & Left Click tracking for clicks vs drag
  const [rightClickStartScreen, setRightClickStartScreen] = useState<{ x: number; y: number } | null>(null);
  const [isRightClickDragging, setIsRightClickDragging] = useState<boolean>(false);
  const [leftClickStartScreen, setLeftClickStartScreen] = useState<{ x: number; y: number } | null>(null);
  const [isLeftClickDragging, setIsLeftClickDragging] = useState<boolean>(false);

  // Group Drag state (moving multiple selected nodes together)
  const [isGroupDragging, setIsGroupDragging] = useState<boolean>(false);
  const [groupDragStartMouse, setGroupDragStartMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [groupDragInitialPositions, setGroupDragInitialPositions] = useState<Record<string, { x: number; y: number }>>({});

  // New todo input state per node
  const [newTodoTexts, setNewTodoTexts] = useState<Record<string, string>>({});
  const [batchTodoOpenMap, setBatchTodoOpenMap] = useState<Record<string, boolean>>({});
  const [batchTodoTexts, setBatchTodoTexts] = useState<Record<string, string>>({});

  // Todo Item Editing state
  const [editingTodo, setEditingTodo] = useState<{ nodeId: string; todoId: string; text: string } | null>(null);

  // Todo Item Moving/Reordering state
  const [movingTodo, setMovingTodo] = useState<{ nodeId: string; todoId: string } | null>(null);

  // Formatting menu open state per node & font size target ('title' | 'body')
  const [openFormatMenuNodeId, setOpenFormatMenuNodeId] = useState<string | null>(null);
  const [fontSizeTargetMap, setFontSizeTargetMap] = useState<Record<string, 'title' | 'body'>>({});

  // Clipboard state for copying node styles
  const [copiedNodeTemplate, setCopiedNodeTemplate] = useState<Partial<MindMapNode> | null>(null);

  // Delete Confirmation state
  const [nodeToDelete, setNodeToDelete] = useState<MindMapNode | null>(null);

  // Collapsed Connections state
  const [collapsedConnections, setCollapsedConnections] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mindmap_collapsed_conns');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('mindmap_collapsed_conns', JSON.stringify(collapsedConnections));
  }, [collapsedConnections]);

  const { hiddenNodes, hiddenConnections } = useMemo(() => {
    const hn = new Set<string>();
    const hc = new Set<string>();

    const hideRecursively = (nodeId: string) => {
      if (hn.has(nodeId)) return;
      hn.add(nodeId);
      connections.forEach((c) => {
        if (c.fromNodeId === nodeId) {
          hc.add(c.id);
          hideRecursively(c.toNodeId);
        }
      });
    };

    collapsedConnections.forEach((connId) => {
      const conn = connections.find((c) => c.id === connId);
      if (conn) {
        hideRecursively(conn.toNodeId);
      }
    });

    return { hiddenNodes: hn, hiddenConnections: hc };
  }, [nodes, connections, collapsedConnections]);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalWrapperRef = useRef<HTMLDivElement>(null);

  // Fullscreen listener & Keyboard shortcuts
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          const setIds = new Set(selectedNodeIds);
          setNodes((prev) => prev.filter((n) => !setIds.has(n.id)));
          setConnections((prev) => prev.filter((c) => !setIds.has(c.fromNodeId) && !setIds.has(c.toNodeId)));
          setSelectedNodeIds([]);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedNodeId) {
          const node = nodes.find(n => n.id === selectedNodeId);
          if (node) {
            setCopiedNodeTemplate({
              shape: node.shape,
              color: node.color,
              width: node.width,
              height: node.height,
              fontSize: node.fontSize,
              titleFontSize: node.titleFontSize,
              contentFontSize: node.contentFontSize,
              isBold: node.isBold,
              isItalic: node.isItalic,
            });
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (copiedNodeTemplate) {
          const viewWidth = containerRef.current?.clientWidth || 800;
          const viewHeight = containerRef.current?.clientHeight || 600;
          
          const canvasCenterX = (viewWidth / 2 - pan.x) / zoom;
          const canvasCenterY = (viewHeight / 2 - pan.y) / zoom;
          const cascadeOffset = (nodes.length % 5) * 15;

          const newNode: MindMapNode = {
            id: `node_${Date.now()}`,
            x: canvasCenterX - (copiedNodeTemplate.width || 200) / 2 + cascadeOffset,
            y: canvasCenterY - (copiedNodeTemplate.height || 90) / 2 + cascadeOffset,
            width: copiedNodeTemplate.width || 200,
            height: copiedNodeTemplate.height || 90,
            title: '',
            notes: '',
            todos: [],
            shape: copiedNodeTemplate.shape || 'rectangle',
            color: copiedNodeTemplate.color || 'cyan',
            fontSize: copiedNodeTemplate.fontSize,
            titleFontSize: copiedNodeTemplate.titleFontSize,
            contentFontSize: copiedNodeTemplate.contentFontSize,
            isBold: copiedNodeTemplate.isBold,
            isItalic: copiedNodeTemplate.isItalic,
          };
          
          setNodes(prev => [...prev, newNode]);
          setSelectedNodeId(newNode.id);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, selectedNodeIds, copiedNodeTemplate, nodes, pan, zoom]);

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

  // Delete All Selected Nodes
  const handleDeleteSelectedNodes = () => {
    if (selectedNodeIds.length === 0) return;
    const setIds = new Set(selectedNodeIds);
    setNodes((prev) => prev.filter((n) => !setIds.has(n.id)));
    setConnections((prev) => prev.filter((c) => !setIds.has(c.fromNodeId) && !setIds.has(c.toNodeId)));
    setSelectedNodeIds([]);
  };

  // Helper to convert screen client coordinates to inner canvas world coordinates
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  // Canvas Mouse Down (Start Pan, Right-Click Box Selection, or Deselect)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setOpenFormatMenuNodeId(null);
    const isCanvasBg = (e.target as HTMLElement).getAttribute('data-canvas-bg') === 'true';
    const coords = getCanvasCoords(e.clientX, e.clientY);

    // Right-Click on Canvas (e.button === 2)
    if (e.button === 2) {
      e.preventDefault();

      setRightClickStartScreen({ x: e.clientX, y: e.clientY });
      setIsRightClickDragging(false);

      // If nodes are already selected, right-click dragging anywhere moves the group
      if (selectedNodeIds.length > 0) {
        setIsGroupDragging(true);
        setGroupDragStartMouse({ x: e.clientX, y: e.clientY });
        const initialPos: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          if (selectedNodeIds.includes(n.id)) {
            initialPos[n.id] = { x: n.x, y: n.y };
          }
        });
        setGroupDragInitialPositions(initialPos);
        return;
      }

      // No nodes selected -> Start selection box exactly under the mouse pointer
      setSelectionBox({
        startCanvas: coords,
        currentCanvas: coords,
      });
      return;
    }

    // Left-Click on Canvas Background (e.button === 0) -> Start Pan or prepare Deselect
    if (e.button === 0 && isCanvasBg) {
      setLeftClickStartScreen({ x: e.clientX, y: e.clientY });
      setIsLeftClickDragging(false);

      setIsPanning(true);
      setStartPanMouse({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (connectingFromId) setConnectingFromId(null);
    }
  };

  // Global Mouse Move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setMouseCanvasPos(coords);

      if (rightClickStartScreen) {
        const dist = Math.hypot(e.clientX - rightClickStartScreen.x, e.clientY - rightClickStartScreen.y);
        if (dist > 4) {
          setIsRightClickDragging(true);
        }
      }

      if (leftClickStartScreen) {
        const dist = Math.hypot(e.clientX - leftClickStartScreen.x, e.clientY - leftClickStartScreen.y);
        if (dist > 4) {
          setIsLeftClickDragging(true);
        }
      }

      // 1. Selection Box Dragging
      if (selectionBox) {
        setSelectionBox((prev) => (prev ? { ...prev, currentCanvas: coords } : null));

        const minX = Math.min(selectionBox.startCanvas.x, coords.x);
        const maxX = Math.max(selectionBox.startCanvas.x, coords.x);
        const minY = Math.min(selectionBox.startCanvas.y, coords.y);
        const maxY = Math.max(selectionBox.startCanvas.y, coords.y);

        const newlySelected = nodes
          .filter((n) => {
            if (hiddenNodes.has(n.id)) return false;
            const nodeMinX = n.x;
            const nodeMaxX = n.x + n.width;
            const nodeMinY = n.y;
            const nodeMaxY = n.y + n.height;
            return nodeMinX <= maxX && nodeMaxX >= minX && nodeMinY <= maxY && nodeMaxY >= minY;
          })
          .map((n) => n.id);

        setSelectedNodeIds(newlySelected);
        return;
      }

      // 2. Group Dragging (Moving selected nodes together)
      if (isGroupDragging) {
        const dxScreen = e.clientX - groupDragStartMouse.x;
        const dyScreen = e.clientY - groupDragStartMouse.y;
        const dxCanvas = dxScreen / zoom;
        const dyCanvas = dyScreen / zoom;

        setNodes((prev) =>
          prev.map((n) => {
            if (groupDragInitialPositions[n.id] !== undefined) {
              const init = groupDragInitialPositions[n.id];
              return {
                ...n,
                x: init.x + dxCanvas,
                y: init.y + dyCanvas,
              };
            }
            return n;
          })
        );
        return;
      }

      // 3. Single Node Dragging
      if (draggingNodeId) {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === draggingNodeId) {
              return {
                ...n,
                x: coords.x - dragOffset.x,
                y: coords.y - dragOffset.y,
              };
            }
            return n;
          })
        );
        return;
      }

      // 4. Canvas Panning
      if (isPanning) {
        setPan({
          x: e.clientX - startPanMouse.x,
          y: e.clientY - startPanMouse.y,
        });
        return;
      }

      // 5. Connection curve dragging
      if (draggingConnectionId && connectionDragStart && initialCurveOffset) {
        const dx = (e.clientX - connectionDragStart.x) / zoom;
        const dy = (e.clientY - connectionDragStart.y) / zoom;

        setConnections((prev) =>
          prev.map((c) =>
            c.id === draggingConnectionId
              ? {
                  ...c,
                  curveOffset: {
                    x: initialCurveOffset.x + dx,
                    y: initialCurveOffset.y + dy,
                  },
                }
              : c
          )
        );
        return;
      }

      // 6. Resizing Node
      if (resizingState) {
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
              newWidth = Math.max(120, resizingState.startWidth + dx);
            }
            // Left edge (Width + X position)
            if (side === 'w' || side === 'sw' || side === 'nw') {
              newWidth = Math.max(120, resizingState.startWidth - dx);
              newX = resizingState.startX + (resizingState.startWidth - newWidth);
            }
            // Bottom edge (Height)
            if (side === 's' || side === 'se' || side === 'sw') {
              newHeight = Math.max(75, resizingState.startHeight + dy);
            }
            // Top edge (Height + Y position)
            if (side === 'n' || side === 'ne' || side === 'nw') {
              newHeight = Math.max(75, resizingState.startHeight - dy);
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
      }
    },
    [
      getCanvasCoords,
      rightClickStartScreen,
      leftClickStartScreen,
      selectionBox,
      isGroupDragging,
      groupDragStartMouse,
      groupDragInitialPositions,
      draggingNodeId,
      dragOffset,
      isPanning,
      startPanMouse,
      draggingConnectionId,
      connectionDragStart,
      initialCurveOffset,
      resizingState,
      zoom,
      nodes,
      hiddenNodes,
    ]
  );

  // Global Mouse Up
  const handleMouseUp = () => {
    // If clicked or right clicked without dragging -> Deselect all nodes
    if (
      (rightClickStartScreen && !isRightClickDragging) ||
      (leftClickStartScreen && !isLeftClickDragging)
    ) {
      setSelectedNodeIds([]);
    }

    setRightClickStartScreen(null);
    setIsRightClickDragging(false);
    setLeftClickStartScreen(null);
    setIsLeftClickDragging(false);

    setSelectionBox(null);
    setIsGroupDragging(false);
    setGroupDragInitialPositions({});

    setIsPanning(false);
    setDraggingNodeId(null);
    setResizingState(null);
    setDraggingConnectionId(null);
    setConnectionDragStart(null);
    setInitialCurveOffset(null);
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

  // Node Formatting Handlers
  const handleToggleNodeBold = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isBold: !n.isBold } : n))
    );
  };

  const handleToggleNodeItalic = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isItalic: !n.isItalic } : n))
    );
  };

  const getNodeFontSizeNum = (fontSize?: number | string): number => {
    if (typeof fontSize === 'number') return fontSize;
    if (fontSize === 'sm') return 12;
    if (fontSize === 'base') return 14;
    if (fontSize === 'lg') return 16;
    if (fontSize === 'xl') return 20;
    if (fontSize === '2xl') return 24;
    return 14;
  };

  const getNodeTitleFontSize = (node: MindMapNode): number => {
    if (typeof node.titleFontSize === 'number') return node.titleFontSize;
    if (typeof node.fontSize === 'number') return node.fontSize;
    return getNodeFontSizeNum(node.fontSize);
  };

  const getNodeContentFontSize = (node: MindMapNode): number => {
    if (typeof node.contentFontSize === 'number') return node.contentFontSize;
    return 12;
  };

  const handleSetNodeFontSize = (
    nodeId: string,
    target: 'title' | 'body',
    fontSize: number,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    const clamped = Math.max(8, Math.min(60, fontSize));
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const currentTitle = getNodeTitleFontSize(n);
        const currentContent = getNodeContentFontSize(n);

        if (target === 'title') {
          return {
            ...n,
            titleFontSize: clamped,
            contentFontSize: n.contentFontSize ?? currentContent,
            fontSize: clamped,
          };
        } else {
          return {
            ...n,
            titleFontSize: n.titleFontSize ?? currentTitle,
            contentFontSize: clamped,
          };
        }
      })
    );
  };

  const handleChangeNodeColor = (nodeId: string, color: MindMapNode['color'], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, color } : n))
    );
  };

  const handleUpdateNotes = (nodeId: string, notes: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, notes } : n))
    );
  };

  // Add Node
  const handleAddNode = (shape: MindMapNode['shape'] = 'rectangle', color: MindMapNode['color'] = 'fuchsia') => {
    // Position exactly in the center of current visible canvas viewport
    const container = containerRef.current;
    const viewWidth = container?.clientWidth || window.innerWidth;
    const viewHeight = container?.clientHeight || (window.innerHeight - 64);

    let nodeWidth = 270;
    let nodeHeight = 210;
    let defaultTitle = 'کار / نود جدید';
    let defaultColor: MindMapNode['color'] = color;
    let defaultFontSize: MindMapNode['fontSize'] = 'base';
    let defaultIsBold = false;

    if (shape === 'square') {
      nodeWidth = 220;
      nodeHeight = 210;
    } else if (shape === 'header') {
      nodeWidth = 280;
      nodeHeight = 160;
      defaultTitle = 'عنوان جدید';
      defaultColor = 'emerald';
      defaultIsBold = true;
    } else if (shape === 'label') {
      nodeWidth = 200;
      nodeHeight = 90;
      defaultTitle = 'لیبل جدید';
      defaultColor = 'cyan';
      defaultFontSize = 'base';
      defaultIsBold = true;
    } else if (shape === 'note') {
      nodeWidth = 250;
      nodeHeight = 180;
      defaultTitle = 'یادداشت جدید';
      defaultColor = 'amber';
      defaultFontSize = 'sm';
      defaultIsBold = false;
    }

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
      title: defaultTitle,
      notes: shape === 'note' ? 'متن یادداشت را اینجا بنویسید...' : undefined,
      shape,
      color: defaultColor,
      fontSize: defaultFontSize,
      isBold: defaultIsBold,
      isItalic: false,
      todos: shape === 'label' || shape === 'note' ? [] : [
        { id: `t_${Date.now()}_1`, text: 'اولین آیتم لیست کارها', completed: false },
      ],
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Delete Node Request & Confirm
  const handleDeleteNodeRequest = (node: MindMapNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNodeToDelete(node);
  };

  const handleConfirmDeleteNode = () => {
    if (!nodeToDelete) return;
    const id = nodeToDelete.id;
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.fromNodeId !== id && c.toNodeId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (connectingFromId === id) setConnectingFromId(null);
    setNodeToDelete(null);
  };

  // Node Drag Start (Supports Right-Click Selection & Group Drag)
  const handleNodeMouseDown = (node: MindMapNode, e: React.MouseEvent) => {
    e.stopPropagation();

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

    // Right Click on Node (e.button === 2) -> Group Drag
    if (e.button === 2) {
      e.preventDefault();
      setRightClickStartScreen({ x: e.clientX, y: e.clientY });
      setIsRightClickDragging(false);

      let currentSelection = selectedNodeIds;
      if (!currentSelection.includes(node.id)) {
        currentSelection = [node.id];
        setSelectedNodeIds([node.id]);
      }

      setIsGroupDragging(true);
      setGroupDragStartMouse({ x: e.clientX, y: e.clientY });
      const initialPos: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        if (currentSelection.includes(n.id)) {
          initialPos[n.id] = { x: n.x, y: n.y };
        }
      });
      setGroupDragInitialPositions(initialPos);
      return;
    }

    // Left Click on Node (e.button === 0)
    if (e.button === 0) {
      setLeftClickStartScreen({ x: e.clientX, y: e.clientY });
      setIsLeftClickDragging(false);

      let newSelected = selectedNodeIds;
      if (e.ctrlKey || e.shiftKey || e.metaKey) {
        if (selectedNodeIds.includes(node.id)) {
          newSelected = selectedNodeIds.filter((id) => id !== node.id);
        } else {
          newSelected = [...selectedNodeIds, node.id];
        }
        setSelectedNodeIds(newSelected);
      } else {
        if (!selectedNodeIds.includes(node.id)) {
          newSelected = [node.id];
          setSelectedNodeIds([node.id]);
        }
      }

      if (newSelected.length > 1 && newSelected.includes(node.id)) {
        setIsGroupDragging(true);
        setGroupDragStartMouse({ x: e.clientX, y: e.clientY });
        const initialPos: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          if (newSelected.includes(n.id)) {
            initialPos[n.id] = { x: n.x, y: n.y };
          }
        });
        setGroupDragInitialPositions(initialPos);
      } else {
        setDraggingNodeId(node.id);
        const coords = getCanvasCoords(e.clientX, e.clientY);
        setDragOffset({
          x: coords.x - node.x,
          y: coords.y - node.y,
        });
      }
    }
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

  // Add batch multi-line todos to a node
  const handleBatchAddTodosToNode = (nodeId: string) => {
    const rawText = batchTodoTexts[nodeId] || '';
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return;

    const now = Date.now();
    const newTodos: MindMapTodo[] = lines.map((line, idx) => ({
      id: `t_${now}_${idx}`,
      text: line,
      completed: false,
    }));

    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            todos: [...n.todos, ...newTodos],
          };
        }
        return n;
      })
    );

    setBatchTodoTexts((prev) => ({ ...prev, [nodeId]: '' }));
    setBatchTodoOpenMap((prev) => ({ ...prev, [nodeId]: false }));
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

  // Start Editing Todo
  const handleStartEditTodo = (nodeId: string, todoId: string, currentText: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTodo({ nodeId, todoId, text: currentText });
  };

  // Save Edited Todo
  const handleSaveEditTodo = () => {
    if (!editingTodo) return;
    const { nodeId, todoId, text } = editingTodo;
    const trimmed = text.trim();
    if (trimmed) {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              todos: n.todos.map((t) => (t.id === todoId ? { ...t, text: trimmed } : t)),
            };
          }
          return n;
        })
      );
    }
    setEditingTodo(null);
  };

  // Cancel Editing Todo
  const handleCancelEditTodo = () => {
    setEditingTodo(null);
  };

  // Toggle or Perform Todo Reordering
  const handleToggleMoveTodo = (nodeId: string, todoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (movingTodo && movingTodo.nodeId === nodeId && movingTodo.todoId === todoId) {
      // Clicked again on active moving todo -> finalize and exit move mode
      setMovingTodo(null);
    } else if (movingTodo && movingTodo.nodeId === nodeId && movingTodo.todoId !== todoId) {
      // Clicked on a different todo in the same node while move mode active -> swap positions!
      handleSwapTodos(nodeId, movingTodo.todoId, todoId);
    } else {
      // Start move mode for this todo
      setMovingTodo({ nodeId, todoId });
    }
  };

  // Swap two todos inside a node
  const handleSwapTodos = (nodeId: string, todoId1: string, todoId2: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const idx1 = n.todos.findIndex((t) => t.id === todoId1);
          const idx2 = n.todos.findIndex((t) => t.id === todoId2);
          if (idx1 !== -1 && idx2 !== -1) {
            const newTodos = [...n.todos];
            const temp = newTodos[idx1];
            newTodos[idx1] = newTodos[idx2];
            newTodos[idx2] = temp;
            return { ...n, todos: newTodos };
          }
        }
        return n;
      })
    );
  };

  // Move todo one position up or down
  const handleMoveTodoDirection = (nodeId: string, todoId: string, direction: 'up' | 'down', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const idx = n.todos.findIndex((t) => t.id === todoId);
          if (idx === -1) return n;
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= n.todos.length) return n;

          const newTodos = [...n.todos];
          const temp = newTodos[idx];
          newTodos[idx] = newTodos[targetIdx];
          newTodos[targetIdx] = temp;
          return { ...n, todos: newTodos };
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
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.5)]">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300">
              Mind Map
            </h2>
          </div>
        </div>

        {/* Center Actions: Add Shapes, Connections, Labels, Notes */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            className={`px-3 py-1.5 rounded-xl transition border text-xs font-bold flex items-center gap-1.5 shrink-0 ${
              isFullscreen
                ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.5)]'
                : 'bg-[#150533] hover:bg-fuchsia-950 border-fuchsia-800/60 text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
            }`}
            title={isFullscreen ? 'خروج از حالت تمام صفحه' : 'حالت تمام صفحه (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />}
            <span className="hidden sm:inline">{isFullscreen ? 'خروج تمام‌صفحه' : 'تمام‌صفحه'}</span>
          </button>

          {/* Add Label Button - Directly next to Fullscreen */}
          <button
            onClick={() => handleAddNode('label', 'cyan')}
            className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/70 text-cyan-200 text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(34,211,238,0.25)] shrink-0"
            title="افزودن لیبل متنی (Label)"
          >
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>+ لیبل</span>
          </button>

          {/* Add Note Button - Directly next to Label */}
          <button
            onClick={() => handleAddNode('note', 'amber')}
            className="px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-200 text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.25)] shrink-0"
            title="افزودن یادداشت (Note)"
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
            <span>+ یادداشت</span>
          </button>

          {/* Add Rectangle */}
          <button
            onClick={() => handleAddNode('rectangle', 'fuchsia')}
            className="px-3 py-1.5 rounded-xl bg-fuchsia-950/80 hover:bg-fuchsia-900 border border-fuchsia-700/60 text-fuchsia-100 text-xs font-bold transition flex items-center gap-1.5 shadow-[0_0_10px_rgba(217,70,239,0.2)] shrink-0"
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
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-black"
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
              if (hiddenConnections.has(conn.id)) return null;
              
              const isCollapsed = collapsedConnections.includes(conn.id);

              const { p1, p2 } = getConnectionEndpoints(conn.fromNodeId, conn.toNodeId);

              // Calculate control points for smooth bezier curve connecting outer boundaries
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;

              const cOffsetX = conn.curveOffset?.x || 0;
              const cOffsetY = conn.curveOffset?.y || 0;

              let cx1 = p1.x + dx * 0.4 + cOffsetX;
              let cy1 = p1.y + dy * 0.1 + cOffsetY;
              let cx2 = p2.x - dx * 0.4 + cOffsetX;
              let cy2 = p2.y - dy * 0.1 + cOffsetY;

              if (Math.abs(dy) > Math.abs(dx)) {
                cx1 = p1.x + dx * 0.1 + cOffsetX;
                cy1 = p1.y + dy * 0.4 + cOffsetY;
                cx2 = p2.x - dx * 0.1 + cOffsetX;
                cy2 = p2.y - dy * 0.4 + cOffsetY;
              }

              const pathData = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;
              const midX = 0.125 * p1.x + 0.375 * cx1 + 0.375 * cx2 + 0.125 * p2.x;
              const midY = 0.125 * p1.y + 0.375 * cy1 + 0.375 * cy2 + 0.125 * p2.y;

              return (
                <g key={conn.id} className="pointer-events-auto group">
                  {/* Invisible wide path for easy clicking/hovering */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    className="cursor-pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingConnectionId(conn.id);
                      setConnectionDragStart({ x: e.clientX, y: e.clientY });
                      setInitialCurveOffset(conn.curveOffset || { x: 0, y: 0 });
                    }}
                  />
                  {/* Visible Glow Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={conn.color || '#d946ef'}
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    markerEnd={isCollapsed ? undefined : "url(#arrowhead-fuchsia)"}
                    className={`transition-all duration-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.6)] ${isCollapsed ? 'opacity-50' : 'group-hover:stroke-cyan-400 group-hover:stroke-width-4'}`}
                  />
                  
                  {/* Delete connection badge on hover */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <circle
                      cx={midX - 14}
                      cy={midY}
                      r="10"
                      fill="#150533"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(conn.id);
                      }}
                    />
                    <text
                      x={midX - 14}
                      y={midY + 3.5}
                      textAnchor="middle"
                      fill="#f43f5e"
                      fontSize="10"
                      fontWeight="bold"
                      className="pointer-events-none cursor-pointer"
                    >
                      ✕
                    </text>
                  </g>

                  {/* Collapse / Expand badge */}
                  <g className={`${isCollapsed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <circle
                      cx={midX + 14}
                      cy={midY}
                      r="11"
                      fill="#150533"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      className="cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCollapsed) {
                          setCollapsedConnections(prev => prev.filter(id => id !== conn.id));
                        } else {
                          setCollapsedConnections(prev => [...prev, conn.id]);
                        }
                      }}
                    />
                    <text
                      x={midX + 14}
                      y={midY + 4}
                      textAnchor="middle"
                      fill="#06b6d4"
                      fontSize="14"
                      fontWeight="bold"
                      className="pointer-events-none cursor-pointer"
                    >
                      {isCollapsed ? '+' : '−'}
                    </text>
                  </g>
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

          {/* Selection Box overlay in canvas coordinates */}
          {selectionBox && (() => {
            const minX = Math.min(selectionBox.startCanvas.x, selectionBox.currentCanvas.x);
            const maxX = Math.max(selectionBox.startCanvas.x, selectionBox.currentCanvas.x);
            const minY = Math.min(selectionBox.startCanvas.y, selectionBox.currentCanvas.y);
            const maxY = Math.max(selectionBox.startCanvas.y, selectionBox.currentCanvas.y);
            const w = maxX - minX;
            const h = maxY - minY;

            return (
              <div
                style={{
                  transform: `translate(${minX}px, ${minY}px)`,
                  width: `${w}px`,
                  height: `${h}px`,
                }}
                className="absolute top-0 left-0 border-2 border-cyan-400 bg-cyan-500/20 rounded-xl pointer-events-none z-40 shadow-[0_0_20px_rgba(34,211,238,0.4)] border-dashed"
              />
            );
          })()}

          {/* Interactive Mind Map Nodes */}
          {nodes.map((node) => {
            if (hiddenNodes.has(node.id)) return null;

            const isSelected = selectedNodeIds.includes(node.id);
            const isConnecting = connectingFromId === node.id;

            const colorStyles = (() => {
              switch (node.color) {
                case 'cyan':
                  return { hex: '#22d3ee', bg: 'bg-[#09182d]/90', border: 'border-cyan-500/70', shadow: 'shadow-[0_0_20px_rgba(34,211,238,0.2)]', text: 'text-cyan-200', handleBg: 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' };
                case 'emerald':
                  return { hex: '#10b981', bg: 'bg-[#062419]/90', border: 'border-emerald-500/70', shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]', text: 'text-emerald-200', handleBg: 'bg-emerald-400 shadow-[0_0_10px_#10b981]' };
                case 'amber':
                  return { hex: '#f59e0b', bg: 'bg-[#291e03]/90', border: 'border-amber-500/70', shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]', text: 'text-amber-200', handleBg: 'bg-amber-400 shadow-[0_0_10px_#f59e0b]' };
                case 'rose':
                  return { hex: '#f43f5e', bg: 'bg-[#280715]/90', border: 'border-rose-500/70', shadow: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]', text: 'text-rose-200', handleBg: 'bg-rose-400 shadow-[0_0_10px_#f43f5e]' };
                case 'purple':
                  return { hex: '#a855f7', bg: 'bg-[#150533]/90', border: 'border-purple-500/70', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]', text: 'text-purple-200', handleBg: 'bg-purple-400 shadow-[0_0_10px_#c084fc]' };
                case 'yellow':
                  return { hex: '#eab308', bg: 'bg-[#282104]/90', border: 'border-yellow-400/80', shadow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]', text: 'text-yellow-200', handleBg: 'bg-yellow-400 shadow-[0_0_10px_#facc15]' };
                case 'white':
                  return { hex: '#e2e8f0', bg: 'bg-[#12131f]/90', border: 'border-slate-300/80', shadow: 'shadow-[0_0_20px_rgba(255,255,255,0.2)]', text: 'text-slate-100', handleBg: 'bg-slate-200 shadow-[0_0_10px_#f1f5f9]' };
                default:
                  return { hex: '#d946ef', bg: 'bg-[#150533]/90', border: 'border-fuchsia-500/70', shadow: 'shadow-[0_0_20px_rgba(217,70,239,0.2)]', text: 'text-fuchsia-200', handleBg: 'bg-fuchsia-400 shadow-[0_0_10px_#d946ef]' };
              }
            })();

            const titleFontPx = getNodeTitleFontSize(node);
            const bodyFontPx = getNodeContentFontSize(node);

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
                onMouseDown={(e) => handleNodeMouseDown(node, e)}
                className={`absolute top-0 left-0 pointer-events-auto flex flex-col backdrop-blur-md transition-shadow duration-200 border group ${colorStyles.bg} ${colorStyles.border} ${colorStyles.shadow} ${
                  node.shape === 'circle' ? 'rounded-[100px]' : 'rounded-2xl'
                } ${
                  isSelected
                    ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#090314] shadow-[0_0_30px_rgba(6,182,212,0.5)] z-10'
                    : ''
                } ${isConnecting ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
              >
                {/* 4 Edge Resizing Handles */}
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'n', e)}
                  className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-2 ${colorStyles.handleBg} border border-[#090314] rounded-full cursor-ns-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر ارتفاع از بالا"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 's', e)}
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-2 ${colorStyles.handleBg} border border-[#090314] rounded-full cursor-ns-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر ارتفاع از پایین"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'w', e)}
                  className={`absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 h-10 w-2 ${colorStyles.handleBg} border border-[#090314] rounded-full cursor-ew-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر عرض از چپ"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'e', e)}
                  className={`absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 h-10 w-2 ${colorStyles.handleBg} border border-[#090314] rounded-full cursor-ew-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر عرض از راست"
                />

                {/* 4 Corner Resizing Handles */}
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'se', e)}
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 ${colorStyles.handleBg} border-2 border-[#090314] rounded-full translate-x-1/2 translate-y-1/2 cursor-se-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'sw', e)}
                  className={`absolute bottom-0 left-0 w-3.5 h-3.5 ${colorStyles.handleBg} border-2 border-[#090314] rounded-full -translate-x-1/2 translate-y-1/2 cursor-sw-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'ne', e)}
                  className={`absolute top-0 right-0 w-3.5 h-3.5 ${colorStyles.handleBg} border-2 border-[#090314] rounded-full translate-x-1/2 -translate-y-1/2 cursor-ne-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />
                <div
                  onMouseDown={(e) => handleResizeMouseDown(node, 'nw', e)}
                  className={`absolute top-0 left-0 w-3.5 h-3.5 ${colorStyles.handleBg} border-2 border-[#090314] rounded-full -translate-x-1/2 -translate-y-1/2 cursor-nw-resize z-30 hover:scale-125 transition-all opacity-0 group-hover:opacity-100 ${
                    isSelected ? 'opacity-100' : ''
                  }`}
                  title="تغییر اندازه از گوشه"
                />

                {/* Node Title Bar & Controls */}
                <div className="p-1.5 border-b border-fuchsia-900/50 flex items-center justify-between gap-1 bg-[#0d0221]/80 rounded-t-2xl cursor-grab active:cursor-grabbing flex-wrap min-w-0">
                  <div className="flex items-center gap-1 flex-1 min-w-0" dir="rtl">
                    {node.shape === 'label' ? (
                      <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        لیبل
                      </span>
                    ) : node.shape === 'note' ? (
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        یادداشت
                      </span>
                    ) : (
                      <input
                        type="text"
                        dir="rtl"
                        value={node.title}
                        onChange={(e) => handleUpdateTitle(node.id, e.target.value)}
                        style={{ fontSize: `${titleFontPx}px` }}
                        className={`bg-transparent outline-none flex-1 min-w-0 border-b border-transparent focus:border-fuchsia-400 transition text-right ${
                          node.isBold ? 'font-bold' : 'font-normal'
                        } ${node.isItalic ? 'italic' : ''} ${colorStyles.text}`}
                        placeholder="عنوان نود..."
                      />
                    )}
                  </div>

                  {/* Formatting & Action Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Combined Formatting Menu Button (Palette Icon) */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFormatMenuNodeId((prev) => (prev === node.id ? null : node.id));
                        }}
                        className={`p-1 rounded-lg border transition flex items-center justify-center ${
                          openFormatMenuNodeId === node.id
                            ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.7)]'
                            : 'bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-200 border-fuchsia-800/60'
                        }`}
                        title="تنظیمات استایل، فونت و رنگ"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>

                      {/* Upwards Formatting Popover */}
                      {openFormatMenuNodeId === node.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-full mb-2 right-0 bg-[#0a021b]/95 border border-fuchsia-600/80 rounded-2xl p-3 shadow-[0_0_25px_rgba(217,70,239,0.5)] backdrop-blur-xl flex flex-col gap-2.5 min-w-[220px] z-50"
                          dir="rtl"
                        >
                          <div className="text-[10px] font-bold text-fuchsia-300/80 border-b border-fuchsia-900/50 pb-1 flex items-center justify-between">
                            <span>تنظیمات استایل، فونت و رنگ</span>
                          </div>

                          {/* Bold & Italic Row */}
                          <div className="flex items-center gap-1.5">
                            {/* Bold */}
                            <button
                              onClick={(e) => handleToggleNodeBold(node.id, e)}
                              className={`flex-1 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border ${
                                node.isBold
                                  ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]'
                                  : 'bg-[#150533] hover:bg-fuchsia-950 text-fuchsia-200 border-fuchsia-800/60'
                              }`}
                              title="Bold (ضخیم)"
                            >
                              <Bold className="w-3.5 h-3.5" />
                              <span>Bold</span>
                            </button>

                            {/* Italic */}
                            <button
                              onClick={(e) => handleToggleNodeItalic(node.id, e)}
                              className={`flex-1 py-1 rounded-lg text-xs italic font-bold transition flex items-center justify-center gap-1 border ${
                                node.isItalic
                                  ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.5)]'
                                  : 'bg-[#150533] hover:bg-fuchsia-950 text-fuchsia-200 border-fuchsia-800/60'
                              }`}
                              title="Italic (مورب)"
                            >
                              <Italic className="w-3.5 h-3.5" />
                              <span>Italic</span>
                            </button>
                          </div>

                          {/* Font Size Target Scope & Stepper */}
                          <div className="flex flex-col gap-1.5 pt-1 border-t border-fuchsia-900/40">
                            {(() => {
                              const activeTarget = fontSizeTargetMap[node.id] || 'title';
                              const activePx = activeTarget === 'title' ? titleFontPx : bodyFontPx;

                              return (
                                <div className="flex flex-col gap-1.5">
                                  {/* Stepper Header & Controls */}
                                  <div className="flex items-center justify-between text-[10px] text-fuchsia-300/80 font-bold">
                                    <span>سایز {activeTarget === 'title' ? 'عنوان' : 'متن بدنه'} (پیکسل):</span>
                                    <span className="text-cyan-300 font-mono font-bold">{activePx}px</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 bg-[#05010d] p-1.5 rounded-xl border border-fuchsia-900/50">
                                    {/* Decrease button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetNodeFontSize(node.id, activeTarget, Math.max(8, activePx - 1), e);
                                      }}
                                      className="p-1.5 rounded-lg bg-[#150533] hover:bg-fuchsia-900 text-fuchsia-200 border border-fuchsia-800/60 transition active:scale-95 shrink-0"
                                      title="کاهش سایز (-۱)"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Numeric Input Field */}
                                    <div className="flex-1 flex items-center justify-center">
                                      <input
                                        type="number"
                                        min={8}
                                        max={60}
                                        value={activePx}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10);
                                          if (!isNaN(val)) {
                                            handleSetNodeFontSize(node.id, activeTarget, val);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-center bg-[#0d0221] border border-fuchsia-800/80 rounded-lg py-1 px-1 text-cyan-300 font-extrabold text-xs outline-none focus:border-cyan-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </div>

                                    {/* Increase button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetNodeFontSize(node.id, activeTarget, Math.min(60, activePx + 1), e);
                                      }}
                                      className="p-1.5 rounded-lg bg-[#150533] hover:bg-fuchsia-900 text-fuchsia-200 border border-fuchsia-800/60 transition active:scale-95 shrink-0"
                                      title="افزایش سایز (+۱)"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Scope Selector: Title vs Body (Placed BELOW stepper) */}
                                  <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-[10px] text-fuchsia-300/80 font-bold">انتخاب بخش برای تغییر سایز:</span>
                                    <div className="flex items-center gap-1.5 bg-[#05010d] p-1 rounded-xl border border-fuchsia-900/50">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFontSizeTargetMap((prev) => ({ ...prev, [node.id]: 'title' }));
                                        }}
                                        className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border ${
                                          activeTarget === 'title'
                                            ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.7)]'
                                            : 'bg-[#12042b] hover:bg-fuchsia-950 text-fuchsia-200 border-fuchsia-900/50'
                                        }`}
                                        title="تغییر سایز عنوان نود"
                                      >
                                        <span>Title (عنوان)</span>
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFontSizeTargetMap((prev) => ({ ...prev, [node.id]: 'body' }));
                                        }}
                                        className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 border ${
                                          activeTarget === 'body'
                                            ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.7)]'
                                            : 'bg-[#12042b] hover:bg-fuchsia-950 text-fuchsia-200 border-fuchsia-900/50'
                                        }`}
                                        title="تغییر سایز متن بدنه و کارها"
                                      >
                                        <span>Body (متن بدنه)</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Color Palette Swatches */}
                          <div className="flex flex-col gap-1 pt-1 border-t border-fuchsia-900/40">
                            <span className="text-[10px] text-fuchsia-300/80 font-bold">رنگ نود:</span>
                            <div className="flex items-center justify-between gap-1">
                              {(['cyan', 'fuchsia', 'emerald', 'amber', 'rose', 'yellow', 'purple', 'white'] as const).map((c) => (
                                <button
                                  key={c}
                                  onClick={(e) => handleChangeNodeColor(node.id, c, e)}
                                  className={`w-5 h-5 rounded-full transition flex items-center justify-center border border-black/40 ${
                                    node.color === c
                                      ? 'scale-125 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.9)]'
                                      : 'opacity-75 hover:opacity-100 hover:scale-110'
                                  }`}
                                  style={{
                                    backgroundColor:
                                      c === 'cyan' ? '#22d3ee' :
                                      c === 'fuchsia' ? '#d946ef' :
                                      c === 'emerald' ? '#10b981' :
                                      c === 'amber' ? '#f59e0b' :
                                      c === 'rose' ? '#f43f5e' :
                                      c === 'yellow' ? '#eab308' :
                                      c === 'purple' ? '#a855f7' :
                                      '#f8fafc'
                                  }}
                                  title={`رنگ ${c}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Connect & Lock Buttons - ONLY for standard nodes */}
                    {node.shape !== 'label' && node.shape !== 'note' && (
                      <>
                        {/* Connect Button */}
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

                        {/* Lock Button */}
                        <button
                          onClick={(e) => handleToggleLockNode(node.id, e)}
                          className={`p-1 rounded-lg border transition ${
                            node.isLocked
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 hover:bg-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                              : 'bg-fuchsia-950 hover:bg-fuchsia-900 text-fuchsia-300 border-fuchsia-800/60'
                          }`}
                          title={node.isLocked ? 'باز کردن قفل' : 'قفل کردن'}
                        >
                          {node.isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteNodeRequest(node, e)}
                      className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition"
                      title="حذف نود"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Node Body */}
                {node.shape === 'label' ? (
                  <div className="p-2 flex-1 flex flex-col justify-between h-full overflow-hidden min-h-0">
                    <textarea
                      dir="rtl"
                      value={node.notes || ''}
                      onChange={(e) => handleUpdateNotes(node.id, e.target.value)}
                      placeholder="متن توصیفی لیبل (اختیاری)..."
                      style={{ fontSize: `${bodyFontPx}px` }}
                      className={`w-full flex-1 bg-transparent outline-none resize-none text-right transition ${
                        node.isBold ? 'font-bold' : 'font-normal'
                      } ${node.isItalic ? 'italic' : ''} ${colorStyles.text}`}
                    />
                  </div>
                ) : node.shape === 'note' ? (
                  <div className="p-2 flex-1 flex flex-col justify-between h-full overflow-hidden min-h-0">
                    <textarea
                      dir="rtl"
                      value={node.notes || ''}
                      onChange={(e) => handleUpdateNotes(node.id, e.target.value)}
                      placeholder="متن یادداشت را اینجا بنویسید..."
                      style={{ fontSize: `${bodyFontPx}px` }}
                      className={`w-full flex-1 bg-transparent outline-none resize-none text-right transition ${
                        node.isBold ? 'font-bold' : 'font-normal'
                      } ${node.isItalic ? 'italic' : ''} ${colorStyles.text}`}
                    />
                  </div>
                ) : (
                  /* Standard Node Body: List of Todos with Checkboxes */
                  <div className="p-2 flex-1 flex flex-col justify-between space-y-1.5 overflow-hidden min-h-0">
                    <div className="space-y-1 flex-1 overflow-y-auto pr-1 min-h-0">
                      {node.todos.map((todo, todoIndex) => {
                        const isEditingThis =
                          editingTodo?.nodeId === node.id && editingTodo?.todoId === todo.id;
                        const isMovingThis =
                          movingTodo?.nodeId === node.id && movingTodo?.todoId === todo.id;
                        const isNodeMovingActive =
                          movingTodo?.nodeId === node.id;

                        return (
                          <div
                            key={todo.id}
                            dir="rtl"
                            className={`flex items-center justify-between gap-1.5 p-1.5 rounded-lg transition group/item ${
                              isMovingThis
                                ? 'bg-amber-950/80 border border-amber-400/90 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                : isNodeMovingActive
                                ? 'bg-[#0d0221]/80 border border-amber-500/30 hover:border-amber-400 cursor-pointer'
                                : 'bg-[#0d0221]/60 border border-fuchsia-900/40 hover:border-fuchsia-700/50'
                            }`}
                            onClick={(e) => {
                              if (isNodeMovingActive && !isMovingThis && !isEditingThis) {
                                e.stopPropagation();
                                handleSwapTodos(node.id, movingTodo.todoId, todo.id);
                              }
                            }}
                          >
                            {isEditingThis ? (
                              /* Inline Edit Mode */
                              <div className="flex items-center gap-1 flex-1 min-w-0" dir="rtl">
                                <input
                                  type="text"
                                  autoFocus
                                  dir="rtl"
                                  value={editingTodo.text}
                                  onChange={(e) =>
                                    setEditingTodo({ ...editingTodo, text: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditTodo();
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditTodo();
                                    }
                                  }}
                                  style={{ fontSize: `${bodyFontPx}px` }}
                                  className={`flex-1 px-2 py-0.5 rounded bg-[#090314] border border-cyan-400 text-fuchsia-100 outline-none text-right ${
                                    node.isBold ? 'font-bold' : 'font-normal'
                                  } ${node.isItalic ? 'italic' : ''}`}
                                />
                                <button
                                  onClick={handleSaveEditTodo}
                                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shrink-0"
                                  title="ذخیره تغییرات"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={handleCancelEditTodo}
                                  className="p-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-bold transition shrink-0"
                                  title="انصراف"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              /* Normal View Mode */
                              <>
                                <div className="flex items-center gap-1.5 flex-1 min-w-0" dir="rtl">
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
                                    dir="rtl"
                                    style={{ fontSize: `${bodyFontPx}px` }}
                                    className={`leading-tight text-right break-words flex-1 min-w-0 ${
                                      node.isBold ? 'font-bold' : 'font-normal'
                                    } ${node.isItalic ? 'italic' : ''} ${
                                      todo.completed ? 'line-through text-fuchsia-400/50' : 'text-fuchsia-100'
                                    }`}
                                  >
                                    {todo.text}
                                  </span>
                                </div>

                                <div className={`${isMovingThis || isNodeMovingActive ? 'flex' : 'hidden group-hover/item:flex'} items-center gap-1 shrink-0`}>
                                  {/* Edit Button */}
                                  <button
                                    onClick={(e) => handleStartEditTodo(node.id, todo.id, todo.text, e)}
                                    className="text-cyan-400 hover:text-cyan-300 p-0.5 hover:bg-cyan-950/60 rounded transition"
                                    title="ویرایش کار"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Move Controls */}
                                  {isMovingThis ? (
                                    <>
                                      {/* Move Up */}
                                      <button
                                        onClick={(e) => handleMoveTodoDirection(node.id, todo.id, 'up', e)}
                                        disabled={todoIndex === 0}
                                        className={`p-0.5 rounded transition ${
                                          todoIndex === 0
                                            ? 'text-fuchsia-700/30 cursor-not-allowed'
                                            : 'text-cyan-300 hover:bg-cyan-900/60 hover:text-white'
                                        }`}
                                        title="انتقال به یک خط بالاتر"
                                      >
                                        <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                                      </button>

                                      {/* Move Down */}
                                      <button
                                        onClick={(e) => handleMoveTodoDirection(node.id, todo.id, 'down', e)}
                                        disabled={todoIndex === node.todos.length - 1}
                                        className={`p-0.5 rounded transition ${
                                          todoIndex === node.todos.length - 1
                                            ? 'text-fuchsia-700/30 cursor-not-allowed'
                                            : 'text-cyan-300 hover:bg-cyan-900/60 hover:text-white'
                                        }`}
                                        title="انتقال به یک خط پایین‌تر"
                                      >
                                        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                                      </button>

                                      {/* Finish Move Toggle Button */}
                                      <button
                                        onClick={(e) => handleToggleMoveTodo(node.id, todo.id, e)}
                                        className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                                        title="تثبیت موقعیت (کلیک مجدد برای قرارگیری)"
                                      >
                                        <ArrowUpDown className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    /* Inactive Move Button */
                                    <button
                                      onClick={(e) => handleToggleMoveTodo(node.id, todo.id, e)}
                                      className="text-amber-400/90 hover:text-amber-300 p-0.5 hover:bg-amber-950/60 rounded transition"
                                      title={isNodeMovingActive ? "جایگزینی جایگاه با کار انتخابی" : "جابه‌جایی کار (بالا/پایین)"}
                                    >
                                      <ArrowUpDown className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Delete Button */}
                                  <button
                                    onClick={() => handleDeleteTodo(node.id, todo.id)}
                                    className="text-rose-400/80 hover:text-rose-300 p-0.5 hover:bg-rose-950/60 rounded transition"
                                    title="حذف کار"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!node.isLocked && (
                      <div className="pt-2 border-t border-fuchsia-900/40 flex flex-col gap-1.5" dir="rtl">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            dir="rtl"
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
                            style={{ fontSize: `${bodyFontPx}px` }}
                            className={`flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-[#0d0221] border border-fuchsia-800/60 text-fuchsia-100 placeholder-fuchsia-400/40 outline-none focus:border-cyan-400 text-right ${
                              node.isBold ? 'font-bold' : 'font-normal'
                            } ${node.isItalic ? 'italic' : ''}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTodoToNode(node.id)}
                            className="p-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition shrink-0 cursor-pointer"
                            title="افزودن کار (تک خطی)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* Batch Multi-line Task Input Toggle Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setBatchTodoOpenMap((prev) => ({ ...prev, [node.id]: !prev[node.id] }))
                            }
                            className={`p-1 rounded-lg border transition shrink-0 cursor-pointer ${
                              batchTodoOpenMap[node.id]
                                ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                                : 'bg-fuchsia-950/80 hover:bg-fuchsia-900 text-cyan-300 border-fuchsia-800/60 hover:border-cyan-500/60'
                            }`}
                            title="افزودن متنی چند خطی کارها (ورود چند کار همزمان)"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Batch Textarea Panel */}
                        {batchTodoOpenMap[node.id] && (
                          <div className="p-2 rounded-xl bg-[#080214] border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.25)] space-y-2 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between text-[10px] font-extrabold text-cyan-300">
                              <span className="flex items-center gap-1">
                                <ListPlus className="w-3.5 h-3.5 text-cyan-400" />
                                <span>ورود گروهی کارهای چند خطی:</span>
                              </span>
                              <span className="text-[9px] text-fuchsia-300/70 font-normal">هر خط = یک کار جدید</span>
                            </div>

                            <textarea
                              rows={5}
                              dir="rtl"
                              value={batchTodoTexts[node.id] || ''}
                              onChange={(e) =>
                                setBatchTodoTexts((prev) => ({ ...prev, [node.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault();
                                  handleBatchAddTodosToNode(node.id);
                                }
                              }}
                              placeholder={'متن چند خطی خود را اینجا وارد کنید...\nمثال:\n۲.۱: گوروتین چیست؟\n۲.۲: ایجاد Goroutineها\n۲.۳: چرخه حیات گوروتین'}
                              className="w-full p-2 text-xs rounded-lg bg-[#0d0221] border border-fuchsia-800/80 text-fuchsia-100 placeholder-fuchsia-400/35 outline-none focus:border-cyan-400 resize-y leading-relaxed"
                            />

                            <div className="flex items-center justify-between gap-1.5 pt-0.5">
                              <span className="text-[10px] font-bold text-fuchsia-300/80">
                                تعداد: {toPersianDigits((batchTodoTexts[node.id] || '').split(/\r?\n/).filter((l) => l.trim().length > 0).length)} خط
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBatchTodoOpenMap((prev) => ({ ...prev, [node.id]: false }))
                                  }
                                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-fuchsia-300 hover:text-white hover:bg-fuchsia-950/60 border border-fuchsia-800/40 transition cursor-pointer"
                                >
                                  لغو
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBatchAddTodosToNode(node.id)}
                                  disabled={!(batchTodoTexts[node.id] || '').trim()}
                                  className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>ثبت همه خط‌ها</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Multi-Selection Control Floating Bar */}
        {selectedNodeIds.length > 1 && (
          <div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#0a021b]/95 border border-cyan-500/80 rounded-2xl px-4 py-2.5 shadow-[0_0_30px_rgba(6,182,212,0.5)] backdrop-blur-md flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
            dir="rtl"
          >
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-extrabold">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{selectedNodeIds.length} نود انتخاب شده</span>
            </div>

            <div className="h-4 w-px bg-cyan-500/30" />

            <span className="text-[11px] text-fuchsia-200/90 hidden sm:inline font-semibold">
              کلیک راست و درگ برای جابه‌جایی گروهی
            </span>

            <button
              onClick={() => setSelectedNodeIds([])}
              className="text-fuchsia-300 hover:text-white text-xs font-bold transition px-2.5 py-1 rounded-lg hover:bg-fuchsia-950/80 border border-fuchsia-800/40"
            >
              لغو انتخاب
            </button>

            <button
              onClick={handleDeleteSelectedNodes}
              className="text-rose-300 hover:text-rose-100 text-xs font-bold transition px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف گروهی ({selectedNodeIds.length})</span>
            </button>
          </div>
        )}

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

        {/* Delete Confirmation Modal Overlay */}
        {nodeToDelete && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 pointer-events-auto"
            onClick={() => setNodeToDelete(null)}
          >
            <div
              className="bg-[#0c021e] border border-rose-500/80 rounded-2xl p-5 max-w-sm w-full shadow-[0_0_35px_rgba(244,63,94,0.4)] flex flex-col gap-4 text-right"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center gap-2.5 text-rose-400 border-b border-rose-900/40 pb-2.5">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-extrabold text-fuchsia-100">تایید حذف</h3>
              </div>
              <p className="text-xs font-semibold text-fuchsia-200/90 leading-relaxed">
                آیا از حذف این {nodeToDelete.shape === 'label' ? 'لیبل' : nodeToDelete.shape === 'note' ? 'یادداشت' : 'نود'} اطمینان دارید؟
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setNodeToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-fuchsia-950 hover:bg-fuchsia-900 text-fuchsia-200 text-xs font-bold border border-fuchsia-800/60 transition"
                >
                  انصراف (No)
                </button>
                <button
                  onClick={handleConfirmDeleteNode}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-[0_0_12px_rgba(244,63,94,0.5)] transition"
                >
                  بله، حذف شود (Yes)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
