import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Check,
  Edit2,
  Trophy,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpRight,
  ListTodo,
  Layers,
  Info,
  LayoutGrid,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Lock,
  Clock,
  BookOpen,
  Download,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import { StairStep, StaircaseTodo, StaircaseProject, StaircaseTrashItem, DeletedStaircaseItem, DeletedStepItem } from '../types';
import {
  loadStaircaseProjects,
  saveStaircaseProjects,
  loadStaircaseTrash,
  saveStaircaseTrash,
  fetchServerData,
  STAIRCASE_PROJECTS_KEY,
  STAIRCASE_TRASH_KEY,
} from '../utils/storage';
import {
  formatShamsiDate,
  formatHHMM,
  toPersianDigits,
  getShamsiDateStack,
  ShamsiDateStack,
  getShamsiNumbers,
  shamsiToIsoString,
  PERSIAN_MONTH_NAMES,
} from '../utils/time';

interface StaircaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTasksToMain?: (tasks: string[]) => void;
}

// Helper to get ISO date string (YYYY-MM-DD) with optional day offset
const getIsoDateString = (daysOffset = 0): string => {
  const d = new Date();
  if (daysOffset !== 0) {
    d.setDate(d.getDate() + daysOffset);
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Default single-step template with Golden Summit for the goal (creates exactly 1 step with today's date)
const createDefaultSteps = (goalTitle = 'هدف نهایی'): StairStep[] => {
  const now = new Date();
  return [
    {
      id: `step-${Date.now()}-goal`,
      title: goalTitle,
      color: '#78350f', // EXACT Golden summit preserved
      createdAt: now.getTime(),
      customDate: getIsoDateString(0),
      todos: [],
    },
  ];
};

const INITIAL_PROJECTS: StaircaseProject[] = [
  {
    id: 'staircase-project-1',
    title: 'پلکان اصلی: اهداف و تمرکز',
    createdAt: Date.now() - 86400000,
    steps: createDefaultSteps(),
  },
  {
    id: 'staircase-project-2',
    title: 'پلکان مهارت و یادگیری عمیق',
    createdAt: Date.now() - 43200000,
    steps: [
      {
        id: 's2-1',
        title: 'مبانی و آموزش اولیه',
        color: '#220d3a',
        customDate: getIsoDateString(-5),
        todos: [{ id: 't2-1', text: 'مشاهده دوره‌های مقدماتی', completed: true, createdAt: Date.now() }],
      },
      {
        id: 's2-2',
        title: 'تمرین و پروژه‌های کوچک',
        color: '#2b104b',
        customDate: getIsoDateString(-2),
        todos: [{ id: 't2-2', text: 'پیاده‌سازی نمونه‌های کاربردی', completed: false, createdAt: Date.now() }],
      },
      {
        id: 's2-3',
        title: 'هدف: تسلط کامل و خلق اثر',
        color: '#78350f', // Golden summit
        customDate: getIsoDateString(0),
        todos: [{ id: 't2-3', text: 'ارائه پروژه نهایی و دستیابی به هدف', completed: false, createdAt: Date.now() }],
      },
    ],
  },
];

// Dark purple palette options for steps (except the last step which is permanently golden)
const STEP_COLORS = [
  { name: 'بنفش دارک عمیق', value: '#220d3a' },
  { name: 'بنفش بادمجانی تیره', value: '#280f45' },
  { name: 'بنفش سلطنتی تیره', value: '#2e1250' },
  { name: 'بنفش ویولت شبانه', value: '#36155c' },
  { name: 'بنفش ارغوانی تیره', value: '#3e1869' },
  { name: 'بنفش نیلی تیره', value: '#1d0b33' },
];

// Helper to ensure all non-goal steps adopt the requested dark purple theme even if previously saved with legacy slate/teal
const migrateNonGoalStepsToDarkPurple = (loadedProjects: StaircaseProject[]): StaircaseProject[] => {
  const purplePalette = ['#220d3a', '#280f45', '#2e1250', '#36155c', '#3e1869'];
  return loadedProjects.map((p) => ({
    ...p,
    steps: p.steps.map((s, idx) => {
      const isLast = idx === p.steps.length - 1;
      if (isLast) return s; // Do not touch golden summit
      // If legacy slate/charcoal/teal or empty color, migrate to dark purple
      if (
        !s.color ||
        s.color === '#2c2c2e' ||
        s.color === '#38383a' ||
        s.color === '#1b3e34' ||
        s.color === '#1d5345' ||
        s.color === '#24483e'
      ) {
        return { ...s, color: purplePalette[idx % purplePalette.length] };
      }
      return s;
    }),
  }));
};

export const StaircaseModal: React.FC<StaircaseModalProps> = ({
  isOpen,
  onClose,
  onSyncTasksToMain,
}) => {
  // All projects with automatic migration to dark purple for non-final steps
  const [projects, setProjects] = useState<StaircaseProject[]>(() => {
    const saved = loadStaircaseProjects();
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return migrateNonGoalStepsToDarkPurple(saved);
    }
    return INITIAL_PROJECTS;
  });

  // Current active project ID
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return projects[0]?.id || 'staircase-project-1';
  });

  // View mode: 'staircase' (detail view) or 'gallery' (all staircases list)
  const [viewMode, setViewMode] = useState<'staircase' | 'gallery'>('staircase');

  // UI States
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [editingTitleStepId, setEditingTitleStepId] = useState<string | null>(null);
  const [tempStepTitle, setTempStepTitle] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [tempTodoText, setTempTodoText] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [tempProjectTitle, setTempProjectTitle] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [minimizedProjectIds, setMinimizedProjectIds] = useState<Record<string, boolean>>({});

  const toggleMinimizeProject = (projectId: string) => {
    setMinimizedProjectIds((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handleMinimizeAll = () => {
    const allMinimized: Record<string, boolean> = {};
    projects.forEach((p) => {
      allMinimized[p.id] = true;
    });
    setMinimizedProjectIds(allMinimized);
  };

  const handleExpandAll = () => {
    setMinimizedProjectIds({});
  };

  // Deletion Confirmation Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'project' | 'step' | 'todo';
    id: string;
    title: string;
    itemName: string;
    warning?: string;
  } | null>(null);

  // Trash / Recycle Bin State (سطل آشغال پلکان‌ها و پله‌های حذف‌شده)
  const [trashItems, setTrashItems] = useState<StaircaseTrashItem[]>(() => loadStaircaseTrash());
  const [isTrashModalOpen, setIsTrashModalOpen] = useState<boolean>(false);
  const [trashFilter, setTrashFilter] = useState<'all' | 'project' | 'step'>('all');
  const [trashConfirmDeleteId, setTrashConfirmDeleteId] = useState<string | null>(null);
  const [isClearTrashConfirmOpen, setIsClearTrashConfirmOpen] = useState<boolean>(false);
  const [previewNotesItem, setPreviewNotesItem] = useState<DeletedStaircaseItem | null>(null);

  // Sliding Notebook Drawer State (دفترچه یادداشت کشویی سمت راست)
  const [isNotebookDrawerOpen, setIsNotebookDrawerOpen] = useState(false);
  const [notebookCopyNotice, setNotebookCopyNotice] = useState(false);
  const [clearNotebookConfirm, setClearNotebookConfirm] = useState(false);

  // Alert / Warning Notice State (e.g. for minimum step or minimum project limits)
  const [warningNotice, setWarningNotice] = useState<string | null>(null);

  // Create New Staircase Modal State (Modal for independent vs sub-staircase)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStaircaseTitle, setNewStaircaseTitle] = useState('');
  const [newStaircaseGoal, setNewStaircaseGoal] = useState('هدف نهایی');
  const [newStaircaseType, setNewStaircaseType] = useState<'independent' | 'sub'>('independent');
  const [selectedParentId, setSelectedParentId] = useState<string>('');

  // Dropdown menu state to expand/collapse sub-staircases per root staircase (hidden by default)
  const [expandedDropdownRoots, setExpandedDropdownRoots] = useState<Record<string, boolean>>({});

  const toggleDropdownRoot = (rootId: string) => {
    setExpandedDropdownRoots((prev) => ({
      ...prev,
      [rootId]: !prev[rootId],
    }));
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const stepScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Mouse Drag-to-Scroll State & Handlers for Horizontal Staircase scrolling
  const dragScrollState = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
    hasMoved: boolean;
    activeProjId: string | null;
  }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
    activeProjId: null,
  });

  const handleMouseDownDrag = (e: React.MouseEvent<HTMLDivElement>, projId: string) => {
    const target = e.target as HTMLElement;
    // Don't drag if user clicked on form inputs or buttons
    if (target.closest('input, textarea, select, button')) {
      return;
    }
    const container = stepScrollRefs.current[projId];
    if (!container) return;

    dragScrollState.current = {
      isDown: true,
      startX: e.pageX,
      scrollLeft: container.scrollLeft,
      hasMoved: false,
      activeProjId: projId,
    };
  };

  const handleMouseMoveDrag = (e: React.MouseEvent<HTMLDivElement>, projId: string) => {
    if (!dragScrollState.current.isDown || dragScrollState.current.activeProjId !== projId) return;
    const container = stepScrollRefs.current[projId];
    if (!container) return;

    const deltaX = e.pageX - dragScrollState.current.startX;
    if (Math.abs(deltaX) > 4) {
      dragScrollState.current.hasMoved = true;
    }
    // Scroll horizontally left/right smoothly
    container.scrollLeft = dragScrollState.current.scrollLeft - deltaX;
  };

  const handleMouseUpOrLeaveDrag = (projId: string) => {
    if (dragScrollState.current.activeProjId === projId) {
      dragScrollState.current.isDown = false;
      dragScrollState.current.activeProjId = null;
      // Keep hasMoved briefly to block unwanted click triggers right after dragging
      setTimeout(() => {
        dragScrollState.current.hasMoved = false;
      }, 60);
    }
  };

  // Auto-save projects to storage (both localStorage and server file) whenever updated
  useEffect(() => {
    saveStaircaseProjects(projects);
  }, [projects]);

  // Auto-save trash to storage whenever updated
  useEffect(() => {
    saveStaircaseTrash(trashItems);
  }, [trashItems]);

  // Dual-layer recovery: if local storage is empty, hydrate from server backend file
  useEffect(() => {
    let isMounted = true;
    async function restoreFromServerIfMissing() {
      try {
        const localSaved = loadStaircaseProjects();
        if (!localSaved || localSaved.length === 0) {
          const serverProjects = await fetchServerData<StaircaseProject[]>(STAIRCASE_PROJECTS_KEY);
          if (serverProjects && Array.isArray(serverProjects) && serverProjects.length > 0 && isMounted) {
            const migrated = migrateNonGoalStepsToDarkPurple(serverProjects);
            setProjects(migrated);
            saveStaircaseProjects(migrated);
          }
        }
        const serverTrash = await fetchServerData<StaircaseTrashItem[]>(STAIRCASE_TRASH_KEY);
        if (serverTrash && Array.isArray(serverTrash) && isMounted) {
          const localTrash = loadStaircaseTrash();
          if (!localTrash || localTrash.length === 0) {
            setTrashItems(serverTrash);
            saveStaircaseTrash(serverTrash);
          }
        }
      } catch (e) {
        console.warn('Backup fetch check error:', e);
      }
    }
    restoreFromServerIfMissing();
    return () => {
      isMounted = false;
    };
  }, []);

  // Current active project
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || INITIAL_PROJECTS[0];
  const steps = activeProject.steps;
  const totalSteps = steps.length;

  // Hierarchical resolution for main canvas display:
  // Root ID is the parent ID (if active is a sub-staircase) or active project itself
  const currentRootId = activeProject.parentId || activeProject.id;
  const currentRootProject = projects.find((p) => p.id === currentRootId) || activeProject;

  // In the main view, show ONLY the active root project and its sub-staircases (stacked vertically)
  const visibleProjects = projects.filter(
    (p) => p.id === currentRootId || p.parentId === currentRootId
  );

  // Keep selectedStepId valid
  useEffect(() => {
    if (steps.length > 0) {
      if (!selectedStepId || !steps.some((s) => s.id === selectedStepId)) {
        setSelectedStepId(steps[steps.length - 1].id);
      }
    }
  }, [steps, selectedStepId, activeProjectId]);

  if (!isOpen) return null;

  const selectedStep = steps.find((s) => s.id === selectedStepId) || steps[steps.length - 1];
  const selectedStepIndex = steps.findIndex((s) => s.id === selectedStep?.id);
  const isGoalStep = selectedStepIndex === totalSteps - 1;

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsBrowserFullscreen(true))
        .catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => setIsBrowserFullscreen(false))
          .catch(() => {});
      }
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setScale((prev) => Math.min(2.2, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setScale((prev) => Math.max(0.35, +(prev - 0.15).toFixed(2)));
  const handleResetZoom = () => setScale(1.0);
  const handleFitZoom = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 100;
    const requiredWidth = totalSteps * 150 + 120;
    if (requiredWidth > containerWidth) {
      const optimal = Math.max(0.4, Math.min(1.0, containerWidth / requiredWidth));
      setScale(+optimal.toFixed(2));
    } else {
      setScale(1.0);
    }
  };

  // Horizontal scroll helpers (scrolls the active staircase steps directly)
  const handleScrollLeft = () => {
    const activeEl = stepScrollRefs.current[activeProjectId];
    if (activeEl) {
      activeEl.scrollBy({ left: -320, behavior: 'smooth' });
    }
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    const activeEl = stepScrollRefs.current[activeProjectId];
    if (activeEl) {
      activeEl.scrollBy({ left: 320, behavior: 'smooth' });
    }
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const handleScrollToStart = () => {
    const activeEl = stepScrollRefs.current[activeProjectId];
    if (activeEl) {
      activeEl.scrollTo({ left: 0, behavior: 'smooth' });
    }
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const handleScrollToEnd = () => {
    const activeEl = stepScrollRefs.current[activeProjectId];
    if (activeEl) {
      activeEl.scrollTo({ left: activeEl.scrollWidth, behavior: 'smooth' });
    }
  };

  // Project Management (Multiple Staircases & Sub-Staircases)
  const openCreateStaircaseModal = (defaultType: 'independent' | 'sub' = 'independent', parentId?: string) => {
    setNewStaircaseTitle('');
    setNewStaircaseGoal('هدف نهایی');
    setNewStaircaseType(defaultType);
    const targetParent = parentId || currentRootId || projects[0]?.id || '';
    setSelectedParentId(targetParent);
    setIsCreateModalOpen(true);
  };

  const handleCreateNewProject = () => {
    openCreateStaircaseModal('independent');
  };

  const handleConfirmCreateStaircase = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newProjectId = `staircase-${Date.now()}`;
    const parentProject = projects.find((p) => p.id === selectedParentId);
    const rootProjectsList = projects.filter((p) => !p.parentId);
    
    const defaultTitle =
      newStaircaseType === 'sub'
        ? `زیرمجموعه ${parentProject?.title || 'پلکان'}`
        : `پلکان هدف ${rootProjectsList.length + 1}`;

    const finalTitle = newStaircaseTitle.trim() || defaultTitle;
    const finalGoal = newStaircaseGoal.trim() || 'هدف نهایی';
    const newSteps = createDefaultSteps(finalGoal);
    
    const isSub = newStaircaseType === 'sub' && !!selectedParentId;
    const newProject: StaircaseProject = {
      id: newProjectId,
      title: finalTitle,
      createdAt: Date.now(),
      steps: newSteps,
      notes: '',
      parentId: isSub ? selectedParentId : undefined,
    };

    let updated: StaircaseProject[];
    if (isSub) {
      const parentIndex = projects.findIndex((p) => p.id === selectedParentId);
      if (parentIndex !== -1) {
        // Find the last index among parent and its existing sub-staircases
        let insertIndex = parentIndex;
        for (let i = parentIndex + 1; i < projects.length; i++) {
          if (projects[i].parentId === selectedParentId) {
            insertIndex = i;
          } else {
            break;
          }
        }
        updated = [
          ...projects.slice(0, insertIndex + 1),
          newProject,
          ...projects.slice(insertIndex + 1),
        ];
      } else {
        updated = [...projects, newProject];
      }
    } else {
      updated = [...projects, newProject];
    }

    setProjects(updated);
    setActiveProjectId(newProjectId);
    setViewMode('staircase');
    setSelectedStepId(newSteps[newSteps.length - 1].id);
    setIsSidebarOpen(true);
    setIsProjectDropdownOpen(false);
    setIsCreateModalOpen(false);

    // Smooth scroll down to the newly created staircase
    setTimeout(() => {
      const el = document.getElementById(`staircase-section-${newProjectId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  // Handlers for Right Sliding Notebook Drawer (یادداشت‌های اختصاصی پلکان)
  const handleUpdateActiveProjectNotes = (newNotes: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? { ...p, notes: newNotes } : p))
    );
  };

  const handleInsertNoteHelper = (snippet: string) => {
    const currentNotes = activeProject.notes || '';
    const needsNewline = currentNotes.length > 0 && !currentNotes.endsWith('\n');
    const updated = currentNotes + (needsNewline ? '\n' : '') + snippet;
    handleUpdateActiveProjectNotes(updated);
  };

  const handleInsertDateTimeNote = () => {
    const now = new Date();
    const dateStr = formatShamsiDate(now);
    const timeStr = formatHHMM(now.getTime());
    handleInsertNoteHelper(`[${dateStr} - ${timeStr}] `);
  };

  const handleCopyNotes = () => {
    const text = activeProject.notes || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setNotebookCopyNotice(true);
      setTimeout(() => setNotebookCopyNotice(false), 2000);
    });
  };

  const handleDownloadNotes = () => {
    const text = activeProject.notes || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (activeProject.title || 'staircase').replace(/[\/\\:*?"<>|]/g, '_');
    link.download = `${safeTitle}-notes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearNotes = () => {
    handleUpdateActiveProjectNotes('');
    setClearNotebookConfirm(false);
  };

  // Request Deletion Confirmations
  const promptDeleteProject = (proj: StaircaseProject) => {
    if (projects.length <= 1) {
      setWarningNotice('حداقل یک پلکان باید در برنامه باقی بماند و امکان حذف آخرین پلکان وجود ندارد.');
      return;
    }
    const totalStepCount = proj.steps.length;
    const totalTodoCount = proj.steps.flatMap((s) => s.todos).length;
    setDeleteConfirmation({
      type: 'project',
      id: proj.id,
      title: 'حذف پلکان',
      itemName: proj.title,
      warning: `این پلکان شامل ${totalStepCount} پله و ${totalTodoCount} تسک است که همگی حذف خواهند شد.`,
    });
  };

  const promptRemoveStep = (stepIdToRemove?: string) => {
    if (steps.length <= 1) {
      setWarningNotice('حداقل ۱ پله (پله هدف) باید در پلکان باقی بماند.');
      return;
    }

    const targetId = stepIdToRemove || selectedStepId || (steps.length >= 2 ? steps[steps.length - 2]?.id : undefined);
    const targetStep = steps.find((s) => s.id === targetId);
    if (!targetStep) return;

    // Golden goal summit step cannot be removed
    if (targetStep.id === steps[steps.length - 1].id) {
      setWarningNotice('پله هدف نهایی (قله طلایی) بخش اصلی پلکان بوده و قابل حذف نیست.');
      return;
    }

    setDeleteConfirmation({
      type: 'step',
      id: targetStep.id,
      title: 'حذف پله',
      itemName: targetStep.title,
      warning:
        targetStep.todos.length > 0
          ? `تمام ${targetStep.todos.length} تسک ثبت‌شده در این مرحله نیز حذف خواهند شد.`
          : undefined,
    });
  };

  const promptDeleteTodo = (todo: StaircaseTodo) => {
    setDeleteConfirmation({
      type: 'todo',
      id: todo.id,
      title: 'حذف تسک',
      itemName: todo.text,
    });
  };

  // Execute Confirmed Delete Action (Moves to Trash / Recycle Bin)
  const handleExecuteConfirmedDelete = () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === 'project') {
      const projectIdToDelete = deleteConfirmation.id;
      const projToDelete = projects.find((p) => p.id === projectIdToDelete);

      if (projToDelete) {
        // Deep clone project and store in trash with timestamp
        const trashItem: DeletedStaircaseItem = {
          id: `trash-proj-${Date.now()}-${projToDelete.id}`,
          type: 'project',
          deletedAt: Date.now(),
          project: JSON.parse(JSON.stringify(projToDelete)),
        };
        const updatedTrash = [trashItem, ...trashItems];
        setTrashItems(updatedTrash);
        saveStaircaseTrash(updatedTrash);
      }

      // Unlink any sub-projects of the deleted project so they become independent instead of broken
      const updated = projects
        .filter((p) => p.id !== projectIdToDelete)
        .map((p) => (p.parentId === projectIdToDelete ? { ...p, parentId: undefined } : p));
      setProjects(updated);
      saveStaircaseProjects(updated);

      if (activeProjectId === projectIdToDelete) {
        setActiveProjectId(updated[0]?.id || 'staircase-project-1');
      }
      setIsProjectDropdownOpen(false);
      setSyncNotice(`پلکان «${projToDelete?.title || ''}» به سطل آشغال منتقل شد.`);
    } else if (deleteConfirmation.type === 'step') {
      const targetId = deleteConfirmation.id;
      // Find the project containing this step (either active or another)
      const projContainingStep = projects.find((p) => p.steps.some((s) => s.id === targetId)) || activeProject;
      const stepIdx = projContainingStep.steps.findIndex((s) => s.id === targetId);
      const stepToDelete = projContainingStep.steps[stepIdx];

      if (stepToDelete) {
        const trashItem: DeletedStepItem = {
          id: `trash-step-${Date.now()}-${stepToDelete.id}`,
          type: 'step',
          deletedAt: Date.now(),
          projectId: projContainingStep.id,
          projectTitle: projContainingStep.title,
          step: JSON.parse(JSON.stringify(stepToDelete)),
          originalIndex: stepIdx,
        };
        const updatedTrash = [trashItem, ...trashItems];
        setTrashItems(updatedTrash);
        saveStaircaseTrash(updatedTrash);
      }

      const updated = projContainingStep.steps.filter((s) => s.id !== targetId);

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === projContainingStep.id) {
            const sorted = sortStepsChronologically(updated, p);
            return { ...p, steps: sorted };
          }
          return p;
        })
      );

      const nextSelectIdx = Math.max(0, Math.min(stepIdx, updated.length - 1));
      setSelectedStepId(updated[nextSelectIdx]?.id || updated[0]?.id);
      setSyncNotice(`پله «${stepToDelete?.title || ''}» به سطل آشغال منتقل شد.`);
    } else if (deleteConfirmation.type === 'todo') {
      const todoId = deleteConfirmation.id;
      if (selectedStep) {
        const updated = steps.map((s) => {
          if (s.id === selectedStep.id) {
            return {
              ...s,
              todos: s.todos.filter((t) => t.id !== todoId),
            };
          }
          return s;
        });
        updateActiveSteps(updated);
      }
    }

    setDeleteConfirmation(null);
  };

  // Restore Project from Trash
  const handleRestoreProject = (trashItem: DeletedStaircaseItem) => {
    const projToRestore = JSON.parse(JSON.stringify(trashItem.project)) as StaircaseProject;

    // Avoid duplicate ID collision if a new project was created with same ID
    if (projects.some((p) => p.id === projToRestore.id)) {
      projToRestore.id = `staircase-${Date.now()}`;
    }

    const updatedProjects = [...projects, projToRestore];
    setProjects(updatedProjects);
    saveStaircaseProjects(updatedProjects);

    const updatedTrash = trashItems.filter((item) => item.id !== trashItem.id);
    setTrashItems(updatedTrash);
    saveStaircaseTrash(updatedTrash);

    setActiveProjectId(projToRestore.id);
    setViewMode('staircase');
    setSyncNotice(`پلکان «${projToRestore.title}» با موفقیت بازیابی شد.`);
  };

  // Restore Step from Trash
  const handleRestoreStep = (trashItem: DeletedStepItem) => {
    const stepToRestore = JSON.parse(JSON.stringify(trashItem.step)) as StairStep;

    // Check if target project still exists
    let targetProj = projects.find((p) => p.id === trashItem.projectId);
    let targetProjId = trashItem.projectId;

    if (!targetProj) {
      // If original parent staircase was deleted, restore into currently active project
      targetProj = activeProject;
      targetProjId = activeProject.id;
    }

    // Insert step before the last step (golden summit)
    const pSteps = targetProj.steps;
    const withRestored = [
      ...pSteps.slice(0, Math.max(0, pSteps.length - 1)),
      stepToRestore,
      pSteps[pSteps.length - 1],
    ];
    const sorted = sortStepsChronologically(withRestored, targetProj);

    const updatedProjects = projects.map((p) =>
      p.id === targetProjId ? { ...p, steps: sorted } : p
    );
    setProjects(updatedProjects);
    saveStaircaseProjects(updatedProjects);

    const updatedTrash = trashItems.filter((item) => item.id !== trashItem.id);
    setTrashItems(updatedTrash);
    saveStaircaseTrash(updatedTrash);

    setActiveProjectId(targetProjId);
    setSelectedStepId(stepToRestore.id);
    setSyncNotice(`پله «${stepToRestore.title}» با موفقیت بازیابی شد.`);
  };

  // Permanent Delete Single Item from Trash
  const handlePermanentDelete = (trashId: string) => {
    const updatedTrash = trashItems.filter((item) => item.id !== trashId);
    setTrashItems(updatedTrash);
    saveStaircaseTrash(updatedTrash);
    setTrashConfirmDeleteId(null);
    setSyncNotice('مورد با موفقیت به طور کامل و دائم حذف شد.');
  };

  // Empty Entire Trash
  const handleEmptyTrash = () => {
    setTrashItems([]);
    saveStaircaseTrash([]);
    setIsClearTrashConfirmOpen(false);
    setSyncNotice('سطل آشغال به طور کامل پاکسازی شد.');
  };

  const handleDuplicateProject = (proj: StaircaseProject) => {
    const dupId = `staircase-${Date.now()}`;
    const duplicated: StaircaseProject = {
      ...proj,
      id: dupId,
      title: `${proj.title} (کپی)`,
      createdAt: Date.now(),
      steps: proj.steps.map((s, idx) => ({
        ...s,
        id: `step-${Date.now()}-${idx}`,
        createdAt: s.createdAt || Date.now(),
        todos: s.todos.map((t, tIdx) => ({
          ...t,
          id: `todo-${Date.now()}-${idx}-${tIdx}`,
          completed: false,
        })),
      })),
    };

    // Insert right below the duplicated project
    const projIndex = projects.findIndex((p) => p.id === proj.id);
    let updated: StaircaseProject[];
    if (projIndex !== -1) {
      updated = [
        ...projects.slice(0, projIndex + 1),
        duplicated,
        ...projects.slice(projIndex + 1),
      ];
    } else {
      updated = [...projects, duplicated];
    }

    setProjects(updated);
    setActiveProjectId(dupId);
    setViewMode('staircase');
    setSelectedStepId(duplicated.steps[duplicated.steps.length - 1].id);
    setIsSidebarOpen(true);

    setTimeout(() => {
      const el = document.getElementById(`staircase-section-${dupId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  const handleSaveProjectTitle = (targetId?: string) => {
    const pId = targetId || activeProjectId;
    const clean = tempProjectTitle.trim() || 'پلکان بدون عنوان';
    const updated = projects.map((p) => (p.id === pId ? { ...p, title: clean } : p));
    setProjects(updated);
    setIsEditingProjectTitle(false);
    setEditingProjectId(null);
  };

  // Helper to sort regular steps chronologically while keeping the Golden Goal (last step) at the summit
  const sortStepsChronologically = (stepsToSort: StairStep[], proj: StaircaseProject): StairStep[] => {
    if (stepsToSort.length <= 2) return stepsToSort;

    // The last step is always the summit / Golden Goal
    const summitStep = stepsToSort[stepsToSort.length - 1];
    const regularSteps = stepsToSort.slice(0, stepsToSort.length - 1);

    // Compute effective timestamp for each regular step using its customDate or assigned index
    const withTimes = regularSteps.map((s, idx) => {
      let time = 0;
      if (s.customDate) {
        const parts = s.customDate.split('-');
        if (parts.length === 3) {
          time = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0).getTime();
        } else {
          time = new Date(s.customDate).getTime();
        }
      }
      if (!time || isNaN(time)) {
        // Fall back to getStepDateObj calculation
        time = getStepDateObj(s, idx, proj).getTime();
      }
      return { step: s, time, originalIndex: idx };
    });

    // Sort stably by date
    withTimes.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.originalIndex - b.originalIndex;
    });

    return [...withTimes.map((item) => item.step), summitStep];
  };

  // Update steps within active project
  const updateActiveSteps = (newSteps: StairStep[]) => {
    const updated = projects.map((p) => {
      if (p.id === activeProjectId) {
        const sorted = sortStepsChronologically(newSteps, p);
        return { ...p, steps: sorted };
      }
      return p;
    });
    setProjects(updated);
  };

  // Resolves the normalized JavaScript Date object for any step in a project
  const getStepDateObj = (step: StairStep, stepIdx: number, proj: StaircaseProject): Date => {
    if (step.customDate) {
      const parts = step.customDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      }
      const parsed = new Date(step.customDate);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(12, 0, 0, 0);
        return parsed;
      }
    }

    if (step.createdAt) {
      const parsed = new Date(step.createdAt);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(12, 0, 0, 0);
        return parsed;
      }
    }

    let baseDate: Date;
    if (proj.steps[0]?.customDate) {
      const parts = proj.steps[0].customDate.split('-');
      if (parts.length === 3) {
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      } else {
        baseDate = new Date(proj.steps[0].customDate);
      }
    } else if (proj.steps[0]?.createdAt) {
      baseDate = new Date(proj.steps[0].createdAt);
    } else if (proj.createdAt) {
      baseDate = new Date(proj.createdAt);
    } else {
      baseDate = new Date();
    }

    const d = new Date(baseDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + stepIdx);
    return d;
  };

  // Formats Shamsi date stack info (سال / روز / ماه)
  const getStepDateInfo = (step: StairStep, stepIdx: number, proj: StaircaseProject): ShamsiDateStack => {
    const d = getStepDateObj(step, stepIdx, proj);
    return getShamsiDateStack(d);
  };

  // Calculates list of missing calendar days between two dates
  const getMissingDaysBetween = (
    prevDateObj: Date,
    currDateObj: Date
  ): Array<{ dateObj: Date; dateInfo: ShamsiDateStack; isoStr: string }> => {
    const missing: Array<{ dateObj: Date; dateInfo: ShamsiDateStack; isoStr: string }> = [];
    const tPrev = new Date(prevDateObj.getFullYear(), prevDateObj.getMonth(), prevDateObj.getDate(), 12, 0, 0).getTime();
    const tCurr = new Date(currDateObj.getFullYear(), currDateObj.getMonth(), currDateObj.getDate(), 12, 0, 0).getTime();

    const diffDays = Math.round((tCurr - tPrev) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      for (let i = 1; i < diffDays; i++) {
        const gapDate = new Date(prevDateObj);
        gapDate.setDate(gapDate.getDate() + i);
        gapDate.setHours(12, 0, 0, 0);
        const isoStr = `${gapDate.getFullYear()}-${pad(gapDate.getMonth() + 1)}-${pad(gapDate.getDate())}`;
        missing.push({
          dateObj: gapDate,
          dateInfo: getShamsiDateStack(gapDate),
          isoStr,
        });
      }
    }
    return missing;
  };

  // Add Step to any specific project or active project
  const handleAddStepForProject = (projectId: string, customDateIso?: string) => {
    setActiveProjectId(projectId);
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;
    const pSteps = targetProj.steps;
    const newStepId = `step-${Date.now()}`;
    const newStepNum = pSteps.length <= 1 ? 1 : pSteps.length;
    const now = Date.now();

    // User requirement: When a new step is added, it must strictly have today's date
    const assignedDateIso: string = customDateIso || getIsoDateString(0);

    const newStep: StairStep = {
      id: newStepId,
      title: `مرحله ${newStepNum}: گام جدید`,
      color: '#280f45', // Dark purple
      createdAt: now,
      customDate: assignedDateIso,
      todos: [
        {
          id: `todo-${now}`,
          text: 'اقدام اولیه این مرحله را وارد کنید',
          completed: false,
          createdAt: now,
        },
      ],
    };

    // Insert new step and sort chronologically before the golden summit
    const withNewStep = [...pSteps.slice(0, pSteps.length - 1), newStep, pSteps[pSteps.length - 1]];
    const updated = sortStepsChronologically(withNewStep, targetProj);

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, steps: updated } : p))
    );
    setSelectedStepId(newStepId);
    setIsSidebarOpen(true);

    setTimeout(() => {
      const el = document.getElementById(`step-pillar-${newStepId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        const scrollContainer = stepScrollRefs.current[projectId];
        if (scrollContainer) {
          scrollContainer.scrollBy({ left: 300, behavior: 'smooth' });
        }
      }
    }, 100);
  };

  // Add Step immediately to active project
  const handleAddStep = () => {
    handleAddStepForProject(activeProjectId);
  };

  // Remove Step (always prompts confirmation)
  const handleRemoveStep = (stepIdToRemove?: string) => {
    promptRemoveStep(stepIdToRemove);
  };

  // Todo operations
  const handleAddTodo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTodoText.trim() || !selectedStep) return;

    const newTodo: StaircaseTodo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: newTodoText.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    const updated = steps.map((s) => {
      if (s.id === selectedStep.id) {
        return {
          ...s,
          todos: [...s.todos, newTodo],
        };
      }
      return s;
    });

    updateActiveSteps(updated);
    setNewTodoText('');
  };

  const handleToggleTodo = (todoId: string) => {
    if (!selectedStep) return;
    const updated = steps.map((s) => {
      if (s.id === selectedStep.id) {
        return {
          ...s,
          todos: s.todos.map((t) => (t.id === todoId ? { ...t, completed: !t.completed } : t)),
        };
      }
      return s;
    });
    updateActiveSteps(updated);
  };

  // Delete Todo (always prompts confirmation)
  const handleDeleteTodo = (todoId: string) => {
    const todo = selectedStep?.todos.find((t) => t.id === todoId);
    if (todo) {
      promptDeleteTodo(todo);
    }
  };

  // Edit Todo
  const handleStartEditTodo = (todo: StaircaseTodo) => {
    setEditingTodoId(todo.id);
    setTempTodoText(todo.text);
  };

  const handleSaveEditTodo = () => {
    if (!editingTodoId || !selectedStep) return;
    const trimmed = tempTodoText.trim();
    if (!trimmed) {
      setEditingTodoId(null);
      return;
    }
    const updated = steps.map((s) => {
      if (s.id === selectedStep.id) {
        return {
          ...s,
          todos: s.todos.map((t) => (t.id === editingTodoId ? { ...t, text: trimmed } : t)),
        };
      }
      return s;
    });
    updateActiveSteps(updated);
    setEditingTodoId(null);
  };

  const handleCancelEditTodo = () => {
    setEditingTodoId(null);
    setTempTodoText('');
  };

  const handleChangeStepColor = (color: string) => {
    if (!selectedStep || isGoalStep) return; // Last step remains permanently golden
    const updated = steps.map((s) => (s.id === selectedStep.id ? { ...s, color } : s));
    updateActiveSteps(updated);
  };

  const handleStartEditTitle = (step: StairStep, projectId?: string) => {
    if (projectId && projectId !== activeProjectId) {
      setActiveProjectId(projectId);
    }
    setEditingTitleStepId(step.id);
    setTempStepTitle(step.title);
  };

  const handleSaveStepTitle = () => {
    if (!editingTitleStepId) return;
    const cleanTitle = tempStepTitle.trim() || 'بدون عنوان';
    const updated = steps.map((s) => (s.id === editingTitleStepId ? { ...s, title: cleanTitle } : s));
    updateActiveSteps(updated);
    setEditingTitleStepId(null);
  };

  const handleSyncToMainList = () => {
    if (!onSyncTasksToMain || !selectedStep) return;
    const uncompletedTasks = selectedStep.todos.filter((t) => !t.completed).map((t) => t.text);
    if (uncompletedTasks.length === 0) {
      setSyncNotice('تمام تسک‌های این پله انجام شده‌اند یا تسکی برای انتقال وجود ندارد.');
      setTimeout(() => setSyncNotice(null), 3500);
      return;
    }
    onSyncTasksToMain(uncompletedTasks);
    setSyncNotice(`${uncompletedTasks.length} تسک به چک‌لیست فوکوس منتقل شد.`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const handleUpdateStepDate = (stepId: string, newDateIso: string) => {
    if (!newDateIso) return;
    const updated = steps.map((s) => (s.id === stepId ? { ...s, customDate: newDateIso } : s));
    updateActiveSteps(updated);
  };

  // Dimensions & Calculations
  const minStepHeight = 65;
  const maxStepHeight = 260;
  const stepWidth = 125;

  const allTodos = steps.flatMap((s) => s.todos);
  const completedAllCount = allTodos.filter((t) => t.completed).length;
  const overallPercent = allTodos.length > 0 ? Math.round((completedAllCount / allTodos.length) * 100) : 0;

  return (
    /* Full screen container edge-to-edge (100vw × 100vh) */
    <div
      className="fixed inset-0 z-50 w-screen h-screen bg-[#07050d] flex flex-col overflow-hidden text-neutral-100 transition-all animate-in fade-in duration-150 staircase-vazir-root"
      dir="rtl"
    >
      {/* Top Navigation & Controls Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-fuchsia-950/40 bg-[#0e0a17] shrink-0 gap-3 flex-wrap">
        {/* Start / Left: Title & Staircase Selector */}
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          {viewMode === 'gallery' ? (
            <button
              onClick={() => setViewMode('staircase')}
              className="p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-amber-400 hover:text-white transition flex items-center gap-1.5 text-xs font-bold border border-purple-800/40"
              title="بازگشت به نمای پلکان"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>بازگشت به پلکان</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('gallery')}
              className="p-2 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 text-purple-200 hover:text-amber-300 transition flex items-center gap-1.5 text-xs font-bold border border-purple-800/40"
              title="مشاهده همه پلکان‌ها به صورت گالری"
            >
              <LayoutGrid className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">همه پلکان‌ها ({projects.length})</span>
            </button>
          )}

          {/* Current Staircase Title (Editable) and Dropdown Switcher */}
          {viewMode === 'staircase' && (
            <div className="relative">
              {isEditingProjectTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempProjectTitle}
                    onChange={(e) => setTempProjectTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveProjectTitle()}
                    autoFocus
                    className="px-3 py-1 rounded-xl bg-neutral-900 border border-amber-500 text-sm font-bold text-white outline-none w-48 sm:w-64"
                  />
                  <button
                    onClick={handleSaveProjectTitle}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
                  >
                    تایید
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-white font-extrabold text-sm sm:text-base border border-purple-800/50 hover:border-amber-500/50 transition group"
                    title="مشاهده تمام پلکان‌ها و تغییر پلکان فعال"
                  >
                    {activeProject.parentId ? (
                      <Layers className="w-4 h-4 text-fuchsia-400" />
                    ) : (
                      <Trophy className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="truncate max-w-[140px] sm:max-w-[240px]">{activeProject.title}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white" />
                  </button>

                  <button
                    onClick={() => {
                      setTempProjectTitle(activeProject.title);
                      setIsEditingProjectTitle(true);
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-purple-950/50 transition"
                    title="ویرایش نام پلکان"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => promptDeleteProject(activeProject)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                    title="حذف این پلکان"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Dropdown Menu for fast switching between all staircases and sub-staircases */}
              {isProjectDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-[#150d24] border border-purple-800/70 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-purple-900/50 text-xs font-bold text-neutral-400">
                    <span>تمام پلکان‌ها و زیرمجموعه‌ها:</span>
                    <button
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        openCreateStaircaseModal('independent');
                      }}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>پلکان جدید</span>
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 py-2 custom-scrollbar">
                    {(() => {
                      const rootProjects = projects.filter((p) => !p.parentId);
                      // Include any orphaned sub-projects
                      const orphaned = projects.filter(
                        (p) => p.parentId && !projects.some((root) => root.id === p.parentId)
                      );
                      const allRoots = [...rootProjects, ...orphaned];

                      return allRoots.map((rootProj) => {
                        const isRootActive = rootProj.id === activeProjectId;
                        const rootTodos = rootProj.steps.flatMap((s) => s.todos);
                        const rootDoneCount = rootTodos.filter((t) => t.completed).length;
                        const subProjects = projects.filter((p) => p.parentId === rootProj.id);
                        const isExpanded = !!expandedDropdownRoots[rootProj.id];

                        return (
                          <div key={rootProj.id} className="space-y-1">
                            {/* Root Staircase Item */}
                            <div
                              onClick={() => {
                                setActiveProjectId(rootProj.id);
                                setSelectedStepId(rootProj.steps[rootProj.steps.length - 1].id);
                                setIsProjectDropdownOpen(false);
                              }}
                              className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                                isRootActive
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold'
                                  : 'hover:bg-purple-950/70 bg-[#190e2b]/60 border border-purple-900/40 text-neutral-200'
                              }`}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs truncate font-black">{rootProj.title}</p>
                                  <p className="text-[10px] text-neutral-400 mt-0.5">
                                    {rootProj.steps.length} پله • {rootDoneCount}/{rootTodos.length} تسک
                                    {subProjects.length > 0 && ` • (${subProjects.length} زیرمجموعه)`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {isRootActive && <Check className="w-4 h-4 text-amber-400" />}

                                {/* Red Downward Arrow ONLY for staircases that have sub-staircases */}
                                {subProjects.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDropdownRoot(rootProj.id)}
                                    className={`p-1 rounded-lg text-rose-400 hover:text-rose-200 bg-rose-950/70 hover:bg-rose-900/90 border border-rose-500/60 transition shadow-sm flex items-center justify-center ${
                                      isExpanded ? 'bg-rose-900/90 text-rose-100 ring-1 ring-rose-400' : ''
                                    }`}
                                    title={isExpanded ? 'بستن زیرمجموعه‌ها' : `نمایش ${subProjects.length} زیرمجموعه`}
                                  >
                                    <ChevronDown
                                      className={`w-3.5 h-3.5 text-rose-400 transition-transform duration-200 ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsProjectDropdownOpen(false);
                                    openCreateStaircaseModal('sub', rootProj.id);
                                  }}
                                  className="p-1 rounded-lg text-fuchsia-300 hover:text-white hover:bg-fuchsia-950/50 transition"
                                  title="افزودن زیرمجموعه برای این پلکان"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => promptDeleteProject(rootProj)}
                                  className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                  title="حذف این پلکان"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Sub-Staircases indented under this root - shown ONLY when user clicked the red arrow */}
                            {subProjects.length > 0 && isExpanded && (
                              <div className="pr-4 space-y-1 border-r-2 border-fuchsia-500/30 mr-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                {subProjects.map((subProj) => {
                                  const isSubActive = subProj.id === activeProjectId;
                                  const subTodos = subProj.steps.flatMap((s) => s.todos);
                                  const subDoneCount = subTodos.filter((t) => t.completed).length;

                                  return (
                                    <div
                                      key={subProj.id}
                                      onClick={() => {
                                        setActiveProjectId(subProj.id);
                                        setSelectedStepId(subProj.steps[subProj.steps.length - 1].id);
                                        setIsProjectDropdownOpen(false);
                                      }}
                                      className={`p-2 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                                        isSubActive
                                          ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/50 font-bold'
                                          : 'hover:bg-purple-950/50 bg-[#120722]/50 border border-purple-900/30 text-neutral-300'
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-[11px] truncate font-bold">{subProj.title}</p>
                                          <p className="text-[9px] text-neutral-400">
                                            {subProj.steps.length} پله • {subDoneCount}/{subTodos.length} تسک
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        {isSubActive && <Check className="w-3.5 h-3.5 text-fuchsia-400" />}
                                        <button
                                          type="button"
                                          onClick={() => promptDeleteProject(subProj)}
                                          className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                          title="حذف این زیرمجموعه"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="pt-2 border-t border-purple-900/50">
                    <button
                      onClick={() => {
                        setViewMode('gallery');
                        setIsProjectDropdownOpen(false);
                      }}
                      className="w-full py-1.5 text-center text-xs text-neutral-400 hover:text-amber-300 transition"
                    >
                      مشاهده کارت‌های کامل همه پلکان‌ها (گالری)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* End / Right: Action Tools & Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end">
          {/* Create New Staircase Button */}
          <button
            onClick={handleCreateNewProject}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95"
            title="ایجاد پلکان جدید جداگانه"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>پلکان جدید</span>
          </button>

          {/* Recycle Bin / Trash Button (سطل آشغال در کنار پلکان جدید) */}
          <button
            type="button"
            onClick={() => setIsTrashModalOpen(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 border ${
              trashItems.length > 0
                ? 'bg-[#1f0e2b] hover:bg-[#2e133f] text-rose-300 hover:text-rose-100 border-rose-700/60 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'bg-[#150d24] hover:bg-purple-900/80 text-neutral-400 hover:text-neutral-200 border-purple-900/40'
            }`}
            title="سطل آشغال (پلکان‌ها و پله‌های حذف‌شده)"
          >
            <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>سطل آشغال</span>
            {trashItems.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/25 text-rose-200 border border-rose-500/50 text-[10px] font-mono font-bold">
                {toPersianDigits(trashItems.length)}
              </span>
            )}
          </button>

          {/* Notebook Drawer Toggle Button (دفترچه یادداشت کشویی) */}
          <button
            type="button"
            onClick={() => setIsNotebookDrawerOpen(!isNotebookDrawerOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 ${
              isNotebookDrawerOpen
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)] border border-pink-400/60'
                : 'bg-[#1b0d33] hover:bg-purple-900/80 text-fuchsia-200 hover:text-white border border-fuchsia-700/60 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
            }`}
            title={isNotebookDrawerOpen ? 'بستن دفترچه یادداشت کشویی' : 'باز کردن دفترچه یادداشت کشویی پلکان'}
          >
            <BookOpen className="w-4 h-4 text-pink-400 shrink-0" />
            <span>دفترچه یادداشت</span>
            {activeProject.notes && activeProject.notes.trim().length > 0 && (
              <span className="w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_6px_#f472b6]" />
            )}
          </button>

          {viewMode === 'staircase' && (
            <>
              {/* Step Count Controls: Add & Remove Steps */}
              <div className="flex items-center bg-[#150d24] border border-purple-800/40 rounded-xl p-1 gap-1">
                <button
                  onClick={handleAddStep}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                  title="افزودن پله جدید به مسیر"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">افزودن پله</span>
                </button>

                <button
                  onClick={() => handleRemoveStep()}
                  disabled={steps.length <= 1}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                    steps.length <= 1
                      ? 'bg-neutral-800/40 text-neutral-500 border-neutral-800 cursor-not-allowed'
                      : 'bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 border-rose-800/40'
                  }`}
                  title="حذف پله فعلی یا ماقبل آخر"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">حذف پله</span>
                </button>
              </div>

              {/* Zoom / Scale Controls */}
              <div className="flex items-center bg-[#150d24] border border-purple-800/40 rounded-xl p-1 gap-1">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg hover:bg-purple-900/50 text-neutral-300 hover:text-white transition active:scale-95"
                  title="کوچک‌نمایی (Zoom Out)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-1.5 py-1 text-xs font-mono font-bold text-neutral-300 hover:text-white transition"
                  title="بازنشانی زوم به ۱۰۰٪"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg hover:bg-purple-900/50 text-neutral-300 hover:text-white transition active:scale-95"
                  title="بزرگ‌نمایی (Zoom In)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleFitZoom}
                  className="p-1.5 rounded-lg hover:bg-purple-900/50 text-neutral-300 hover:text-white transition"
                  title="تنظیم خودکار با عرض صفحه"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Toggle Left Sidebar Drawer (Hide/Show) */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                  isSidebarOpen
                    ? 'bg-purple-950/40 text-neutral-200 border-purple-800/50 hover:text-white'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                }`}
                title={isSidebarOpen ? 'مخفی کردن منوی تسک‌ها' : 'نمایش منوی تسک‌ها'}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                <span className="hidden lg:inline">{isSidebarOpen ? 'مخفی کردن منو' : 'نمایش منو'}</span>
              </button>
            </>
          )}

          {/* Browser Fullscreen Toggle Button */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-purple-950/30 hover:bg-purple-900/50 text-neutral-400 hover:text-white border border-purple-800/40 transition"
            title={isBrowserFullscreen ? 'خروج از تمام صفحه مرورگر' : 'تمام صفحه مرورگر'}
          >
            {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800/80 hover:bg-rose-900/80 text-neutral-300 hover:text-white transition"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sync Alert Notice */}
      {syncNotice && (
        <div className="bg-cyan-950/90 border-b border-cyan-800 text-cyan-200 text-xs px-5 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
          <span>{syncNotice}</span>
          <button onClick={() => setSyncNotice(null)} className="text-cyan-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Area (Canvas / Gallery + Right Sliding Notebook Drawer) */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* VIEW 1: GALLERY OF ALL STAIRCASES */}
        {viewMode === 'gallery' ? (
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-[#07050d] custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-amber-400" />
                  <span>گالری پلکان‌های من</span>
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  می‌توانید چندین پلکان مجزا برای اهداف کاری، تحصیلی یا شخصی خود تعریف و مدیریت کنید.
                </p>
              </div>

              <button
                onClick={handleCreateNewProject}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm transition flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>ایجاد پلکان جدید</span>
              </button>
            </div>

            {/* Grid of Staircases */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((proj) => {
                const projSteps = proj.steps;
                const projTodos = projSteps.flatMap((s) => s.todos);
                const completedCount = projTodos.filter((t) => t.completed).length;
                const percent = projTodos.length > 0 ? Math.round((completedCount / projTodos.length) * 100) : 0;
                const isCurrent = proj.id === activeProjectId;

                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      setViewMode('staircase');
                    }}
                    className={`group relative rounded-3xl p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden bg-[#110b1e] hover:bg-[#160f26] ${
                      isCurrent
                        ? 'border-amber-500/70 ring-2 ring-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                        : 'border-purple-900/40 hover:border-purple-700/60 shadow-lg'
                    }`}
                  >
                    {/* Top Info */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-200 border border-purple-800/40 font-mono">
                          {projSteps.length} پله
                        </span>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDuplicateProject(proj)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                            title="تکثیر این پلکان"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => promptDeleteProject(proj)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                            title="حذف این پلکان"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition line-clamp-1">
                        {proj.title}
                      </h3>

                      <p className="text-[11px] text-neutral-400 mt-1">
                        {completedCount} از {projTodos.length} کار تکمیل شده ({percent}٪)
                      </p>
                    </div>

                    {/* Mini Visual Staircase Preview (Dark purple steps + Golden summit) */}
                    <div className="my-6 h-28 flex items-end justify-center gap-1.5 px-3 py-2 bg-black/50 rounded-2xl border border-purple-950/60 pointer-events-none" dir="ltr">
                      {projSteps.map((s, idx) => {
                        const isSummit = idx === projSteps.length - 1;
                        const h = projSteps.length <= 1 ? 65 : 25 + (idx / Math.max(1, projSteps.length - 1)) * 65;
                        const purpleTone = s.color || '#280f45';
                        return (
                          <div
                            key={s.id}
                            className="w-6 rounded-t-sm transition-all relative border-t border-l border-r"
                            style={{
                              height: `${h}%`,
                              borderColor: isSummit ? '#f59e0b' : '#6b21a8/40',
                              backgroundColor: isSummit ? undefined : purpleTone,
                              background: isSummit
                                ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 50%, #78350f 100%)'
                                : `linear-gradient(180deg, ${purpleTone} 0%, #150726 100%)`,
                              boxShadow: isSummit ? '0 0 10px rgba(245,158,11,0.6)' : undefined,
                            }}
                          >
                            {isSummit && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress Bar & Open Button */}
                    <div>
                      <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden mb-3">
                        <div
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-[-2px] transition-transform">
                        <span>باز کردن و مدیریت پلکان</span>
                        <ChevronLeft className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Project Card */}
              <div
                onClick={handleCreateNewProject}
                className="rounded-3xl p-8 border-2 border-dashed border-purple-900/50 hover:border-amber-500/60 bg-purple-950/10 hover:bg-purple-950/25 transition-all cursor-pointer flex flex-col items-center justify-center text-center group min-h-[260px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-amber-300 transition">
                  ایجاد پلکان جدید
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-[200px]">
                  یک مسیر پلکانی جدید با گام‌های دلخواه برای پروژه‌ای تازه بسازید
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: INTERACTIVE STAIRCASE CANVAS & TASK LIST */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Staircase Canvas Container with Vertical & Horizontal Scrolling */}
          <div
            ref={containerRef}
            className="flex-1 relative bg-[#07050d] overflow-x-auto overflow-y-auto custom-scrollbar select-none flex flex-col items-center py-4 sm:py-6 px-3 sm:px-6 gap-6 scroll-smooth min-h-0 min-w-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(68, 20, 110, 0.25) 0%, transparent 80%)',
            }}
            dir="ltr"
          >
            {/* Background Aesthetic Guides */}
            <div className="absolute inset-0 pointer-events-none opacity-10 flex flex-col justify-between p-8">
              <div className="border-b border-dashed border-purple-500 w-full" />
              <div className="border-b border-dashed border-purple-500 w-full" />
              <div className="border-b border-dashed border-purple-500 w-full" />
            </div>

            {/* Float Left Floating Open Sidebar Button (when sidebar is hidden) */}
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="fixed top-20 left-4 z-30 px-3.5 py-2 rounded-2xl bg-[#150d24]/95 hover:bg-[#201438] border border-amber-500/60 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-[0_4px_25px_rgba(0,0,0,0.6)] transition backdrop-blur-md active:scale-95"
                title="نمایش منوی تسک‌ها"
                dir="rtl"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-400" />
                <span>نمایش منوی تسک‌ها</span>
                {selectedStep && (
                  <span className="bg-amber-500/20 px-2 py-0.5 rounded-lg text-[10px] text-amber-200 truncate max-w-[120px]">
                    {selectedStep.title}
                  </span>
                )}
              </button>
            )}

            {/* Horizontal Scroll Navigation Float Controls */}
            <div className="fixed bottom-4 left-4 z-30 flex items-center gap-1 bg-[#150d24]/95 border border-purple-900/60 rounded-2xl p-1 shadow-2xl backdrop-blur-md">
              <button
                onClick={handleScrollToStart}
                className="p-2 rounded-xl hover:bg-purple-900/60 text-neutral-400 hover:text-amber-300 transition active:scale-95"
                title="پرش به شروع پلکان (پله اول)"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleScrollLeft}
                className="p-2 rounded-xl hover:bg-purple-900/60 text-neutral-300 hover:text-white transition active:scale-95"
                title="اسکرول به چپ"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono text-purple-300 px-1 select-none">اسکرول پله‌ها</span>
              <button
                onClick={handleScrollRight}
                className="p-2 rounded-xl hover:bg-purple-900/60 text-neutral-300 hover:text-white transition active:scale-95"
                title="اسکرول به راست"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleScrollToEnd}
                className="p-2 rounded-xl hover:bg-purple-900/60 text-neutral-400 hover:text-amber-300 transition active:scale-95"
                title="پرش به انتهای پلکان (هدف نهایی)"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Multi-Staircase Global Toolbar (When active project has sub-staircases) */}
            {visibleProjects.length > 1 && (
              <div
                className="w-full max-w-6xl flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#140b26]/90 border border-purple-900/50 backdrop-blur-md shadow-lg"
                dir="rtl"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-fuchsia-400" />
                  <span className="text-xs font-bold text-neutral-200">
                    پلکان اصلی و زیرمجموعه‌ها ({visibleProjects.length} پلکان)
                  </span>
                  <span className="text-[11px] text-neutral-400 hidden sm:inline">
                    می‌توانید هر پلکان را برای مشاهده فشرده کوچک (Minimize) کنید
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMinimizeAll}
                    className="px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/50 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                    title="کوچک کردن تمام پلکان‌ها (Minimize All)"
                  >
                    <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>بستن همه</span>
                  </button>
                  <button
                    onClick={handleExpandAll}
                    className="px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/50 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                    title="باز کردن تمام پلکان‌ها (Expand All)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>باز کردن همه</span>
                  </button>
                </div>
              </div>
            )}

            {/* Stack of Visible Staircases Vertically (فقط پلکان انتخابی و زیرمجموعه‌های آن) */}
            {visibleProjects.map((proj, projIndex) => {
              const isThisProjActive = proj.id === activeProjectId;
              const isMinimized = !!minimizedProjectIds[proj.id];
              const projSteps = proj.steps;
              const projTotalSteps = projSteps.length;
              const projTodos = projSteps.flatMap((s) => s.todos);
              const projDoneCount = projTodos.filter((t) => t.completed).length;

              return (
                <React.Fragment key={proj.id}>
                  {/* Staircase Card Section */}
                  <div
                    id={`staircase-section-${proj.id}`}
                    onClick={() => {
                      if (activeProjectId !== proj.id) {
                        setActiveProjectId(proj.id);
                        setSelectedStepId(projSteps[projSteps.length - 1].id);
                        setIsSidebarOpen(true);
                      }
                    }}
                    className={`w-full max-w-6xl rounded-3xl transition-all duration-300 relative border flex flex-col items-center ${
                      isMinimized ? 'p-3 sm:p-4' : 'p-4 sm:p-5'
                    } ${
                      isThisProjActive
                        ? 'bg-[#120822]/90 border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.18)] ring-1 ring-amber-400/35'
                        : 'bg-[#0b0517]/75 border-purple-950/70 hover:border-purple-800/60 hover:bg-[#100720]/75 cursor-pointer shadow-lg'
                    }`}
                  >
                    {/* Staircase Card Header Bar */}
                    <div
                      className={`w-full flex items-center justify-between border-b border-purple-900/40 flex-wrap gap-2.5 ${
                        isMinimized ? 'pb-2 mb-1' : 'pb-3 mb-3'
                      }`}
                      dir="rtl"
                    >
                      {/* Right: Title, Hierarchy Badge & Active Status */}
                      <div className="flex items-center gap-3">
                        <span className={`p-2 rounded-xl border ${
                          proj.parentId
                            ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {proj.parentId ? <Layers className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                        </span>

                        {editingProjectId === proj.id ? (
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={tempProjectTitle}
                              onChange={(e) => setTempProjectTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveProjectTitle(proj.id)}
                              autoFocus
                              className="px-2.5 py-1 rounded-xl bg-neutral-900 border border-amber-500 text-sm font-bold text-white outline-none w-44 sm:w-60"
                            />
                            <button
                              onClick={() => handleSaveProjectTitle(proj.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
                            >
                              ذخیره
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/title">
                            <h2 className="text-base sm:text-lg font-black text-white group-hover/title:text-amber-300 transition">
                              {proj.title}
                            </h2>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProjectId(proj.id);
                                setEditingProjectId(proj.id);
                                setTempProjectTitle(proj.title);
                              }}
                              className="p-1 rounded-lg text-neutral-400 hover:text-amber-400 opacity-0 group-hover/title:opacity-100 hover:bg-purple-950/50 transition"
                              title="ویرایش نام پلکان"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Hierarchy Indicator (Sub vs Main) */}
                        {proj.parentId ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">
                            زیرمجموعه
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreateStaircaseModal('sub', proj.id);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-fuchsia-950/60 hover:bg-fuchsia-900/80 text-fuchsia-200 hover:text-white text-[11px] font-bold border border-fuchsia-800/50 flex items-center gap-1 transition shadow-sm"
                            title="افزودن زیرمجموعه برای این پلکان"
                          >
                            <Plus className="w-3 h-3 text-fuchsia-400" />
                            <span className="hidden sm:inline">افزودن زیرمجموعه</span>
                          </button>
                        )}

                        {/* Active Badge / Select Button */}
                        {isThisProjActive ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>پلکان فعال (منوی سمت چپ)</span>
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveProjectId(proj.id);
                              setSelectedStepId(projSteps[projSteps.length - 1].id);
                              setIsSidebarOpen(true);
                            }}
                            className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-950/50 hover:bg-purple-900/70 text-purple-300 hover:text-white border border-purple-800/40 transition"
                          >
                            کلیک برای انتخاب در منوی چپ
                          </button>
                        )}
                      </div>

                      {/* Left: Controls & Stats */}
                      <div className="flex items-center gap-2">
                        {/* Scroll controls for this staircase if steps are wide */}
                        {projTotalSteps > 4 && !isMinimized && (
                          <div className="flex items-center gap-0.5 bg-purple-950/50 p-0.5 rounded-xl border border-purple-900/50" dir="ltr">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stepScrollRefs.current[proj.id]?.scrollBy({ left: -260, behavior: 'smooth' });
                              }}
                              className="p-1 rounded-lg hover:bg-purple-900/70 text-purple-300 hover:text-amber-300 transition active:scale-95"
                              title="اسکرول به پله‌های شروع (سمت چپ)"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stepScrollRefs.current[proj.id]?.scrollBy({ left: 260, behavior: 'smooth' });
                              }}
                              className="p-1 rounded-lg hover:bg-purple-900/70 text-purple-300 hover:text-amber-300 transition active:scale-95"
                              title="اسکرول به سمت هدف (سمت راست)"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <span className="text-xs text-neutral-400 bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-900/40 font-mono">
                          {projTotalSteps} پله • {projDoneCount} از {projTodos.length} تسک
                        </span>

                        {/* Add Step Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddStepForProject(proj.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 text-purple-200 hover:text-white border border-purple-800/50 text-xs font-bold transition flex items-center gap-1"
                          title="افزودن پله به این پلکان"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          <span>افزودن پله</span>
                        </button>

                        {/* Notebook Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveProjectId(proj.id);
                            setIsNotebookDrawerOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 hover:text-amber-300 border border-purple-900/40 text-xs transition flex items-center gap-1"
                          title="دفترچه یادداشت این پلکان"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">دفترچه</span>
                        </button>

                        {/* Duplicate Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateProject(proj);
                          }}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-300 hover:bg-purple-950/40 transition"
                          title="تکثیر این پلکان"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Staircase (if > 1) */}
                        {projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              promptDeleteProject(proj);
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                            title="حذف این پلکان"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Minimize / Maximize Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMinimizeProject(proj.id);
                          }}
                          className={`px-2 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                            isMinimized
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-purple-950/40 text-neutral-300 hover:text-white border-purple-900/40 hover:bg-purple-900/60'
                          }`}
                          title={isMinimized ? 'باز کردن کامل پلکان' : 'کوچک کردن پلکان (Minimize)'}
                        >
                          {isMinimized ? (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden sm:inline">باز کردن</span>
                            </>
                          ) : (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden sm:inline">کوچک کردن</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsed / Minimized Preview Summary */}
                    {isMinimized ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProjectId(proj.id);
                          setSelectedStepId(projSteps[projSteps.length - 1].id);
                          setIsSidebarOpen(true);
                        }}
                        className="w-full flex items-center justify-between py-2 px-3 sm:px-4 rounded-2xl bg-purple-950/25 border border-purple-900/30 hover:border-amber-500/30 hover:bg-purple-950/40 transition cursor-pointer flex-wrap gap-3 mt-1"
                        dir="rtl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>هدف: {projSteps[projSteps.length - 1]?.title || 'هدف'}</span>
                          </div>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            ({projTotalSteps} پله • {projDoneCount} از {projTodos.length} تسک انجام شده)
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-1 max-w-xs">
                          <div className="w-full bg-neutral-900/80 h-2 rounded-full overflow-hidden border border-purple-900/40">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${projTodos.length > 0 ? (projDoneCount / projTodos.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-amber-300 shrink-0">
                            {projTodos.length > 0 ? Math.round((projDoneCount / projTodos.length) * 100) : 0}%
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMinimizeProject(proj.id);
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline"
                        >
                          <span>مشاهده پله‌ها</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Staircase Steps Display */
                      <div
                        ref={(el) => {
                          stepScrollRefs.current[proj.id] = el;
                        }}
                        onMouseDown={(e) => handleMouseDownDrag(e, proj.id)}
                        onMouseMove={(e) => handleMouseMoveDrag(e, proj.id)}
                        onMouseUp={() => handleMouseUpOrLeaveDrag(proj.id)}
                        onMouseLeave={() => handleMouseUpOrLeaveDrag(proj.id)}
                        className="w-full overflow-x-auto custom-scrollbar py-2 select-none cursor-grab active:cursor-grabbing"
                        dir="ltr"
                      >
                        <div
                          style={{
                            transform: `scale(${scale})`,
                            transformOrigin: projTotalSteps * stepWidth > 750 ? 'bottom left' : 'bottom center',
                            transition: 'transform 0.15s ease-out',
                          }}
                          className="pt-12 pb-6 sm:pt-14 sm:pb-8 px-6 sm:px-10 min-w-full w-max flex items-end justify-center"
                        >
                          <div className="flex items-end shadow-2xl relative shrink-0" dir="ltr">
                            {projSteps.map((step, idx) => {
                              const isLast = idx === projTotalSteps - 1;
                              const isFirst = idx === 0;
                              const isSelected = isThisProjActive && step.id === selectedStep?.id;
                              const stepDate = getStepDateInfo(step, idx, proj);

                              // Gap detection: check if there are missing calendar days between previous step and this step
                              const prevStep = idx > 0 ? projSteps[idx - 1] : null;
                              const missingDays =
                                prevStep && idx > 0
                                  ? getMissingDaysBetween(
                                      getStepDateObj(prevStep, idx - 1, proj),
                                      getStepDateObj(step, idx, proj)
                                    )
                                  : [];

                              // Linear ascend from minStepHeight to maxStepHeight
                              const height =
                                projTotalSteps <= 1
                                  ? 120
                                  : minStepHeight +
                                    (idx / Math.max(1, projTotalSteps - 1)) * (maxStepHeight - minStepHeight);

                              // Calculate intermediate height for red gap dots based on prev and current step heights
                              const prevHeight =
                                idx > 0
                                  ? minStepHeight +
                                    ((idx - 1) / Math.max(1, projTotalSteps - 1)) * (maxStepHeight - minStepHeight)
                                  : height;

                              const darkPurpleColor = step.color || '#280f45';
                              const completedTodos = step.todos.filter((t) => t.completed).length;
                              const totalTodos = step.todos.length;
                              const isStepAllDone = totalTodos > 0 && completedTodos === totalTodos;

                              return (
                                <React.Fragment key={step.id}>
                                  {/* MISSING DAYS VISUALIZATION: Red dots with date under each dot */}
                                  {missingDays.map((gapDay, gIdx) => {
                                    const fraction = (gIdx + 1) / (missingDays.length + 1);
                                    const dotPillarHeight = prevHeight + fraction * (height - prevHeight);

                                    return (
                                      <div
                                        key={`gap-${gapDay.isoStr}-${gIdx}`}
                                        className="relative flex flex-col items-center justify-end shrink-0 select-none group/gap"
                                        style={{ width: '84px', minWidth: '84px' }}
                                      >
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full mb-2 opacity-0 group-hover/gap:opacity-100 transition-opacity duration-200 pointer-events-none z-30 flex flex-col items-center">
                                          <div className="bg-rose-950/95 border border-rose-500/70 text-rose-200 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap text-center">
                                            <span>روز فاقد پله و فعالیت</span>
                                            <div className="text-white font-mono text-[9px] mt-0.5">
                                              {gapDay.dateInfo.dayEn} {gapDay.dateInfo.month} {gapDay.dateInfo.yearEn}
                                            </div>
                                          </div>
                                          <div className="w-1.5 h-1.5 bg-rose-950 border-r border-b border-rose-500/70 rotate-45 -mt-1" />
                                        </div>

                                        {/* The Red Dot Indicator on the ascending path */}
                                        <div
                                          className="w-full flex flex-col items-center justify-center relative"
                                          style={{ height: `${dotPillarHeight}px` }}
                                        >
                                          {/* Subtle dashed vertical lifeline */}
                                          <div className="absolute inset-y-0 w-px border-r border-dashed border-rose-500/30" />

                                          {/* Glowing Red Dot */}
                                          <div className="relative z-10 flex items-center justify-center">
                                            {/* Pulsing ring */}
                                            <div className="absolute w-6 h-6 rounded-full bg-rose-500/20 animate-ping opacity-60" />
                                            {/* Outer Glow */}
                                            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-700 via-rose-600 to-red-400 border-2 border-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.85)] flex items-center justify-center transition-transform group-hover/gap:scale-125">
                                              {/* Center Core */}
                                              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_#ffffff]" />
                                            </div>
                                          </div>
                                        </div>

                                        {/* DATE DIRECTLY UNDER EACH RED DOT: Vertical Stack matching staircase styling */}
                                        <div
                                          className="w-full pt-3 pb-2 flex flex-col items-center justify-start text-center shrink-0"
                                          style={{ width: '84px' }}
                                          title={`روز ثبت نشده: ${gapDay.dateInfo.yearEn}/${gapDay.dateInfo.dayEn}/${gapDay.dateInfo.month}`}
                                        >
                                          <div className="w-[74px] py-2 px-1 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-0.5 bg-[#1a0610]/95 border-rose-800/60 group-hover/gap:border-rose-500 group-hover/gap:bg-[#260a18] shadow-md">
                                            {/* 1. سال (Year) */}
                                            <span className="text-[10px] font-mono tracking-widest text-rose-300/70 leading-none">
                                              {gapDay.dateInfo.yearEn}
                                            </span>

                                            {/* 2. روز (Day) with small red indicator dot */}
                                            <div className="flex items-center justify-center gap-1 my-0.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
                                              <span className="text-base font-black leading-tight text-rose-400 group-hover/gap:text-rose-300">
                                                {gapDay.dateInfo.dayEn}
                                              </span>
                                            </div>

                                            {/* 3. ماه (Month) */}
                                            <span className="text-[11px] font-bold leading-none text-rose-300/80">
                                              {gapDay.dateInfo.month}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* THE STAIR STEP PILLAR */}
                                  <div
                                    id={`step-pillar-${step.id}`}
                                    className="relative flex flex-col items-center justify-end group shrink-0"
                                    style={{ width: `${stepWidth}px`, minWidth: `${stepWidth}px` }}
                                  >
                                {/* LABEL STRICTLY ABOVE STEP */}
                                <div className="absolute bottom-full mb-3 flex flex-col items-center z-20 pointer-events-auto">
                                  {isLast ? (
                                    /* Golden Summit: Radiant sun on top and Goal label clearly underneath - ALWAYS fully visible, NO truncation with 3 dots */
                                    editingTitleStepId === step.id ? (
                                      <div
                                        className="mb-2 text-center px-3 py-2 rounded-2xl bg-[#1c0d2b] border-2 border-amber-400 shadow-2xl flex items-center gap-1.5 z-30 pointer-events-auto"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="text"
                                          value={tempStepTitle}
                                          onChange={(e) => setTempStepTitle(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveStepTitle();
                                            } else if (e.key === 'Escape') {
                                              e.preventDefault();
                                              setEditingTitleStepId(null);
                                            }
                                          }}
                                          autoFocus
                                          className="w-48 sm:w-64 px-2.5 py-1.5 text-xs font-bold text-amber-200 bg-neutral-950 rounded-xl border border-amber-500 outline-none text-center"
                                          dir="rtl"
                                          placeholder="عنوان هدف را وارد کنید..."
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveStepTitle();
                                          }}
                                          className="p-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow-md"
                                          title="ذخیره"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          if (dragScrollState.current.hasMoved) return;
                                          e.stopPropagation();
                                          handleStartEditTitle(step, proj.id);
                                        }}
                                        className="flex flex-col items-center mb-1 cursor-pointer transition-transform hover:scale-105 select-none"
                                        title="کلیک برای ویرایش عنوان هدف"
                                      >
                                        {/* 1. Glowing Sun with Radiating Rays on top */}
                                        <div className="relative w-10 h-10 flex items-center justify-center mb-1">
                                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#e59733] to-[#ffd074] border-2 border-[#fff0c0] shadow-[0_0_20px_#f59e0b]" />
                                          <div className="absolute -top-1.5 w-0.5 h-3 bg-[#ffd074] rounded-full shadow-[0_0_4px_#f59e0b]" />
                                          <div className="absolute -top-1 -right-1 w-0.5 h-3 bg-[#ffd074] rotate-45 rounded-full origin-bottom" />
                                          <div className="absolute -top-1 -left-1 w-0.5 h-3 bg-[#ffd074] -rotate-45 rounded-full origin-bottom" />
                                          <div className="absolute -right-1.5 w-3 h-0.5 bg-[#ffd074] rounded-full shadow-[0_0_4px_#f59e0b]" />
                                          <div className="absolute -left-1.5 w-3 h-0.5 bg-[#ffd074] rounded-full shadow-[0_0_4px_#f59e0b]" />
                                        </div>

                                        {/* 2. Bold Glowing Goal Title - ALWAYS completely visible, NEVER truncated with 3 dots */}
                                        <div className="text-center px-4 py-2 rounded-2xl bg-[#1c0d2b]/95 border-2 border-amber-400/90 shadow-[0_0_22px_rgba(245,158,11,0.45)] min-w-[110px] max-w-[280px] sm:max-w-[380px]">
                                          <span
                                            className="text-xs sm:text-sm font-black text-amber-100 tracking-wide drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] text-center block leading-relaxed break-words whitespace-normal"
                                            dir="rtl"
                                          >
                                            {step.title}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  ) : (
                                    /* Standard Step Label Above Pillar */
                                    editingTitleStepId === step.id ? (
                                      <div
                                        className="mb-1 text-center px-2 py-1.5 rounded-xl bg-[#1c0d2b] border border-purple-500 shadow-2xl flex items-center gap-1.5 z-30 pointer-events-auto"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="text"
                                          value={tempStepTitle}
                                          onChange={(e) => setTempStepTitle(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveStepTitle();
                                            } else if (e.key === 'Escape') {
                                              e.preventDefault();
                                              setEditingTitleStepId(null);
                                            }
                                          }}
                                          autoFocus
                                          className="w-36 px-2 py-1 text-xs font-bold text-white bg-neutral-950 rounded-lg border border-purple-500 outline-none text-center"
                                          dir="rtl"
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSaveStepTitle();
                                          }}
                                          className="p-1 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition"
                                          title="ذخیره"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          if (dragScrollState.current.hasMoved) return;
                                          e.stopPropagation();
                                          handleStartEditTitle(step, proj.id);
                                        }}
                                        className={`px-2.5 py-1 rounded-xl text-center cursor-pointer transition-all min-w-[90px] max-w-[160px] ${
                                          isSelected
                                            ? 'bg-[#1f1035] text-amber-300 font-extrabold border border-amber-500/60 shadow-lg scale-105'
                                            : 'bg-black/75 hover:bg-[#1f1035] text-purple-200 font-bold border border-purple-900/60 hover:text-white'
                                        }`}
                                        title="برای ویرایش نام مرحله کلیک کنید"
                                      >
                                        <span className="text-[11px] leading-snug font-bold break-words whitespace-normal block" dir="rtl">
                                          {step.title}
                                        </span>
                                        {totalTodos > 0 && (
                                          <span
                                            className={`text-[9px] mt-0.5 block font-mono ${
                                              isStepAllDone ? 'text-emerald-400 font-bold' : 'text-neutral-400'
                                            }`}
                                          >
                                            {isStepAllDone ? '✓ تکمیل' : `${completedTodos}/${totalTodos}`}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>

                                {/* STEP BODY PILLAR */}
                                <div
                                  onClick={(e) => {
                                    if (dragScrollState.current.hasMoved) return;
                                    e.stopPropagation();
                                    setActiveProjectId(proj.id);
                                    setSelectedStepId(step.id);
                                    setIsSidebarOpen(true);
                                  }}
                                  className={`relative w-full cursor-pointer transition-all duration-300 ease-out border-t border-l border-r ${
                                    isLast
                                      ? 'border-[#f59e0b] shadow-[0_0_40px_rgba(245,158,11,0.55)]'
                                      : 'border-[#6b21a8]/45'
                                  } ${
                                    isSelected
                                      ? 'ring-2 ring-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.6)] z-10 brightness-125 scale-[1.01]'
                                      : 'hover:brightness-115 hover:shadow-[0_0_20px_rgba(107,33,168,0.35)] z-0'
                                  }`}
                                  style={{
                                    height: `${height}px`,
                                    backgroundColor: isLast ? undefined : darkPurpleColor,
                                    background: isLast
                                      ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 40%, #78350f 100%)'
                                      : `linear-gradient(180deg, ${darkPurpleColor} 0%, #150726 100%)`,
                                    boxShadow: isLast
                                      ? '0 0 35px rgba(245, 158, 11, 0.5), inset 0 2px 4px rgba(255,255,255,0.4)'
                                      : isSelected
                                      ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 25px rgba(168, 85, 247, 0.45)'
                                      : 'inset 0 1px 0 rgba(255,255,255,0.15)',
                                  }}
                                >
                                  {/* Inner top highlight line for 3D pillar realism */}
                                  <div className="absolute top-0 inset-x-0 h-1.5 bg-white/20" />

                                  {/* Completed tasks progress atmospheric glow inside pillar */}
                                  {totalTodos > 0 && !isLast && (
                                    <div
                                      className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-fuchsia-600/30 to-transparent pointer-events-none transition-all"
                                      style={{
                                        height: `${(completedTodos / totalTodos) * 100}%`,
                                      }}
                                    />
                                  )}
                                </div>

                                {/* DATE DIRECTLY UNDER EACH STEP: Vertical Stack (سال / روز / ماه) */}
                                <div
                                  className="w-full pt-3 pb-2 flex flex-col items-center justify-start text-center shrink-0 select-none cursor-pointer z-10"
                                  style={{ width: `${stepWidth}px` }}
                                  onClick={(e) => {
                                    if (dragScrollState.current.hasMoved) return;
                                    e.stopPropagation();
                                    setActiveProjectId(proj.id);
                                    setSelectedStepId(step.id);
                                    setIsSidebarOpen(true);
                                  }}
                                  title={`تاریخ: ${stepDate.yearEn}/${stepDate.dayEn}/${stepDate.month} (کلیک برای ویرایش تسک‌ها و تاریخ)`}
                                >
                                  {/* Date Capsule Card */}
                                  <div
                                    className={`w-[104px] py-2 px-1 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                                      isSelected
                                        ? 'bg-[#201038] border-amber-500 shadow-[0_0_22px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/60'
                                        : isLast
                                        ? 'bg-[#180d26] border-amber-500/50 hover:border-amber-400 shadow-md hover:bg-[#201133]'
                                        : 'bg-[#100720]/95 border-purple-900/60 hover:border-purple-600/70 hover:bg-[#180b30] shadow-md'
                                    }`}
                                  >
                                    {/* 1. سال (Year) */}
                                    <span className="text-[11px] font-mono tracking-widest text-neutral-400 leading-none">
                                      {stepDate.yearEn}
                                    </span>

                                    {/* 2. روز (Day) */}
                                    <span
                                      className={`text-lg font-black leading-tight my-0.5 ${
                                        isLast
                                          ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                          : isSelected
                                          ? 'text-amber-200'
                                          : 'text-white'
                                      }`}
                                    >
                                      {stepDate.dayEn}
                                    </span>

                                    {/* 3. ماه (Month) */}
                                    <span
                                      className={`text-xs font-bold leading-none ${
                                        isLast ? 'text-amber-400 font-black' : isSelected ? 'text-purple-200' : 'text-purple-300'
                                      }`}
                                    >
                                      {stepDate.month}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                  {/* Aesthetic Connector Divider between stacked staircases */}
                  {projIndex < visibleProjects.length - 1 && (
                    <div className="flex items-center justify-center gap-3 w-full py-1 opacity-70">
                      <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-600/50 to-transparent flex-1 max-w-sm" />
                      <span className="text-[11px] text-fuchsia-300 font-mono px-3 py-1 rounded-full bg-purple-950/60 border border-fuchsia-900/40 shadow-sm flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span>↓ زیرمجموعه بعدی ↓</span>
                      </span>
                      <div className="h-px bg-gradient-to-r from-fuchsia-600/50 via-purple-600/50 to-transparent flex-1 max-w-sm" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Bottom Buttons to Create Sub-Staircase or New Independent Staircase */}
            <div className="my-4 flex flex-wrap items-center justify-center gap-3 w-full max-w-3xl" dir="rtl">
              <button
                onClick={() => openCreateStaircaseModal('sub', currentRootId)}
                className="px-5 py-2.5 rounded-2xl bg-[#190e2b] hover:bg-[#281344] border-2 border-dashed border-fuchsia-500/50 hover:border-fuchsia-400 text-fuchsia-200 hover:text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(217,70,239,0.25)] hover:scale-[1.02] active:scale-95"
              >
                <Plus className="w-4 h-4 text-fuchsia-400" />
                <span>+ افزودن زیرمجموعه برای «{currentRootProject.title}»</span>
              </button>

              <button
                onClick={() => openCreateStaircaseModal('independent')}
                className="px-5 py-2.5 rounded-2xl bg-[#170e28] hover:bg-[#251540] border-2 border-dashed border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-amber-200 font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:scale-[1.02] active:scale-95"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>+ ایجاد یک پلکان اصلی جدید</span>
              </button>
            </div>

            {/* Bottom Floating Helper Info */}
            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 pb-4 pointer-events-none" dir="rtl">
              <Info className="w-3.5 h-3.5 text-purple-400" />
              <span>روی هر پله کلیک کنید تا تسک‌های آن باز شود • زیرمجموعه‌ها کاملاً مستقل از پلکان اصلی و سایر زیرمجموعه‌ها عمل می‌کنند</span>
            </div>
          </div>

          {/* Collapsible Left Side Drawer: Active Step To-do List */}
          {isSidebarOpen && (
            <div
              className="w-full md:w-[320px] lg:w-[360px] xl:w-[400px] bg-[#0e0918] border-t md:border-t-0 md:border-r border-purple-950/60 flex flex-col shrink-0 h-[45vh] md:h-full transition-all duration-300 z-20 animate-in slide-in-from-right-3"
              dir="rtl"
            >
              {selectedStep ? (
                <div className="flex-1 flex flex-col p-5 overflow-hidden">
                  {/* Active Staircase Indicator in Left Sidebar */}
                  <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-purple-950/40 to-purple-950/20 border border-amber-500/30 text-amber-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-[11px] text-neutral-400 shrink-0">پلکان فعال:</span>
                      <span className="text-xs font-black truncate max-w-[170px]">{activeProject.title}</span>
                    </div>
                    <span className="text-[10px] text-amber-300 font-mono bg-amber-500/20 px-2 py-0.5 rounded-lg shrink-0">
                      {projects.findIndex((p) => p.id === activeProject.id) + 1} از {projects.length}
                    </span>
                  </div>

                  {/* Header of Active Step */}
                  <div className="pb-4 border-b border-purple-950/60">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                          isGoalStep
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-purple-950/60 text-purple-200 border border-purple-800/50'
                        }`}
                      >
                        {isGoalStep ? <Trophy className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>
                          {isGoalStep ? 'پله هدف نهایی (طلایی)' : `پله ${selectedStepIndex + 1} از ${totalSteps}`}
                        </span>
                      </span>

                      {/* Step Controls: Palette, Delete Step & Close Sidebar */}
                      <div className="flex items-center gap-1">
                        {/* Dark Purple Palette for steps (Locked on goal step) */}
                        {!isGoalStep ? (
                          <div className="flex items-center gap-1 mr-1">
                            {STEP_COLORS.slice(0, 4).map((col) => (
                              <button
                                key={col.value}
                                onClick={() => handleChangeStepColor(col.value)}
                                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                                  selectedStep.color === col.value
                                    ? 'scale-125 ring-2 ring-amber-400'
                                    : 'hover:scale-110 opacity-75'
                                }`}
                                style={{ backgroundColor: col.value }}
                                title={col.name}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-400/90 font-medium ml-1">
                            طلایی دائمی
                          </span>
                        )}

                        {/* Delete Step Button */}
                        <button
                          onClick={() => handleRemoveStep(selectedStep.id)}
                          disabled={steps.length <= 1 || isGoalStep}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 transition disabled:opacity-30 disabled:hover:bg-transparent"
                          title={isGoalStep ? 'پله هدف قابل حذف نیست' : steps.length <= 1 ? 'حداقل یک پله باید باقی بماند' : 'حذف این پله'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Close / Hide Sidebar Button */}
                        <button
                          onClick={() => setIsSidebarOpen(false)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                          title="مخفی کردن منو"
                        >
                          <PanelLeftClose className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title of this Step (Editable) */}
                    {editingTitleStepId === selectedStep.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={tempStepTitle}
                          onChange={(e) => setTempStepTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveStepTitle()}
                          autoFocus
                          className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-900 border border-amber-500 text-sm font-bold text-white outline-none"
                        />
                        <button
                          onClick={handleSaveStepTitle}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
                        >
                          ذخیره
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartEditTitle(selectedStep)}
                        className="group flex items-center justify-between cursor-pointer p-1.5 -mx-1.5 rounded-xl hover:bg-purple-950/40 transition"
                        title="کلیک برای ویرایش نام مرحله"
                      >
                        <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition">
                          {selectedStep.title}
                        </h3>
                        <Edit2 className="w-3.5 h-3.5 text-neutral-500 group-hover:text-amber-400 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    )}

                    {/* Step Date Information with Date Picker */}
                    {(() => {
                      const currentStepDate = selectedStep
                        ? getStepDateInfo(selectedStep, selectedStepIndex, activeProject)
                        : null;

                      if (!currentStepDate || !selectedStep) return null;

                      const stepDateObj = getStepDateObj(selectedStep, selectedStepIndex, activeProject);
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      const currentIsoDate = `${stepDateObj.getFullYear()}-${pad(stepDateObj.getMonth() + 1)}-${pad(stepDateObj.getDate())}`;

                      return (
                        <div
                          className="mt-2.5 flex flex-col gap-2 p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 select-none"
                          title="تاریخ اختصاص یافته به این پله در مسیر پلکان"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-purple-200 min-w-0">
                              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-[11px] text-neutral-400 shrink-0">تاریخ این روز:</span>
                              <span className="text-xs font-black text-amber-300 truncate">
                                {currentStepDate.dayEn} {currentStepDate.month} {currentStepDate.yearEn}
                              </span>
                            </div>

                            <div
                              className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300/90 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30 shrink-0 mr-1"
                              title="ترتیب تاریخ زیر پله: سال، روز، ماه"
                            >
                              <span className="text-neutral-400">{currentStepDate.yearEn}</span>
                              <span className="text-neutral-500">/</span>
                              <span className="text-white font-bold">{currentStepDate.dayEn}</span>
                              <span className="text-neutral-500">/</span>
                              <span className="text-amber-300">{currentStepDate.month}</span>
                            </div>
                          </div>

                          {/* Quick Shamsi Date Change Input */}
                          {(() => {
                            const { jy, jm, jd } = getShamsiNumbers(stepDateObj);
                            const currentYear = jy;
                            // Available years range around current year
                            const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
                            // Maximum days in selected Shamsi month
                            const maxDaysInMonth = jm <= 6 ? 31 : jm <= 11 ? 30 : 29;
                            const dayOptions = Array.from({ length: maxDaysInMonth }, (_, i) => i + 1);

                            return (
                              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-purple-900/40" dir="rtl">
                                <label className="text-[11px] text-purple-300/80 font-medium">
                                  تغییر تاریخ شمسی پله:
                                </label>
                                <div className="grid grid-cols-3 gap-1.5" dir="rtl">
                                  {/* Day Selector */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] text-neutral-400 pr-0.5">روز</span>
                                    <select
                                      value={jd}
                                      onChange={(e) => {
                                        const newDay = parseInt(e.target.value, 10);
                                        const iso = shamsiToIsoString(jy, jm, newDay);
                                        handleUpdateStepDate(selectedStep.id, iso);
                                      }}
                                      className="w-full px-1.5 py-1 text-xs rounded-lg bg-[#140a24] border border-purple-700/60 text-amber-300 focus:outline-none focus:border-amber-400 transition cursor-pointer"
                                      title="انتخاب روز شمسی"
                                    >
                                      {dayOptions.map((d) => (
                                        <option key={d} value={d} className="bg-[#1a0c30] text-amber-200">
                                          {toPersianDigits(d)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Month Selector */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] text-neutral-400 pr-0.5">ماه</span>
                                    <select
                                      value={jm}
                                      onChange={(e) => {
                                        const newMonth = parseInt(e.target.value, 10);
                                        const maxD = newMonth <= 6 ? 31 : newMonth <= 11 ? 30 : 29;
                                        const safeDay = Math.min(jd, maxD);
                                        const iso = shamsiToIsoString(jy, newMonth, safeDay);
                                        handleUpdateStepDate(selectedStep.id, iso);
                                      }}
                                      className="w-full px-1.5 py-1 text-xs rounded-lg bg-[#140a24] border border-purple-700/60 text-amber-300 focus:outline-none focus:border-amber-400 transition cursor-pointer"
                                      title="انتخاب ماه شمسی"
                                    >
                                      {PERSIAN_MONTH_NAMES.map((name, idx) => (
                                        <option key={name} value={idx + 1} className="bg-[#1a0c30] text-amber-200">
                                          {name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Year Selector */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] text-neutral-400 pr-0.5">سال</span>
                                    <select
                                      value={jy}
                                      onChange={(e) => {
                                        const newYear = parseInt(e.target.value, 10);
                                        const iso = shamsiToIsoString(newYear, jm, jd);
                                        handleUpdateStepDate(selectedStep.id, iso);
                                      }}
                                      className="w-full px-1.5 py-1 text-xs rounded-lg bg-[#140a24] border border-purple-700/60 text-amber-300 focus:outline-none focus:border-amber-400 transition cursor-pointer"
                                      title="انتخاب سال شمسی"
                                    >
                                      {yearOptions.map((y) => (
                                        <option key={y} value={y} className="bg-[#1a0c30] text-amber-200">
                                          {toPersianDigits(y)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Progress Bar of this step */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5 font-medium">
                        <span>پیشرفت تسک‌های این پله:</span>
                        <span className="font-mono text-amber-300 font-bold">
                          {selectedStep.todos.filter((t) => t.completed).length} از {selectedStep.todos.length} (
                          {selectedStep.todos.length > 0
                            ? Math.round(
                                (selectedStep.todos.filter((t) => t.completed).length /
                                  selectedStep.todos.length) *
                                  100
                              )
                            : 0}
                          ٪)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              selectedStep.todos.length > 0
                                ? (selectedStep.todos.filter((t) => t.completed).length /
                                    selectedStep.todos.length) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Add New Todo Form */}
                  <form onSubmit={handleAddTodo} className="my-4 flex gap-2">
                    <input
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      placeholder="افزودن تسک جدید به این پله..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[#170e28] border border-purple-800/60 focus:border-amber-500/80 focus:ring-2 focus:ring-amber-500/20 text-neutral-100 text-sm outline-none placeholder-neutral-500 font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95 shrink-0"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>افزودن</span>
                    </button>
                  </form>

                  {/* Todo Checklist for this step */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {selectedStep.todos.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-purple-900/50 rounded-2xl text-neutral-500 text-xs">
                        <ListTodo className="w-8 h-8 text-neutral-600 mb-2 stroke-[1.5]" />
                        <p className="font-bold text-neutral-400">هنوز تسکی برای این پله ثبت نشده است</p>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          اولین اقدام لازم برای طی کردن این مرحله را در کادر بالا وارد کنید.
                        </p>
                      </div>
                    ) : (
                      selectedStep.todos.map((todo) => {
                        const isEditing = editingTodoId === todo.id;
                        return (
                          <div
                            key={todo.id}
                            onClick={() => {
                              if (!isEditing) handleToggleTodo(todo.id);
                            }}
                            className={`group p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                              isEditing
                                ? 'bg-[#1e1335] border-amber-500/70 ring-2 ring-amber-500/20 text-neutral-100 shadow-md cursor-default'
                                : todo.completed
                                ? 'bg-[#120a20]/60 border-purple-950/80 text-neutral-500 cursor-pointer'
                                : 'bg-[#19102c] border-purple-800/50 hover:border-amber-500/50 text-neutral-200 shadow-sm cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleTodo(todo.id);
                                  }}
                                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                    todo.completed
                                      ? 'bg-amber-500 text-slate-950 border border-amber-400'
                                      : 'border-2 border-purple-600 group-hover:border-amber-400 bg-black/40'
                                  }`}
                                >
                                  {todo.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>
                              )}

                              {isEditing ? (
                                <div
                                  className="flex items-center gap-2 flex-1 min-w-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="text"
                                    value={tempTodoText}
                                    onChange={(e) => setTempTodoText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEditTodo();
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleCancelEditTodo();
                                      }
                                    }}
                                    autoFocus
                                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#0d0718] border border-amber-500/60 text-white text-xs outline-none focus:ring-1 focus:ring-amber-400 font-medium"
                                    placeholder="متن تسک..."
                                  />
                                  <button
                                    type="button"
                                    onClick={handleSaveEditTodo}
                                    className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition shrink-0"
                                    title="ذخیره تغییرات"
                                  >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditTodo}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition shrink-0"
                                    title="انصراف"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`text-xs sm:text-sm font-medium leading-relaxed truncate ${
                                    todo.completed ? 'line-through text-neutral-500' : 'text-neutral-200'
                                  }`}
                                >
                                  {todo.text}
                                </span>
                              )}
                            </div>

                            {!isEditing && (
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditTodo(todo);
                                  }}
                                  className="p-1.5 text-neutral-400 hover:text-amber-300 rounded-lg hover:bg-purple-900/40 transition"
                                  title="ویرایش تسک"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTodo(todo.id);
                                  }}
                                  className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition"
                                  title="حذف تسک"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer of Drawer: Sync button & Overall summary */}
                  <div className="pt-4 mt-auto border-t border-purple-950/60 flex flex-col gap-2">
                    {onSyncTasksToMain && (
                      <button
                        onClick={handleSyncToMainList}
                        className="w-full py-2.5 px-4 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-cyan-300 font-bold text-xs transition flex items-center justify-center gap-2 border border-purple-800/50 active:scale-98"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>انتقال تسک‌های این پله به چک‌لیست فوکوس</span>
                      </button>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span>مجموع تسک‌های این پلکان:</span>
                      <span className="font-mono text-neutral-300">
                        {completedAllCount} از {allTodos.length} انجام شده ({overallPercent}٪)
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

        {/* Sliding Notebook Drawer Backdrop on mobile */}
        {isNotebookDrawerOpen && (
          <div
            onClick={() => setIsNotebookDrawerOpen(false)}
            className="sm:hidden absolute inset-0 bg-black/60 z-30 backdrop-blur-xs"
          />
        )}

        {/* Right Sliding Notebook Drawer (دفترچه یادداشت کشویی سمت راست) */}
        <div
          className={`absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[420px] md:w-[460px] lg:w-[490px] bg-[#0c0618] border-l border-purple-800/70 shadow-[-20px_0_50px_rgba(0,0,0,0.85)] flex flex-col transition-transform duration-300 ease-in-out ${
            isNotebookDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
          }`}
          dir="rtl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-purple-900/60 bg-[#120924] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-600/30 to-purple-600/30 border border-fuchsia-500/40 flex items-center justify-center text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.3)] shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>دفترچه یادداشت پلکان</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-700/50">
                    کشویی
                  </span>
                </h3>
                <p className="text-[11px] text-purple-300/70 truncate max-w-[200px] sm:max-w-[260px]">
                  یادداشت‌های «{activeProject.title}»
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNotebookDrawerOpen(false)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-purple-900/50 transition active:scale-95 shrink-0"
              title="بستن دفترچه یادداشت"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Insertion & Actions Bar */}
          <div className="px-4 py-2.5 border-b border-purple-900/40 bg-[#0e071c] flex items-center justify-between gap-1.5 flex-wrap shrink-0">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => handleInsertNoteHelper('[ ] ')}
                className="px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 text-purple-200 text-[11px] font-bold border border-purple-800/40 transition active:scale-95"
                title="درج چک‌باکس تسک"
              >
                + چک‌باکس
              </button>
              <button
                type="button"
                onClick={() => handleInsertNoteHelper('• ')}
                className="px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 text-purple-200 text-[11px] font-bold border border-purple-800/40 transition active:scale-95"
                title="درج بولت لیست"
              >
                + بولت
              </button>
              <button
                type="button"
                onClick={handleInsertDateTimeNote}
                className="px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 text-purple-200 text-[11px] font-bold border border-purple-800/40 transition active:scale-95"
                title="درج تاریخ و ساعت جاری"
              >
                + تاریخ امروز
              </button>
              <button
                type="button"
                onClick={() => handleInsertNoteHelper('\n────────────────────\n')}
                className="px-2 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 text-purple-200 text-[11px] font-bold border border-purple-800/40 transition active:scale-95"
                title="درج خط جداکننده"
              >
                + خط جداکننده
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyNotes}
                className="p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-900/50 transition relative"
                title="کپی کردن کل متن"
              >
                {notebookCopyNotice ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadNotes}
                className="p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-900/50 transition"
                title="دانلود متن به صورت فایل txt"
              >
                <Download className="w-4 h-4" />
              </button>
              {clearNotebookConfirm ? (
                <div className="flex items-center gap-1 bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-800/60 text-[10px]">
                  <span className="text-rose-200 font-bold">پاک شود؟</span>
                  <button
                    type="button"
                    onClick={handleClearNotes}
                    className="text-rose-400 font-black hover:underline"
                  >
                    بله
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearNotebookConfirm(false)}
                    className="text-neutral-400 hover:text-white ml-1"
                  >
                    لغو
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setClearNotebookConfirm(true)}
                  disabled={!activeProject.notes || activeProject.notes.trim().length === 0}
                  className={`p-1.5 rounded-lg transition ${
                    !activeProject.notes || activeProject.notes.trim().length === 0
                      ? 'text-neutral-600 cursor-not-allowed'
                      : 'text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40'
                  }`}
                  title="پاکسازی یادداشت"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Main Text Area */}
          <div className="flex-1 p-4 flex flex-col overflow-hidden bg-[#0c0618]">
            <textarea
              value={activeProject.notes || ''}
              onChange={(e) => handleUpdateActiveProjectNotes(e.target.value)}
              placeholder={`نکات، استراتژی‌ها، ایده‌ها و خلاصه یادداشت‌های این پلکان را بنویسید...\n\nهر کلمه‌ای که تایپ کنید بلافاصله به صورت خودکار و دائمی با این پلکان ذخیره می‌شود.`}
              className="flex-1 w-full bg-[#130b24] border border-purple-900/50 focus:border-fuchsia-500/70 rounded-2xl p-4 text-neutral-100 text-sm leading-relaxed resize-none outline-none custom-scrollbar font-sans shadow-inner placeholder:text-purple-300/30"
              dir="rtl"
            />
          </div>

          {/* Drawer Footer with Stats and Status */}
          <div className="px-4 py-2.5 border-t border-purple-900/60 bg-[#0e071c] flex items-center justify-between text-[11px] text-purple-300/70 shrink-0">
            <div className="flex items-center gap-3 font-mono">
              <span>{toPersianDigits(activeProject.notes ? activeProject.notes.trim().split(/\s+/).filter(Boolean).length : 0)} کلمه</span>
              <span>•</span>
              <span>{toPersianDigits(activeProject.notes?.length || 0)} کاراکتر</span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px]">ذخیره‌شده در این پلکان</span>
            </div>
          </div>
        </div>
      </div>
      {deleteConfirmation && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
          onClick={() => setDeleteConfirmation(null)}
          dir="rtl"
        >
          <div
            className="bg-[#140a24] border-2 border-rose-500/70 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-[0_0_50px_rgba(244,63,94,0.35)] flex flex-col gap-4 text-right transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Icon */}
            <div className="flex items-center gap-3 border-b border-purple-900/60 pb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {deleteConfirmation.title}
                </h3>
                <p className="text-xs text-rose-300/80 font-medium mt-0.5">
                  تایید عملیات حذف
                </p>
              </div>
            </div>

            {/* Body Question */}
            <div className="space-y-2 py-1">
              <p className="text-sm font-bold text-neutral-100 leading-relaxed">
                {deleteConfirmation.type === 'project'
                  ? 'می‌خوای حذف بشه این پلکان؟'
                  : deleteConfirmation.type === 'step'
                  ? 'می‌خوای حذف بشه این پله؟'
                  : 'می‌خوای حذف بشه این تسک؟'}
              </p>
              <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/50 text-xs font-semibold text-amber-300 break-words leading-relaxed">
                «{deleteConfirmation.itemName}»
              </div>
              {deleteConfirmation.warning && (
                <p className="text-xs text-rose-300/90 leading-relaxed font-medium">
                  ⚠️ {deleteConfirmation.warning}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-purple-900/60">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-neutral-300 hover:text-white text-xs font-bold border border-purple-800/50 transition active:scale-95"
              >
                انصراف (لغو)
              </button>

              <button
                type="button"
                onClick={handleExecuteConfirmedDelete}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-black shadow-[0_0_20px_rgba(244,63,94,0.4)] transition flex items-center gap-2 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Staircase Modal (پلکان مستقل یا زیرمجموعه) */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
          onClick={() => setIsCreateModalOpen(false)}
          dir="rtl"
        >
          <div
            className="bg-[#120822] border border-amber-500/50 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col gap-5 text-right relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg font-black">
                  <Plus className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">ایجاد پلکان جدید</h3>
                  <p className="text-xs text-amber-300/80">تعریف پلکان مستقل جدید یا زیرمجموعه پلکان موجود</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-purple-950/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-neutral-300">عنوان پلکان:</label>
              <input
                type="text"
                value={newStaircaseTitle}
                onChange={(e) => setNewStaircaseTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreateStaircase()}
                placeholder={
                  newStaircaseType === 'sub'
                    ? 'مثال: بخش فرانت‌اند یا فاز اول پروژه...'
                    : 'مثال: اهداف سالانه، یادگیری زبان، تناسب اندام...'
                }
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#080410] border border-purple-800/80 focus:border-amber-400 text-sm font-bold text-white outline-none placeholder:text-neutral-600 transition"
              />
            </div>

            {/* Input Goal Title (First Step - Golden Summit) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>عنوان هدف در پله اول (قله طلایی):</span>
              </label>
              <input
                type="text"
                value={newStaircaseGoal}
                onChange={(e) => setNewStaircaseGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmCreateStaircase()}
                placeholder="هدف نهایی (مثال: استخدام، قبولی، پایان پروژه...)"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#080410] border border-amber-500/40 focus:border-amber-400 text-sm font-bold text-amber-200 outline-none placeholder:text-amber-700/60 transition"
              />
              <span className="text-[10px] text-neutral-400">
                ✨ پلکان با ۱ پله (پله هدف طلایی) ساخته می‌شود و پس از ایجاد می‌توانید پله‌های قبلی را به آن اضافه کنید.
              </span>
            </div>

            {/* Type Selection (Independent vs Sub-Staircase) */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-neutral-300">نوع و ساختار پلکان:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Independent Root Staircase */}
                <div
                  onClick={() => setNewStaircaseType('independent')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                    newStaircaseType === 'independent'
                      ? 'bg-amber-500/15 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.2)] text-white ring-1 ring-amber-400/50'
                      : 'bg-[#180d2e]/60 border-purple-900/50 hover:border-purple-700/60 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Trophy className="w-4 h-4" />
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        newStaircaseType === 'independent' ? 'border-amber-400 bg-amber-500' : 'border-neutral-600'
                      }`}
                    >
                      {newStaircaseType === 'independent' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">پلکان اصلی و مستقل</p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mt-1">
                      یک پلکان مجزا که در فهرست پلکان‌ها به تنهایی مدیریت می‌شود.
                    </p>
                  </div>
                </div>

                {/* Option 2: Sub-Staircase of an existing project */}
                <div
                  onClick={() => setNewStaircaseType('sub')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                    newStaircaseType === 'sub'
                      ? 'bg-fuchsia-500/15 border-fuchsia-500/80 shadow-[0_0_20px_rgba(217,70,239,0.2)] text-white ring-1 ring-fuchsia-400/50'
                      : 'bg-[#180d2e]/60 border-purple-900/50 hover:border-purple-700/60 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                      <Layers className="w-4 h-4" />
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        newStaircaseType === 'sub' ? 'border-fuchsia-400 bg-fuchsia-500' : 'border-neutral-600'
                      }`}
                    >
                      {newStaircaseType === 'sub' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">زیرمجموعه یک پلکان</p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed mt-1">
                      در صفحه اصلی زیر پلکان انتخابی قرار می‌گیرد و مستقل پیش می‌رود.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Parent Selector when Sub-Staircase is active */}
            {newStaircaseType === 'sub' && (
              <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 bg-[#1a0f33]/70 p-3 rounded-2xl border border-fuchsia-900/60">
                <label className="text-xs font-bold text-fuchsia-200">پلکان والد را انتخاب کنید:</label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0517] border border-fuchsia-700/60 text-xs font-bold text-white outline-none"
                >
                  {projects
                    .filter((p) => !p.parentId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.steps.length} پله)
                      </option>
                    ))}
                  {/* If no root exists, fallback */}
                  {projects.every((p) => p.parentId) &&
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-purple-900/60">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-neutral-300 hover:text-white text-xs font-bold border border-purple-800/50 transition active:scale-95"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={handleConfirmCreateStaircase}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.4)] transition flex items-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>ایجاد و شروع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning / Informational Modal Overlay */}
      {warningNotice && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
          onClick={() => setWarningNotice(null)}
          dir="rtl"
        >
          <div
            className="bg-[#140a24] border border-amber-500/60 rounded-3xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(245,158,11,0.3)] flex flex-col gap-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400 border-b border-purple-900/60 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">توجه</h3>
                <p className="text-[11px] text-amber-300/80">عدم امکان حذف</p>
              </div>
            </div>
            <p className="text-xs font-medium text-neutral-200 leading-relaxed">
              {warningNotice}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setWarningNotice(null)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black transition active:scale-95"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recycle Bin / Trash Modal (سطل آشغال پلکان‌ها و پله‌های حذف‌شده) */}
      {isTrashModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 pointer-events-auto"
          onClick={() => {
            setIsTrashModalOpen(false);
            setTrashConfirmDeleteId(null);
            setIsClearTrashConfirmOpen(false);
            setPreviewNotesItem(null);
          }}
          dir="rtl"
        >
          <div
            className="bg-[#120822] border-2 border-rose-500/40 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-[0_0_60px_rgba(244,63,94,0.25)] flex flex-col gap-4 text-right max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.3)] shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">سطل آشغال پلکان و پله‌ها</h3>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold font-mono">
                      {toPersianDigits(trashItems.length)} مورد
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    پلکان‌ها و پله‌های حذف‌شده به همراه دفترچه یادداشت در اینجا نگهداری می‌شوند.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {trashItems.length > 0 && !isClearTrashConfirmOpen && (
                  <button
                    onClick={() => setIsClearTrashConfirmOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 hover:text-rose-100 text-xs font-bold border border-rose-800/50 transition flex items-center gap-1"
                    title="خالی کردن تمام موارد سطل آشغال"
                  >
                    <Trash className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">خالی کردن سطل</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsTrashModalOpen(false);
                    setTrashConfirmDeleteId(null);
                    setIsClearTrashConfirmOpen(false);
                    setPreviewNotesItem(null);
                  }}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-purple-950/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Clear All Confirmation Banner */}
            {isClearTrashConfirmOpen && (
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-600/70 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 shrink-0">
                <div className="flex items-center gap-2 text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>آیا مطمئنید می‌خواهید سطل آشغال را به طور کامل خالی کنید؟ این عمل غیرقابل بازگشت است.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleEmptyTrash}
                    className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-sm"
                  >
                    بله، خالی کن
                  </button>
                  <button
                    onClick={() => setIsClearTrashConfirmOpen(false)}
                    className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            {trashItems.length > 0 && (
              <div className="flex items-center gap-2 border-b border-purple-900/40 pb-2.5 shrink-0">
                <button
                  onClick={() => setTrashFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    trashFilter === 'all'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-purple-950/40 text-neutral-400 hover:text-neutral-200 border border-purple-900/30'
                  }`}
                >
                  همه موارد ({toPersianDigits(trashItems.length)})
                </button>
                <button
                  onClick={() => setTrashFilter('project')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    trashFilter === 'project'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-purple-950/40 text-neutral-400 hover:text-neutral-200 border border-purple-900/30'
                  }`}
                >
                  پلکان‌ها ({toPersianDigits(trashItems.filter((i) => i.type === 'project').length)})
                </button>
                <button
                  onClick={() => setTrashFilter('step')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    trashFilter === 'step'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-purple-950/40 text-neutral-400 hover:text-neutral-200 border border-purple-900/30'
                  }`}
                >
                  پله‌ها ({toPersianDigits(trashItems.filter((i) => i.type === 'step').length)})
                </button>
              </div>
            )}

            {/* Trash Items List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {trashItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-neutral-400 gap-3">
                  <div className="w-16 h-16 rounded-3xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-neutral-500">
                    <Trash2 className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-200">سطل آشغال خالی است</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      هیچ پلکان یا پله‌ای در سطل آشغال وجود ندارد.
                    </p>
                  </div>
                </div>
              ) : (
                trashItems
                  .filter((item) => trashFilter === 'all' || item.type === trashFilter)
                  .map((item) => {
                    const isProject = item.type === 'project';
                    const isConfirmingDelete = trashConfirmDeleteId === item.id;

                    if (isProject) {
                      const proj = (item as DeletedStaircaseItem).project;
                      const projTodos = proj.steps?.flatMap((s) => s.todos) || [];
                      const hasNotes = Boolean(proj.notes && proj.notes.trim().length > 0);

                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-[#170b2c]/80 border border-purple-800/50 hover:border-purple-700 transition flex flex-col gap-3 shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                                <Trophy className="w-4 h-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-black text-white">{proj.title}</h4>
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                    پلکان {proj.parentId ? '(زیرمجموعه)' : '(اصلی)'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1 flex-wrap">
                                  <span>{toPersianDigits(proj.steps?.length || 0)} پله</span>
                                  <span>•</span>
                                  <span>{toPersianDigits(projTodos.length)} تسک</span>
                                  {hasNotes && (
                                    <>
                                      <span>•</span>
                                      <span className="text-pink-300 font-medium flex items-center gap-1">
                                        <BookOpen className="w-3 h-3 text-pink-400" />
                                        دفترچه یادداشت دارد ({toPersianDigits(proj.notes!.length)} کاراکتر)
                                      </span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span className="text-neutral-500">
                                    حذف در: {formatShamsiDate(new Date(item.deletedAt), { showWeekday: false, showYear: true })} - ساعت{' '}
                                    {formatHHMM(item.deletedAt, true)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Restore & Delete Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasNotes && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewNotesItem(item as DeletedStaircaseItem)}
                                  className="px-2.5 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900 text-pink-300 hover:text-white border border-pink-500/30 text-xs font-bold transition flex items-center gap-1"
                                  title="مشاهده متن یادداشت این پلکان"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-pink-400" />
                                  <span className="hidden sm:inline">یادداشت‌ها</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRestoreProject(item as DeletedStaircaseItem)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-100 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                                title="بازیابی پلکان به همراه تمام پله‌ها، تسک‌ها و دفترچه یادداشت"
                              >
                                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>بازیابی (Restore)</span>
                              </button>

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1 animate-in fade-in">
                                  <button
                                    type="button"
                                    onClick={() => handlePermanentDelete(item.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
                                  >
                                    تایید حذف دائم
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTrashConfirmDeleteId(null)}
                                    className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setTrashConfirmDeleteId(item.id)}
                                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                  title="حذف دائمی از سطل آشغال"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Deleted Step Item
                      const stepItem = item as DeletedStepItem;
                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-[#140a26]/80 border border-purple-900/50 hover:border-purple-800 transition flex flex-col gap-2 shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0 mt-0.5">
                                <TrendingUp className="w-4 h-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-black text-white">{stepItem.step.title}</h4>
                                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                                    پله
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1 flex-wrap">
                                  <span className="text-amber-300/90 font-medium">
                                    پلکان مبدا: «{stepItem.projectTitle}»
                                  </span>
                                  <span>•</span>
                                  <span>{toPersianDigits(stepItem.step.todos?.length || 0)} تسک همراه</span>
                                  <span>•</span>
                                  <span className="text-neutral-500">
                                    حذف در: {formatShamsiDate(new Date(item.deletedAt), { showWeekday: false, showYear: true })} - ساعت{' '}
                                    {formatHHMM(item.deletedAt, true)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Restore & Delete Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRestoreStep(stepItem)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-100 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                                title="بازیابی این پله به همراه تسک‌های آن"
                              >
                                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>بازیابی (Restore)</span>
                              </button>

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1 animate-in fade-in">
                                  <button
                                    type="button"
                                    onClick={() => handlePermanentDelete(item.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
                                  >
                                    تایید حذف دائم
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTrashConfirmDeleteId(null)}
                                    className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setTrashConfirmDeleteId(item.id)}
                                  className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                  title="حذف دائمی از سطل آشغال"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-purple-900/60 pt-3 shrink-0">
              <span className="text-xs text-neutral-400">
                💡 موارد بازیابی‌شده بلافاصله در پلکان فعال در دسترس خواهند بود.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsTrashModalOpen(false);
                  setTrashConfirmDeleteId(null);
                  setIsClearTrashConfirmOpen(false);
                  setPreviewNotesItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-neutral-200 text-xs font-bold border border-purple-800/50 transition"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Notes Modal for a Deleted Project */}
      {previewNotesItem && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto"
          onClick={() => setPreviewNotesItem(null)}
          dir="rtl"
        >
          <div
            className="bg-[#120924] border border-pink-500/50 rounded-3xl p-6 max-w-lg w-full shadow-[0_0_50px_rgba(217,70,239,0.3)] flex flex-col gap-4 text-right max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-purple-900/60 pb-3">
              <div className="flex items-center gap-2 text-pink-300 font-bold text-sm">
                <BookOpen className="w-4 h-4" />
                <span>دفترچه یادداشت پلکان: «{previewNotesItem.project.title}»</span>
              </div>
              <button
                onClick={() => setPreviewNotesItem(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#0a0414] p-4 rounded-2xl border border-purple-950 text-xs text-neutral-200 font-sans leading-relaxed whitespace-pre-wrap select-text">
              {previewNotesItem.project.notes || 'هیچ متنی در دفترچه یادداشت وجود ندارد.'}
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={() => setPreviewNotesItem(null)}
                className="px-4 py-1.5 rounded-xl bg-purple-950 text-neutral-200 hover:text-white text-xs font-bold transition border border-purple-800/50"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
