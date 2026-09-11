import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Check,
  Edit2,
  Trophy,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ListTodo,
  Layers,
  Info,
  LayoutGrid,
  Copy,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Lock,
  Clock,
  BookOpen,
  Download,
} from 'lucide-react';
import { StairStep, StaircaseTodo, StaircaseProject } from '../types';
import {
  loadStaircaseProjects,
  saveStaircaseProjects,
  fetchServerData,
  STAIRCASE_PROJECTS_KEY,
} from '../utils/storage';
import { formatShamsiDate, formatHHMM, toPersianDigits } from '../utils/time';

interface StaircaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncTasksToMain?: (tasks: string[]) => void;
}

// Default 5-step template with requested Dark Purple (بنفش دارک) for non-final steps and Golden Summit for the goal
const createDefaultSteps = (): StairStep[] => [
  {
    id: `step-${Date.now()}-1`,
    title: 'شروع و برنامه‌ریزی اولیه',
    color: '#220d3a', // Dark purple
    createdAt: Date.now() - 3600000 * 24 * 3,
    todos: [
      { id: `t1-${Date.now()}-1`, text: 'تعیین اهداف کلیدی و پیش‌نیازها', completed: true, createdAt: Date.now() - 3600000 },
      { id: `t1-${Date.now()}-2`, text: 'آماده‌سازی محیط و ابزارهای کار', completed: true, createdAt: Date.now() - 1800000 },
    ],
  },
  {
    id: `step-${Date.now()}-2`,
    title: 'فاز مقدماتی و آماده‌سازی',
    color: '#280f45', // Dark purple
    createdAt: Date.now() - 3600000 * 24 * 2,
    todos: [
      { id: `t2-${Date.now()}-1`, text: 'انجام بخش اول تسک‌های پایه‌ای', completed: true, createdAt: Date.now() - 900000 },
      { id: `t2-${Date.now()}-2`, text: 'بررسی کیفیت و رفع موانع اولیه', completed: false, createdAt: Date.now() },
    ],
  },
  {
    id: `step-${Date.now()}-3`,
    title: 'توسعه عمیق و تمرکز بالا',
    color: '#2e1250', // Dark purple
    createdAt: Date.now() - 3600000 * 24,
    todos: [
      { id: `t3-${Date.now()}-1`, text: 'اجرای هسته اصلی پروژه و قابلیت‌ها', completed: false, createdAt: Date.now() },
      { id: `t3-${Date.now()}-2`, text: 'تمرین و مرور تسک‌های میانی', completed: false, createdAt: Date.now() },
    ],
  },
  {
    id: `step-${Date.now()}-4`,
    title: 'تست، بهینه‌سازی و پالایش',
    color: '#36155c', // Dark purple
    createdAt: Date.now() - 3600000 * 4,
    todos: [
      { id: `t4-${Date.now()}-1`, text: 'بررسی نهایی، تست و رفع ایرادات', completed: false, createdAt: Date.now() },
      { id: `t4-${Date.now()}-2`, text: 'آماده‌سازی برای فاز تحویل نهایی', completed: false, createdAt: Date.now() },
    ],
  },
  {
    id: `step-${Date.now()}-5`,
    title: 'هدف نهایی و پیروزی',
    color: '#78350f', // EXACT Golden summit preserved
    createdAt: Date.now(),
    todos: [
      { id: `t5-${Date.now()}-1`, text: 'دستیابی کامل به نتیجه مطلوب و جشن موفقیت', completed: false, createdAt: Date.now() },
    ],
  },
];

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
        todos: [{ id: 't2-1', text: 'مشاهده دوره‌های مقدماتی', completed: true, createdAt: Date.now() }],
      },
      {
        id: 's2-2',
        title: 'تمرین و پروژه‌های کوچک',
        color: '#2b104b',
        todos: [{ id: 't2-2', text: 'پیاده‌سازی نمونه‌های کاربردی', completed: false, createdAt: Date.now() }],
      },
      {
        id: 's2-3',
        title: 'هدف: تسلط کامل و خلق اثر',
        color: '#78350f', // Golden summit
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
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [tempProjectTitle, setTempProjectTitle] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  // Deletion Confirmation Modal State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'project' | 'step' | 'todo';
    id: string;
    title: string;
    itemName: string;
    warning?: string;
  } | null>(null);

  // Sliding Notebook Drawer State (دفترچه یادداشت کشویی سمت راست)
  const [isNotebookDrawerOpen, setIsNotebookDrawerOpen] = useState(false);
  const [notebookCopyNotice, setNotebookCopyNotice] = useState(false);
  const [clearNotebookConfirm, setClearNotebookConfirm] = useState(false);

  // Alert / Warning Notice State (e.g. for minimum step or minimum project limits)
  const [warningNotice, setWarningNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-save projects to storage (both localStorage and server file) whenever updated
  useEffect(() => {
    saveStaircaseProjects(projects);
  }, [projects]);

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

  // Horizontal scroll helpers
  const handleScrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Project Management (Multiple Staircases)
  const handleCreateNewProject = () => {
    const newProjectId = `staircase-${Date.now()}`;
    const newProjectNum = projects.length + 1;
    const newProject: StaircaseProject = {
      id: newProjectId,
      title: `پلکان هدف ${newProjectNum}`,
      createdAt: Date.now(),
      steps: createDefaultSteps(),
      notes: '',
    };

    const updated = [newProject, ...projects];
    setProjects(updated);
    setActiveProjectId(newProjectId);
    setViewMode('staircase');
    setSelectedStepId(newProject.steps[newProject.steps.length - 1].id);
    setIsProjectDropdownOpen(false);
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
    if (steps.length <= 2) {
      setWarningNotice('حداقل ۲ پله (پله شروع و پله هدف) باید در پلکان باقی بماند.');
      return;
    }

    const targetId = stepIdToRemove || selectedStepId || steps[steps.length - 2]?.id;
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

  // Execute Confirmed Delete Action
  const handleExecuteConfirmedDelete = () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === 'project') {
      const projectIdToDelete = deleteConfirmation.id;
      const updated = projects.filter((p) => p.id !== projectIdToDelete);
      setProjects(updated);
      if (activeProjectId === projectIdToDelete) {
        setActiveProjectId(updated[0].id);
      }
      setIsProjectDropdownOpen(false);
    } else if (deleteConfirmation.type === 'step') {
      const targetId = deleteConfirmation.id;
      const targetIdx = steps.findIndex((s) => s.id === targetId);
      const updated = steps.filter((s) => s.id !== targetId);
      updateActiveSteps(updated);

      const nextSelectIdx = Math.max(0, Math.min(targetIdx, updated.length - 1));
      setSelectedStepId(updated[nextSelectIdx]?.id || updated[0]?.id);
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

    setProjects([duplicated, ...projects]);
    setActiveProjectId(dupId);
    setViewMode('staircase');
  };

  const handleSaveProjectTitle = () => {
    const clean = tempProjectTitle.trim() || 'پلکان بدون عنوان';
    const updated = projects.map((p) => (p.id === activeProjectId ? { ...p, title: clean } : p));
    setProjects(updated);
    setIsEditingProjectTitle(false);
  };

  // Update steps within active project
  const updateActiveSteps = (newSteps: StairStep[]) => {
    const updated = projects.map((p) => {
      if (p.id === activeProjectId) {
        return { ...p, steps: newSteps };
      }
      return p;
    });
    setProjects(updated);
  };

  // Add Step (Default color is dark purple; inserts right before the golden summit)
  const handleAddStep = () => {
    const newStepId = `step-${Date.now()}`;
    const newStepNum = totalSteps;
    const now = Date.now();

    const newStep: StairStep = {
      id: newStepId,
      title: `مرحله ${newStepNum}: گام جدید`,
      color: '#280f45', // Dark purple
      createdAt: now,
      todos: [
        {
          id: `todo-${now}`,
          text: 'اقدام اولیه این مرحله را وارد کنید',
          completed: false,
          createdAt: now,
        },
      ],
    };

    // Insert before the last (goal) step so the summit always stays the Golden Goal
    const updated = [...steps];
    updated.splice(totalSteps - 1, 0, newStep);
    updateActiveSteps(updated);
    setSelectedStepId(newStepId);
    setIsSidebarOpen(true);
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

  const handleChangeStepColor = (color: string) => {
    if (!selectedStep || isGoalStep) return; // Last step remains permanently golden
    const updated = steps.map((s) => (s.id === selectedStep.id ? { ...s, color } : s));
    updateActiveSteps(updated);
  };

  const handleStartEditTitle = (step: StairStep) => {
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

  // Dimensions & Calculations
  const minStepHeight = 90;
  const maxStepHeight = 460;
  const stepWidth = 145;

  const allTodos = steps.flatMap((s) => s.todos);
  const completedAllCount = allTodos.filter((t) => t.completed).length;
  const overallPercent = allTodos.length > 0 ? Math.round((completedAllCount / allTodos.length) * 100) : 0;

  return (
    /* Full screen container edge-to-edge (100vw × 100vh) */
    <div
      className="fixed inset-0 z-50 w-screen h-screen bg-[#07050d] flex flex-col overflow-hidden text-neutral-100 transition-all animate-in fade-in duration-150"
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
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
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

              {/* Dropdown Menu for fast switching between staircases */}
              {isProjectDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-[#150d24] border border-purple-800/70 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-purple-900/50 text-xs font-bold text-neutral-400">
                    <span>انتخاب پلکان:</span>
                    <button
                      onClick={handleCreateNewProject}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>پلکان جدید</span>
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 py-1.5 custom-scrollbar">
                    {projects.map((proj) => {
                      const isSelected = proj.id === activeProjectId;
                      const projTodos = proj.steps.flatMap((s) => s.todos);
                      const doneCount = projTodos.filter((t) => t.completed).length;

                      return (
                        <div
                          key={proj.id}
                          onClick={() => {
                            setActiveProjectId(proj.id);
                            setIsProjectDropdownOpen(false);
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'hover:bg-purple-950/60 text-neutral-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate">{proj.title}</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {proj.steps.length} پله • {doneCount} از {projTodos.length} تسک
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                            <button
                              type="button"
                              onClick={() => promptDeleteProject(proj)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                              title="حذف این پلکان"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-purple-900/50">
                    <button
                      onClick={() => {
                        setViewMode('gallery');
                        setIsProjectDropdownOpen(false);
                      }}
                      className="w-full py-1.5 text-center text-xs text-neutral-400 hover:text-amber-300 transition"
                    >
                      مشاهده کارت‌های کامل همه پلکان‌ها
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* End / Right: Action Tools & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* Create New Staircase Button */}
          <button
            onClick={handleCreateNewProject}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-95"
            title="ایجاد پلکان جدید جداگانه"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>پلکان جدید</span>
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
                  disabled={steps.length <= 2}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                    steps.length <= 2
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
                        const h = 25 + (idx / Math.max(1, projSteps.length - 1)) * 65;
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Staircase Canvas Container */}
          <div
            ref={containerRef}
            className="flex-1 relative bg-[#07050d] overflow-x-auto overflow-y-auto custom-scrollbar select-none flex flex-col justify-end"
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
                className="absolute top-4 left-4 z-30 px-3.5 py-2 rounded-2xl bg-[#150d24]/95 hover:bg-[#201438] border border-amber-500/60 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-[0_4px_25px_rgba(0,0,0,0.6)] transition backdrop-blur-md active:scale-95"
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
            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 bg-[#150d24]/90 border border-purple-900/50 rounded-2xl p-1 shadow-2xl backdrop-blur-md">
              <button
                onClick={handleScrollLeft}
                className="p-2 rounded-xl hover:bg-purple-900/50 text-neutral-300 hover:text-white transition active:scale-95"
                title="اسکرول به چپ"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono text-purple-300 px-1">اسکرول افقی</span>
              <button
                onClick={handleScrollRight}
                className="p-2 rounded-xl hover:bg-purple-900/50 text-neutral-300 hover:text-white transition active:scale-95"
                title="اسکرول به راست"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Central Staircase Wrapper - Using min-w-full w-max with generous padding to ensure 100% full visibility without clipping */}
            <div className="min-w-full w-max min-h-full flex flex-col justify-end items-center px-28 sm:px-36 py-14 m-auto">
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'bottom center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="py-12"
              >
                {/* Ascending Steps Flex Container */}
                <div className="flex items-end shadow-2xl relative" dir="ltr">
                  {steps.map((step, idx) => {
                    const isLast = idx === totalSteps - 1;
                    const isFirst = idx === 0;
                    const isSelected = step.id === selectedStep?.id;

                    // Linear ascend from minStepHeight to maxStepHeight
                    const height =
                      minStepHeight +
                      (idx / Math.max(1, totalSteps - 1)) * (maxStepHeight - minStepHeight);

                    // STRICT RULE: Last step is ALWAYS Golden!
                    // All other steps are DARK PURPLE (بنفش دارک)
                    const darkPurpleColor = step.color || '#280f45';

                    const completedTodos = step.todos.filter((t) => t.completed).length;
                    const totalTodos = step.todos.length;
                    const isStepAllDone = totalTodos > 0 && completedTodos === totalTodos;

                    return (
                      <div
                        key={step.id}
                        className="relative flex flex-col items-center justify-end group"
                        style={{ width: `${stepWidth}px` }}
                      >
                        {/* LABEL STRICTLY ABOVE STEP (No text inside body as requested) */}
                        <div className="absolute bottom-full mb-3 flex flex-col items-center z-20 pointer-events-auto">
                          {isLast ? (
                            /* Golden Summit: Radiant sun and Goal label */
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditTitle(step);
                              }}
                              className="flex flex-col items-center mb-1 cursor-pointer transition-transform hover:scale-105"
                              title="کلیک برای ویرایش عنوان هدف"
                            >
                              {/* Bold Glowing "هدف" Title */}
                              <span className="text-sm sm:text-base font-black text-amber-100 tracking-wider drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] mb-1 text-center max-w-[130px] truncate">
                                {step.title === 'هدف نهایی و پیروزی' || step.title === 'هدف'
                                  ? 'هدف'
                                  : step.title}
                              </span>

                              {/* Glowing Sun with Radiating Rays */}
                              <div className="relative w-10 h-10 flex items-center justify-center my-0.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#e59733] to-[#ffd074] border-2 border-[#fff0c0] shadow-[0_0_20px_#f59e0b]" />
                                <div className="absolute -top-1.5 w-0.5 h-3 bg-[#ffd074] rounded-full shadow-[0_0_4px_#f59e0b]" />
                                <div className="absolute -top-1 -right-1 w-0.5 h-3 bg-[#ffd074] rotate-45 rounded-full origin-bottom" />
                                <div className="absolute -top-1 -left-1 w-0.5 h-3 bg-[#ffd074] -rotate-45 rounded-full origin-bottom" />
                                <div className="absolute -right-1.5 w-3 h-0.5 bg-[#ffd074] rounded-full shadow-[0_0_4px_#f59e0b]" />
                                <div className="absolute -left-1.5 w-3 h-0.5 bg-[#ffd074] rounded-full shadow-[0_0_4px_#f59e0b]" />
                              </div>
                            </div>
                          ) : (
                            /* Standard Step Label Above Pillar */
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditTitle(step);
                              }}
                              className={`px-2.5 py-1 rounded-xl text-center cursor-pointer transition-all max-w-[135px] ${
                                isSelected
                                  ? 'bg-[#1f1035] text-amber-300 font-extrabold border border-amber-500/60 shadow-lg scale-105'
                                  : 'bg-black/75 hover:bg-[#1f1035] text-purple-200 font-bold border border-purple-900/60 hover:text-white'
                              }`}
                              title="برای ویرایش نام مرحله کلیک کنید"
                            >
                              <span className="text-[11px] leading-tight line-clamp-2 block" dir="rtl">
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
                          )}
                        </div>

                        {/* STEP BODY PILLAR (NO TEXT on body; completely polished) */}
                        <div
                          onClick={() => {
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

                        {/* "شروع" label beneath the first step */}
                        {isFirst && (
                          <div className="absolute top-full mt-3 text-center pointer-events-none">
                            <span className="text-xs font-bold text-neutral-400 tracking-wider">
                              شروع
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Floating Helper Info */}
            <div className="absolute bottom-3 right-6 text-[11px] text-neutral-400 flex items-center gap-1.5 pointer-events-none" dir="rtl">
              <Info className="w-3.5 h-3.5 text-purple-400" />
              <span>روی هر پله کلیک کنید تا تسک‌های آن باز شود • پله‌ها بنفش دارک و قله طلایی درخشان است</span>
            </div>
          </div>

          {/* Collapsible Left Side Drawer: Active Step To-do List */}
          {isSidebarOpen && (
            <div
              className="w-full lg:w-[380px] xl:w-[420px] bg-[#0e0918] border-t lg:border-t-0 lg:border-r border-purple-950/60 flex flex-col shrink-0 h-full transition-all duration-300 z-20 animate-in slide-in-from-right-3"
              dir="rtl"
            >
              {selectedStep ? (
                <div className="flex-1 flex flex-col p-5 overflow-hidden">
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
                          disabled={steps.length <= 2}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 transition disabled:opacity-30 disabled:hover:bg-transparent"
                          title="حذف این پله"
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

                    {/* Step Creation Date Badge - Strictly Read-only & Permanent */}
                    {(() => {
                      const stepTimestamp =
                        selectedStep.createdAt ||
                        selectedStep.todos[0]?.createdAt ||
                        activeProject.createdAt ||
                        Date.now();
                      const shamsiDateStr = formatShamsiDate(new Date(stepTimestamp), {
                        showWeekday: true,
                        showYear: true,
                      });
                      const timeStr = formatHHMM(stepTimestamp, true);

                      return (
                        <div
                          className="mt-2.5 flex items-center justify-between px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-800/40 select-none"
                          title="تاریخ ثبت این پله (ثابت و به هیچ عنوان قابل تغییر نیست)"
                        >
                          <div className="flex items-center gap-2 text-purple-200 min-w-0">
                            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-[11px] text-neutral-400 shrink-0">تاریخ ثبت پله:</span>
                            <span className="text-xs font-black text-amber-300 truncate">
                              {shamsiDateStr}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">
                              ({timeStr})
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-1 text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 shrink-0 mr-1"
                            title="این تاریخ به صورت سیستمی ثبت شده و به هیچ عنوان قابل تغییر نیست"
                          >
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            <span>غیرقابل تغییر</span>
                          </div>
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
                      selectedStep.todos.map((todo) => (
                        <div
                          key={todo.id}
                          onClick={() => handleToggleTodo(todo.id)}
                          className={`group p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                            todo.completed
                              ? 'bg-[#120a20]/60 border-purple-950/80 text-neutral-500'
                              : 'bg-[#19102c] border-purple-800/50 hover:border-amber-500/50 text-neutral-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
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

                            <span
                              className={`text-xs sm:text-sm font-medium leading-relaxed truncate ${
                                todo.completed ? 'line-through text-neutral-500' : 'text-neutral-200'
                              }`}
                            >
                              {todo.text}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTodo(todo.id);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800 opacity-0 group-hover:opacity-100 transition shrink-0"
                            title="حذف تسک"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
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
    </div>
  );
};
