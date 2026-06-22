"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeBullets, parseAnalysisSections } from "@/lib/analysis";

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

type ChatSession = {
  id: string;
  title: string;
  documentName: string;
  documentText: string;
  analysis: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const CHAT_STORAGE_KEY = "ai-document-analyzer-chats-v1";
const THEME_STORAGE_KEY = "diw:theme";

const tabs: Array<{ id: ResultTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "keyPoints", label: "Key Points" },
  { id: "risksActions", label: "Risks & Actions" },
];

export default function Home() {
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("upload");
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("No document loaded");
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");
  const [question, setQuestion] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [openChatMenuId, setOpenChatMenuId] = useState("");
  const [renamingChatId, setRenamingChatId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [draftDocumentId, setDraftDocumentId] = useState("");
  const [hasLoadedChats, setHasLoadedChats] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => parseAnalysisSections(rawAnalysis), [rawAnalysis]);
  const currentContent = sections[activeTab];
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [activeChatId, chats],
  );
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
    const query = chatSearch.trim().toLowerCase();
    if (!query) return documentChats;
    return documentChats.filter((chat) =>
      [chat.documentName, chat.title, getChatPreview(chat)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [chatSearch, documentChats]);

  const hasDocument = Boolean(documentText.trim());
  const hasAnalysis = Boolean(rawAnalysis.trim());
  const hasChatMessages = Boolean(activeChat?.messages.length);
  const isDarkTheme = themeMode === "dark";
  const riskCount = sections.risksActions ? normalizeBullets(sections.risksActions).length : 0;

  const analysisExport = useMemo(
    () => buildAnalysisExport(documentName, sections, rawAnalysis),
    [documentName, rawAnalysis, sections],
  );
  const chatExport = useMemo(() => buildChatExport(activeChat), [activeChat]);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as ChatSession[]) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validChats = parsed.filter(isChatSession).filter(hasMeaningfulChat);
        const firstChat = validChats[0];
        if (firstChat) {
          setChats(validChats);
          setActiveChatId(firstChat.id);
          setDocumentName(firstChat.documentName);
          setDocumentText(firstChat.documentText);
          setRawAnalysis(firstChat.analysis ?? "");
          setIntakeMode(firstChat.documentText ? "paste" : "upload");
          setHasLoadedChats(true);
          return;
        }
      }
    } catch {
      // ignore invalid localStorage
    }
    const initialChat = createChatSession();
    setChats([initialChat]);
    setActiveChatId(initialChat.id);
    setHasLoadedChats(true);
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

  // Persist sessions
  useEffect(() => {
    if (!hasLoadedChats) return;
    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(chats.filter(hasMeaningfulChat)),
    );
  }, [chats, hasLoadedChats]);

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

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setError("");
    setIsExtracting(true);
    setDocumentName(buildSelectedFilesLabel(files));

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/extract", { method: "POST", body: formData });
      const payload = (await response.json()) as {
        fileName?: string;
        text?: string;
        error?: string;
      };
      if (!response.ok || !payload.text) {
        throw new Error(payload.error || "Could not extract text from the documents.");
      }
      setDocumentText(payload.text);
      setRawAnalysis("");
      attachDocumentToActiveChat(payload.fileName ?? buildSelectedFilesLabel(files), payload.text);
      setDraftDocumentId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Document upload failed.");
    } finally {
      setIsExtracting(false);
      if (event.target) event.target.value = "";
    }
  }

  async function handleAnalyze() {
    if (!documentText.trim()) {
      setError("Upload or paste a document before running analysis.");
      return;
    }
    const session = activeChat ?? createAndActivateChat(documentName, documentText);
    setError("");
    setRawAnalysis("");
    updateChat(session.id, (chat) => ({
      ...chat,
      analysis: "",
      updatedAt: new Date().toISOString(),
    }));
    setIsAnalyzing(true);
    try {
      await streamFromApi(
        "/api/analyze",
        { mode: "analysis", documentText },
        (chunk) => {
          setRawAnalysis((prev) => prev + chunk);
          appendAnalysisChunk(session.id, chunk);
        },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleQuestion(event: FormEvent<HTMLFormElement>) {
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
      title: chat.messages.length ? chat.title : buildChatTitle(trimmedQuestion),
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
    }
  }

  function handlePastedDocument(nextText: string) {
    setDocumentText(nextText);
    setDocumentName("pasted-document.txt");
    attachDocumentToActiveChat("pasted-document.txt", nextText);
    setDraftDocumentId("");
  }

  function createAndActivateChat(
    nextDocumentName = "No document loaded",
    nextDocumentText = "",
  ) {
    const nextChat = createChatSession(nextDocumentName, nextDocumentText);
    setChats((prev) => [nextChat, ...prev.filter(hasMeaningfulChat)]);
    setActiveChatId(nextChat.id);
    setDraftDocumentId(hasMeaningfulChat(nextChat) ? "" : nextChat.id);
    setDocumentName(nextDocumentName);
    setDocumentText(nextDocumentText);
    setIntakeMode(nextDocumentText ? "paste" : "upload");
    setRawAnalysis("");
    setQuestion("");
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setError("");
    return nextChat;
  }

  function selectChat(chat: ChatSession) {
    setActiveChatId(chat.id);
    setDraftDocumentId(chat.id === draftDocumentId ? draftDocumentId : "");
    setDocumentName(chat.documentName);
    setDocumentText(chat.documentText);
    setRawAnalysis(chat.analysis ?? "");
    setIntakeMode(chat.documentText ? "paste" : "upload");
    setQuestion("");
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setError("");
  }

  function toggleChatMenu(chatId: string) {
    setRenamingChatId("");
    setRenameDraft("");
    setOpenChatMenuId((cur) => (cur === chatId ? "" : chatId));
  }

  function startRenamingChat(chat: ChatSession) {
    setRenamingChatId(chat.id);
    setRenameDraft(getChatDocumentLabel(chat));
    setOpenChatMenuId("");
  }

  function cancelRename() {
    setRenamingChatId("");
    setRenameDraft("");
  }

  function saveRename(chatId: string) {
    const nextName = renameDraft.trim();
    if (!nextName) { cancelRename(); return; }
    updateChat(chatId, (chat) => ({
      ...chat,
      documentName: nextName,
      updatedAt: new Date().toISOString(),
    }));
    setDraftDocumentId("");
    if (chatId === activeChatId) setDocumentName(nextName);
    cancelRename();
  }

  function deleteChat(chatId: string) {
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setDraftDocumentId("");
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

  async function exportAnalysis() {
    await downloadPdf(
      analysisExport,
      `${toFileSlug(documentName)}-analysis.pdf`,
      "Document Intelligence Review",
    );
  }

  async function exportChat() {
    await downloadPdf(
      chatExport,
      `${toFileSlug(activeChat?.title ?? documentName)}-chat.pdf`,
      "Document Export",
    );
  }

  function attachDocumentToActiveChat(nextName: string, nextText: string) {
    if (!activeChatId) return;
    updateChat(activeChatId, (chat) => ({
      ...chat,
      documentName: nextName,
      documentText: nextText,
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
            <Sparkles className="size-[15px] text-on-accent" />
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
          onClick={() => createAndActivateChat()}
          type="button"
        >
          <Plus className="size-4" />
          New document
        </button>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
          <input
            className="w-full rounded-[10px] bg-inset border border-border pl-8 pr-3 text-[13px] text-text placeholder:text-muted outline-none transition focus:border-accent focus:ring-2"
            style={{ height: "34px", "--tw-ring-color": "color-mix(in oklab, var(--accent) 18%, transparent)" } as React.CSSProperties}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Search documents"
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
                          {getChatDocumentLabel(chat)}
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

        {/* Footer: avatar + theme toggle */}
        <div className="border-t border-border pt-3 mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="size-7 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: "color-mix(in oklab, var(--calm) 14%, transparent)", color: "var(--calm)" }}
            >
              <UserRound className="size-3.5" />
            </div>
            <span className="text-[12.5px] font-medium text-text truncate">User</span>
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
                <button
                  className="mt-4 w-full flex flex-col items-center justify-center rounded-[14px] p-10 text-center transition hover:opacity-90 disabled:cursor-not-allowed"
                  style={{
                    border: "1.5px dashed color-mix(in oklab, var(--accent) 45%, transparent)",
                    background: "color-mix(in oklab, var(--accent) 7%, transparent)",
                  }}
                  disabled={isExtracting}
                  onClick={() => fileInputRef.current?.click()}
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
                    ) : (
                      <>
                        Drag & drop, or{" "}
                        <span className="text-accent">browse</span>
                      </>
                    )}
                  </span>
                  <span className="mt-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
                    PDF · TXT · MD — up to 8 MB
                  </span>
                </button>
              ) : (
                <textarea
                  className="mt-4 w-full resize-y rounded-[11px] border border-border bg-inset px-3.5 py-3 text-[13.5px] leading-relaxed text-text placeholder:text-muted outline-none transition focus:border-accent"
                  style={{ minHeight: "180px" }}
                  onChange={(e) => handlePastedDocument(e.target.value)}
                  placeholder="Paste document text here…"
                  value={documentText}
                />
              )}

              <input
                ref={fileInputRef}
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                className="hidden"
                multiple
                onChange={handleFileChange}
                type="file"
              />

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
                <SectionPill color="calm" label="Key Points" />
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
                <p className="text-[13.5px] font-semibold text-text truncate">{documentName}</p>
                <p className="font-mono text-[10px] font-medium text-muted tracking-[0.03em] mt-0.5">
                  {documentText.trim().length.toLocaleString()} characters
                </p>
              </div>

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
                Re-run
              </button>

              <button
                className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent shrink-0"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Plus className="size-3.5" />
                Add
              </button>

              <input
                ref={fileInputRef}
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                className="hidden"
                multiple
                onChange={handleFileChange}
                type="file"
              />
            </div>

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
                    <h2 className="text-[17px] font-bold text-text truncate">{documentName}</h2>
                    <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted mt-0.5">
                      Review Workspace
                    </p>
                  </div>
                  <button
                    className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    disabled={!hasAnalysis || isAnalyzing}
                    onClick={exportAnalysis}
                    type="button"
                  >
                    <Download className="size-3.5" />
                    Export PDF
                  </button>
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
                            style={{ background: isRisks ? "var(--danger)" : "var(--accent)" }}
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
                    currentContent ? (
                      <p className="fade-in-up whitespace-pre-wrap text-[15px] leading-[1.62] text-text">
                        {currentContent}
                        {isAnalyzing && <StreamingCursor />}
                      </p>
                    ) : isAnalyzing ? (
                      <SkeletonLines />
                    ) : (
                      <EmptyTabState />
                    )
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
                  <button
                    className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!hasChatMessages || isAnswering}
                    onClick={exportChat}
                    type="button"
                  >
                    <Download className="size-3.5" />
                    PDF
                  </button>
                </div>

                {/* Messages */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3.5"
                  ref={chatScrollRef}
                  style={{ padding: "var(--pad)" }}
                >
                  {activeChat?.messages.length ? (
                    activeChat.messages.map((message, index) => (
                      <ChatBubble
                        key={message.id}
                        message={message}
                        isStreaming={
                          isAnswering &&
                          message.role === "assistant" &&
                          index === activeChat.messages.length - 1
                        }
                      />
                    ))
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
                  className="border-t border-border shrink-0 flex items-center gap-2"
                  style={{ padding: "12px var(--pad)" }}
                  onSubmit={handleQuestion}
                >
                  <input
                    className="flex-1 min-w-0 rounded-[11px] bg-inset border border-border px-3.5 text-[13px] text-text placeholder:text-muted outline-none transition focus:border-accent"
                    style={{ height: "var(--control-h)" }}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about this document…"
                    value={question}
                  />
                  <button
                    className="size-[34px] flex shrink-0 items-center justify-center rounded-[10px] bg-accent text-on-accent transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isAnswering || !hasDocument}
                    type="submit"
                  >
                    {isAnswering ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionPill({ color, label }: { color: "accent" | "calm" | "danger"; label: string }) {
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

function KeyPointsList({ content, isLoading }: { content: string; isLoading: boolean }) {
  const bullets = normalizeBullets(content);
  if (!bullets.length) {
    return isLoading ? <SkeletonLines /> : <EmptyTabState />;
  }
  return (
    <ul className="fade-in-up space-y-2">
      {bullets.map((bullet, index) => (
        <li
          key={bullet}
          className="flex items-start gap-3 rounded-[11px] border border-border"
          style={{ padding: "10px 14px", background: "var(--inset)" }}
        >
          <span
            className="shrink-0 mt-[1px] rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.07em]"
            style={{
              color: "var(--accent)",
              background: "color-mix(in oklab, var(--accent) 10%, transparent)",
              border: "1px solid color-mix(in oklab, var(--accent) 22%, transparent)",
            }}
          >
            Key
          </span>
          <span className="text-[13px] leading-[1.5] text-text flex-1 min-w-0">
            {bullet}
            {isLoading && index === bullets.length - 1 && <StreamingCursor />}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RisksList({ content, isLoading }: { content: string; isLoading: boolean }) {
  const bullets = normalizeBullets(content);
  if (!bullets.length) {
    return isLoading ? <SkeletonLines /> : <EmptyTabState />;
  }
  return (
    <ul className="fade-in-up space-y-2">
      {bullets.map((bullet, index) => (
        <li
          key={bullet}
          className="flex items-start gap-0 rounded-[11px] border overflow-hidden"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 22%, transparent)",
            background: "color-mix(in oklab, var(--danger) 5%, transparent)",
          }}
        >
          <span
            className="w-1 shrink-0 self-stretch"
            style={{ background: "var(--danger)" }}
          />
          <span className="flex items-start gap-2.5 flex-1 min-w-0 px-3.5 py-2.5">
            <CheckCircle2
              className="size-4 shrink-0 mt-[2px]"
              style={{ color: "var(--danger)" }}
            />
            <span className="text-[13px] leading-[1.5] text-text">
              {bullet}
              {isLoading && index === bullets.length - 1 && <StreamingCursor />}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function EmptyTabState() {
  return (
    <p className="text-[13.5px] text-muted">
      Run an analysis to populate this section.
    </p>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-3" aria-label="Loading content">
      <div className="skeleton-line w-11/12" />
      <div className="skeleton-line w-full" />
      <div className="skeleton-line w-9/12" />
      <div className="skeleton-line w-7/12" />
    </div>
  );
}

function StreamingCursor() {
  return <span aria-hidden className="streaming-cursor" />;
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
            {message.content}
            {isStreaming && <StreamingCursor />}
          </p>
        ) : (
          <SkeletonLines />
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

function buildAnalysisExport(
  documentName: string,
  sections: ReturnType<typeof parseAnalysisSections>,
  rawAnalysis: string,
) {
  if (!rawAnalysis.trim()) return "";
  const generatedAt = new Date().toLocaleString();
  return `# Document Intelligence Review\n\nDocument: ${documentName}\nGenerated: ${generatedAt}\n\n## Summary\n\n${sections.summary || "No summary was generated."}\n\n## Key Points\n\n${formatMarkdownBullets(sections.keyPoints)}\n\n## Risks & Actions\n\n${formatMarkdownBullets(sections.risksActions)}\n`;
}

function buildChatExport(chat?: ChatSession) {
  if (!chat?.messages.length) return "";
  const generatedAt = new Date().toLocaleString();
  const messages = chat.messages
    .map((m) => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`)
    .join("\n\n");
  return `# Document Export\n\nDocument: ${chat.documentName}\nGenerated: ${generatedAt}\n\n${messages}\n`;
}

function formatMarkdownBullets(content: string) {
  const bullets = normalizeBullets(content);
  return bullets.length ? bullets.map((b) => `- ${b}`).join("\n") : "No items were generated.";
}

async function downloadPdf(content: string, fileName: string, title: string) {
  if (!content.trim()) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "pt" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;
  doc.setProperties({ title, subject: "Document Intelligence Workspace export", creator: "Document Intelligence Workspace" });
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) { y += 10; continue; }
    const style = getPdfLineStyle(line);
    const printableLine = line.replace(/^#{1,3}\s*/, "");
    doc.setFont("helvetica", style.weight);
    doc.setFontSize(style.size);
    const wrappedLines = doc.splitTextToSize(printableLine, maxWidth) as string[];
    const lineHeight = style.size + 6;
    const blockHeight = wrappedLines.length * lineHeight;
    if (y + blockHeight > pageHeight - margin) { doc.addPage(); y = margin; }
    for (const wl of wrappedLines) { doc.text(wl, margin, y); y += lineHeight; }
    y += style.after;
  }
  doc.save(fileName);
}

function getPdfLineStyle(line: string) {
  if (line.startsWith("# ")) return { size: 18, weight: "bold" as const, after: 8 };
  if (line.startsWith("## ")) return { size: 14, weight: "bold" as const, after: 6 };
  if (line.startsWith("### ")) return { size: 12, weight: "bold" as const, after: 4 };
  return { size: 10, weight: "normal" as const, after: 2 };
}

function hasMeaningfulChat(chat: ChatSession) {
  return Boolean(
    chat.documentText.trim() || chat.messages.length || chat.documentName !== "No document loaded",
  );
}

function getChatDocumentLabel(chat: ChatSession) {
  if (chat.documentName && chat.documentName !== "No document loaded") return chat.documentName;
  return chat.title === "New chat" ? "Untitled document" : chat.title;
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
  return { id: createId(), title: "Untitled document", documentName, documentText, analysis: "", messages: [], createdAt: now, updatedAt: now };
}

function buildSelectedFilesLabel(files: File[]) {
  if (files.length === 1) return files[0].name;
  const visible = files.slice(0, 2).map((f) => f.name).join(", ");
  const rest = files.length - 2;
  return rest > 0 ? `${files.length} documents: ${visible} +${rest}` : `${files.length} documents: ${visible}`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildChatTitle(question: string) {
  return question.length > 44 ? `${question.slice(0, 44)}…` : question;
}

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<ChatSession>;
  return Boolean(c.id && c.title && Array.isArray(c.messages));
}

function toFileSlug(value: string) {
  const slug = value
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}
