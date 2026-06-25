"use client";

import {
  WarningCircleIcon as AlertCircle,
  ArrowRightIcon as ArrowRight,
  CaretDownIcon as ChevronDown,
  CoinsIcon as Coins,
  DownloadSimpleIcon as Download,
  FileTextIcon as FileText,
  CircleNotchIcon as Loader2,
  SignOutIcon as LogOut,
  ChatCircleIcon as MessageCircle,
  MoonIcon as Moon,
  DotsThreeIcon as MoreHorizontal,
  PencilSimpleIcon as Pencil,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  MagnifyingGlassIcon as Search,
  FileMagnifyingGlassIcon as BrandMark,
  SunIcon as Sun,
  TrashIcon as Trash2,
  UploadSimpleIcon as Upload,
  UserIcon as UserRound,
} from "@phosphor-icons/react";
import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeBullets, parseAnalysisSections } from "@/lib/analysis";
import {
  KeyPointsList,
  RisksList,
  StreamingCursor,
  SummaryContent,
} from "@/components/review/ReviewContent";
import {
  buildAnalysisExport,
  buildAnalysisJsonExport,
  buildChatExport,
  buildChatJsonExport,
  downloadJson,
  downloadPdf,
  toFileSlug,
} from "@/lib/exports";
import { AuthForm, type AuthUser } from "@/components/AuthForm";

type IntakeMode = "upload" | "paste";
type ResultTab = "summary" | "keyPoints" | "risksActions";
type ChatRole = "user" | "assistant";
type ThemeMode = "light" | "dark";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type DocumentPart = {
  fileName: string;
  text: string;
};

type ChatSession = {
  id: string;
  title: string;
  documentName: string;
  documentText: string;
  documents: DocumentPart[];
  analysis: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

type TokenStatus = { quota: number; used: number; remaining: number; period: string };
type UploadProgress = { fileName: string; progress: number; status: "Uploading" | "Extracting" | "Ready" | "Error" };
type ToastTone = "success" | "error" | "info";
type ToastMessage = { id: string; message: string; tone: ToastTone };

const THEME_STORAGE_KEY = "diw:theme";
const QUESTION_MAX_LENGTH = 1000;

const tabs: Array<{ id: ResultTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "keyPoints", label: "Key Points" },
  { id: "risksActions", label: "Risks & Actions" },
];

const tabColors: Record<ResultTab, string> = {
  summary: "var(--accent)",
  keyPoints: "var(--ok)",
  risksActions: "var(--danger)",
};

