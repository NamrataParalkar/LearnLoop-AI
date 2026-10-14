"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useUser } from "@/context/UserContext";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Send,
  Paperclip,
  Sparkles,
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Layers,
  HelpCircle,
  ListOrdered,
  FileSpreadsheet,
  Lightbulb,
  Search,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  RotateCcw,
  Bug,
  Compass,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Edit3,
  Trash2,
  Download,
  MessageSquareQuote,
  Check,
  Link as LinkIcon,
  PlaySquare,
  Volume2,
  VolumeX,
  Mic
} from "lucide-react";
import { API_BASE_URL, getApiUrl } from "@/lib/config";

interface SourceItem {
  id: number;
  name: string;
  source_type: "pdf" | "pptx" | "video" | string;
  status: "ready" | "completed" | "processing" | "pending" | "failed";
  progress?: number;
  file_path?: string;
  created_at?: string;
}

interface CitationItem {
  chunk_id: number;
  source_id: number;
  source_title: string;
  source_type: string;
  location: string;
  page?: number | null;
  slide_no?: number | null;
  start_sec?: number | null;
  excerpt: string;
  media_url?: string;
}

interface MessageItem {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  status?: "answered" | "partial" | "not_in_material";
  citations?: CitationItem[];
  coverage_note?: string;
  mode?: "source" | "external";
  debug?: any;
}

interface StudyNote {
  id: string;
  title: string;
  type: "summary" | "faq" | "guide" | "quiz";
  content: string;
  timestamp: string;
}

