import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignRight,
  AlignLeft,
  Calendar,
  Plus,
  Minus,
  Palette,
  PaintBucket,
  ChevronDown,
  Trash2,
  Maximize2,
  Sparkles,
  Layers,
  Paintbrush,
  Check,
  Copy,
  Scissors,
  ClipboardPaste
} from 'lucide-react';
import { toPersianDigits, formatShamsiDate } from '../utils/time';

export interface MindMapTableCell {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  dir?: 'rtl' | 'ltr';
  color?: string;
  bgColor?: string;
  fontSize?: number;
}

export interface MindMapTableData {
  rows: number;
  cols: number;
  cells: Record<string, MindMapTableCell>; // key: `${rowIndex}_${colIndex}`
  colWidths: number[];
  rowHeights: number[];
}

export interface CellClipboardPayload {
  rows: number;
  cols: number;
  cells: Array<{
    relR: number;
    relC: number;
    cell: MindMapTableCell;
  }>;
  isCut?: boolean;
  sourceNodeId?: string;
  sourceRange?: { minR: number; maxR: number; minC: number; maxC: number };
}

// Module-level global clipboard for copying/cutting cells between any table nodes
let globalCellClipboard: CellClipboardPayload | null = null;

interface MindMapTableProps {
  nodeId: string;
  data?: MindMapTableData;
  onChangeData: (data: MindMapTableData) => void;
  isNodeLocked?: boolean;
}

const DEFAULT_COLS = 4;
const DEFAULT_ROWS = 6;
const DEFAULT_COL_WIDTH = 110;
const DEFAULT_ROW_HEIGHT = 36;

const PRESET_TEXT_COLORS = [
  { name: 'سفید', value: '#f8fafc' },
  { name: 'مشکی', value: '#0f172a' },
  { name: 'فیروزه‌ای', value: '#22d3ee' },
  { name: 'صورتی/ارغوانی', value: '#d946ef' },
  { name: 'سبز زمردی', value: '#10b981' },
  { name: 'کهربایی/زرد', value: '#f59e0b' },
  { name: 'سرخ/رز', value: '#f43f5e' },
  { name: 'بنفش', value: '#a855f7' },
  { name: 'آبی آسمانی', value: '#38bdf8' },
  { name: 'لیمویی', value: '#a3e635' },
];

const PRESET_BG_COLORS = [
  { name: 'شفاف', value: 'transparent' },
  { name: 'تیره نرم‌افزار', value: '#110426' },
  { name: 'تیره زغالی', value: '#1e293b' },
  { name: 'سفید ملایم', value: '#f8fafc' },
  { name: 'فیروزه‌ای تیره', value: '#083344' },
  { name: 'بنفش تیره', value: '#3b0764' },
  { name: 'سبز تیره', value: '#064e3b' },
  { name: 'کهربایی تیره', value: '#451a03' },
  { name: 'زرشکی تیره', value: '#4c0519' },
  { name: 'آبی تیره', value: '#172554' },
];

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24];

export const createInitialTableData = (): MindMapTableData => {
  return {
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    cells: {},
    colWidths: Array(DEFAULT_COLS).fill(DEFAULT_COL_WIDTH),
    rowHeights: Array(DEFAULT_ROWS).fill(DEFAULT_ROW_HEIGHT),
  };
};