export default function Home() {
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("upload");
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("No document loaded");
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");
  const [question, setQuestion] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatHistorySearch, setChatHistorySearch] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [openChatMenuId, setOpenChatMenuId] = useState("");
  const [renamingChatId, setRenamingChatId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentUser, setCurrentUser] = useState<{ name: string | null; email: string } | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDocumentsMenu, setShowDocumentsMenu] = useState(false);
  const [showAnalysisExportMenu, setShowAnalysisExportMenu] = useState(false);
  const [showChatExportMenu, setShowChatExportMenu] = useState(false);
  const [activeChatId, setActiveChatId] = useState("");
  const [draftDocumentId, setDraftDocumentId] = useState("");
  const [hasLoadedChats, setHasLoadedChats] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadProgresses, setUploadProgresses] = useState<UploadProgress[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const chatHistorySearchInputRef = useRef<HTMLInputElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const questionFormRef = useRef<HTMLFormElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const documentsMenuRef = useRef<HTMLDivElement>(null);
  const analysisExportMenuRef = useRef<HTMLDivElement>(null);
  const chatExportMenuRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<ChatSession | undefined>(undefined);
  const wasDropRef = useRef(false);
  // Tracks the last JSON synced to the DB per chat, so the persist effect only
  // pushes chats that actually changed.
  const lastSyncedRef = useRef<Map<string, string>>(new Map());
  // Soft-auth gating: authedRef mirrors login state synchronously, and
  // pendingActionRef holds the action to resume after a successful login.
  const authedRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = createId();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const sections = useMemo(() => parseAnalysisSections(rawAnalysis), [rawAnalysis]);
  const currentContent = sections[activeTab];
  const debouncedChatSearch = useDebouncedValue(chatSearch, 180);
  const debouncedHistorySearch = useDebouncedValue(chatHistorySearch, 180);
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [activeChatId, chats],
  );
  const activeDocuments = useMemo(() => currentDocuments(activeChat), [activeChat]);
  const recentChats = useMemo(
    () =>
      [...chats].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [chats],
  );
  const documentChats = useMemo(
    () =>
      recentChats.filter(
        (chat) =>
          hasMeaningfulChat(chat) ||
          (chat.id === draftDocumentId && chat.id === activeChatId),
      ),
    [activeChatId, draftDocumentId, recentChats],
  );
  const filteredChats = useMemo(() => {
    const query = debouncedChatSearch.trim().toLowerCase();
    if (!query) return documentChats;
    return documentChats.filter((chat) =>
      [chat.documentName, chat.title, getChatPreview(chat)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [debouncedChatSearch, documentChats]);
  const visibleChatMessages = useMemo(() => {
    const messages = activeChat?.messages ?? [];
    const query = debouncedHistorySearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) =>
      [message.role, message.content].join(" ").toLowerCase().includes(query),
    );
  }, [activeChat?.messages, debouncedHistorySearch]);

  const hasDocument = Boolean(documentText.trim());
  const hasAnalysis = Boolean(rawAnalysis.trim());
  const isBootstrapping = !hasLoadedChats || !hasCheckedAuth;
  const workspaceTitle = activeChat ? chatDisplayName(activeChat) : "Untitled document";
  const hasChatMessages = Boolean(activeChat?.messages.length);
  const documentCharTotal = activeDocuments.length
    ? activeDocuments.reduce((total, document) => total + document.text.trim().length, 0)
    : documentText.trim().length;
  const documentHeaderTitle =
    activeDocuments.length > 1
      ? `${activeDocuments.length} documents loaded`
      : activeDocuments[0]?.fileName || documentName;
  const documentHeaderSubtitle =
    activeDocuments.length > 1
      ? `${documentCharTotal.toLocaleString()} total characters`
      : `${documentCharTotal.toLocaleString()} characters`;
  const isDarkTheme = themeMode === "dark";
  const questionLength = question.length;
  const isQuestionOverLimit = questionLength > QUESTION_MAX_LENGTH;
  const tokenPct =
    tokenStatus && tokenStatus.quota > 0
      ? Math.max(0, Math.min(100, (tokenStatus.remaining / tokenStatus.quota) * 100))
      : 0;
  const tokenBarColor =
    tokenStatus && tokenStatus.remaining <= 0
      ? "var(--danger)"
      : tokenPct < 20
        ? "var(--gold)"
        : "var(--accent)";
  const riskCount = sections.risksActions ? normalizeBullets(sections.risksActions).length : 0;

  const analysisExport = useMemo(
    () => buildAnalysisExport(documentName, sections, rawAnalysis),
    [documentName, rawAnalysis, sections],
  );
  const chatExport = useMemo(() => buildChatExport(activeChat), [activeChat]);

  // Load sessions from the database
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await fetchChats();
        if (cancelled) return;
        if (applyLoadedChats(loaded)) {
          setHasLoadedChats(true);
          return;
        }
      } catch {
        // fall through to a fresh local session
      }
      if (cancelled) return;
      const initialChat = createChatSession();
      setChats([initialChat]);
      setActiveChatId(initialChat.id);
      setHasLoadedChats(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the authenticated user for the sidebar footer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as {
            user?: { name: string | null; email: string } | null;
          };
          if (!cancelled && payload.user) {
            authedRef.current = true;
            setCurrentUser(payload.user);
            void refreshTokenStatus();
          }
        }
      } catch {
        // anonymous — browsing is allowed; login is requested when using an action
      } finally {
        if (!cancelled) setHasCheckedAuth(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load theme (supports old key for backward compat)
  useEffect(() => {
    const saved =
      window.localStorage.getItem(THEME_STORAGE_KEY) ||
      window.localStorage.getItem("ai-document-analyzer-theme-v1");
    if (saved === "dark" || saved === "light") {
      setThemeMode(saved);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setThemeMode("dark");
    }
  }, []);

  // Persist sessions to the database — debounced, and only the chats whose
  // serialized form changed since the last sync. Only for logged-in users.
  useEffect(() => {
    if (!hasLoadedChats || !currentUser) return;
    const timer = setTimeout(() => {
      chats.filter(hasMeaningfulChat).forEach((chat) => {
        const snapshot = serializeChat(chat);
        if (lastSyncedRef.current.get(chat.id) === snapshot) return;
        void saveChat(chat).then((saved) => {
          if (saved) lastSyncedRef.current.set(chat.id, snapshot);
        });
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [chats, hasLoadedChats, currentUser]);

  // Persist & apply theme class on <html>
  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }, [themeMode, isDarkTheme]);

  // Scroll chat to bottom
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: isAnswering ? "smooth" : "auto" });
  }, [activeChatId, activeChat?.messages.length, activeChat?.updatedAt, isAnswering]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        if (activeChat?.messages.length) {
          chatHistorySearchInputRef.current?.focus();
        } else {
          chatSearchInputRef.current?.focus();
        }
        return;
      }

      if (key === "n") {
        event.preventDefault();
        if (!requireAuth(() => createAndActivateChat())) return;
        createAndActivateChat();
        pushToast("New document draft created.", "info");
        return;
      }

      if (event.key === "Enter" && question.trim() && !isAnswering && hasDocument) {
        event.preventDefault();
        questionFormRef.current?.requestSubmit();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeChat?.messages.length, hasDocument, isAnswering, pushToast, question]);

  // ── Handlers ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!showDocumentsMenu && !showAnalysisExportMenu && !showChatExportMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && documentsMenuRef.current?.contains(target)) return;
      if (target instanceof Node && analysisExportMenuRef.current?.contains(target)) return;
      if (target instanceof Node && chatExportMenuRef.current?.contains(target)) return;
      setShowDocumentsMenu(false);
      setShowAnalysisExportMenu(false);
      setShowChatExportMenu(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowDocumentsMenu(false);
        setShowAnalysisExportMenu(false);
        setShowChatExportMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAnalysisExportMenu, showChatExportMenu, showDocumentsMenu]);

  async function refreshTokenStatus() {
    try {
      const response = await fetch("/api/tokens", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { status?: TokenStatus | null };
      if (payload.status) setTokenStatus(payload.status);
    } catch {
      // ignore
    }
  }

  // Soft-auth gate: runs the action if logged in, otherwise stores it and opens
  // the login modal so it can resume after authentication.
  function requireAuth(action?: () => void) {
    if (authedRef.current) return true;
    pendingActionRef.current = action ?? null;
    setShowAuthModal(true);
    return false;
  }

  function applyLoadedChats(loaded: ChatSession[]) {
    const validChats = loaded.filter(hasMeaningfulChat);
    validChats.forEach((chat) =>
      lastSyncedRef.current.set(chat.id, serializeChat(chat)),
    );
    const firstChat = validChats[0];
    if (!firstChat) return false;

    activeChatRef.current = firstChat;
    setChats(validChats);
    setActiveChatId(firstChat.id);
    setDocumentName(firstChat.documentName);
    setDocumentText(firstChat.documentText);
    setRawAnalysis(firstChat.analysis ?? "");
    setIntakeMode(firstChat.documentText ? "paste" : "upload");
    setQuestion("");
    setError("");
    setNotice("");
    return true;
  }

  async function handleAuthSuccess(user: AuthUser) {
    authedRef.current = true;
    setCurrentUser(user);
    setShowAuthModal(false);
    void refreshTokenStatus();
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    try {
      const loaded = await fetchChats();
      applyLoadedChats(loaded);
    } catch {
      // A fresh account may not have persisted chats yet.
    }
    pending?.();
  }

  function closeAuthModal() {
    pendingActionRef.current = null;
    setShowAuthModal(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (event.target) event.target.value = "";
    if (!files.length) return;
    if (!requireAuth(() => void processFiles(files))) return;
    await processFiles(files);
  }

  function handleBrowseFiles() {
    if (wasDropRef.current) {
      wasDropRef.current = false;
      return;
    }
    if (isExtracting || uploadProgresses.length > 0) return;
    if (!requireAuth()) return;
    fileInputRef.current?.click();
  }

  function handleFileDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isExtracting) return;
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  }

  function handleFileDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
  }

  function handleFileDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    wasDropRef.current = true;
    window.setTimeout(() => {
      wasDropRef.current = false;
    }, 350);
    if (isExtracting) return;

    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) return;
    if (!requireAuth(() => void processFiles(files))) return;
    void processFiles(files);
  }

  async function processFiles(files: File[]) {
    setError("");
    setNotice("");
    setIsExtracting(true);
    setDocumentName(buildSelectedFilesLabel(files));
    setUploadProgresses(
      files.map((file) => ({
        fileName: file.name,
        progress: 8,
        status: "Uploading",
      })),
    );
    const progressTimer = window.setInterval(() => {
      setUploadProgresses((current) =>
        current.map((file) =>
          file.status === "Ready" || file.status === "Error"
            ? file
            : {
                ...file,
                progress: Math.min(file.progress + 14, 92),
                status: file.progress > 48 ? "Extracting" : file.status,
              },
        ),
      );
    }, 220);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/extract", { method: "POST", body: formData });
      const payload = (await response.json()) as {
        fileName?: string;
        text?: string;
        documents?: DocumentPart[];
        error?: string;
      };
      if (!response.ok || !payload.text) {
        throw new Error(payload.error || "Could not extract text from the documents.");
      }

      const incoming: DocumentPart[] = payload.documents?.length
        ? payload.documents
        : [{ fileName: payload.fileName ?? buildSelectedFilesLabel(files), text: payload.text }];

      const session = activeChatRef.current ?? createAndActivateChat();
      const { documents: merged, duplicateCount } = mergeDocumentParts(
        currentDocuments(session),
        incoming,
      );

      if (duplicateCount) {
        const duplicateNotice = buildDuplicateDocumentNotice(duplicateCount, incoming.length);
        setNotice(duplicateNotice);
        pushToast(duplicateNotice, "info");
      }

      if (duplicateCount === incoming.length) {
        setDocumentName(session.documentName);
        setDocumentText(session.documentText);
        setIntakeMode(session.documentText ? "paste" : "upload");
        setDraftDocumentId("");
        setShowDocumentsMenu(false);
        setUploadProgresses((current) =>
          current.map((file) => ({ ...file, progress: 100, status: "Ready" })),
        );
        return;
      }

      const mergedText = mergeDocumentText(merged);
      const mergedName = documentSetName(merged);

      const updatedChat = {
        ...session,
        documentName: mergedName,
        documentText: mergedText,
        documents: merged,
        analysis: "",
        updatedAt: new Date().toISOString(),
      };
      if (authedRef.current && !(await saveChat(updatedChat, { forceDocumentUpdate: true }))) {
        throw new Error("Could not save the updated document set. Please try again.");
      }

      setDocumentText(mergedText);
      setDocumentName(mergedName);
      setIntakeMode("upload");
      setRawAnalysis("");
      updateChat(session.id, (chat) => ({ ...chat, ...updatedChat }));
      setDraftDocumentId("");
      setShowDocumentsMenu(false);
      lastSyncedRef.current.set(updatedChat.id, serializeChat(updatedChat));
      setUploadProgresses((current) =>
        current.map((file) => ({ ...file, progress: 100, status: "Ready" })),
      );
      pushToast(
        `${incoming.length - duplicateCount} document${incoming.length - duplicateCount === 1 ? "" : "s"} added.`,
        "success",
      );
      void runAnalysis(mergedText, session.id);
    } catch (caught) {
      setNotice("");
      const message = caught instanceof Error ? caught.message : "Document upload failed.";
      setError(message);
      pushToast(message, "error");
      setUploadProgresses((current) =>
        current.map((file) => ({ ...file, status: "Error", progress: 100 })),
      );
    } finally {
      window.clearInterval(progressTimer);
      setIsExtracting(false);
      window.setTimeout(() => setUploadProgresses([]), 1600);
    }
  }

  function handleAnalyze() {
    if (!documentText.trim()) {
      setError("Upload or paste a document before running analysis.");
      return;
    }
    if (!requireAuth(() => startAnalysis(documentText))) return;
    startAnalysis(documentText);
  }

  function startAnalysis(text: string) {
    if (tokenStatus && tokenStatus.remaining <= 0) {
      setError("You've run out of tokens for this month.");
      return;
    }
    const session = activeChat ?? createAndActivateChat(documentName, text);
    void runAnalysis(text, session.id);
  }

  async function runAnalysis(text: string, sessionId: string) {
    if (!text.trim()) return;
    setError("");
    setRawAnalysis("");
    updateChat(sessionId, (chat) => ({
      ...chat,
      analysis: "",
      updatedAt: new Date().toISOString(),
    }));
    setIsAnalyzing(true);
    try {
      await streamFromApi(
        "/api/analyze",
        { mode: "analysis", documentText: text },
        (chunk) => {
          setRawAnalysis((prev) => prev + chunk);
          appendAnalysisChunk(sessionId, chunk);
        },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
      void refreshTokenStatus();
    }
  }

  function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!documentText.trim()) {
      setError("Load a document before using the chat.");
      return;
    }
    if (!trimmedQuestion) {
      setError("Write a question first.");
      return;
    }
    if (trimmedQuestion.length > QUESTION_MAX_LENGTH) {
      setError(`Keep the question under ${QUESTION_MAX_LENGTH} characters.`);
      return;
    }
    if (!requireAuth(() => submitQuestion(trimmedQuestion))) return;
    submitQuestion(trimmedQuestion);
  }

  async function submitQuestion(trimmedQuestion: string) {
    if (tokenStatus && tokenStatus.remaining <= 0) {
      setError("You've run out of tokens for this month.");
      return;
    }
    const session = activeChat ?? createAndActivateChat(documentName, documentText);
    const assistantId = createId();
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmedQuestion,
      createdAt: now,
    };
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now,
    };
    const chatHistory = session.messages.map(({ role, content }) => ({ role, content }));

    setError("");
    setQuestion("");
    setIsAnswering(true);
    updateChat(session.id, (chat) => ({
      ...chat,
      documentName,
      documentText,
      messages: [...chat.messages, userMessage, assistantMessage],
      updatedAt: now,
    }));
    setDraftDocumentId("");

    try {
      await streamFromApi(
        "/api/analyze",
        { mode: "question", documentText, question: trimmedQuestion, chatHistory },
        (chunk) => appendAssistantChunk(session.id, assistantId, chunk),
      );
    } catch (caught) {
      removeMessage(session.id, assistantId);
      setError(caught instanceof Error ? caught.message : "Question failed.");
    } finally {
      setIsAnswering(false);
      void refreshTokenStatus();
    }
  }

  function handlePastedDocument(nextText: string) {
    if (!requireAuth(() => handlePastedDocument(nextText))) return;
    setNotice("");
    setDocumentText(nextText);
    setDocumentName("pasted-document.txt");
    attachDocumentToActiveChat("pasted-document.txt", nextText, [
      { fileName: "pasted-document.txt", text: nextText },
    ]);
    setDraftDocumentId("");
    startAnalysis(nextText);
  }

  function handlePasteIntent() {
    requireAuth();
  }

  function createAndActivateChat(
    nextDocumentName = "No document loaded",
    nextDocumentText = "",
  ) {
    const nextChat = createChatSession(nextDocumentName, nextDocumentText);
    activeChatRef.current = nextChat;
    setChats((prev) => [nextChat, ...prev.filter(hasMeaningfulChat)]);
    setActiveChatId(nextChat.id);
    setDraftDocumentId(hasMeaningfulChat(nextChat) ? "" : nextChat.id);
    setDocumentName(nextDocumentName);
    setDocumentText(nextDocumentText);
    setIntakeMode(nextDocumentText ? "paste" : "upload");
    setRawAnalysis("");
    setQuestion("");
    setChatHistorySearch("");
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setShowDocumentsMenu(false);
    setShowChatExportMenu(false);
    setError("");
    setNotice("");
    return nextChat;
  }

  function selectChat(chat: ChatSession) {
    activeChatRef.current = chat;
    setActiveChatId(chat.id);
    setDraftDocumentId(chat.id === draftDocumentId ? draftDocumentId : "");
    setDocumentName(chat.documentName);
    setDocumentText(chat.documentText);
    setRawAnalysis(chat.analysis ?? "");
    setIntakeMode(chat.documentText ? "paste" : "upload");
    setQuestion("");
    setChatHistorySearch("");
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setShowDocumentsMenu(false);
    setShowChatExportMenu(false);
    setError("");
    setNotice("");
  }

  function toggleChatMenu(chatId: string) {
    setRenamingChatId("");
    setRenameDraft("");
    setOpenChatMenuId((cur) => (cur === chatId ? "" : chatId));
  }

  function startRenamingChat(chat: ChatSession) {
    setRenamingChatId(chat.id);
    setRenameDraft(chatDisplayName(chat));
    setOpenChatMenuId("");
  }

  function cancelRename() {
    setRenamingChatId("");
    setRenameDraft("");
  }

  function saveRename(chatId: string) {
    const nextName = renameDraft.trim();
    if (!nextName) { cancelRename(); return; }
    // Renames only the chat's title — the document files stay untouched.
    updateChat(chatId, (chat) => ({
      ...chat,
      title: nextName,
      updatedAt: new Date().toISOString(),
    }));
    setDraftDocumentId("");
    cancelRename();
  }

  function deleteChat(chatId: string) {
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setDraftDocumentId("");
    setShowDocumentsMenu(false);
    setShowChatExportMenu(false);
    if (lastSyncedRef.current.has(chatId)) {
      lastSyncedRef.current.delete(chatId);
      void deleteChatRemote(chatId);
    }
    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== chatId);
      if (remaining.length) {
        if (chatId === activeChatId) {
          const next = remaining[0];
          setActiveChatId(next.id);
          setDocumentName(next.documentName);
          setDocumentText(next.documentText);
          setRawAnalysis(next.analysis ?? "");
          setIntakeMode(next.documentText ? "paste" : "upload");
        }
        return remaining;
      }
      const next = createChatSession();
      setActiveChatId(next.id);
      setDocumentName(next.documentName);
      setDocumentText(next.documentText);
      setRawAnalysis("");
      setIntakeMode("upload");
      return [next];
    });
  }

  async function exportAnalysisPdf() {
    setShowAnalysisExportMenu(false);
    await downloadPdf(
      analysisExport,
      `${toFileSlug(documentName)}-analysis.pdf`,
      "Document Intelligence Review",
    );
    pushToast("Analysis exported as PDF.", "success");
  }

  function exportAnalysisJson() {
    if (!hasAnalysis) return;
    setShowAnalysisExportMenu(false);
    downloadJson(
      buildAnalysisJsonExport(documentName, sections, rawAnalysis),
      `${toFileSlug(documentName)}-analysis.json`,
    );
    pushToast("Analysis exported as JSON.", "success");
  }

  async function exportChat() {
    setShowChatExportMenu(false);
    await downloadPdf(
      chatExport,
      `${toFileSlug(activeChat ? chatDisplayName(activeChat) : documentName)}-chat.pdf`,
      "Document Export",
    );
    pushToast("Conversation exported as PDF.", "success");
  }

  function exportChatJson() {
    if (!activeChat?.messages.length) return;
    setShowChatExportMenu(false);
    downloadJson(
      buildChatJsonExport(activeChat),
      `${toFileSlug(chatDisplayName(activeChat))}-chat.json`,
    );
    pushToast("Conversation exported as JSON.", "success");
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — redirect anyway
    }
    window.location.href = "/login";
  }

  function attachDocumentToActiveChat(
    nextName: string,
    nextText: string,
    nextDocuments: DocumentPart[],
  ) {
    if (!activeChatId) return;
    updateChat(activeChatId, (chat) => ({
      ...chat,
      documentName: nextName,
      documentText: nextText,
      documents: nextDocuments,
      analysis: "",
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateChat(chatId: string, updater: (chat: ChatSession) => ChatSession) {
    setChats((prev) => prev.map((c) => (c.id === chatId ? updater(c) : c)));
  }

  function appendAssistantChunk(chatId: string, messageId: string, chunk: string) {
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.map((m) =>
        m.id === messageId ? { ...m, content: `${m.content}${chunk}` } : m,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function appendAnalysisChunk(chatId: string, chunk: string) {
    updateChat(chatId, (chat) => ({
      ...chat,
      analysis: `${chat.analysis ?? ""}${chunk}`,
      updatedAt: new Date().toISOString(),
    }));
  }

  function removeMessage(chatId: string, messageId: string) {
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.filter((m) => m.id !== messageId),
      updatedAt: new Date().toISOString(),
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (isBootstrapping) {
    return <WorkspaceBootScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <aside
        className="w-[252px] shrink-0 flex flex-col bg-sidebar border-r border-border overflow-hidden"
        style={{ padding: "18px 14px" }}
      >
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="size-[30px] shrink-0 flex items-center justify-center rounded-[9px] bg-accent">
            <BrandMark className="size-[15px] text-on-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-text leading-snug">Document Intelligence</p>
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              Workspace
            </p>
          </div>
        </div>

        {/* New document */}
        <button
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-[12px] bg-accent text-on-accent text-[13px] font-semibold transition hover:opacity-90 active:scale-[0.98]"
          style={{ height: "var(--control-h)" }}
          onClick={() => {
            if (!requireAuth(() => createAndActivateChat())) return;
            createAndActivateChat();
          }}
          type="button"
        >
          <Plus className="size-4" />
          New document
        </button>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
          <input
            ref={chatSearchInputRef}
            className="w-full rounded-[10px] bg-inset border border-border pl-8 pr-3 text-[13px] text-text placeholder:text-muted outline-none transition focus:border-accent focus:ring-2"
            style={{ height: "34px", "--tw-ring-color": "color-mix(in oklab, var(--accent) 18%, transparent)" } as CSSProperties}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search documents (Ctrl+K)"
            value={chatSearch}
          />
        </div>

        {/* Recent label */}
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted mt-4 mb-2">
          Recent
        </p>

        {/* Recent list */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[3px] pr-0.5">
          {filteredChats.length ? (
            filteredChats.map((chat) =>
              renamingChatId === chat.id ? (
                <form
                  key={chat.id}
                  className="rounded-[11px] border border-border bg-panel p-2 space-y-2"
                  onSubmit={(e) => { e.preventDefault(); saveRename(chat.id); }}
                >
                  <input
                    autoFocus
                    className="w-full h-8 rounded-[8px] border border-border bg-inset px-2.5 text-[12.5px] font-semibold text-text outline-none focus:border-accent"
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") cancelRename(); }}
                    value={renameDraft}
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      className="px-2.5 py-1 rounded-[7px] text-[11.5px] font-semibold text-muted transition hover:text-text hover:bg-inset"
                      onClick={cancelRename}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="px-2.5 py-1 rounded-[7px] bg-accent text-on-accent text-[11.5px] font-semibold transition hover:opacity-90"
                      type="submit"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  key={chat.id}
                  className={`rounded-[11px] border transition ${
                    chat.id === activeChatId
                      ? "border-accent bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]"
                      : "border-border bg-panel hover:border-[color-mix(in_oklab,var(--accent)_35%,transparent)]"
                  }`}
                  style={{ padding: "8px 10px" }}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => selectChat(chat)}
                      type="button"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText
                          className="size-3.5 shrink-0 mt-[1px]"
                          style={{ color: chat.id === activeChatId ? "var(--accent)" : "var(--muted)" }}
                        />
                        <span className="block flex-1 min-w-0 truncate text-[12.5px] font-semibold text-text">
                          {chatDisplayName(chat)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="block truncate font-mono text-[9.5px] text-muted">
                          {getChatPreview(chat)}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-muted">
                          {formatRelativeTime(chat.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      className="rounded-[7px] p-1 text-muted transition hover:bg-inset hover:text-text"
                      onClick={() => toggleChatMenu(chat.id)}
                      type="button"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </div>

                  {openChatMenuId === chat.id && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-border pt-2">
                      <button
                        className="flex items-center justify-center gap-1 rounded-[8px] border border-border bg-inset px-2 py-1.5 text-[11.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
                        onClick={() => startRenamingChat(chat)}
                        type="button"
                      >
                        <Pencil className="size-3" />
                        Rename
                      </button>
                      <button
                        className="flex items-center justify-center gap-1 rounded-[8px] border px-2 py-1.5 text-[11.5px] font-semibold transition"
                        style={{
                          borderColor: "color-mix(in oklab, var(--danger) 30%, transparent)",
                          color: "var(--danger)",
                          background: "color-mix(in oklab, var(--danger) 6%, transparent)",
                        }}
                        onClick={() => deleteChat(chat.id)}
                        type="button"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="size-5 text-muted" />
              <p className="mt-2 text-[12px] font-medium text-muted">
                {chatSearch.trim() ? "No matches" : "No documents yet"}
              </p>
            </div>
          )}
        </div>

        {/* Footer: tokens + user + theme toggle + logout */}
        <div className="border-t border-border pt-3 mt-3 space-y-3">
          {currentUser && tokenStatus && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <Coins className="size-3" />
                  Tokens
                </span>
                <span className="font-mono text-[10px] font-semibold text-text">
                  {formatTokens(tokenStatus.remaining)} / {formatTokens(tokenStatus.quota)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-inset overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${tokenPct}%`, background: tokenBarColor }}
                />
              </div>
              <p className="mt-1 font-mono text-[9px] text-muted">
                {tokenStatus.remaining <= 0 ? "No tokens left this month" : "Remaining this month"}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="size-7 rounded-full shrink-0 flex items-center justify-center font-semibold text-[11px] uppercase"
                style={
                  currentUser
                    ? { background: "color-mix(in oklab, var(--calm) 14%, transparent)", color: "var(--calm)" }
                    : { background: "color-mix(in oklab, var(--muted) 16%, transparent)", color: "var(--muted)" }
                }
              >
                {currentUser ? (
                  (currentUser.name || currentUser.email || "U").charAt(0)
                ) : (
                  <UserRound className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[12.5px] font-medium text-text truncate">
                  {currentUser ? currentUser.name || currentUser.email : "Guest"}
                </p>
                <p className="font-mono text-[9px] text-muted truncate">
                  {currentUser?.email ?? "Not signed in"}
                </p>
              </div>
            </div>
            <div className="flex items-center rounded-[9px] bg-inset border border-border p-0.5 shrink-0">
              <button
                className={`flex items-center justify-center size-[26px] rounded-[7px] transition ${
                  !isDarkTheme ? "bg-panel shadow-sm text-text" : "text-muted hover:text-text"
                }`}
                onClick={() => setThemeMode("light")}
                type="button"
                aria-label="Light theme"
              >
                <Sun className="size-3.5" />
              </button>
              <button
                className={`flex items-center justify-center size-[26px] rounded-[7px] transition ${
                  isDarkTheme ? "bg-panel shadow-sm text-text" : "text-muted hover:text-text"
                }`}
                onClick={() => setThemeMode("dark")}
                type="button"
                aria-label="Dark theme"
              >
                <Moon className="size-3.5" />
              </button>
            </div>
          </div>
          {currentUser ? (
            <button
              className="w-full flex items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold text-text-muted transition hover:border-danger hover:text-danger"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-1.5 rounded-[10px] bg-accent text-on-accent px-3 py-2 text-[12px] font-semibold transition hover:opacity-90"
              onClick={() => setShowAuthModal(true)}
              type="button"
            >
              <UserRound className="size-3.5" />
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────── */}
      <main
        className="flex-1 min-w-0 flex flex-col"
        style={{ gap: "var(--gap)", padding: "var(--pad)" }}
      >
        {!hasDocument ? (
          /* ── INTAKE EMPTY STATE ──────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 className="text-[26px] font-bold text-text tracking-[-0.01em]">
              Start a new analysis
            </h1>
            <p className="mt-2 text-[13.5px] text-text-muted text-center">
              Upload or paste a document to get a structured review.
            </p>

            <div
              className="mt-8 w-full max-w-[560px] bg-panel rounded-panel border border-border shadow-card"
              style={{ padding: "var(--pad)" }}
            >
              {/* Tab toggle */}
              <div className="grid grid-cols-2 rounded-[10px] bg-inset border border-border p-0.5">
                <button
                  className={`rounded-[8px] py-2 text-[13px] font-semibold transition ${
                    intakeMode === "upload" ? "bg-panel shadow-sm text-text" : "text-muted hover:text-text"
                  }`}
                  onClick={() => setIntakeMode("upload")}
                  type="button"
                >
                  Upload files
                </button>
                <button
                  className={`rounded-[8px] py-2 text-[13px] font-semibold transition ${
                    intakeMode === "paste" ? "bg-panel shadow-sm text-text" : "text-muted hover:text-text"
                  }`}
                  onClick={() => setIntakeMode("paste")}
                  type="button"
                >
                  Paste text
                </button>
              </div>

              {/* Dropzone or textarea */}
              {intakeMode === "upload" ? (
                uploadProgresses.length > 0 ? (
                  <UploadReceivedState />
                ) : (
                <button
                  className="mt-4 w-full flex flex-col items-center justify-center rounded-[14px] p-10 text-center transition hover:opacity-90 disabled:cursor-not-allowed"
                  style={{
                    border: `1.5px dashed color-mix(in oklab, var(--accent) ${isDraggingFiles ? "78%" : "45%"}, transparent)`,
                    background: `color-mix(in oklab, var(--accent) ${isDraggingFiles ? "13%" : "7%"}, transparent)`,
                    boxShadow: isDraggingFiles
                      ? "inset 0 0 0 1px color-mix(in oklab, var(--accent) 35%, transparent)"
                      : "none",
                  }}
                  aria-busy={isExtracting}
                  disabled={isExtracting}
                  onClick={handleBrowseFiles}
                  onDragEnter={handleFileDragOver}
                  onDragLeave={handleFileDragLeave}
                  onDragOver={handleFileDragOver}
                  onDrop={handleFileDrop}
                  type="button"
                >
                  {isExtracting ? (
                    <Loader2 className="size-12 animate-spin text-accent" />
                  ) : (
                    <div
                      className="flex size-12 items-center justify-center rounded-[12px] bg-accent"
                    >
                      <Upload className="size-6 text-on-accent" />
                    </div>
                  )}
                  <span className="mt-3 text-[13.5px] font-semibold text-text">
                    {isExtracting ? (
                      "Extracting document text…"
                    ) : isDraggingFiles ? (
                      "Drop files to upload"
                    ) : (
                      "Click to choose files or drop them here"
                    )}
                  </span>
                  <span className="mt-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
                    PDF · TXT · MD — up to 8 MB
                  </span>
                </button>
                )
              ) : (
                <textarea
                  className="mt-4 w-full resize-y rounded-[11px] border border-border bg-inset px-3.5 py-3 text-[13.5px] leading-relaxed text-text placeholder:text-muted outline-none transition focus:border-accent"
                  style={{ minHeight: "180px" }}
                  onChange={(e) => handlePastedDocument(e.target.value)}
                  onFocus={handlePasteIntent}
                  placeholder="Paste document text here…"
                  value={documentText}
                />
              )}

              {uploadProgresses.length > 0 && (
                <UploadProgressList files={uploadProgresses} />
              )}

              {uploadProgresses.length === 0 && (
                <input
                  ref={fileInputRef}
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  multiple
                  onChange={handleFileChange}
                  type="file"
                />
              )}

              {error && (
                <div
                  className="mt-3 flex gap-2 rounded-[11px] border p-3 text-[13px]"
                  style={{
                    borderColor: "color-mix(in oklab, var(--danger) 30%, transparent)",
                    background: "color-mix(in oklab, var(--danger) 8%, transparent)",
                    color: "var(--danger)",
                  }}
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-[12px] bg-accent text-on-accent text-[13.5px] font-semibold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  height: "44px",
                  boxShadow: "0 1px 2px color-mix(in oklab, var(--accent) 40%, transparent)",
                }}
                disabled={isAnalyzing || isExtracting || !hasDocument}
                onClick={handleAnalyze}
                type="button"
              >
                {isAnalyzing && <Loader2 className="size-4 animate-spin" />}
                Process document
              </button>

              {/* Preview pills */}
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                <SectionPill color="accent" label="Summary" />
                <SectionPill color="ok" label="Key Points" />
                <SectionPill color="danger" label="Risks & Actions" />
              </div>
            </div>
          </div>
        ) : (
          /* ── LOADED STATE ─────────────────────────────────────────── */
          <>
            {/* Intake strip */}
            <div
              className="flex items-center gap-3.5 rounded-panel bg-panel border border-border shadow-card shrink-0"
              style={{ padding: "14px 18px" }}
            >
              <div
                className="size-[38px] shrink-0 flex items-center justify-center rounded-[10px]"
                style={{ background: "color-mix(in oklab, var(--accent) 10%, transparent)" }}
              >
                <FileText className="size-5 text-accent" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-text truncate">{documentHeaderTitle}</p>
                <p className="font-mono text-[10px] font-medium text-muted tracking-[0.03em] mt-0.5">
                  {documentHeaderSubtitle}
                </p>
              </div>

              {activeDocuments.length > 0 && (
                <div className="relative shrink-0 order-[5]" ref={documentsMenuRef}>
                  <button
                    className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
                    onClick={() => setShowDocumentsMenu((current) => !current)}
                    type="button"
                    aria-expanded={showDocumentsMenu}
                    aria-haspopup="menu"
                  >
                    <FileText className="size-3.5" />
                    Documents
                    <ChevronDown
                      className={`size-3 transition ${showDocumentsMenu ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showDocumentsMenu && (
                    <div
                      className="absolute right-0 top-[calc(100%+8px)] z-30 w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[14px] border border-border bg-panel shadow-card"
                      role="menu"
                    >
                      <div className="border-b border-border px-3.5 py-3">
                        <p className="text-[13px] font-bold text-text">
                          Documents in this workspace
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] font-medium text-muted">
                          {activeDocuments.length} {activeDocuments.length === 1 ? "document" : "documents"} · {documentCharTotal.toLocaleString()} characters
                        </p>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto p-1.5">
                        {activeDocuments.map((document, index) => (
                          <div
                            className="flex items-start gap-2 rounded-[10px] px-2.5 py-2 text-left"
                            key={`${document.fileName}-${index}`}
                            role="menuitem"
                          >
                            <span
                              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px] font-mono text-[10px] font-bold"
                              style={{
                                background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                                color: "var(--accent)",
                              }}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold text-text">
                                {document.fileName}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] text-muted">
                                {document.text.trim().length.toLocaleString()} characters
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasAnalysis && (
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold shrink-0"
                  style={{
                    color: "var(--ok)",
                    background: "color-mix(in oklab, var(--ok) 12%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--ok) 25%, transparent)",
                  }}
                >
                  <span className="size-1.5 rounded-full bg-ok" />
                  Processed
                </span>
              )}

              {error && (
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium shrink-0" style={{ color: "var(--danger)" }}>
                  <AlertCircle className="size-3.5" />
                  {error}
                </span>
              )}

              {notice && !error && (
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium shrink-0" style={{ color: "var(--warning)" }}>
                  <AlertCircle className="size-3.5" />
                  {notice}
                </span>
              )}

              <button
                className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent shrink-0 disabled:opacity-50"
                disabled={isAnalyzing || isExtracting}
                onClick={handleAnalyze}
                type="button"
              >
                {isAnalyzing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Run
              </button>

              <button
                className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent shrink-0 order-[6] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isExtracting || uploadProgresses.length > 0}
                onClick={handleBrowseFiles}
                type="button"
              >
                <Plus className="size-3.5" />
                Add
              </button>

              {uploadProgresses.length === 0 && (
                <input
                  ref={fileInputRef}
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  multiple
                  onChange={handleFileChange}
                  type="file"
                />
              )}
            </div>

            {uploadProgresses.length > 0 && (
              <UploadProgressList files={uploadProgresses} compact />
            )}

            {/* Workspace + Chat */}
            <div className="flex flex-1 min-h-0" style={{ gap: "var(--gap)" }}>

              {/* ── REVIEW WORKSPACE ──────────────────────────────── */}
              <div
                className="flex-1 min-w-0 flex flex-col bg-panel rounded-panel border border-border shadow-card overflow-hidden"
              >
                {/* Panel header */}
                <div
                  className="flex items-center justify-between border-b border-border shrink-0"
                  style={{ padding: "var(--header-py) var(--pad)" }}
                >
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold text-text truncate">{workspaceTitle}</h2>
                    <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted mt-0.5">
                      Review Workspace
                    </p>
                  </div>
                  <div className="relative shrink-0" ref={analysisExportMenuRef}>
                    <button
                      className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!hasAnalysis || isAnalyzing}
                      onClick={() => setShowAnalysisExportMenu((current) => !current)}
                      type="button"
                      aria-expanded={showAnalysisExportMenu}
                      aria-haspopup="menu"
                    >
                      <Download className="size-3.5" />
                      Export
                      <ChevronDown
                        className={`size-3 transition ${showAnalysisExportMenu ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showAnalysisExportMenu && (
                      <div
                        className="absolute right-0 top-[calc(100%+8px)] z-30 w-[180px] overflow-hidden rounded-[12px] border border-border bg-panel p-1.5 shadow-card"
                        role="menu"
                      >
                        <button
                          className="flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold text-text-muted transition hover:bg-inset hover:text-text"
                          onClick={exportAnalysisPdf}
                          role="menuitem"
                          type="button"
                        >
                          PDF
                          <span className="font-mono text-[9px] text-muted">.pdf</span>
                        </button>
                        <button
                          className="flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold text-text-muted transition hover:bg-inset hover:text-text"
                          onClick={exportAnalysisJson}
                          role="menuitem"
                          type="button"
                        >
                          JSON
                          <span className="font-mono text-[9px] text-muted">.json</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-border shrink-0">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isRisks = tab.id === "risksActions";
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        type="button"
                        className={`relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold transition ${
                          isActive ? "text-text" : "text-muted hover:text-text-muted"
                        }`}
                      >
                        {tab.label}
                        {isRisks && riskCount > 0 && hasAnalysis && (
                          <span
                            className="rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-on-accent bg-danger"
                          >
                            {riskCount}
                          </span>
                        )}
                        {isActive && (
                          <span
                            className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full"
                            style={{ background: tabColors[tab.id] }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto"
                  style={{ padding: "var(--pad)" }}
                >
                  {activeTab === "summary" ? (
                    <SummaryContent content={currentContent} isLoading={isAnalyzing} />
                  ) : activeTab === "keyPoints" ? (
                    <KeyPointsList content={currentContent} isLoading={isAnalyzing} />
                  ) : (
                    <RisksList content={currentContent} isLoading={isAnalyzing} />
                  )}
                </div>
              </div>

              {/* ── CHAT PANEL ────────────────────────────────────── */}
              <div
                className="w-[396px] shrink-0 flex flex-col bg-panel rounded-panel border border-border shadow-card overflow-hidden"
              >
                {/* Chat header */}
                <div
                  className="flex items-center justify-between border-b border-border shrink-0"
                  style={{ padding: "var(--header-py) var(--pad)" }}
                >
                  <div>
                    <h2 className="text-[15px] font-bold text-text">Document chat</h2>
                    <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted mt-0.5">
                      Grounded in this document
                    </p>
                  </div>
                  <div className="relative" ref={chatExportMenuRef}>
                    <button
                      className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!hasChatMessages || isAnswering}
                      onClick={() => setShowChatExportMenu((current) => !current)}
                      type="button"
                      aria-expanded={showChatExportMenu}
                      aria-haspopup="menu"
                    >
                      <Download className="size-3.5" />
                      Export
                      <ChevronDown
                        className={`size-3 transition ${showChatExportMenu ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showChatExportMenu && (
                      <div
                        className="absolute right-0 top-[calc(100%+8px)] z-30 w-[180px] overflow-hidden rounded-[12px] border border-border bg-panel p-1.5 shadow-card"
                        role="menu"
                      >
                        <button
                          className="flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold text-text-muted transition hover:bg-inset hover:text-text"
                          onClick={exportChat}
                          role="menuitem"
                          type="button"
                        >
                          PDF
                          <span className="font-mono text-[9px] text-muted">.pdf</span>
                        </button>
                        <button
                          className="flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12.5px] font-semibold text-text-muted transition hover:bg-inset hover:text-text"
                          onClick={exportChatJson}
                          role="menuitem"
                          type="button"
                        >
                          JSON
                          <span className="font-mono text-[9px] text-muted">.json</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {hasChatMessages && (
                  <div className="border-b border-border px-[var(--pad)] py-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                      <input
                        ref={chatHistorySearchInputRef}
                        className="w-full rounded-[10px] bg-inset border border-border pl-8 pr-3 text-[12.5px] text-text placeholder:text-muted outline-none transition focus:border-accent"
                        style={{ height: "32px" }}
                        onChange={(e) => setChatHistorySearch(e.target.value)}
                        placeholder="Search conversation history"
                        value={chatHistorySearch}
                      />
                    </div>
                    {chatHistorySearch.trim() && (
                      <p className="mt-1.5 font-mono text-[9.5px] text-muted">
                        {visibleChatMessages.length} of {activeChat?.messages.length ?? 0} messages
                      </p>
                    )}
                  </div>
                )}

                {/* Messages */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3.5"
                  ref={chatScrollRef}
                  style={{ padding: "var(--pad)" }}
                >
                  {activeChat?.messages.length ? (
                    visibleChatMessages.length ? (
                      visibleChatMessages.map((message) => (
                      <ChatBubble
                        key={message.id}
                        message={message}
                        isStreaming={
                          isAnswering &&
                          message.role === "assistant" &&
                          message.id === activeChat.messages[activeChat.messages.length - 1]?.id
                        }
                      />
                      ))
                    ) : (
                      <EmptyChatSearchState />
                    )
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                      <div
                        className="size-12 flex items-center justify-center rounded-[14px]"
                        style={{ background: "color-mix(in oklab, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                      >
                        <MessageCircle className="size-6" />
                      </div>
                      <h3 className="mt-3 text-[13.5px] font-semibold text-text">No conversation yet</h3>
                      <p className="mt-1.5 max-w-[220px] text-[12.5px] leading-5 text-muted">
                        Ask a question and the answer will be grounded in the loaded document.
                      </p>
                    </div>
                  )}
                </div>

                {/* Composer */}
                <form
                  ref={questionFormRef}
                  className="border-t border-border shrink-0"
                  style={{ padding: "12px var(--pad)" }}
                  onSubmit={handleQuestion}
                >
                  <div className="flex items-center gap-2">
                    <input
                      ref={questionInputRef}
                      aria-invalid={isQuestionOverLimit}
                      className="flex-1 min-w-0 rounded-[11px] bg-inset border border-border px-3.5 text-[13px] text-text placeholder:text-muted outline-none transition focus:border-accent"
                      style={{
                        height: "var(--control-h)",
                        borderColor: isQuestionOverLimit ? "var(--danger)" : undefined,
                      }}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                          event.preventDefault();
                          questionFormRef.current?.requestSubmit();
                        }
                      }}
                      placeholder="Ask about this document..."
                      value={question}
                    />
                    <button
                      className="size-[34px] flex shrink-0 items-center justify-center rounded-[10px] bg-accent text-on-accent transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isAnswering || !hasDocument || isQuestionOverLimit}
                      type="submit"
                    >
                      {isAnswering ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[9.5px]">
                    <span className="text-muted">Ctrl+Enter to send</span>
                    <span style={{ color: isQuestionOverLimit ? "var(--danger)" : "var(--muted)" }}>
                      {questionLength.toLocaleString()} / {QUESTION_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── LOGIN MODAL (soft-auth) ──────────────────────────────────── */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in oklab, var(--bg) 55%, transparent)", backdropFilter: "blur(3px)" }}
          onClick={closeAuthModal}
        >
          <div className="w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center text-[13px] text-text-muted">
              Sign in or create an account to use this feature.
            </p>
            <AuthForm onSuccess={handleAuthSuccess} onClose={closeAuthModal} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function WorkspaceBootScreen() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text" aria-label="Loading workspace">
      <aside
        className="w-[252px] shrink-0 flex flex-col bg-sidebar border-r border-border overflow-hidden"
        style={{ padding: "18px 14px" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="size-[30px] shrink-0 rounded-[9px] bg-accent" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton-line h-3.5 w-36" />
            <div className="skeleton-line h-2.5 w-20" />
          </div>
        </div>
        <div className="skeleton-line mt-4 h-[38px] w-full rounded-[12px]" />
        <div className="skeleton-line mt-3 h-[34px] w-full rounded-[10px]" />
        <div className="mt-5 space-y-2">
          <div className="skeleton-line h-3 w-16" />
          <div className="skeleton-line h-[52px] w-full rounded-[11px]" />
          <div className="skeleton-line h-[52px] w-full rounded-[11px]" />
        </div>
        <div className="mt-auto space-y-3 border-t border-border pt-3">
          <div className="skeleton-line h-2 w-full" />
          <div className="skeleton-line h-8 w-full rounded-[10px]" />
          <div className="skeleton-line h-9 w-full rounded-[10px]" />
        </div>
      </aside>
      <main
        className="flex-1 min-w-0 flex flex-col"
        style={{ gap: "var(--gap)", padding: "var(--pad)" }}
      >
        <div className="rounded-panel bg-panel border border-border shadow-card" style={{ padding: "18px" }}>
          <div className="skeleton-line h-4 w-44" />
          <div className="skeleton-line mt-2 h-2.5 w-28" />
        </div>
        <div className="flex flex-1 min-h-0" style={{ gap: "var(--gap)" }}>
          <div className="flex-1 rounded-panel bg-panel border border-border shadow-card p-5">
            <div className="skeleton-line h-5 w-56" />
            <div className="skeleton-line mt-4 h-3 w-11/12" />
            <div className="skeleton-line mt-3 h-3 w-full" />
            <div className="skeleton-line mt-3 h-3 w-9/12" />
          </div>
          <div className="w-[396px] rounded-panel bg-panel border border-border shadow-card p-5">
            <div className="skeleton-line h-5 w-36" />
            <div className="skeleton-line mt-5 h-28 w-full rounded-[14px]" />
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionPill({ color, label }: { color: "accent" | "ok" | "danger"; label: string }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.07em]"
      style={{
        color: `var(--${color})`,
        background: `color-mix(in oklab, var(--${color}) 10%, transparent)`,
        border: `1px solid color-mix(in oklab, var(--${color}) 22%, transparent)`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: `var(--${color})` }}
      />
      {label}
    </span>
  );
}

function UploadReceivedState() {
  return (
    <div
      className="mt-4 w-full flex flex-col items-center justify-center rounded-[14px] border border-border bg-inset p-10 text-center"
      aria-live="polite"
    >
      <div
        className="flex size-12 items-center justify-center rounded-[12px]"
        style={{
          background: "color-mix(in oklab, var(--accent) 12%, transparent)",
          color: "var(--accent)",
        }}
      >
        <Loader2 className="size-6 animate-spin" />
      </div>
      <p className="mt-3 text-[13.5px] font-semibold text-text">File received</p>
      <p className="mt-1.5 max-w-[260px] text-[12.5px] leading-5 text-muted">
        Preparing the document for analysis.
      </p>
    </div>
  );
}

function UploadProgressList({
  files,
  compact = false,
}: {
  files: UploadProgress[];
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[12px] border border-border bg-inset ${compact ? "px-3 py-2" : "mt-3 p-3"}`}
    >
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.fileName}>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[12px] font-semibold text-text">
                {file.fileName}
              </span>
              <span
                className="shrink-0 font-mono text-[9.5px] font-semibold"
                style={{
                  color:
                    file.status === "Error"
                      ? "var(--danger)"
                      : file.status === "Ready"
                        ? "var(--ok)"
                        : "var(--muted)",
                }}
              >
                {file.status}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${file.progress}%`,
                  background:
                    file.status === "Error"
                      ? "var(--danger)"
                      : file.status === "Ready"
                        ? "var(--ok)"
                        : "var(--accent)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChatSearchState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
      <Search className="size-5 text-muted" />
      <h3 className="mt-3 text-[13.5px] font-semibold text-text">No matching messages</h3>
      <p className="mt-1.5 max-w-[220px] text-[12.5px] leading-5 text-muted">
        Try another word from this conversation.
      </p>
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-5 top-5 z-[60] flex w-[320px] max-w-[calc(100vw-32px)] flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className="fade-in-up rounded-[13px] border bg-panel px-3.5 py-3 text-left shadow-card transition hover:-translate-y-0.5"
          style={{
            borderColor: `color-mix(in oklab, var(--${toast.tone === "error" ? "danger" : toast.tone === "success" ? "ok" : "accent"}) 28%, transparent)`,
          }}
          onClick={() => onDismiss(toast.id)}
          type="button"
        >
          <p className="text-[12.5px] font-semibold text-text">{toast.message}</p>
          <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted">
            Click to dismiss
          </p>
        </button>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

// Renders a small subset of inline markdown (**bold**, *italic*, `code`) that the
// model sometimes emits, so it doesn't show up as literal asterisks.
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-inset px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function ChatBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold mt-1"
          style={{
            background: "color-mix(in oklab, var(--accent) 14%, transparent)",
            color: "var(--accent)",
          }}
        >
          AI
        </div>
      )}
      <div
        className="max-w-[86%] rounded-[14px] px-3.5 py-2.5 text-[13px] leading-[1.6]"
        style={
          isUser
            ? { background: "var(--accent)", color: "var(--on-accent)", borderRadius: "14px 14px 5px 14px" }
            : { background: "var(--inset)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "14px 14px 14px 5px" }
        }
      >
        {message.content ? (
          <p className="whitespace-pre-wrap">
            {renderInline(message.content)}
            {isStreaming && <StreamingCursor />}
          </p>
        ) : (
          <TypingDots />
        )}
      </div>
      {isUser && (
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full mt-1"
          style={{ background: "color-mix(in oklab, var(--muted) 16%, transparent)", color: "var(--muted)" }}
        >
          <UserRound className="size-3.5" />
        </div>
      )}
    </div>
  );
}

// ── Pure helpers ───────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

async function streamFromApi(
  url: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    received += chunk;
    onChunk(chunk);
  }
  if (!received.trim()) {
    throw new Error("The analysis finished without returning text. Please try again.");
  }
}

function hasMeaningfulChat(chat: ChatSession) {
  return Boolean(
    chat.documentText.trim() || chat.messages.length || chat.documentName !== "No document loaded",
  );
}

// The chat's display name: the user-set title if any, otherwise the first
// document's name, otherwise a placeholder. Independent of the document files.
function chatDisplayName(chat: ChatSession) {
  if (chat.title.trim()) return chat.title;
  if (chat.documents?.length) return chat.documents[0].fileName;
  if (chat.documentName && chat.documentName !== "No document loaded") return chat.documentName;
  return "Untitled document";
}

function getChatPreview(chat: ChatSession) {
  const first = chat.messages.find((m) => m.role === "user");
  if (first?.content.trim()) return `"${first.content.trim()}"`;
  if (chat.documentText.trim()) return "Ready for review";
  return "Draft document";
}

function formatRelativeTime(value: string) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "Recently";
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const mins = Math.floor(diff / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (diff < 60) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ts);
}

function createChatSession(documentName = "No document loaded", documentText = ""): ChatSession {
  const now = new Date().toISOString();
  const documents = documentText ? [{ fileName: documentName, text: documentText }] : [];
  return { id: createId(), title: "", documentName, documentText, documents, analysis: "", messages: [], createdAt: now, updatedAt: now };
}

// Returns the documents already attached to a session, falling back to a single
// part derived from its combined text (covers pasted docs and legacy sessions).
function currentDocuments(session?: ChatSession): DocumentPart[] {
  if (session?.documents?.length) return session.documents;
  if (session?.documentText.trim()) {
    return [{ fileName: session.documentName, text: session.documentText }];
  }
  return [];
}

function mergeDocumentParts(existing: DocumentPart[], incoming: DocumentPart[]) {
  const merged = [...existing];
  const seen = new Set(existing.map(documentKey));
  let duplicateCount = 0;

  incoming.forEach((document) => {
    const key = documentKey(document);
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    merged.push(document);
  });

  return { documents: merged, duplicateCount };
}

function mergeDocumentText(documents: DocumentPart[]) {
  return documents
    .map((document, index) => `Document ${index + 1}: ${document.fileName}\n\n${document.text}`)
    .join("\n\n---\n\n");
}

function documentSetName(documents: DocumentPart[]) {
  if (!documents.length) return "No document loaded";
  if (documents.length === 1) return documents[0].fileName;
  const visible = documents.slice(0, 2).map((d) => d.fileName).join(", ");
  const rest = documents.length - 2;
  return rest > 0
    ? `${documents.length} documents: ${visible} +${rest}`
    : `${documents.length} documents: ${visible}`;
}

function buildSelectedFilesLabel(files: File[]) {
  if (files.length === 1) return files[0].name;
  const visible = files.slice(0, 2).map((f) => f.name).join(", ");
  const rest = files.length - 2;
  return rest > 0 ? `${files.length} documents: ${visible} +${rest}` : `${files.length} documents: ${visible}`;
}

function buildDuplicateDocumentNotice(duplicateCount: number, uploadedCount: number) {
  if (duplicateCount === uploadedCount) {
    return duplicateCount === 1
      ? "This document is already attached to this chat."
      : "These documents are already attached to this chat.";
  }

  return duplicateCount === 1
    ? "1 document was already attached and was skipped."
    : `${duplicateCount} documents were already attached and were skipped.`;
}

function documentKey(document: DocumentPart) {
  return `${document.fileName}\u0000${document.text}`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


// ── Database sync ──────────────────────────────────────────────────────

async function fetchChats(): Promise<ChatSession[]> {
  const response = await fetch("/api/chats", { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load chats");
  const payload = (await response.json()) as { chats?: ChatSession[] };
  return Array.isArray(payload.chats) ? payload.chats : [];
}

async function saveChat(
  chat: ChatSession,
  options: { forceDocumentUpdate?: boolean } = {},
) {
  try {
    const response = await fetch(`/api/chats/${chat.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(options.forceDocumentUpdate ? { "X-Document-Update": "true" } : {}),
      },
      body: JSON.stringify(chat),
    });
    return response.ok;
  } catch {
    // best-effort: the next change re-attempts the sync
    return false;
  }
}

async function deleteChatRemote(chatId: string) {
  try {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
  } catch {
    // best-effort
  }
}

// Stable JSON fingerprint used to detect chats that need re-syncing.
function serializeChat(chat: ChatSession) {
  return JSON.stringify({
    title: chat.title,
    documentName: chat.documentName,
    documentText: chat.documentText,
    documents: chat.documents,
    analysis: chat.analysis,
    messages: chat.messages,
  });
}

function formatTokens(value: number) {
  if (value >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(Math.max(0, value));
}