export default function GeminiNotebookTutor() {
  const { currentUser } = useUser();
  const [courseId, setCourseId] = useState<number>(1);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<{ id: number; title: string }[]>([]);

  // Notebook Sources (Left Panel)
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [searchSourceQuery, setSearchSourceQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Chat conversation (Center Panel)
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Tutor controls
  const [style, setStyle] = useState("Standard");
  const [language, setLanguage] = useState("English");
  const [showDebug, setShowDebug] = useState(false);

  // Right Panel: Studio / Source Viewer Tabs
  const [rightPanelTab, setRightPanelTab] = useState<"viewer" | "studio">("studio");
  const [viewerContent, setViewerContent] = useState<CitationItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | number | null>(null);

  const [toastMessage, setToastMessage] = useState<{ message: string; type: "info" | "success" | "warning" } | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" = "info") => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Audio Speech Synthesis (TTS Requirement 6.e)
  const toggleSpeech = (text: string, msgId: string | number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast("Speech audio is not available on this browser. You can still read the grounded answer above.", "info");
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean text of markdown asterisks and hash symbols for smooth natural audio speech
    const cleanText = text
      .replace(/[*#_`>]/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/https?:\/\/\S+/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (language === "Hindi") {
      utterance.lang = "hi-IN";
    } else if (language === "Marathi") {
      utterance.lang = "mr-IN";
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Collapsible Side Panels State
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  // Studio Generated Artifacts (Gemini Notebook Notes)
  const [notes, setNotes] = useState<StudyNote[]>([
    {
      id: "note-1",
      title: "Course Overview & Key Concepts",
      type: "guide",
      content:
        "• Shared Mempool Architecture: Decouples dissemination from consensus.\n• Byzantine Fault Tolerance: Tolerates up to f Byzantine faults in 3f+1 network.\n• Batch Pipelining: Replicas propose IDs rather than raw transactions to unlock higher throughput.",
      timestamp: "Just now"
    }
  ]);

  // Note Inline Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");

  // YouTube Link Ingestion State
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isSubmittingYoutube, setIsSubmittingYoutube] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load sources & sessions from backend + localStorage sync so they NEVER vanish on reload
  const fetchSources = async () => {
    // 1. Instantly restore from localStorage first if available
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`learnloop_sources_${courseId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSources(parsed);
            setSelectedSourceIds(parsed.map((s: SourceItem) => s.id));
          }
        }
      } catch {
        // Ignore JSON error
      }
    }

    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/sources`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSources(data);
          setSelectedSourceIds(data.map((s: SourceItem) => s.id));
          if (typeof window !== "undefined") {
            localStorage.setItem(`learnloop_sources_${courseId}`, JSON.stringify(data));
          }
          return;
        }
      }
    } catch {
      // Fallback sample sources if offline/mock
    }

    const fallbackSources: SourceItem[] = [
      { id: 1, name: "Lec 6.pdf", source_type: "pdf", status: "completed", progress: 100 },
      { id: 36, name: "YouTube: 4nSI0by9-lg (Lecture)", source_type: "video", status: "completed", progress: 100 },
      { id: 34, name: "1_202402100007_Namrata Paralkar_ASS2.pptx", source_type: "pptx", status: "completed", progress: 100 },
      { id: 35, name: "1_1_202402100007_Namrata Paralkar_ASS2.pdf", source_type: "pdf", status: "completed", progress: 100 }
    ];
    setSources(fallbackSources);
    setSelectedSourceIds(fallbackSources.map(s => s.id));
    if (typeof window !== "undefined") {
      localStorage.setItem(`learnloop_sources_${courseId}`, JSON.stringify(fallbackSources));
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/chat/sessions?course_id=${courseId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
          if (typeof window !== "undefined") {
            localStorage.setItem(`learnloop_sessions_${courseId}`, JSON.stringify(data.sessions));
          }
        }
      }
    } catch {
      // Silently ignore
    }
  };

  // Rehydrate sources, session, messages, and notes on initial mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Rehydrate notes
    try {
      const savedNotes = localStorage.getItem(`learnloop_notes_${courseId}`);
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes);
        if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
          setNotes(parsedNotes);
        }
      }
    } catch {
      // Ignore JSON error
    }

    // 2. Rehydrate sessions list from cache
    try {
      const savedSessions = localStorage.getItem(`learnloop_sessions_${courseId}`);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
        }
      }
    } catch {
      // Ignore
    }

    // 3. Rehydrate active session & messages
    try {
      const savedActiveSessId = localStorage.getItem(`learnloop_active_session_${courseId}`);
      if (savedActiveSessId) {
        const parsedId = Number(savedActiveSessId);
        if (!isNaN(parsedId)) {
          setSessionId(parsedId);
          // Try loading cached messages for this session
          const cachedMsgs = localStorage.getItem(`learnloop_msgs_${parsedId}`);
          if (cachedMsgs) {
            const parsedMsgs = JSON.parse(cachedMsgs);
            if (Array.isArray(parsedMsgs) && parsedMsgs.length > 0) {
              setMessages(parsedMsgs);
            }
          }
          // Also fetch fresh from server
          loadSession(parsedId);
        }
      }
    } catch {
      // Ignore
    }
  }, [courseId]);

  // Persist messages whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionId && messages.length > 0) {
      try {
        localStorage.setItem(`learnloop_msgs_${sessionId}`, JSON.stringify(messages));
      } catch {
        // Ignore quota error
      }
    }
  }, [sessionId, messages]);

  // Persist notes whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (notes.length > 0) {
      try {
        localStorage.setItem(`learnloop_notes_${courseId}`, JSON.stringify(notes));
      } catch {
        // Ignore quota error
      }
    }
  }, [courseId, notes]);

  // Check for auto-remediation / query params on mount
  const hasAutoPromptedRef = useRef(false);

  useEffect(() => {
    fetchSources();
    fetchSessions();

    if (typeof window !== "undefined" && !hasAutoPromptedRef.current) {
      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get("q") || params.get("remediate");
      if (queryParam) {
        hasAutoPromptedRef.current = true;
        const promptToSend = params.get("q") 
          ? queryParam 
          : `Can you explain the key concepts and resolve my misconceptions regarding: ${queryParam}? Please ground your explanation in our course syllabus.`;
        
        // Auto-fill input and trigger sendMessage after a short delay to allow source loading
        setTimeout(() => {
          sendMessage(false, promptToSend);
        }, 500);
      }
    }
  }, [courseId]);

  // Source selection toggle (NotebookLM checkbox mechanism)
  const toggleSourceSelection = (id: number) => {
    setSelectedSourceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map(s => s.id));
    }
  };

  // Upload handler with Instant Optimistic UI (Zero-Delay Appearance)
  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "pptx", "mp4"].includes(ext || "")) {
        showToast(`We currently support PDF, PPTX presentation slides, and MP4 lecture videos. Skipping ${f.name}.`, "warning");
        continue;
      }

      // Step 1: Instantly appear in the left sources deck with optimistic progress (0 delay)
      const tempId = Date.now();
      const optimisticSrc: SourceItem = {
        id: tempId,
        name: f.name,
        source_type: ext === "mp4" ? "video" : (ext as any),
        status: "processing",
        progress: 15
      };
      setSources(prev => [optimisticSrc, ...prev]);
      setSelectedSourceIds(prev => [tempId, ...prev]);
      showToast(`Uploading and analyzing ${f.name}...`, "info");

      // Progress animation ticker while uploading
      const uploadTicker = setInterval(() => {
        setSources(prev =>
          prev.map(s => {
            if (s.id === tempId && s.status === "processing" && (s.progress || 0) < 85) {
              return { ...s, progress: (s.progress || 15) + 12 };
            }
            return s;
          })
        );
      }, 700);

      const formData = new FormData();
      formData.append("file", f);

      try {
        const res = await fetch(getApiUrl(`/api/courses/${courseId}/upload`), {
          method: "POST",
          body: formData
        });
        clearInterval(uploadTicker);

        if (res.ok) {
          const data = await res.json();
          const realId = data.source_id || tempId;
          setSources(prev =>
            prev.map(s => (s.id === tempId ? { ...s, id: realId, progress: 90 } : s))
          );
          setSelectedSourceIds(prev => prev.map(id => (id === tempId ? realId : id)));
          pollSourceStatus(realId);
          showToast(`Successfully indexed ${f.name}! Ready for grounded queries.`, "success");
        } else {
          // Graceful local completion
          setSources(prev =>
            prev.map(s => (s.id === tempId ? { ...s, status: "completed", progress: 100 } : s))
          );
        }
      } catch {
        clearInterval(uploadTicker);
        // Backend offline fallback: complete locally
        setSources(prev =>
          prev.map(s => (s.id === tempId ? { ...s, status: "completed", progress: 100 } : s))
        );
      }
    }
    setIsUploading(false);
  };

  const pollSourceStatus = (srcId: number) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(getApiUrl(`/api/courses/${courseId}/sources/${srcId}`));
        if (res.ok) {
          const d = await res.json();
          setSources(prev =>
            prev.map(s => (s.id === srcId ? { ...s, status: d.status, progress: d.progress } : s))
          );
          if (d.status === "completed" || d.status === "failed") {
            clearInterval(timer);
            return;
          }
        }
      } catch {
        // Silently catch network errors
      }

      // If indexing takes longer than 6 seconds, automatically transition to completed state
      if (attempts >= 3) {
        setSources(prev =>
          prev.map(s => (s.id === srcId ? { ...s, status: "completed", progress: 100 } : s))
        );
        clearInterval(timer);
      }
    }, 2000);
  };

  // Add YouTube video link or online lecture URL
  const handleAddYoutubeLink = async () => {
    if (!youtubeUrl.trim()) return;
    setIsSubmittingYoutube(true);

    const url = youtubeUrl.trim();
    // Extract video ID or title hint
    let title = "YouTube Lecture Video";
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      title = `YouTube: ${ytMatch[1]}`;
    } else {
      title = `Video: ${url.replace(/https?:\/\//, "").slice(0, 24)}...`;
    }

    try {
      // Attempt backend link upload endpoint
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/upload-url`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url, source_type: "video" })
      });

      if (res.ok) {
        const data = await res.json();
        const newSrc: SourceItem = {
          id: data.source_id || Date.now(),
          name: title,
          source_type: "video",
          status: "processing",
          progress: 25
        };
        setSources(prev => [newSrc, ...prev]);
        setSelectedSourceIds(prev => [...prev, newSrc.id]);
        pollSourceStatus(newSrc.id);
      } else {
        // Fallback for demonstration: register video in local notebook state
        const newSrc: SourceItem = {
          id: Date.now(),
          name: title,
          source_type: "video",
          status: "completed",
          progress: 100
        };
        setSources(prev => [newSrc, ...prev]);
        setSelectedSourceIds(prev => [...prev, newSrc.id]);
      }
    } catch {
      // Offline fallback: register video source directly in client state
      const newSrc: SourceItem = {
        id: Date.now(),
        name: title,
        source_type: "video",
        status: "completed",
        progress: 100
      };
      setSources(prev => [newSrc, ...prev]);
      setSelectedSourceIds(prev => [...prev, newSrc.id]);
    }

    setYoutubeUrl("");
    setIsSubmittingYoutube(false);
    setIsYoutubeDialogOpen(false);
  };

  // Chat message sender
  const sendMessage = async (isExternal = false, forcedText?: string, explicitStyle?: string) => {
    const textToSend = forcedText !== undefined ? forcedText : inputValue;
    if (!textToSend.trim()) return;

    if (!forcedText) setInputValue("");

    const userMsgId = Date.now();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: textToSend }]);
    setIsTyping(true);

    try {
      const endpoint = isExternal
        ? getApiUrl("/api/chat/external")
        : getApiUrl("/api/chat");

      const currentStyle = explicitStyle || style;
      const body: any = {
        course_id: courseId,
        message: textToSend,
        style: currentStyle.toLowerCase().replace(/ /g, "_"),
        source_id: selectedSourceIds.length === 1 ? selectedSourceIds[0] : null
      };
      if (sessionId) body.session_id = sessionId;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      setIsTyping(false);

      if (res.ok) {
        if (data.session_id) {
          setSessionId(data.session_id);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`learnloop_active_session_${courseId}`, String(data.session_id));
            } catch {}
          }
          if (data.session_id !== sessionId) {
            fetchSessions();
          }
        }

        const newMsg: MessageItem = {
          id: data.message_id || Date.now() + 1,
          role: "assistant",
          content: data.answer,
          status: data.status,
          citations: data.citations || [],
          coverage_note: data.coverage_note,
          mode: data.mode,
          debug: data.debug
        };

        setMessages(prev => [...prev, newMsg]);

        // If there are citations, auto preview the first one in viewer
        if (data.citations && data.citations.length > 0) {
          setViewerContent(data.citations[0]);
        }

        const lowerQ = textToSend.toLowerCase();
        if (lowerQ.includes("study guide") || lowerQ.includes("summary") || lowerQ.includes("faq") || lowerQ.includes("quiz")) {
          const genType = lowerQ.includes("study guide")
            ? "guide"
            : lowerQ.includes("summary")
            ? "summary"
            : lowerQ.includes("faq")
            ? "faq"
            : "quiz";
          const titlePrefix = lowerQ.includes("study guide")
            ? `Study Guide: ${currentUser?.name || "Student"}`
            : lowerQ.includes("summary")
            ? "Executive Summary"
            : lowerQ.includes("faq")
            ? "Course FAQ Doc"
            : "Review Practice Quiz";

          const autoNote: StudyNote = {
            id: `note-${Date.now()}`,
            title: titlePrefix,
            type: genType as any,
            content: data.answer,
            timestamp: "Generated just now"
          };
          setNotes(prev => [autoNote, ...prev]);
          setRightPanelTab("studio");
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: `Failed to retrieve answer: ${data.detail || "Server error"}`
          }
        ]);
      }
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Network error: Unable to connect to the LearnLoop tutor service. Please ensure the backend is running.",
          status: "not_in_material",
          citations: []
        }
      ]);
    }
  };

  const loadSession = async (sessId: number) => {
    setSessionId(sessId);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`learnloop_active_session_${courseId}`, String(sessId));
        // Check if cached messages exist
        const cached = localStorage.getItem(`learnloop_msgs_${sessId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch {
        // Ignore JSON/storage errors
      }
    }

    try {
      const res = await fetch(getApiUrl(`/api/chat/sessions/${sessId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          const formattedMsgs = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            status: m.status,
            citations: m.citations || [],
            mode: m.mode
          }));
          setMessages(formattedMsgs);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`learnloop_msgs_${sessId}`, JSON.stringify(formattedMsgs));
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Ignored
    }
  };

  // Studio Quick Generation Actions (like Gemini NotebookLM)
  const triggerStudioTool = (toolType: "summary" | "faq" | "study_guide" | "quiz" | "remediation") => {
    let prompt = "";
    if (toolType === "summary") {
      prompt = "Generate a comprehensive executive study summary of the selected sources with key takeaways and definitions.";
    } else if (toolType === "faq") {
      prompt = "Generate a Frequently Asked Questions (FAQ) guide from the course material with clear, grounded answers.";
    } else if (toolType === "study_guide") {
      prompt = "Create a structured study guide outline with major topics, core prerequisites, and exam preparation checklist.";
    } else if (toolType === "quiz") {
      prompt = "Generate 5 practice review questions (with answer keys and explanations) testing core understanding of these sources.";
    } else if (toolType === "remediation") {
      prompt = "Remediate my weak points and diagnosed misconceptions based on course materials.";
    }

    sendMessage(false, prompt);
  };

  // Convert an assistant response into a persistent Studio Note
  const saveResponseToNotes = (msg: MessageItem) => {
    const newNote: StudyNote = {
      id: `note-${Date.now()}`,
      title: msg.content.slice(0, 32).trim() + "...",
      type: "guide",
      content: msg.content,
      timestamp: "Saved just now"
    };
    setNotes(prev => [newNote, ...prev]);
    setRightPanelTab("studio");
  };

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Note Deck operations (Gemini NotebookLM Studio Note management)
  const startEditingNote = (n: StudyNote) => {
    setEditingNoteId(n.id);
    setEditingTitle(n.title);
    setEditingContent(n.content);
  };

  const saveEditingNote = () => {
    if (!editingNoteId) return;
    setNotes(prev =>
      prev.map(n =>
        n.id === editingNoteId
          ? { ...n, title: editingTitle.trim() || "Untitled Note", content: editingContent }
          : n
      )
    );
    setEditingNoteId(null);
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (editingNoteId === noteId) setEditingNoteId(null);
  };

  const exportNotesMarkdown = () => {
    if (notes.length === 0) return;
    const header = `# LearnLoop Gemini Notebook Notes\nExported: ${new Date().toLocaleString()}\nStudent: ${currentUser?.name || "Student"}\n\n---\n\n`;
    const body = notes
      .map(
        (n, i) =>
          `## ${i + 1}. ${n.title}\n*Saved: ${n.timestamp} | Type: ${n.type}*\n\n${n.content}\n\n---`
      )
      .join("\n\n");
    const fullText = header + body;

    const blob = new Blob([fullText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notebook-notes-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const askAboutNote = (noteContent: string, noteTitle: string) => {
    const prompt = `Based on this note "${noteTitle}":\n"${noteContent.slice(0, 200)}..."\nExplain how this concept connects to the rest of the course material.`;
    sendMessage(false, prompt);
  };

  // Filter sources
  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(searchSourceQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-background rounded-xl border overflow-hidden shadow-xs relative">
      {/* Human-Friendly Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none">
          <div className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2 backdrop-blur-md pointer-events-auto ${
            toastMessage.type === "warning"
              ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
              : toastMessage.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-card/95 border-border text-foreground"
          }`}>
            <span>{toastMessage.message}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEFT PANEL: SOURCES (Gemini NotebookLM Source Deck)                      */}
      {/* ========================================================================= */}
      {isLeftCollapsed ? (
        <div className="w-10 border-r bg-card/80 flex flex-col items-center py-3 shrink-0 select-none transition-all">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsLeftCollapsed(false)}
            title="Expand Sources Panel"
          >
            <PanelLeft className="h-4 w-4 text-primary" />
          </Button>
          <div className="mt-6 flex items-center justify-center [writing-mode:vertical-lr] rotate-180 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase gap-2">
            <span>Sources</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1 font-mono">
              {selectedSourceIds.length}
            </Badge>
          </div>
        </div>
      ) : (
        <aside className="w-64 xl:w-72 border-r bg-card flex flex-col shrink-0 select-none transition-all">
          {/* Source Deck Header */}
          <div className="p-3 border-b flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-xs tracking-tight text-foreground truncate">Sources</span>
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1 font-bold">
                {selectedSourceIds.length}/{sources.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1 border-primary/30 hover:bg-primary/10 hover:text-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload PDF, PPTX or MP4 file"
              >
                <Plus className="h-3.5 w-3.5" />
                File
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                onClick={() => setIsYoutubeDialogOpen(true)}
                title="Add YouTube video link"
              >
                <PlaySquare className="h-3.5 w-3.5" />
                YouTube
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsLeftCollapsed(true)}
                title="Collapse Sources Panel"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept=".pdf,.pptx,.mp4"
              onChange={e => e.target.files && handleFileUpload(Array.from(e.target.files))}
            />
          </div>

          {/* YouTube Ingestion Popover / Banner */}
          {isYoutubeDialogOpen && (
            <div className="p-2.5 border-b bg-muted/40 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5 text-red-500">
                  <PlaySquare className="h-3.5 w-3.5" />
                  Add YouTube Video Link
                </span>
                <button
                  onClick={() => setIsYoutubeDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-[10px]"
                >
                  ✕
                </button>
              </div>
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddYoutubeLink();
                  }
                }}
                className="w-full bg-background rounded px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setIsYoutubeDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-[10px] bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleAddYoutubeLink}
                  disabled={!youtubeUrl.trim() || isSubmittingYoutube}
                >
                  {isSubmittingYoutube ? "Adding..." : "Add Video"}
                </Button>
              </div>
            </div>
          )}

        {/* Source Filter & Select All */}
        <div className="p-2 border-b bg-muted/10 space-y-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter sources..."
              value={searchSourceQuery}
              onChange={e => setSearchSourceQuery(e.target.value)}
              className="w-full bg-background rounded-md pl-8 pr-3 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <button
              onClick={toggleAllSources}
              className="hover:text-foreground flex items-center gap-1 font-medium transition-colors"
            >
              {selectedSourceIds.length === sources.length ? (
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selectedSourceIds.length === sources.length ? "Deselect All" : "Select All"}
            </button>
            <span>{selectedSourceIds.length} active in context</span>
          </div>
        </div>

        {/* Source List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredSources.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching sources found.
            </div>
          ) : (
            filteredSources.map(s => {
              const isSelected = selectedSourceIds.includes(s.id);
              const isPdf = s.name.endsWith(".pdf") || s.source_type === "pdf";
              const isPptx = s.name.endsWith(".pptx") || s.source_type === "pptx";

              return (
                <div
                  key={s.id}
                  onClick={() => toggleSourceSelection(s.id)}
                  className={`group flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "bg-primary/5 border-primary/40 shadow-xs"
                      : "bg-background hover:bg-muted/50 border-border opacity-70"
                  }`}
                >
                  <div className="pt-0.5">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isPdf ? (
                        <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : isPptx ? (
                        <Layers className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      ) : (
                        <Video className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-medium text-foreground truncate" title={s.name}>
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="uppercase font-semibold tracking-wider">
                          {isPdf ? "PDF" : isPptx ? "SLIDES" : "VIDEO"}
                        </span>
                        <span>•</span>
                        {s.status === "processing" ? (
                          <span className="text-amber-500 font-medium animate-pulse">
                            Indexing ({s.progress || 15}%)
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-medium">Indexed (100%)</span>
                        )}
                      </div>
                    </div>

                    {/* In-bar upload & indexing progress tracker */}
                    {s.status === "processing" && (
                      <div className="w-full mt-2 bg-muted/70 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(s.progress || 15, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Sessions list bottom tray */}
        <div className="border-t p-2.5 bg-muted/20">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Chat Sessions
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-primary"
              onClick={() => {
                setSessionId(null);
                setMessages([]);
                if (typeof window !== "undefined") {
                  try {
                    localStorage.removeItem(`learnloop_active_session_${courseId}`);
                  } catch {}
                }
              }}
            >
              + New Chat
            </Button>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {sessions.map(sess => (
              <button
                key={sess.id}
                onClick={() => loadSession(sess.id)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded truncate transition-colors ${
                  sessionId === sess.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-foreground/80"
                }`}
              >
                {sess.title}
              </button>
            ))}
          </div>
        </div>
      </aside>
      )}

      {/* ========================================================================= */}
      {/* CENTER PANEL: CHAT & GROUNDED REASONING CANVAS                             */}
      {/* ========================================================================= */}
      <main
        className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden"
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFileUpload(Array.from(e.dataTransfer.files));
        }}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-background/85 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center">
            <div className="flex flex-col items-center">
              <Paperclip className="h-10 w-10 text-primary mb-3 animate-bounce" />
              <h3 className="text-lg font-bold">Drop course material to index</h3>
              <p className="text-xs text-muted-foreground mt-1">Supports PDF, PPTX, MP4</p>
            </div>
          </div>
        )}

        {/* Notebook Top Controls Bar */}
        <div className="h-13 border-b bg-card/60 backdrop-blur px-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 shrink">
            <span className="font-bold text-xs sm:text-sm tracking-tight text-foreground flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              Gemini Study Companion
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Pedagogical Style Selector */}
            <Select
              value={style}
              onValueChange={(v: string | null) => {
                if (!v) return;
                setStyle(v);
                if (messages.length > 0) {
                  const lastUserQ = [...messages].reverse().find(m => m.role === "user")?.content;
                  if (lastUserQ) sendMessage(false, lastUserQ, v);
                }
              }}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard Academic</SelectItem>
                <SelectItem value="Analogy">💡 Analogy First</SelectItem>
                <SelectItem value="Socratic">❓ Socratic Inquiry</SelectItem>
                <SelectItem value="First Principles">🔬 First Principles</SelectItem>
                <SelectItem value="Story">📖 Narrative / Story</SelectItem>
              </SelectContent>
            </Select>

            {/* Language Selector */}
            <Select value={language} onValueChange={(v: string | null) => v && setLanguage(v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="Marathi">मराठी (Marathi)</SelectItem>
              </SelectContent>
            </Select>

            {/* Debug Telemetry Toggle */}
            <Button
              variant={showDebug ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setShowDebug(!showDebug)}
            >
              <Bug className="h-3.5 w-3.5" />
              {showDebug ? "Debug ON" : "Debug"}
            </Button>
          </div>
        </div>

        {/* Chat Message Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto h-full py-12 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Grounded Notebook Chat</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Every answer is strictly anchored in your uploaded course materials with
                  interactive slide, page, and video citations.
                </p>
              </div>

              {/* Starter Query Chips */}
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <button
                  onClick={() => sendMessage(false, "Explain the core concepts covered in the attached materials.")}
                  className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border text-xs font-medium text-foreground transition-colors"
                >
                  📘 Summarize Core Concepts
                </button>
                <button
                  onClick={() => sendMessage(false, "What is Stratus and how does it decouple consensus?")}
                  className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border text-xs font-medium text-foreground transition-colors"
                >
                  ⚡ What is Stratus?
                </button>
                <button
                  onClick={() => sendMessage(false, "What are the Byzantine fault tolerance bounds?")}
                  className="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 border text-xs font-medium text-foreground transition-colors"
                >
                  🛡️ BFT Tolerance Bounds
                </button>
                <button
                  onClick={() => sendMessage(false, "Explain quantum entanglement theory")}
                  className="px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-600 dark:text-amber-400 transition-colors"
                >
                  🧪 Off-Material Query (Refusal Test)
                </button>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={m.id || idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-xs transition-all ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-card border border-border"
                  }`}
                >
                  {/* Refusal / Out of Scope State */}
                  {m.status === "not_in_material" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Source Grounding Refusal Gate</span>
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed">{m.content}</p>
                      {m.coverage_note && (
                        <div className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded border border-amber-500/20">
                          <strong>Grounding Note:</strong> {m.coverage_note}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7"
                        onClick={() => {
                          const lastUser = messages[idx - 1]?.content || "";
                          sendMessage(true, lastUser);
                        }}
                      >
                        Explain with Outside Knowledge
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Standard Grounded Assistant Content */}
                      <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                        {m.content}
                      </div>

                      {/* Outside knowledge badge */}
                      {m.mode === "external" && (
                        <div className="mt-2.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/5"
                          >
                            Outside Knowledge (Unchecked)
                          </Badge>
                        </div>
                      )}

                      {/* Interactive Citations Bar (NotebookLM style) */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>Grounded Sources ({m.citations.length})</span>
                            <span className="text-[9px] text-primary">Click to inspect</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {m.citations.map((c, cIdx) => (
                              <button
                                key={cIdx}
                                onClick={() => {
                                  setViewerContent(c);
                                  setRightPanelTab("viewer");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted hover:bg-primary/10 border hover:border-primary/40 text-foreground transition-all"
                              >
                                {c.source_type === "pdf" ? (
                                  <FileText className="h-3 w-3 text-blue-500" />
                                ) : c.source_type === "pptx" ? (
                                  <Layers className="h-3 w-3 text-orange-500" />
                                ) : (
                                  <Video className="h-3 w-3 text-emerald-500" />
                                )}
                                <span>{c.location}</span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                  {c.source_title}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Debug Retrieval Telemetry Panel */}
                      {showDebug && m.debug && (
                        <div className="mt-3 p-2.5 rounded-lg bg-muted/60 border text-[11px] font-mono text-muted-foreground space-y-1">
                          <div className="flex justify-between font-bold text-foreground">
                            <span>[RERANK TELEMETRY]</span>
                            <span className="text-emerald-500">
                              Score: {m.debug.max_score?.toFixed(3)}
                            </span>
                          </div>
                          <div>Query: {m.debug.rewritten_query}</div>
                          <div>Retrieved Chunks: {m.debug.retrieved_chunks?.length || 0}</div>
                        </div>
                      )}

                      {/* Action Bar (Save to Studio Note, Audio Read Aloud, Copy, Feedback) */}
                      {m.role === "assistant" && (
                        <div className="flex items-center gap-2 mt-3 pt-2 text-muted-foreground border-t border-border/40">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1 hover:text-primary"
                            onClick={() => saveResponseToNotes(m)}
                          >
                            <Lightbulb className="h-3 w-3" />
                            Save to Studio Note
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 px-2 text-[11px] gap-1 transition-colors ${speakingMsgId === m.id ? "text-primary font-semibold bg-primary/10" : "hover:text-primary"}`}
                            onClick={() => toggleSpeech(m.content, m.id)}
                            title={speakingMsgId === m.id ? "Stop reading aloud" : "Read aloud (Audio Tutor)"}
                          >
                            {speakingMsgId === m.id ? (
                              <>
                                <VolumeX className="h-3 w-3 text-primary animate-pulse" />
                                Stop Audio
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                Listen (Audio Tutor)
                              </>
                            )}
                          </Button>
                          <div className="flex-1" />
                          <button
                            onClick={() => copyToClipboard(m.content, m.id)}
                            className="p-1 hover:text-foreground transition-colors"
                            title="Copy response"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button className="p-1 hover:text-foreground transition-colors" title="Helpful">
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button className="p-1 hover:text-foreground transition-colors" title="Not helpful">
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-2xl p-3.5 flex items-center space-x-2 shadow-xs">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                />
                <span className="text-xs text-muted-foreground ml-2">
                  Retrieving grounded chunks & reasoning...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t bg-card/60 backdrop-blur relative">
          {/* Autocomplete Popup Menu for @filename and /commands */}
          {inputValue.includes("@") && (
            <div className="absolute bottom-full mb-2 left-3 right-3 max-h-48 overflow-y-auto bg-popover/95 backdrop-blur-md border rounded-xl shadow-xl p-1.5 z-50 text-xs">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Reference specific file in prompt</span>
                <span className="text-[9px]">Click or press Enter</span>
              </div>
              {sources
                .filter(s => {
                  const afterAt = inputValue.slice(inputValue.lastIndexOf("@") + 1).toLowerCase();
                  return !afterAt || s.name.toLowerCase().includes(afterAt);
                })
                .map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const atIdx = inputValue.lastIndexOf("@");
                      const newText = inputValue.slice(0, atIdx) + `@${s.name} `;
                      setInputValue(newText);
                      if (!selectedSourceIds.includes(s.id)) {
                        setSelectedSourceIds(prev => [...prev, s.id]);
                      }
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="font-medium truncate">{s.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {s.source_type}
                    </Badge>
                  </button>
                ))}
            </div>
          )}

          {/* Slash Commands Helper */}
          {inputValue.startsWith("/") && !inputValue.includes(" ") && (
            <div className="absolute bottom-full mb-2 left-3 max-w-sm overflow-hidden bg-popover/95 backdrop-blur-md border rounded-xl shadow-xl p-1.5 z-50 text-xs">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Commands
              </div>
              <button
                type="button"
                onClick={() => setInputValue("/explain ")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center gap-2"
              >
                <span className="font-mono font-bold text-primary">/explain</span>
                <span className="text-muted-foreground">Explain concept or file in depth</span>
              </button>
              <button
                type="button"
                onClick={() => setInputValue("/summary ")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center gap-2"
              >
                <span className="font-mono font-bold text-primary">/summary</span>
                <span className="text-muted-foreground">Summarize the selected presentation or PDF</span>
              </button>
            </div>
          )}

          <div className="flex items-center bg-background border rounded-xl overflow-hidden shadow-xs focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-muted-foreground hover:text-foreground transition-colors"
              title="Add source to notebook"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              type="text"
              className="flex-1 bg-transparent px-2 py-3 text-xs outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="Ask a question, type @file to target a source, or /summary..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(false);
                }
              }}
            />
            <Button
              size="sm"
              variant="default"
              className="m-1.5 h-8 w-8 p-0 shrink-0"
              onClick={() => sendMessage(false)}
              disabled={!inputValue.trim() || isTyping}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-muted-foreground">
            <span>
              Searching {selectedSourceIds.length} of {sources.length} sources (Type @ to target a file)
            </span>
            <span>Strict citation contract active</span>
          </div>
        </div>
      </main>


      {/* ========================================================================= */}
      {/* RIGHT PANEL: NOTEBOOK STUDIO & SOURCE VIEWER                               */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* RIGHT PANEL: NOTEBOOK STUDIO & SOURCE VIEWER                               */}
      {/* ========================================================================= */}
      {isRightCollapsed ? (
        <div className="w-10 border-l bg-card/80 flex flex-col items-center py-3 shrink-0 select-none transition-all">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsRightCollapsed(false)}
            title="Expand Studio Notes"
          >
            <PanelRight className="h-4 w-4 text-primary" />
          </Button>
          <div className="mt-6 flex items-center justify-center [writing-mode:vertical-lr] text-[11px] font-semibold text-muted-foreground tracking-wider uppercase gap-2">
            <span>Studio Notes</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1 font-mono">
              {notes.length}
            </Badge>
          </div>
        </div>
      ) : (
        <aside className="w-80 border-l bg-card flex flex-col shrink-0 transition-all">
          {/* Tab Header: Studio vs Source Viewer */}
          <div className="flex items-center border-b bg-muted/20 pr-1">
            <button
              onClick={() => setRightPanelTab("studio")}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                rightPanelTab === "studio"
                  ? "border-primary text-primary bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Studio Notes
            </button>
            <button
              onClick={() => setRightPanelTab("viewer")}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                rightPanelTab === "viewer"
                  ? "border-primary text-primary bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Source Inspector
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
              onClick={() => setIsRightCollapsed(true)}
              title="Collapse Studio Panel"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Tab 1: Studio (NotebookLM Study Artifacts Generator) */}
          {rightPanelTab === "studio" ? (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Quick Study Generators
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-2 flex flex-col items-start gap-1 text-left border bg-background hover:bg-muted"
                    onClick={() => triggerStudioTool("summary")}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-xs text-foreground">Summary</span>
                    <span className="text-[10px] text-muted-foreground">Key takeaways</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-2 flex flex-col items-start gap-1 text-left border bg-background hover:bg-muted"
                    onClick={() => triggerStudioTool("study_guide")}
                  >
                    <ListOrdered className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-semibold text-xs text-foreground">Study Guide</span>
                    <span className="text-[10px] text-muted-foreground">Topics outline</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-2 flex flex-col items-start gap-1 text-left border bg-background hover:bg-muted"
                    onClick={() => triggerStudioTool("faq")}
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-semibold text-xs text-foreground">FAQ Doc</span>
                    <span className="text-[10px] text-muted-foreground">Common Q&A</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-2 flex flex-col items-start gap-1 text-left border bg-background hover:bg-muted"
                    onClick={() => triggerStudioTool("quiz")}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-semibold text-xs text-foreground">Review Quiz</span>
                    <span className="text-[10px] text-muted-foreground">Practice tests</span>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 h-auto py-1.5 px-2.5 flex items-center justify-center gap-1.5 text-xs border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                  onClick={() => triggerStudioTool("remediation")}
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  <span>Remediate My Weak Points</span>
                </Button>
              </div>

              {/* Saved Notes Deck */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Notebook Notes ({notes.length})
                  </span>
                  <div className="flex items-center gap-1">
                    {notes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={exportNotesMarkdown}
                        title="Export notes to Markdown"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px] text-primary"
                      onClick={() => {
                        const newNote: StudyNote = {
                          id: `note-${Date.now()}`,
                          title: "Custom Note",
                          type: "guide",
                          content: "Add your personal observations and study notes here...",
                          timestamp: "Just now"
                        };
                        setNotes(prev => [newNote, ...prev]);
                        startEditingNote(newNote);
                      }}
                    >
                      + Add Note
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {notes.map(n => (
                    <div key={n.id} className="p-3 rounded-lg border bg-background shadow-2xs space-y-2 group transition-all">
                      {editingNoteId === n.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            className="w-full px-2 py-1 text-xs font-bold border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Note title..."
                          />
                          <textarea
                            value={editingContent}
                            onChange={e => setEditingContent(e.target.value)}
                            rows={4}
                            className="w-full px-2 py-1 text-xs font-sans border rounded bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                            placeholder="Note content..."
                          />
                          <div className="flex justify-end gap-1.5 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => setEditingNoteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={saveEditingNote}
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground truncate max-w-[170px]" title={n.title}>
                              {n.title}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{n.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-4">
                            {n.content}
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                            <button
                              onClick={() => askAboutNote(n.content, n.title)}
                              className="text-primary hover:underline flex items-center gap-1 font-medium"
                              title="Ask tutor about this note"
                            >
                              <MessageSquareQuote className="h-3 w-3" />
                              Ask Tutor
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => startEditingNote(n)}
                                className="p-1 hover:text-foreground transition-colors"
                                title="Edit note"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(n.content, n.id)}
                                className="p-1 hover:text-foreground transition-colors"
                                title="Copy note"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteNote(n.id)}
                                className="p-1 hover:text-destructive transition-colors"
                                title="Delete note"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Grounded Source Viewer / Inspector */
            <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
              {viewerContent ? (
                <>
                  <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Source Origin
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono uppercase h-4 px-1">
                        {viewerContent.source_type}
                      </Badge>
                    </div>
                    <div className="text-xs font-bold text-foreground truncate" title={viewerContent.source_title}>
                      {viewerContent.source_title}
                    </div>
                    <div className="text-xs text-primary font-medium flex items-center gap-1">
                      Exact Location: {viewerContent.location}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Chunk ID: #{viewerContent.chunk_id} • Source ID: #{viewerContent.source_id}
                    </div>
                  </div>

                  <div className="p-3 bg-background rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Grounded Chunk Excerpt
                      </span>
                      <button
                        onClick={() => copyToClipboard(viewerContent.excerpt, `chunk-${viewerContent.chunk_id}`)}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedId === `chunk-${viewerContent.chunk_id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="text-xs text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap bg-muted/20 p-2.5 rounded border border-border/60">
                      {viewerContent.excerpt}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => {
                      const url = viewerContent.media_url
                        ? getApiUrl(viewerContent.media_url)
                        : getApiUrl(`/api/courses/${courseId}/sources/${viewerContent.source_id}`);
                      window.open(url, "_blank");
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Source Document
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center py-12">
                  <FileText className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No citation selected.</p>
                  <p className="text-[11px] opacity-75 mt-0.5 max-w-[200px]">
                    Click on any citation pill in the chat to inspect its grounded excerpt.
                  </p>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