export const MindMapTable: React.FC<MindMapTableProps> = React.memo(({
  nodeId,
  data,
  onChangeData,
  isNodeLocked = false,
}) => {
  const tableData: MindMapTableData = data && data.rows && data.cols
    ? data
    : createInitialTableData();

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [hasClipboardData, setHasClipboardData] = useState<boolean>(() => !!globalCellClipboard);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Clear cell selection and popovers whenever user clicks outside this table/calendar component
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (tableContainerRef.current && !tableContainerRef.current.contains(e.target as Node)) {
        setSelectedCell(null);
        setEditingCell(null);
        setDragStartCell(null);
        setDragEndCell(null);
        setIsDragSelecting(false);
        setShowTextColorPicker(false);
        setShowBgColorPicker(false);
        setIsFormatPainterActive(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside, true);
    document.addEventListener('touchstart', handlePointerDownOutside, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside, true);
      document.removeEventListener('touchstart', handlePointerDownOutside, true);
    };
  }, []);

  // Format Painter (Copy style/characteristics) state
  const [copiedFormat, setCopiedFormat] = useState<Partial<MindMapTableCell> | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState<boolean>(false);

  // Drag selection state for applying formatting to multiple cells
  const [isDragSelecting, setIsDragSelecting] = useState<boolean>(false);
  const [dragStartCell, setDragStartCell] = useState<{ r: number; c: number } | null>(null);
  const [dragEndCell, setDragEndCell] = useState<{ r: number; c: number } | null>(null);

  // Column / Row resize dragging state
  const [resizingCol, setResizingCol] = useState<{ index: number; startX: number; startWidth: number } | null>(null);
  const [resizingRow, setResizingRow] = useState<{ index: number; startY: number; startHeight: number } | null>(null);

  const getCellKey = (r: number, c: number) => `${r}_${c}`;

  const getCell = useCallback((r: number, c: number): MindMapTableCell => {
    return tableData.cells[getCellKey(r, c)] || {
      text: '',
      dir: 'rtl',
      fontSize: 12,
    };
  }, [tableData]);

  const updateCell = useCallback((r: number, c: number, updates: Partial<MindMapTableCell>) => {
    const key = getCellKey(r, c);
    const existing = tableData.cells[key] || { text: '', dir: 'rtl', fontSize: 12 };
    const updatedCells = {
      ...tableData.cells,
      [key]: {
        ...existing,
        ...updates,
      },
    };
    onChangeData({
      ...tableData,
      cells: updatedCells,
    });
  }, [tableData, onChangeData]);

  // Apply format to a range or set of cells
  const applyFormatToCells = useCallback((targetCells: Array<{ r: number; c: number }>, formatToApply: Partial<MindMapTableCell>) => {
    const updatedCells = { ...tableData.cells };
    targetCells.forEach(({ r, c }) => {
      const key = getCellKey(r, c);
      const existing = updatedCells[key] || { text: '', dir: 'rtl', fontSize: 12 };
      updatedCells[key] = {
        ...existing,
        isBold: formatToApply.isBold,
        isItalic: formatToApply.isItalic,
        isUnderline: formatToApply.isUnderline,
        dir: formatToApply.dir,
        color: formatToApply.color,
        bgColor: formatToApply.bgColor,
        fontSize: formatToApply.fontSize,
      };
    });
    onChangeData({
      ...tableData,
      cells: updatedCells,
    });
  }, [tableData, onChangeData]);

  // Copy style of the currently selected cell (Format Painter)
  const handleCopyCellFormat = () => {
    if (!selectedCell) return;
    const current = getCell(selectedCell.r, selectedCell.c);
    const format: Partial<MindMapTableCell> = {
      isBold: current.isBold,
      isItalic: current.isItalic,
      isUnderline: current.isUnderline,
      dir: current.dir,
      color: current.color,
      bgColor: current.bgColor,
      fontSize: current.fontSize,
    };
    setCopiedFormat(format);
    setIsFormatPainterActive(true);
  };

  const handleCancelFormatPainter = () => {
    setIsFormatPainterActive(false);
  };

  // Helper to determine current active rectangular range of selection
  const getActiveRange = useCallback(() => {
    if (dragStartCell && dragEndCell) {
      return {
        minR: Math.min(dragStartCell.r, dragEndCell.r),
        maxR: Math.max(dragStartCell.r, dragEndCell.r),
        minC: Math.min(dragStartCell.c, dragEndCell.c),
        maxC: Math.max(dragStartCell.c, dragEndCell.c),
      };
    }
    if (selectedCell) {
      return {
        minR: selectedCell.r,
        maxR: selectedCell.r,
        minC: selectedCell.c,
        maxC: selectedCell.c,
      };
    }
    return null;
  }, [dragStartCell, dragEndCell, selectedCell]);

  // 1. Copy Cells (Ctrl+C): Content + Full Style (Bold, Italic, Color, BgColor, FontSize, Direction)
  const handleCopyCells = useCallback(() => {
    const range = getActiveRange();
    if (!range) return;

    const { minR, maxR, minC, maxC } = range;
    const copiedItems: Array<{ relR: number; relC: number; cell: MindMapTableCell }> = [];
    const textRows: string[] = [];

    for (let r = minR; r <= maxR; r++) {
      const rowTexts: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        const cData = getCell(r, c);
        copiedItems.push({
          relR: r - minR,
          relC: c - minC,
          cell: { ...cData },
        });
        rowTexts.push(cData.text || '');
      }
      textRows.push(rowTexts.join('\t'));
    }

    globalCellClipboard = {
      rows: maxR - minR + 1,
      cols: maxC - minC + 1,
      cells: copiedItems,
      isCut: false,
      sourceNodeId: nodeId,
      sourceRange: range,
    };

    setHasClipboardData(true);
    setCopyFeedback('کپی شد (با استایل)');
    setTimeout(() => setCopyFeedback(null), 1600);

    // Also write plain text to system clipboard for external pasting
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(textRows.join('\n'));
      }
    } catch {
      // Ignore fallback
    }
  }, [getActiveRange, getCell, nodeId]);

  // 2. Cut Cells (Ctrl+X): Copy content + full style and clear the source cell values
  const handleCutCells = useCallback(() => {
    const range = getActiveRange();
    if (!range) return;

    const { minR, maxR, minC, maxC } = range;
    const copiedItems: Array<{ relR: number; relC: number; cell: MindMapTableCell }> = [];
    const textRows: string[] = [];
    const updatedCells = { ...tableData.cells };

    for (let r = minR; r <= maxR; r++) {
      const rowTexts: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        const cData = getCell(r, c);
        copiedItems.push({
          relR: r - minR,
          relC: c - minC,
          cell: { ...cData },
        });
        rowTexts.push(cData.text || '');

        const key = getCellKey(r, c);
        if (updatedCells[key]) {
          updatedCells[key] = {
            ...updatedCells[key],
            text: '',
          };
        }
      }
      textRows.push(rowTexts.join('\t'));
    }

    globalCellClipboard = {
      rows: maxR - minR + 1,
      cols: maxC - minC + 1,
      cells: copiedItems,
      isCut: true,
      sourceNodeId: nodeId,
      sourceRange: range,
    };

    setHasClipboardData(true);
    setCopyFeedback('کات شد');
    setTimeout(() => setCopyFeedback(null), 1600);

    onChangeData({
      ...tableData,
      cells: updatedCells,
    });

    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(textRows.join('\n'));
      }
    } catch {
      // Ignore
    }
  }, [getActiveRange, getCell, nodeId, tableData, onChangeData]);

  // 3. Paste Cells (Ctrl+V): Paste content and styles into selected target cell(s)
  const handlePasteCells = useCallback(() => {
    if (!selectedCell) return;

    const targetR = selectedCell.r;
    const targetC = selectedCell.c;

    if (globalCellClipboard && globalCellClipboard.cells.length > 0) {
      const updatedCells = { ...tableData.cells };
      globalCellClipboard.cells.forEach((item) => {
        const r = targetR + item.relR;
        const c = targetC + item.relC;
        if (r < tableData.rows && c < tableData.cols) {
          const key = getCellKey(r, c);
          updatedCells[key] = {
            ...item.cell,
          };
        }
      });

      if (globalCellClipboard.isCut) {
        globalCellClipboard = {
          ...globalCellClipboard,
          isCut: false,
        };
      }

      onChangeData({
        ...tableData,
        cells: updatedCells,
      });

      setCopyFeedback('پیست شد');
      setTimeout(() => setCopyFeedback(null), 1600);
      return;
    }

    // Fallback: Read text from system clipboard if global buffer is empty
    if (navigator?.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        if (!text) return;
        const rows = text.split(/\r?\n/);
        const updatedCells = { ...tableData.cells };

        rows.forEach((rowText, rIdx) => {
          if (!rowText && rIdx === rows.length - 1) return;
          const cols = rowText.split('\t');
          cols.forEach((colText, cIdx) => {
            const r = targetR + rIdx;
            const c = targetC + cIdx;
            if (r < tableData.rows && c < tableData.cols) {
              const key = getCellKey(r, c);
              const existing = updatedCells[key] || { text: '', dir: 'rtl', fontSize: 12 };
              updatedCells[key] = {
                ...existing,
                text: colText,
              };
            }
          });
        });

        onChangeData({
          ...tableData,
          cells: updatedCells,
        });

        setCopyFeedback('پیست شد');
        setTimeout(() => setCopyFeedback(null), 1600);
      }).catch(() => {
        // Clipboard read permission error or empty
      });
    }
  }, [selectedCell, tableData, onChangeData]);

  // 4. Delete / Clear selected cells (Delete or Backspace)
  const handleDeleteSelectedCells = useCallback(() => {
    const range = getActiveRange();
    if (!range) return;

    const { minR, maxR, minC, maxC } = range;
    const updatedCells = { ...tableData.cells };

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = getCellKey(r, c);
        if (updatedCells[key]) {
          updatedCells[key] = {
            ...updatedCells[key],
            text: '',
          };
        }
      }
    }

    onChangeData({
      ...tableData,
      cells: updatedCells,
    });
  }, [getActiveRange, tableData, onChangeData]);

  // Insert Persian Today Date (without year)
  const insertTodayDate = (r: number, c: number) => {
    const todayShamsi = formatShamsiDate(new Date(), { showWeekday: true, showYear: false });
    updateCell(r, c, { text: todayShamsi, dir: 'rtl' });
  };

  // Active cell formatting properties
  const activeCellProps = selectedCell ? getCell(selectedCell.r, selectedCell.c) : null;

  // Toggle Formatting Helpers
  const handleToggleBold = useCallback(() => {
    if (!selectedCell) return;
    const current = getCell(selectedCell.r, selectedCell.c);
    updateCell(selectedCell.r, selectedCell.c, { isBold: !current.isBold });
  }, [selectedCell, getCell, updateCell]);

  const handleToggleItalic = useCallback(() => {
    if (!selectedCell) return;
    const current = getCell(selectedCell.r, selectedCell.c);
    updateCell(selectedCell.r, selectedCell.c, { isItalic: !current.isItalic });
  }, [selectedCell, getCell, updateCell]);

  const handleToggleUnderline = useCallback(() => {
    if (!selectedCell) return;
    const current = getCell(selectedCell.r, selectedCell.c);
    updateCell(selectedCell.r, selectedCell.c, { isUnderline: !current.isUnderline });
  }, [selectedCell, getCell, updateCell]);

  const handleToggleDir = () => {
    if (!selectedCell) return;
    const current = getCell(selectedCell.r, selectedCell.c);
    const newDir = current.dir === 'ltr' ? 'rtl' : 'ltr';
    updateCell(selectedCell.r, selectedCell.c, { dir: newDir });
  };

  const handleSetFontSize = (size: number) => {
    if (!selectedCell) return;
    updateCell(selectedCell.r, selectedCell.c, { fontSize: size });
  };

  const handleSetColor = (color: string) => {
    if (!selectedCell) return;
    updateCell(selectedCell.r, selectedCell.c, { color });
    setShowTextColorPicker(false);
  };

  const handleSetBgColor = (bgColor: string) => {
    if (!selectedCell) return;
    updateCell(selectedCell.r, selectedCell.c, { bgColor });
    setShowBgColorPicker(false);
  };

  // Comprehensive Keyboard Shortcuts Listener for Table Cells
  useEffect(() => {
    if (!selectedCell) return;

    const handleTableKeyDown = (e: KeyboardEvent) => {
      // If currently editing inside textarea, let normal text typing occur
      if (editingCell) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !tableContainerRef.current?.contains(target)) {
        return;
      }

      // Ctrl + C / Cmd + C -> Copy cell(s) + styles
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        handleCopyCells();
        return;
      }

      // Ctrl + X / Cmd + X -> Cut cell(s) + styles
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
        handleCutCells();
        return;
      }

      // Ctrl + V / Cmd + V -> Paste cell(s) + styles
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        handlePasteCells();
        return;
      }

      // Delete or Backspace -> Clear cell contents
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSelectedCells();
        return;
      }

      // Ctrl + B -> Bold
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleBold();
        return;
      }

      // Ctrl + I -> Italic
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleItalic();
        return;
      }

      // Ctrl + U -> Underline
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleUnderline();
        return;
      }

      // Enter or F2 -> Start inline cell editing
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        setEditingCell({ r: selectedCell.r, c: selectedCell.c });
        return;
      }

      // Arrow Keys Navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedCell.r > 0) {
          setSelectedCell({ r: selectedCell.r - 1, c: selectedCell.c });
          setDragStartCell(null);
          setDragEndCell(null);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedCell.r < tableData.rows - 1) {
          setSelectedCell({ r: selectedCell.r + 1, c: selectedCell.c });
          setDragStartCell(null);
          setDragEndCell(null);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        // In RTL layout, moving right is previous column index (c - 1)
        if (selectedCell.c > 0) {
          setSelectedCell({ r: selectedCell.r, c: selectedCell.c - 1 });
          setDragStartCell(null);
          setDragEndCell(null);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        // In RTL layout, moving left is next column index (c + 1)
        if (selectedCell.c < tableData.cols - 1) {
          setSelectedCell({ r: selectedCell.r, c: selectedCell.c + 1 });
          setDragStartCell(null);
          setDragEndCell(null);
        }
        return;
      }

      // Type directly into cell
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setEditingCell({ r: selectedCell.r, c: selectedCell.c });
        updateCell(selectedCell.r, selectedCell.c, { text: e.key });
      }
    };

    window.addEventListener('keydown', handleTableKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleTableKeyDown, true);
    };
  }, [
    selectedCell,
    editingCell,
    tableData,
    handleCopyCells,
    handleCutCells,
    handlePasteCells,
    handleDeleteSelectedCells,
    handleToggleBold,
    handleToggleItalic,
    handleToggleUnderline,
    updateCell,
  ]);

  // Add / Remove Rows & Columns
  const handleAddRow = () => {
    const newRows = tableData.rows + 1;
    const newHeights = [...(tableData.rowHeights || []), DEFAULT_ROW_HEIGHT];
    onChangeData({
      ...tableData,
      rows: newRows,
      rowHeights: newHeights,
    });
  };

  const handleRemoveRow = () => {
    if (tableData.rows <= 1) return;
    const newRows = tableData.rows - 1;
    const newCells: Record<string, MindMapTableCell> = {};

    for (let r = 0; r < newRows; r++) {
      for (let c = 0; c < tableData.cols; c++) {
        const key = getCellKey(r, c);
        if (tableData.cells[key]) {
          newCells[key] = tableData.cells[key];
        }
      }
    }

    const newHeights = (tableData.rowHeights || []).slice(0, newRows);

    onChangeData({
      ...tableData,
      rows: newRows,
      cells: newCells,
      rowHeights: newHeights,
    });

    if (selectedCell && selectedCell.r >= newRows) {
      setSelectedCell({ r: Math.max(0, newRows - 1), c: selectedCell.c });
    }
  };

  const handleAddCol = () => {
    const newCols = tableData.cols + 1;
    const newWidths = [...(tableData.colWidths || []), DEFAULT_COL_WIDTH];
    onChangeData({
      ...tableData,
      cols: newCols,
      colWidths: newWidths,
    });
  };

  const handleRemoveCol = () => {
    if (tableData.cols <= 1) return;
    const newCols = tableData.cols - 1;
    const newCells: Record<string, MindMapTableCell> = {};

    for (let r = 0; r < tableData.rows; r++) {
      for (let c = 0; c < newCols; c++) {
        const key = getCellKey(r, c);
        if (tableData.cells[key]) {
          newCells[key] = tableData.cells[key];
        }
      }
    }

    const newWidths = (tableData.colWidths || []).slice(0, newCols);

    onChangeData({
      ...tableData,
      cols: newCols,
      cells: newCells,
      colWidths: newWidths,
    });

    if (selectedCell && selectedCell.c >= newCols) {
      setSelectedCell({ r: selectedCell.r, c: Math.max(0, newCols - 1) });
    }
  };

  // Column Resizing mouse handlers
  const handleColResizeMouseDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const currentWidth = tableData.colWidths?.[index] || DEFAULT_COL_WIDTH;
    setResizingCol({
      index,
      startX: e.clientX,
      startWidth: currentWidth,
    });
  };

  // Row Resizing mouse handlers
  const handleRowResizeMouseDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const currentHeight = tableData.rowHeights?.[index] || DEFAULT_ROW_HEIGHT;
    setResizingRow({
      index,
      startY: e.clientY,
      startHeight: currentHeight,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const delta = e.clientX - resizingCol.startX;
        const newWidth = Math.max(50, Math.min(500, resizingCol.startWidth + delta));
        const newWidths = [...(tableData.colWidths || Array(tableData.cols).fill(DEFAULT_COL_WIDTH))];
        newWidths[resizingCol.index] = newWidth;
        onChangeData({
          ...tableData,
          colWidths: newWidths,
        });
      }

      if (resizingRow) {
        const delta = e.clientY - resizingRow.startY;
        const newHeight = Math.max(24, Math.min(300, resizingRow.startHeight + delta));
        const newHeights = [...(tableData.rowHeights || Array(tableData.rows).fill(DEFAULT_ROW_HEIGHT))];
        newHeights[resizingRow.index] = newHeight;
        onChangeData({
          ...tableData,
          rowHeights: newHeights,
        });
      }
    };

    const handleMouseUp = () => {
      if (resizingCol) setResizingCol(null);
      if (resizingRow) setResizingRow(null);
    };

    if (resizingCol || resizingRow) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingCol, resizingRow, tableData, onChangeData]);

  // Calculate rectangular cell range between two cells
  const getSelectedRangeCells = useCallback((start: { r: number; c: number }, end: { r: number; c: number }) => {
    const minR = Math.min(start.r, end.r);
    const maxR = Math.max(start.r, end.r);
    const minC = Math.min(start.c, end.c);
    const maxC = Math.max(start.c, end.c);

    const cells: Array<{ r: number; c: number }> = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        cells.push({ r, c });
      }
    }
    return cells;
  }, []);

  const isCellInDragSelection = useCallback((r: number, c: number) => {
    if (!dragStartCell || !dragEndCell) return false;
    const minR = Math.min(dragStartCell.r, dragEndCell.r);
    const maxR = Math.max(dragStartCell.r, dragEndCell.r);
    const minC = Math.min(dragStartCell.c, dragEndCell.c);
    const maxC = Math.max(dragStartCell.c, dragEndCell.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }, [dragStartCell, dragEndCell]);

  // Handle cell mouse down (begins drag-selection or format painting)
  const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // If double clicking or editing, ignore drag
    if (editingCell) return;

    // If Format Painter is active, start drag-selection specifically for applying format
    if (isFormatPainterActive && copiedFormat) {
      e.preventDefault();
      setIsDragSelecting(true);
      setDragStartCell({ r, c });
      setDragEndCell({ r, c });
      return;
    }

    // Normal selection or start of drag selection
    setIsDragSelecting(true);
    setDragStartCell({ r, c });
    setDragEndCell({ r, c });
    setSelectedCell({ r, c });
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (isDragSelecting && dragStartCell) {
      setDragEndCell({ r, c });
    }
  };

  // Global mouseup to finalize drag selection and apply format if painter was active
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragSelecting) {
        setIsDragSelecting(false);

        if (isFormatPainterActive && copiedFormat && dragStartCell && dragEndCell) {
          const cellsInRange = getSelectedRangeCells(dragStartCell, dragEndCell);
          applyFormatToCells(cellsInRange, copiedFormat);
          // Auto-turn off format painter after applying (like Excel / Google Sheets single use)
          setIsFormatPainterActive(false);
          setDragStartCell(null);
          setDragEndCell(null);
        }
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragSelecting, isFormatPainterActive, copiedFormat, dragStartCell, dragEndCell, getSelectedRangeCells, applyFormatToCells]);

  // Handle cell click (with Ctrl+Click detection for Shamsi date)
  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    e.stopPropagation();

    // If Format Painter was active and just clicked a single cell without dragging
    if (isFormatPainterActive && copiedFormat) {
      applyFormatToCells([{ r, c }], copiedFormat);
      setIsFormatPainterActive(false);
      setSelectedCell({ r, c });
      setDragStartCell(null);
      setDragEndCell(null);
      return;
    }

    setSelectedCell({ r, c });

    // Ctrl + Click or Meta + Click -> Insert today's Shamsi date!
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      insertTodayDate(r, c);
      return;
    }
  };

  const getColLetter = (index: number) => {
    return String.fromCharCode(65 + (index % 26));
  };

  const colWidths = tableData.colWidths || Array(tableData.cols).fill(DEFAULT_COL_WIDTH);
  const rowHeights = tableData.rowHeights || Array(tableData.rows).fill(DEFAULT_ROW_HEIGHT);

  return (
    <div
      ref={tableContainerRef}
      data-table-container="true"
      tabIndex={0}
      className="flex flex-col h-full w-full bg-[#0a0219] rounded-b-2xl overflow-hidden select-none border-t border-purple-900/60 outline-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Table Formatting Toolbar (Excel Ribbon Style) */}
      <div className="bg-[#12042b] p-1.5 border-b border-purple-900/60 flex items-center justify-between gap-1 flex-wrap text-xs">
        {/* Left Toolbar: Clipboard, Text Styles, Format & Colors */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Clipboard Group: Copy, Cut, Paste */}
          <div className="flex items-center bg-[#1b073d] border border-purple-800/60 rounded-lg p-0.5">
            {/* Copy (Ctrl+C) */}
            <button
              onClick={handleCopyCells}
              disabled={!selectedCell}
              className="p-1 hover:bg-purple-900/60 rounded text-cyan-300 hover:text-white transition disabled:opacity-35"
              title="کپی محتوا و استایل سلول (Ctrl + C)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Cut (Ctrl+X) */}
            <button
              onClick={handleCutCells}
              disabled={!selectedCell}
              className="p-1 hover:bg-purple-900/60 rounded text-amber-300 hover:text-white transition disabled:opacity-35"
              title="کات کردن محتوا و استایل سلول (Ctrl + X)"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>

            {/* Paste (Ctrl+V) */}
            <button
              onClick={handlePasteCells}
              disabled={!selectedCell && !hasClipboardData}
              className={`p-1 rounded transition ${
                hasClipboardData
                  ? 'hover:bg-purple-900/60 text-pink-300 hover:text-white'
                  : 'text-purple-400/50 hover:bg-purple-900/60 hover:text-purple-200'
              } disabled:opacity-35`}
              title="پیست کردن سلول کپی/کات شده (Ctrl + V)"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy/Cut Feedback Toast Badge */}
          {copyFeedback && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-400 text-cyan-300 animate-pulse shrink-0">
              {copyFeedback}
            </span>
          )}

          <div className="w-px h-4 bg-purple-800/60 mx-0.5" />

          {/* Bold */}
          <button
            onClick={handleToggleBold}
            disabled={!selectedCell}
            className={`p-1 rounded-lg border transition ${
              activeCellProps?.isBold
                ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.5)]'
                : 'bg-[#1b073d] hover:bg-purple-900/70 text-purple-200 border-purple-800/60'
            } disabled:opacity-40`}
            title="بولد (Ctrl + B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            onClick={handleToggleItalic}
            disabled={!selectedCell}
            className={`p-1 rounded-lg border transition ${
              activeCellProps?.isItalic
                ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.5)]'
                : 'bg-[#1b073d] hover:bg-purple-900/70 text-purple-200 border-purple-800/60'
            } disabled:opacity-40`}
            title="ایتالیک (Ctrl + I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline (U) */}
          <button
            onClick={handleToggleUnderline}
            disabled={!selectedCell}
            className={`p-1 rounded-lg border transition ${
              activeCellProps?.isUnderline
                ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.5)]'
                : 'bg-[#1b073d] hover:bg-purple-900/70 text-purple-200 border-purple-800/60'
            } disabled:opacity-40`}
            title="زیرخط (Underline - Ctrl + U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          {/* RTL / LTR Direction Toggle */}
          <button
            onClick={handleToggleDir}
            disabled={!selectedCell}
            className={`p-1 rounded-lg border transition ${
              activeCellProps?.dir === 'ltr'
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                : 'bg-[#1b073d] hover:bg-purple-900/70 text-purple-200 border-purple-800/60'
            } disabled:opacity-40`}
            title={activeCellProps?.dir === 'ltr' ? 'جهت متن: چپ‌چین (LTR)' : 'جهت متن: راست‌چین (RTL)'}
          >
            {activeCellProps?.dir === 'ltr' ? (
              <AlignLeft className="w-3.5 h-3.5 text-cyan-300" />
            ) : (
              <AlignRight className="w-3.5 h-3.5 text-purple-300" />
            )}
          </button>

          {/* Font Size Stepper */}
          <div className="flex items-center bg-[#1b073d] border border-purple-800/60 rounded-lg p-0.5">
            <button
              onClick={() => {
                const current = activeCellProps?.fontSize || 12;
                handleSetFontSize(Math.max(8, current - 1));
              }}
              disabled={!selectedCell}
              className="p-1 hover:bg-purple-900/60 rounded text-purple-300 disabled:opacity-40"
              title="کاهش سایز فونت (-)"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-1 text-[11px] font-mono font-bold text-cyan-300 min-w-[20px] text-center">
              {activeCellProps?.fontSize || 12}
            </span>
            <button
              onClick={() => {
                const current = activeCellProps?.fontSize || 12;
                handleSetFontSize(Math.min(36, current + 1));
              }}
              disabled={!selectedCell}
              className="p-1 hover:bg-purple-900/60 rounded text-purple-300 disabled:opacity-40"
              title="افزایش سایز فونت (+)"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Text Color Picker Popover */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTextColorPicker(!showTextColorPicker);
                setShowBgColorPicker(false);
              }}
              disabled={!selectedCell}
              className="p-1 rounded-lg bg-[#1b073d] hover:bg-purple-900/70 text-purple-200 border border-purple-800/60 flex items-center gap-1 disabled:opacity-40"
              title="تغییر رنگ متن"
            >
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              <div
                className="w-2.5 h-2.5 rounded-full border border-white/40"
                style={{ backgroundColor: activeCellProps?.color || '#f8fafc' }}
              />
            </button>

            {showTextColorPicker && (
              <div className="absolute top-full left-0 mt-1.5 p-2 bg-[#0d0221] border border-purple-600/80 rounded-xl shadow-2xl z-50 flex flex-col gap-1.5 min-w-[170px]" dir="rtl">
                <span className="text-[10px] font-bold text-purple-300/80">رنگ متن سلول:</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_TEXT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => handleSetColor(c.value)}
                      className="w-6 h-6 rounded-lg border border-white/20 hover:scale-110 transition flex items-center justify-center shadow"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Background Color Picker Popover */}
          <div className="relative">
            <button
              onClick={() => {
                setShowBgColorPicker(!showBgColorPicker);
                setShowTextColorPicker(false);
              }}
              disabled={!selectedCell}
              className="p-1 rounded-lg bg-[#1b073d] hover:bg-purple-900/70 text-purple-200 border border-purple-800/60 flex items-center gap-1 disabled:opacity-40"
              title="تغییر رنگ پس‌زمینه سلول"
            >
              <PaintBucket className="w-3.5 h-3.5 text-cyan-400" />
              <div
                className="w-2.5 h-2.5 rounded-full border border-white/40"
                style={{ backgroundColor: activeCellProps?.bgColor || 'transparent' }}
              />
            </button>

            {showBgColorPicker && (
              <div className="absolute top-full left-0 mt-1.5 p-2 bg-[#0d0221] border border-purple-600/80 rounded-xl shadow-2xl z-50 flex flex-col gap-1.5 min-w-[170px]" dir="rtl">
                <span className="text-[10px] font-bold text-purple-300/80">رنگ بک‌گراند سلول:</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_BG_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => handleSetBgColor(c.value)}
                      className="w-6 h-6 rounded-lg border border-white/20 hover:scale-110 transition flex items-center justify-center shadow"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Format Painter / Copy Style Button */}
          <button
            onClick={() => {
              if (isFormatPainterActive) {
                handleCancelFormatPainter();
              } else {
                handleCopyCellFormat();
              }
            }}
            disabled={!selectedCell}
            className={`px-2 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 transition ${
              isFormatPainterActive
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse'
                : 'bg-[#1b073d] hover:bg-purple-900/70 text-amber-300 border-purple-800/60'
            } disabled:opacity-40`}
            title={
              isFormatPainterActive
                ? 'قلم‌مو فعال است: روی سلول‌ها کلیک یا درگ کنید تا مشخصات اعمال شود (کلیک دوباره برای لغو)'
                : 'کپی مشخصات سلول (سایز، رنگ، بولد، بک‌گراند و...) و اعمال با کلیک یا درگ روی سایر سلول‌ها'
            }
          >
            <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
            <span>{isFormatPainterActive ? 'اعمال مشخصات...' : 'کپی مشخصات'}</span>
          </button>

          {/* Insert Today's Date Button (Shamsi) */}
          <button
            onClick={() => {
              if (selectedCell) {
                insertTodayDate(selectedCell.r, selectedCell.c);
              }
            }}
            disabled={!selectedCell}
            className="px-2 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-[0_0_10px_rgba(34,211,238,0.25)] transition disabled:opacity-40"
            title="درج تاریخ شمسی امروز در سلول انتخاب شده (یا کلید Ctrl + کلیک روی هر سلول)"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-200" />
            <span className="hidden sm:inline">تاریخ امروز (شمسی)</span>
          </button>
        </div>

        {/* Right Toolbar: Add/Remove Rows & Columns */}
        <div className="flex items-center gap-1 shrink-0" dir="rtl">
          {/* Row controls */}
          <div className="flex items-center gap-0.5 bg-[#1b073d] border border-purple-800/60 rounded-lg p-0.5">
            <span className="text-[10px] font-bold text-purple-300 px-1">سطر:</span>
            <button
              onClick={handleAddRow}
              className="p-1 hover:bg-purple-900/60 rounded text-cyan-300 transition"
              title="افزودن سطر جدید (+)"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={handleRemoveRow}
              disabled={tableData.rows <= 1}
              className="p-1 hover:bg-purple-900/60 rounded text-rose-300 transition disabled:opacity-30"
              title="حذف سطر (-)"
            >
              <Minus className="w-3 h-3" />
            </button>
          </div>

          {/* Col controls */}
          <div className="flex items-center gap-0.5 bg-[#1b073d] border border-purple-800/60 rounded-lg p-0.5">
            <span className="text-[10px] font-bold text-purple-300 px-1">ستون:</span>
            <button
              onClick={handleAddCol}
              className="p-1 hover:bg-purple-900/60 rounded text-cyan-300 transition"
              title="افزودن ستون جدید (+)"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={handleRemoveCol}
              disabled={tableData.cols <= 1}
              className="p-1 hover:bg-purple-900/60 rounded text-rose-300 transition disabled:opacity-30"
              title="حذف ستون (-)"
            >
              <Minus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Excel Spreadsheet Viewport */}
      <div className="flex-1 overflow-auto bg-[#070114] relative">
        <table className="border-collapse table-fixed w-max min-w-full text-purple-100 font-sans" dir="rtl">
          {/* Table Body */}
          <tbody>
            {Array.from({ length: tableData.rows }).map((_, rIndex) => {
              const height = rowHeights[rIndex] || DEFAULT_ROW_HEIGHT;

              return (
                <tr
                  key={`row_${rIndex}`}
                  style={{ height: `${height}px`, minHeight: `${height}px` }}
                  className="border-b border-purple-900/40 relative group/row"
                >
                  {/* Row Cells */}
                  {Array.from({ length: tableData.cols }).map((_, cIndex) => {
                    const cell = getCell(rIndex, cIndex);
                    const isSelected = selectedCell?.r === rIndex && selectedCell?.c === cIndex;
                    const isInDragRange = isCellInDragSelection(rIndex, cIndex);
                    const isEditing = editingCell?.r === rIndex && editingCell?.c === cIndex;
                    const width = colWidths[cIndex] || DEFAULT_COL_WIDTH;

                    const isCutSource =
                      globalCellClipboard?.isCut &&
                      globalCellClipboard?.sourceNodeId === nodeId &&
                      globalCellClipboard?.sourceRange &&
                      rIndex >= globalCellClipboard.sourceRange.minR &&
                      rIndex <= globalCellClipboard.sourceRange.maxR &&
                      cIndex >= globalCellClipboard.sourceRange.minC &&
                      cIndex <= globalCellClipboard.sourceRange.maxC;

                    return (
                      <td
                        key={`cell_${rIndex}_${cIndex}`}
                        onMouseDown={(e) => handleCellMouseDown(rIndex, cIndex, e)}
                        onMouseEnter={() => handleCellMouseEnter(rIndex, cIndex)}
                        onClick={(e) => handleCellClick(rIndex, cIndex, e)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedCell({ r: rIndex, c: cIndex });
                          setEditingCell({ r: rIndex, c: cIndex });
                        }}
                        style={{
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          maxWidth: `${width}px`,
                          height: `${height}px`,
                          backgroundColor: cell.bgColor && cell.bgColor !== 'transparent' ? cell.bgColor : undefined,
                        }}
                        className={`relative p-1 border-l border-purple-900/40 align-middle transition-colors cursor-cell group/cell select-none ${
                          isCutSource
                            ? 'ring-2 ring-amber-400 ring-dashed ring-inset z-10 bg-amber-950/30'
                            : isInDragRange
                            ? isFormatPainterActive
                              ? 'ring-2 ring-amber-400 ring-inset z-10 bg-amber-500/20'
                              : 'ring-2 ring-cyan-400 ring-inset z-10 bg-cyan-950/30'
                            : isSelected
                            ? isFormatPainterActive
                              ? 'ring-2 ring-amber-400 ring-inset z-10 bg-amber-500/20'
                              : 'ring-2 ring-cyan-400 ring-inset z-10 bg-cyan-950/20'
                            : 'hover:bg-purple-950/30'
                        }`}
                      >
                        {/* Column Resizing Divider Handle (on left edge in RTL) */}
                        <div
                          onMouseDown={(e) => handleColResizeMouseDown(cIndex, e)}
                          className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-cyan-400/80 z-20 transition -translate-x-1/2 opacity-0 group-hover/cell:opacity-100"
                          title="تغییر عرض ستون"
                        />

                        {/* Row Resizing Divider Handle (on bottom edge) */}
                        <div
                          onMouseDown={(e) => handleRowResizeMouseDown(rIndex, e)}
                          className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-cyan-400/80 z-20 transition translate-y-1/2 opacity-0 group-hover/cell:opacity-100"
                          title="تغییر ارتفاع سطر"
                        />

                        {isEditing ? (
                          <textarea
                            autoFocus
                            dir={cell.dir || 'rtl'}
                            value={cell.text}
                            onChange={(e) => updateCell(rIndex, cIndex, { text: e.target.value })}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                setEditingCell(null);
                                // Move to next row cell if exists
                                if (rIndex + 1 < tableData.rows) {
                                  setSelectedCell({ r: rIndex + 1, c: cIndex });
                                }
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                setEditingCell(null);
                                // Move to next column cell
                                if (cIndex + 1 < tableData.cols) {
                                  setSelectedCell({ r: rIndex, c: cIndex + 1 });
                                }
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            style={{
                              fontWeight: cell.isBold ? 'bold' : 'normal',
                              fontStyle: cell.isItalic ? 'italic' : 'normal',
                              textDecoration: cell.isUnderline ? 'underline' : 'none',
                              color: cell.color || '#f8fafc',
                              fontSize: `${cell.fontSize || 12}px`,
                            }}
                            className="w-full h-full p-1 bg-[#090217] border border-cyan-400 rounded outline-none resize-none overflow-hidden"
                          />
                        ) : (
                          <div
                            dir={cell.dir || 'rtl'}
                            style={{
                              fontWeight: cell.isBold ? 'bold' : 'normal',
                              fontStyle: cell.isItalic ? 'italic' : 'normal',
                              textDecoration: cell.isUnderline ? 'underline' : 'none',
                              color: cell.color || '#f8fafc',
                              fontSize: `${cell.fontSize || 12}px`,
                              textAlign: cell.dir === 'ltr' ? 'left' : 'right',
                            }}
                            className="w-full h-full flex items-center justify-start overflow-hidden text-ellipsis whitespace-pre-wrap leading-tight break-words px-1"
                            title={cell.text || 'دابل‌کلیک برای تایپ یا Ctrl+کلیک برای تاریخ شمسی'}
                          >
                            {cell.text || (
                              <span className="text-purple-600/30 text-[10px] italic select-none">
                                {isSelected ? 'تایپ کنید...' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Excel Footer Info / Quick Hint Bar */}
      <div className="bg-[#12042b] px-3 py-1 border-t border-purple-900/60 flex items-center justify-between text-[10px] text-purple-400/80" dir="rtl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-cyan-300 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>میانبرها:</span>
          </span>
          <span><kbd className="px-1 py-0.5 bg-purple-950 border border-purple-700 rounded text-cyan-300 font-mono">Ctrl+C</kbd> کپی استایل و متن</span>
          <span className="text-purple-600">•</span>
          <span><kbd className="px-1 py-0.5 bg-purple-950 border border-purple-700 rounded text-amber-300 font-mono">Ctrl+X</kbd> کات</span>
          <span className="text-purple-600">•</span>
          <span><kbd className="px-1 py-0.5 bg-purple-950 border border-purple-700 rounded text-pink-300 font-mono">Ctrl+V</kbd> پیست</span>
          <span className="text-purple-600">•</span>
          <span><kbd className="px-1 py-0.5 bg-purple-950 border border-purple-700 rounded text-cyan-300 font-mono">Ctrl+کلیک</kbd> تاریخ امروز</span>
        </div>
        <div className="font-mono text-purple-400 hidden sm:block">
          {tableData.rows} سطر × {tableData.cols} ستون
        </div>
      </div>
    </div>
  );
});

