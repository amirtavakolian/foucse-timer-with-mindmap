import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  BookOpen,
  Plus,
  Search,
  Pin,
  Trash2,
  Copy,
  Check,
  Download,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  FileText,
  Palette,
  ArrowRight,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { NoteItem } from '../types';
import { loadNotes, saveNotes, fetchServerData, NOTES_KEY } from '../utils/storage';
import { formatShamsiDate, formatHHMM, toPersianDigits } from '../utils/time';

interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOTE_COLORS = [
  { id: 'violet', label: 'بنفش', bg: '#8b5cf6', ring: 'border-violet-500', pill: 'bg-violet-950/80 text-violet-200 border-violet-700/60' },
  { id: 'pink', label: 'سرخابی', bg: '#ec4899', ring: 'border-pink-500', pill: 'bg-pink-950/80 text-pink-200 border-pink-700/60' },
  { id: 'cyan', label: 'فیروزه‌ای', bg: '#06b6d4', ring: 'border-cyan-500', pill: 'bg-cyan-950/80 text-cyan-200 border-cyan-700/60' },
  { id: 'emerald', label: 'زمردی', bg: '#10b981', ring: 'border-emerald-500', pill: 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60' },
  { id: 'amber', label: 'کهربایی', bg: '#f59e0b', ring: 'border-amber-500', pill: 'bg-amber-950/80 text-amber-200 border-amber-700/60' },
  { id: 'slate', label: 'دودی', bg: '#64748b', ring: 'border-slate-500', pill: 'bg-slate-900/80 text-slate-200 border-slate-700/60' },
];

export const NotebookModal: React.FC<NotebookModalProps> = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState<NoteItem[]>(() => loadNotes());
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    const initial = loadNotes();
    return initial[0]?.id || null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-sync with storage on changes
  useEffect(() => {
    if (notes.length > 0) {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNotes(notes);
        setSaveStatus('saved');
      }, 300);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [notes]);

  // Dual-layer recovery: if local notes are empty or default, check server backup
  useEffect(() => {
    let isMounted = true;
    async function restoreFromServer() {
      try {
        const local = loadNotes();
        if (!local || local.length === 0) {
          const serverNotes = await fetchServerData<NoteItem[]>(NOTES_KEY);
          if (serverNotes && Array.isArray(serverNotes) && serverNotes.length > 0 && isMounted) {
            setNotes(serverNotes);
            saveNotes(serverNotes);
            if (!activeNoteId) setActiveNoteId(serverNotes[0].id);
          }
        }
      } catch (e) {
        console.warn('Notes server restore check error:', e);
      }
    }
    if (isOpen) {
      restoreFromServer();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Ensure activeNoteId points to a valid note
  useEffect(() => {
    if (notes.length > 0 && (!activeNoteId || !notes.some((n) => n.id === activeNoteId))) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  // Filter notes based on search query and sort by pinned first, then updatedAt
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });

    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
  }, [notes, searchQuery]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // Add new note handler
  const handleAddNewNote = () => {
    const now = Date.now();
    const newNote: NoteItem = {
      id: `note-${now}-${Math.random().toString(36).substring(2, 7)}`,
      title: 'یادداشت جدید',
      content: '',
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      color: '#8b5cf6',
    };

    const updated = [newNote, ...notes];
    setNotes(updated);
    setActiveNoteId(newNote.id);
    setMobileView('editor');

    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, 100);
  };

  // Update active note title
  const handleUpdateTitle = (newTitle: string) => {
    if (!activeNoteId) return;
    const now = Date.now();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId
          ? { ...n, title: newTitle, updatedAt: now }
          : n
      )
    );
  };

  // Update active note content
  const handleUpdateContent = (newContent: string) => {
    if (!activeNoteId) return;
    const now = Date.now();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId
          ? { ...n, content: newContent, updatedAt: now }
          : n
      )
    );
  };

  // Toggle Pin state
  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const now = Date.now();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: now } : n
      )
    );
  };

  // Change Color Tag
  const handleChangeColor = (colorHex: string) => {
    if (!activeNoteId) return;
    const now = Date.now();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, color: colorHex, updatedAt: now } : n
      )
    );
  };

  // Delete note confirmed
  const handleConfirmDelete = () => {
    if (!deleteConfirmId) return;
    const remaining = notes.filter((n) => n.id !== deleteConfirmId);
    setNotes(remaining);
    saveNotes(remaining);

    if (activeNoteId === deleteConfirmId) {
      setActiveNoteId(remaining[0]?.id || null);
    }
    setDeleteConfirmId(null);
    if (remaining.length === 0) {
      setMobileView('list');
    }
  };

  // Copy note text
  const handleCopyNote = () => {
    if (!activeNote) return;
    const textToCopy = `${activeNote.title}\n\n${activeNote.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download note as .txt
  const handleDownloadTxt = () => {
    if (!activeNote) return;
    const filename = `${activeNote.title.trim() || 'note'}.txt`;
    const textContent = `${activeNote.title}\nتاریخ: ${formatShamsiDate(new Date(activeNote.updatedAt || activeNote.createdAt))}\n────────────────────────\n\n${activeNote.content}`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Insert helper text snippet at cursor in textarea
  const handleInsertSnippet = (snippet: string) => {
    if (!textareaRef.current || !activeNote) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = activeNote.content;
    const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);
    handleUpdateContent(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 50);
  };

  // Calculate statistics
  const wordCount = useMemo(() => {
    if (!activeNote?.content) return 0;
    const trimmed = activeNote.content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [activeNote?.content]);

  const charCount = activeNote?.content.length || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Windows 11 Fluent Cyberpunk Modal Window */}
      <div
        className="w-full max-w-5xl h-[88vh] max-h-[820px] rounded-2xl bg-[#0e041f] border border-fuchsia-800/60 shadow-[0_0_50px_rgba(168,85,247,0.25)] flex flex-col overflow-hidden dir-rtl select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-fuchsia-900/50 bg-[#14062c] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-[0_0_12px_rgba(217,70,239,0.5)]">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-200 via-purple-200 to-pink-300">
                  دفترچه یادداشت دیجیتال
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-bold border border-purple-800/60">
                  {toPersianDigits(notes.length)} یادداشت
                </span>
              </div>
              <p className="text-[11px] text-purple-300/70 hidden sm:block">
                ثبت و نگهداری دائم ایده‌ها، نکات تمرکز و چک‌لیست‌های کاری با ذخیره‌سازی خودکار
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-save status badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/40 text-[11px] text-purple-300">
              {saveStatus === 'saving' ? (
                <>
                  <Save className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-amber-300 text-[10px]">در حال ذخیره...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 text-[10px]">ذخیره‌شده و ایمن</span>
                </>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-purple-900/60 text-purple-300 hover:text-white transition"
              title="بستن (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: 2-Column Split View */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Right Panel: Notes List & Search */}
          <div
            className={`w-full md:w-80 lg:w-96 border-l border-fuchsia-900/40 bg-[#120527] flex flex-col shrink-0 ${
              mobileView === 'editor' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Actions: New Note & Search */}
            <div className="p-3 sm:p-4 border-b border-fuchsia-900/40 space-y-2.5">
              <button
                onClick={handleAddNewNote}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(217,70,239,0.3)] transition active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>یادداشت جدید</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-purple-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجو در متن یا عنوان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-[#090214] border border-purple-800/40 text-xs text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-fuchsia-500/80 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Notes Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center text-purple-400/60 space-y-2">
                  <FileText className="w-8 h-8 mx-auto stroke-1 opacity-50" />
                  <p className="text-xs">
                    {searchQuery ? 'هیچ یادداشتی با این متن پیدا نشد.' : 'هنوز یادداشتی ایجاد نشده است.'}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isActive = note.id === activeNoteId;
                  const dateDisplay = formatShamsiDate(new Date(note.updatedAt || note.createdAt), {
                    showWeekday: false,
                    showYear: false,
                  });
                  const timeDisplay = formatHHMM(note.updatedAt || note.createdAt, true);
                  const colorTag = NOTE_COLORS.find((c) => c.bg === note.color) || NOTE_COLORS[0];

                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setActiveNoteId(note.id);
                        setMobileView('editor');
                      }}
                      className={`group relative p-3 rounded-xl cursor-pointer border transition text-right ${
                        isActive
                          ? 'bg-purple-900/40 border-fuchsia-500/70 shadow-[0_0_12px_rgba(217,70,239,0.15)]'
                          : 'bg-purple-950/20 border-purple-900/30 hover:bg-purple-950/40 hover:border-purple-800/60'
                      }`}
                    >
                      {/* Color Tag Bar */}
                      <div
                        className="absolute right-0 top-2 bottom-2 w-1 rounded-r-full"
                        style={{ backgroundColor: note.color || '#8b5cf6' }}
                      />

                      <div className="pr-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-fuchsia-100 truncate flex-1">
                            {note.title.trim() || 'یادداشت بدون عنوان'}
                          </h4>

                          <div className="flex items-center gap-1 shrink-0">
                            {note.isPinned && (
                              <Pin className="w-3 h-3 text-amber-400 fill-amber-400" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(note.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-purple-400 hover:text-red-400 transition"
                              title="حذف یادداشت"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-purple-300/60 line-clamp-2 leading-relaxed">
                          {note.content.trim() || 'بدون متن...'}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-purple-400/60 font-mono">
                          <span>
                            {dateDisplay} ({timeDisplay})
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/40">
                            {toPersianDigits(note.content.length)} حرف
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Left/Main Panel: Note Editor Area */}
          <div
            className={`flex-1 flex flex-col bg-[#0c031c] overflow-hidden ${
              mobileView === 'list' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {activeNote ? (
              <>
                {/* Editor Header / Controls Bar */}
                <div className="p-3 sm:px-6 sm:py-3 border-b border-fuchsia-900/40 bg-[#120527] flex flex-wrap items-center justify-between gap-2 shrink-0">
                  {/* Back to list on mobile */}
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden flex items-center gap-1 text-xs text-purple-300 hover:text-white px-2 py-1 rounded-lg bg-purple-950/60 border border-purple-800/50"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>لیست یادداشت‌ها</span>
                  </button>

                  {/* Metadata Stats */}
                  <div className="flex items-center gap-3 text-[11px] text-purple-300/80">
                    <div className="flex items-center gap-1 text-amber-300/90 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {formatShamsiDate(new Date(activeNote.updatedAt || activeNote.createdAt), {
                          showWeekday: true,
                          showYear: true,
                        })}
                      </span>
                      <span className="font-mono text-[10px] text-purple-400 mr-1">
                        ({formatHHMM(activeNote.updatedAt || activeNote.createdAt, true)})
                      </span>
                    </div>

                    <div className="hidden lg:flex items-center gap-2 border-r border-purple-800/60 pr-3 font-mono text-[10px] text-purple-400">
                      <span>{toPersianDigits(wordCount)} کلمه</span>
                      <span>•</span>
                      <span>{toPersianDigits(charCount)} حرف</span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 mr-auto sm:mr-0">
                    {/* Pin button */}
                    <button
                      onClick={() => handleTogglePin(activeNote.id)}
                      className={`p-1.5 rounded-lg border transition ${
                        activeNote.isPinned
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-purple-950/50 text-purple-300 border-purple-800/40 hover:bg-purple-900/60'
                      }`}
                      title={activeNote.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن به بالای لیست'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${activeNote.isPinned ? 'fill-amber-300' : ''}`} />
                    </button>

                    {/* Color Tag Selector */}
                    <div className="flex items-center gap-1 bg-purple-950/60 p-1 rounded-lg border border-purple-800/40">
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleChangeColor(c.bg)}
                          className={`w-4 h-4 rounded-full transition transform hover:scale-110 ${
                            activeNote.color === c.bg
                              ? 'ring-2 ring-white scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.bg }}
                          title={`برچسب رنگ ${c.label}`}
                        />
                      ))}
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={handleCopyNote}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-800/50 text-xs transition"
                      title="کپی کردن متن یادداشت"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 text-[10px]">کپی شد!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-purple-400" />
                          <span className="hidden sm:inline text-[10px]">کپی</span>
                        </>
                      )}
                    </button>

                    {/* Download button */}
                    <button
                      onClick={handleDownloadTxt}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-800/50 text-xs transition"
                      title="دانلود به عنوان فایل متنی txt"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="hidden sm:inline text-[10px]">دانلود</span>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteConfirmId(activeNote.id)}
                      className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/40 transition"
                      title="حذف این یادداشت"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title Input */}
                <div className="px-4 sm:px-6 pt-4 pb-2 shrink-0">
                  <input
                    ref={titleInputRef}
                    type="text"
                    placeholder="عنوان یادداشت..."
                    value={activeNote.title}
                    onChange={(e) => handleUpdateTitle(e.target.value)}
                    className="w-full bg-transparent text-lg sm:text-xl font-black text-fuchsia-100 placeholder-purple-400/40 focus:outline-none border-b border-purple-900/40 pb-2 transition"
                  />
                </div>

                {/* Quick Helper Snippets Toolbar */}
                <div className="px-4 sm:px-6 py-1.5 bg-[#090214]/60 border-y border-purple-900/30 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
                  <span className="text-purple-400/60 text-[10px] shrink-0 ml-1">درج سریع:</span>

                  <button
                    onClick={() => handleInsertSnippet('\n[ ] ')}
                    className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-800/50 text-purple-300 font-mono text-[10px] transition shrink-0"
                    title="درج چک‌باکس"
                  >
                    ☑ چک‌باکس
                  </button>

                  <button
                    onClick={() => handleInsertSnippet('\n• ')}
                    className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-800/50 text-purple-300 text-[10px] transition shrink-0"
                    title="درج بولت لیست"
                  >
                    • بولت
                  </button>

                  <button
                    onClick={() => handleInsertSnippet('\n────────────────────────────\n')}
                    className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-800/50 text-purple-300 text-[10px] transition shrink-0"
                    title="درج خط جداکننده"
                  >
                    ── خط جداکننده
                  </button>

                  <button
                    onClick={() => {
                      const dateNowStr = `${formatShamsiDate(new Date())} - ${formatHHMM(Date.now(), true)}`;
                      handleInsertSnippet(`\n[${dateNowStr}]\n`);
                    }}
                    className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-800/50 text-purple-300 text-[10px] transition shrink-0"
                    title="درج تاریخ و ساعت شمسی جاری"
                  >
                    📅 تاریخ جاری
                  </button>
                </div>

                {/* Main Text Content Area */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                  <textarea
                    ref={textareaRef}
                    value={activeNote.content}
                    onChange={(e) => handleUpdateContent(e.target.value)}
                    placeholder="مطالب، یادداشت‌ها، تصمیمات و ایده‌های خود را اینجا بنویسید... (همه تغییرات بلافاصله و خودکار ذخیره می‌شوند)"
                    className="w-full h-full min-h-[300px] bg-transparent text-sm sm:text-base text-fuchsia-100 placeholder-purple-400/30 focus:outline-none resize-none leading-relaxed font-sans"
                    dir="auto"
                  />
                </div>
              </>
            ) : (
              /* Empty Editor State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-950/50 border border-purple-800/50 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-8 h-8 text-fuchsia-400 opacity-60" />
                </div>
                <div className="max-w-sm space-y-1">
                  <h3 className="text-base font-bold text-fuchsia-200">یادداشتی انتخاب نشده است</h3>
                  <p className="text-xs text-purple-300/60 leading-relaxed">
                    یک یادداشت را از ستون سمت راست انتخاب کنید یا دکمه زیر را برای ایجاد یادداشت جدید بزنید.
                  </p>
                </div>
                <button
                  onClick={handleAddNewNote}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-xs font-bold shadow-lg hover:from-fuchsia-500 hover:to-purple-500 transition"
                >
                  + ایجاد یادداشت جدید
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {deleteConfirmId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="max-w-sm w-full bg-[#180630] border border-red-500/50 rounded-2xl p-5 shadow-2xl text-right space-y-4">
              <div className="flex items-center gap-2.5 text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold">حذف دائمی یادداشت</h3>
              </div>
              <p className="text-xs text-purple-200/80 leading-relaxed">
                آیا از حذف این یادداشت اطمینان دارید؟ این عمل غیرقابل بازگشت است و یادداشت از دیتابیس محلی و سرور پاک خواهد شد.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 text-xs border border-purple-800/60 transition"
                >
                  انصراف
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-[0_0_10px_rgba(239,68,68,0.4)] transition"
                >
                  بله، حذف شود
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
