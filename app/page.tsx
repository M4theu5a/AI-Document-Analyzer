"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileSearch,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Workflow,
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
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const CHAT_STORAGE_KEY = "ai-document-analyzer-chats-v1";
const THEME_STORAGE_KEY = "ai-document-analyzer-theme-v1";

const tabs: Array<{ id: ResultTab; label: string; helper: string }> = [
  {
    id: "summary",
    label: "Summary",
    helper: "Executive-level explanation of what the document says.",
  },
  {
    id: "keyPoints",
    label: "Key Points",
    helper: "Facts, obligations, names, dates, values, and decisions.",
  },
  {
    id: "risksActions",
    label: "Risks & Actions",
    helper: "Follow-ups, missing data, risk signals, and next steps.",
  },
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
  const documentWorkspaceRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => parseAnalysisSections(rawAnalysis), [rawAnalysis]);
  const currentTab = tabs.find((tab) => tab.id === activeTab)!;
  const currentContent = sections[activeTab];
  const completionScore = [sections.summary, sections.keyPoints, sections.risksActions].filter(
    Boolean,
  ).length;
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [activeChatId, chats],
  );
  const recentChats = useMemo(
    () =>
      [...chats].sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
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

    if (!query) {
      return documentChats;
    }

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
  const analysisExport = useMemo(
    () => buildAnalysisExport(documentName, sections, rawAnalysis),
    [documentName, rawAnalysis, sections],
  );
  const chatExport = useMemo(() => buildChatExport(activeChat), [activeChat]);
  const isDarkTheme = themeMode === "dark";

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
          setIntakeMode(firstChat.documentText ? "paste" : "upload");
          setHasLoadedChats(true);
          return;
        }
      }
    } catch {
      // Ignore invalid localStorage and start with a fresh chat.
    }

    const initialChat = createChatSession();
    setChats([initialChat]);
    setActiveChatId(initialChat.id);
    setHasLoadedChats(true);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      setThemeMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedChats) {
      return;
    }

    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(chats.filter(hasMeaningfulChat)),
    );
  }, [chats, hasLoadedChats]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const workspace = documentWorkspaceRef.current;

    if (!workspace) {
      return;
    }

    workspace.scrollTo({
      top: workspace.scrollHeight,
      behavior: isAnswering ? "smooth" : "auto",
    });
  }, [activeChatId, activeChat?.messages.length, activeChat?.updatedAt, isAnswering]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    setError("");
    setIsExtracting(true);
    setDocumentName(buildSelectedFilesLabel(files));

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

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
    }
  }

  async function handleAnalyze() {
    if (!documentText.trim()) {
      setError("Upload documents or paste text before analysis.");
      return;
    }

    setError("");
    setRawAnalysis("");
    setIsAnalyzing(true);

    try {
      await streamFromApi(
        "/api/analyze",
        {
          mode: "analysis",
          documentText,
        },
        (chunk) => setRawAnalysis((previous) => previous + chunk),
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
      setError("Load a document before using the workspace.");
      return;
    }

    if (!trimmedQuestion) {
      setError("Write a prompt first.");
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
        {
          mode: "question",
          documentText,
          question: trimmedQuestion,
          chatHistory,
        },
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
    setChats((previous) => [nextChat, ...previous.filter(hasMeaningfulChat)]);
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
    setOpenChatMenuId((current) => (current === chatId ? "" : chatId));
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

    if (!nextName) {
      cancelRename();
      return;
    }

    updateChat(chatId, (chat) => ({
      ...chat,
      documentName: nextName,
      updatedAt: new Date().toISOString(),
    }));
    setDraftDocumentId("");

    if (chatId === activeChatId) {
      setDocumentName(nextName);
    }

    cancelRename();
  }

  function deleteChat(chatId: string) {
    setOpenChatMenuId("");
    setRenamingChatId("");
    setRenameDraft("");
    setDraftDocumentId("");

    setChats((previous) => {
      const remaining = previous.filter((chat) => chat.id !== chatId);

      if (remaining.length) {
        if (chatId === activeChatId) {
          const nextChat = remaining[0];
          setActiveChatId(nextChat.id);
          setDocumentName(nextChat.documentName);
          setDocumentText(nextChat.documentText);
          setIntakeMode(nextChat.documentText ? "paste" : "upload");
        }

        return remaining;
      }

      const nextChat = createChatSession();
      setActiveChatId(nextChat.id);
      setDocumentName(nextChat.documentName);
      setDocumentText(nextChat.documentText);
      setIntakeMode("upload");
      return [nextChat];
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
      `${toFileSlug(activeChat?.title ?? documentName)}-document-export.pdf`,
      "Document Export",
    );
  }

  function attachDocumentToActiveChat(nextDocumentName: string, nextDocumentText: string) {
    if (!activeChatId) {
      return;
    }

    updateChat(activeChatId, (chat) => ({
      ...chat,
      documentName: nextDocumentName,
      documentText: nextDocumentText,
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateChat(chatId: string, updater: (chat: ChatSession) => ChatSession) {
    setChats((previous) => previous.map((chat) => (chat.id === chatId ? updater(chat) : chat)));
  }

  function appendAssistantChunk(chatId: string, messageId: string, chunk: string) {
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${chunk}` }
          : message,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function removeMessage(chatId: string, messageId: string) {
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.filter((message) => message.id !== messageId),
      updatedAt: new Date().toISOString(),
    }));
  }

  return (
    <main
      className={`theme-root ${isDarkTheme ? "theme-dark" : "theme-light"} min-h-screen px-4 py-6 transition-colors duration-500 sm:px-6 lg:px-8`}
    >
      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex flex-col rounded-3xl border border-white/80 bg-white/75 p-4 shadow-soft backdrop-blur lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
              <FileSearch className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-xen-indigo">
                Document processing
              </p>
              <h1 className="truncate text-base font-semibold text-ink">
                Intelligence Workspace
              </h1>
            </div>
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={() => createAndActivateChat()}
            type="button"
          >
            <Plus className="size-4" />
            New Document
          </button>

          <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-ink">
            <Clock className="size-4 text-xen-indigo" />
            Recent documents
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-xen-indigo focus:bg-white focus:ring-4 focus:ring-indigo-100"
              onChange={(event) => setChatSearch(event.target.value)}
              placeholder="Search documents"
              value={chatSearch}
            />
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredChats.length ? (
              filteredChats.map((chat) => (
                <div
                  className={`rounded-2xl border p-3 transition ${
                    chat.id === activeChatId
                      ? "border-xen-indigo bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-indigo-200"
                  }`}
                  key={chat.id}
                >
                  {renamingChatId === chat.id ? (
                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveRename(chat.id);
                      }}
                    >
                      <input
                        autoFocus
                        className="h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-xen-indigo focus:ring-4 focus:ring-indigo-100"
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            cancelRename();
                          }
                        }}
                        value={renameDraft}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink"
                          onClick={cancelRename}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                          type="submit"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => selectChat(chat)}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                              {getChatDocumentLabel(chat)}
                            </span>
                            <span className="shrink-0 text-[0.7rem] font-medium text-slate-500">
                              {formatRelativeTime(chat.updatedAt)}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {getChatPreview(chat)}
                          </span>
                        </button>
                        <button
                          aria-expanded={openChatMenuId === chat.id}
                          aria-label={`Open options for ${getChatDocumentLabel(chat)}`}
                          className="rounded-full p-2 text-slate-400 transition hover:bg-white hover:text-ink"
                          onClick={() => toggleChatMenu(chat.id)}
                          type="button"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </div>

                      {openChatMenuId === chat.id ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                          <button
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-xen-indigo hover:text-xen-indigo"
                            onClick={() => startRenamingChat(chat)}
                            type="button"
                          >
                            <Pencil className="size-3.5" />
                            Rename
                          </button>
                          <button
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                            onClick={() => deleteChat(chat.id)}
                            type="button"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                <FileText className="size-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-ink">
                  {chatSearch.trim() ? "No matching documents" : "No recent documents yet"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {chatSearch.trim()
                    ? "Try searching by document name or saved activity."
                    : "Your recent documents will appear here after you load or work on them."}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-xen-indigo hover:text-xen-indigo"
              onClick={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
              type="button"
            >
              {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {isDarkTheme ? "Light theme" : "Dark theme"}
            </button>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          <header className="rounded-3xl border border-white/80 bg-white/75 p-5 shadow-soft backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-xen-indigo">
                  Intelligent Document Processing
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Document Intelligence Workspace
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  A focused workflow for intake, structured review and saved document activity.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-600 lg:min-w-80">
                <StatusPill icon={<ShieldCheck className="size-4" />} label="Secure intake" />
                <StatusPill icon={<Workflow className="size-4" />} label="Review workflow" />
                <StatusPill icon={<FileText className="size-4" />} label="Live processing" />
              </div>
            </div>
          </header>

          <section className="rounded-3xl border border-white/80 bg-white p-5 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Document intake</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Upload one or more files, or paste raw text from a contract, invoice, or policy.
                    </p>
                  </div>
                  <FileText className="size-6 shrink-0 text-xen-indigo" />
                </div>

                <div className="mt-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
                  <button
                    className={modeButtonClass(intakeMode === "upload")}
                    onClick={() => setIntakeMode("upload")}
                    type="button"
                  >
                    Upload files
                  </button>
                  <button
                    className={modeButtonClass(intakeMode === "paste")}
                    onClick={() => setIntakeMode("paste")}
                    type="button"
                  >
                    Paste text
                  </button>
                </div>

                {intakeMode === "upload" ? (
                  <div className="mt-5">
                    <button
                      className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-6 text-center transition hover:border-xen-indigo hover:bg-indigo-50"
                      disabled={isExtracting}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      {isExtracting ? (
                        <Loader2 className="size-8 animate-spin text-xen-indigo" />
                      ) : (
                        <Upload className="size-8 text-xen-indigo" />
                      )}
                      <span className="mt-3 font-semibold text-ink">
                        {isExtracting ? "Extracting document text" : "Choose PDF, TXT, or Markdown files"}
                      </span>
                      <span className="mt-1 text-sm text-slate-600">Up to 5 files, 8 MB each</span>
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
                ) : (
                  <textarea
                    className="mt-5 min-h-56 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-ink outline-none transition focus:border-xen-indigo focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    onChange={(event) => handlePastedDocument(event.target.value)}
                    placeholder="Paste document text here..."
                    value={documentText}
                  />
                )}
              </div>

              <div className="flex flex-col justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Current document
                  </p>
                  <p className="mt-2 truncate text-sm font-semibold text-ink">{documentName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {hasDocument
                      ? `${documentText.trim().length.toLocaleString()} characters ready`
                      : "No text extracted yet"}
                  </p>
                </div>

                {error ? (
                  <div className="mt-4 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                ) : null}

                <button
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isAnalyzing || isExtracting || !hasDocument}
                  onClick={handleAnalyze}
                  type="button"
                >
                  {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Workflow className="size-4" />}
                  Process documents
                </button>
              </div>
            </div>
          </section>

          {!hasDocument ? (
            <section className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center shadow-soft">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-50 text-xen-indigo">
                <FileSearch className="size-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink">Start with document intake</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Review and saved activity stay hidden until a document is loaded, keeping the workspace focused.
              </p>
            </section>
          ) : (
            <>
              <section className="flex flex-col rounded-3xl border border-white/80 bg-white p-5 shadow-soft lg:h-[36rem]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Review workspace</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Structured findings appear as the document set is processed.
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 rounded-full bg-slate-100 p-1.5 sm:w-auto">
                    <span className="px-3 text-sm font-medium text-slate-700">
                      {completionScore}/3 sections ready
                    </span>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-sm transition hover:text-xen-indigo disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!hasAnalysis || isAnalyzing}
                      onClick={exportAnalysis}
                      type="button"
                    >
                      <Download className="size-4" />
                      Export PDF
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {tabs.map((tab) => (
                    <button
                      className={`rounded-2xl border p-4 text-left transition ${
                        activeTab === tab.id
                          ? "border-xen-indigo bg-indigo-50 text-ink"
                          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                      }`}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold">{tab.label}</span>
                      <span className="mt-1 block text-xs leading-5">{tab.helper}</span>
                    </button>
                  ))}
                </div>

                <article className="mt-5 h-72 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:h-auto lg:min-h-0 lg:flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-ink">{currentTab.label}</h3>
                    {isAnalyzing ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-xen-indigo">
                        <Loader2 className="size-3.5 animate-spin" />
                        Processing
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 text-sm leading-7 text-slate-700">
                    {activeTab === "summary" ? (
                      currentContent ? (
                        <p className="fade-in-up whitespace-pre-wrap">
                          {currentContent}
                          {isAnalyzing ? <StreamingCursor /> : null}
                        </p>
                      ) : isAnalyzing ? (
                        <SkeletonLines />
                      ) : (
                        <p>{emptyResultText(false)}</p>
                      )
                    ) : (
                      <BulletList content={currentContent} isLoading={isAnalyzing} />
                    )}
                  </div>
                </article>
              </section>

              <section className="flex flex-col rounded-3xl border border-white/80 bg-white p-5 shadow-soft lg:h-[34rem]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-xen-purple text-white">
                      <MessageSquareText className="size-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-ink">Document review</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Explore the active document with contextual prompts.
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        Active document: {documentName}
                        {activeChat?.messages.length
                          ? ` / ${activeChat.messages.length} saved items`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-ink transition hover:border-xen-indigo hover:text-xen-indigo disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!hasChatMessages || isAnswering}
                    onClick={exportChat}
                    type="button"
                  >
                    <Download className="size-4" />
                    Export PDF
                  </button>
                </div>

                <div
                  className="mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  ref={documentWorkspaceRef}
                >
                  {activeChat?.messages.length ? (
                    <div className="space-y-4">
                      {activeChat.messages.map((message, index) => (
                        <ChatBubble
                          isStreaming={
                            isAnswering &&
                            message.role === "assistant" &&
                            index === activeChat.messages.length - 1
                          }
                          key={message.id}
                          message={message}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-72 flex-col items-center justify-center text-center">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-xen-indigo shadow-sm">
                        <MessageCircle className="size-6" />
                      </div>
                      <h3 className="mt-4 font-semibold text-ink">
                        No saved activity for this document yet
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                        Load or paste a document, then explore it below. Saved activity stays
                        with this document.
                      </p>
                    </div>
                  )}
                </div>

                <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleQuestion}>
                  <input
                    className="min-h-12 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-ink outline-none transition focus:border-xen-indigo focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Add a follow-up prompt, e.g. flag payment or compliance risks"
                    value={question}
                  />
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-xen-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isAnswering || !hasDocument}
                    type="submit"
                  >
                    {isAnswering ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    Send
                  </button>
                </form>
              </section>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function StatusPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white px-3 py-2 shadow-sm">
      <span className="text-xen-indigo">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function BulletList({ content, isLoading }: { content: string; isLoading: boolean }) {
  const bullets = normalizeBullets(content);

  if (!bullets.length) {
    return isLoading ? <SkeletonLines /> : <p>{emptyResultText(false)}</p>;
  }

  return (
    <ul className="fade-in-up space-y-3">
      {bullets.map((bullet, index) => (
        <li className="flex gap-3" key={bullet}>
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
          <span>
            {bullet}
            {isLoading && index === bullets.length - 1 ? <StreamingCursor /> : null}
          </span>
        </li>
      ))}
    </ul>
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
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-xen-purple text-white">
          <MessageSquareText className="size-4" />
        </div>
      ) : null}
      <div
        className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-7 ${
          isUser ? "bg-ink text-white" : "bg-white text-slate-700 shadow-sm"
        }`}
      >
        {message.content ? (
          <p className="whitespace-pre-wrap">
            {message.content}
            {isStreaming ? <StreamingCursor /> : null}
          </p>
        ) : (
          <SkeletonLines />
        )}
      </div>
      {isUser ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-ink">
          <UserRound className="size-4" />
        </div>
      ) : null}
    </div>
  );
}

async function streamFromApi(
  url: string,
  body: Record<string, unknown>,
  onChunk: (chunk: string) => void,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedText = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    receivedText += chunk;
    onChunk(chunk);
  }

  if (!receivedText.trim()) {
    throw new Error("The analysis finished without returning text. Please try again.");
  }
}

function modeButtonClass(isActive: boolean) {
  return `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
  }`;
}

function emptyResultText(isLoading: boolean) {
  return isLoading ? "Waiting for this section..." : "Run an analysis to populate this section.";
}

function buildAnalysisExport(
  documentName: string,
  sections: ReturnType<typeof parseAnalysisSections>,
  rawAnalysis: string,
) {
  const generatedAt = new Date().toLocaleString();

  if (!rawAnalysis.trim()) {
    return "";
  }

  return `# Document Intelligence Review

Document: ${documentName}
Generated: ${generatedAt}

## Summary

${sections.summary || "No summary was generated."}

## Key Points

${formatMarkdownBullets(sections.keyPoints)}

## Risks & Actions

${formatMarkdownBullets(sections.risksActions)}
`;
}

function buildChatExport(chat?: ChatSession) {
  const generatedAt = new Date().toLocaleString();

  if (!chat?.messages.length) {
    return "";
  }

  const messages = chat.messages
    .map(
      (message) =>
        `### ${message.role === "user" ? "User" : "Assistant"}\n\n${message.content}`,
    )
    .join("\n\n");

  return `# Document Export

Document: ${chat.documentName}
Generated: ${generatedAt}

${messages}
`;
}

function formatMarkdownBullets(content: string) {
  const bullets = normalizeBullets(content);

  if (!bullets.length) {
    return "No items were generated.";
  }

  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

async function downloadPdf(content: string, fileName: string, title: string) {
  if (!content.trim()) {
    return;
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", unit: "pt" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setProperties({
    title,
    subject: "Document Intelligence Workspace export",
    creator: "Document Intelligence Workspace",
  });

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      y += 10;
      continue;
    }

    const style = getPdfLineStyle(line);
    const printableLine = normalizePdfLine(line);
    doc.setFont("helvetica", style.weight);
    doc.setFontSize(style.size);

    const wrappedLines = doc.splitTextToSize(printableLine, maxWidth) as string[];
    const lineHeight = style.size + 6;
    const blockHeight = wrappedLines.length * lineHeight;

    if (y + blockHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    for (const wrappedLine of wrappedLines) {
      doc.text(wrappedLine, margin, y);
      y += lineHeight;
    }

    y += style.after;
  }

  doc.save(fileName);
}

function getPdfLineStyle(line: string) {
  if (line.startsWith("# ")) {
    return { size: 18, weight: "bold" as const, after: 8 };
  }

  if (line.startsWith("## ")) {
    return { size: 14, weight: "bold" as const, after: 6 };
  }

  if (line.startsWith("### ")) {
    return { size: 12, weight: "bold" as const, after: 4 };
  }

  return { size: 10, weight: "normal" as const, after: 2 };
}

function normalizePdfLine(line: string) {
  return line.replace(/^#{1,3}\s*/, "");
}

function hasMeaningfulChat(chat: ChatSession) {
  return Boolean(
    chat.documentText.trim() ||
      chat.messages.length ||
      chat.documentName !== "No document loaded",
  );
}

function getChatDocumentLabel(chat: ChatSession) {
  if (chat.documentName && chat.documentName !== "No document loaded") {
    return chat.documentName;
  }

  return chat.title === "New chat" ? "Untitled document" : chat.title;
}

function getChatPreview(chat: ChatSession) {
  const firstUserMessage = chat.messages.find((message) => message.role === "user");

  if (firstUserMessage?.content.trim()) {
    return `"${firstUserMessage.content.trim()}"`;
  }

  if (chat.documentText.trim()) {
    return "Ready for review";
  }

  return "Draft document";
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const now = Date.now();
  const diffInSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }

  if (diffInHours < 24) {
    return `${diffInHours} hr ago`;
  }

  if (diffInDays === 1) {
    return "Yesterday";
  }

  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function createChatSession(
  documentName = "No document loaded",
  documentText = "",
): ChatSession {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "Untitled document",
    documentName,
    documentText,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildSelectedFilesLabel(files: File[]) {
  if (files.length === 1) {
    return files[0].name;
  }

  const visibleNames = files.slice(0, 2).map((file) => file.name).join(", ");
  const remainingCount = files.length - 2;

  return remainingCount > 0
    ? `${files.length} documents: ${visibleNames} +${remainingCount}`
    : `${files.length} documents: ${visibleNames}`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildChatTitle(question: string) {
  return question.length > 44 ? `${question.slice(0, 44)}...` : question;
}

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChatSession>;
  return Boolean(candidate.id && candidate.title && Array.isArray(candidate.messages));
}

function toFileSlug(value: string) {
  const slug = value
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "document";
}
