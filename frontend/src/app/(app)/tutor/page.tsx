"use client";



import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

import { Card, CardContent } from '@/components/ui/card';

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

import { Badge } from '@/components/ui/badge';

import { Skeleton } from '@/components/ui/skeleton';

import { 

  Paperclip, Send, X, FileText, Image as ImageIcon, Video, 

  AlertTriangle, RefreshCcw, Copy, MessageSquare, ThumbsUp, Sparkles, 

  ThumbsDown, ChevronRight, Check, XCircle, Bug, ExternalLink 

} from 'lucide-react';



export default function TutorPage() {

  const [courseId, setCourseId] = useState<number>(1);

  const [sessionId, setSessionId] = useState<number | null>(null);

  

  // Left Panel

  const [sources, setSources] = useState<any[]>([]);

  const [sessions, setSessions] = useState<any[]>([{id: 1, name: "Blockchain Consensus Discussion"}]);

  

  // Center Panel

  const [messages, setMessages] = useState<any[]>([]);

  const [inputValue, setInputValue] = useState("");

  const [isTyping, setIsTyping] = useState(false);

  const [attachments, setAttachments] = useState<any[]>([]);

  const [isDragging, setIsDragging] = useState(false);

  

  // Settings & Debug

  const [style, setStyle] = useState("Standard");

  const [language, setLanguage] = useState("English");

  const [showDebug, setShowDebug] = useState(false);

  

  // Right Panel (Viewer)

  const [viewerOpen, setViewerOpen] = useState(true);

  const [viewerContent, setViewerContent] = useState<any>({
    location: "Page 5",
    source_title: "1_1_202402100007_Namrata Paralkar_ASS2.pdf",
    source_type: "pdf",
    excerpt: "Stratus introduces a shared-mempool layer that decouples transaction distribution from consensus. By having every replica disseminate its own transaction batches while the leader proposes only transaction IDs, Stratus eliminates the leader throughput bottleneck in permissioned blockchains.",
    media_url: "/api/media/35"
  });



  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);



  const scrollToBottom = () => {

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  };



  useEffect(() => {

    scrollToBottom();

  }, [messages, isTyping]);

  

  // Load initial sources

  useEffect(() => {

    fetch("http://localhost:8000/api/courses/1/knowledge")

      .then(res => res.json())

      .catch(() => {});

      

    // Mock or fetch initial sources

    setSources([

      { id: 34, name: "1_202402100007_Namrata Paralkar_ASS2.pptx", status: "ready", progress: 100 },

      { id: 35, name: "1_1_202402100007_Namrata Paralkar_ASS2.pdf", status: "ready", progress: 100 }

    ]);

  }, [courseId]);



  const handleDragOver = (e: React.DragEvent) => {

    e.preventDefault();

    setIsDragging(true);

  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {

    e.preventDefault();

    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {

      handleFiles(Array.from(e.dataTransfer.files));

    }

  };



  const handleFiles = async (files: File[]) => {

    for (let f of files) {

      const ext = f.name.split('.').pop()?.toLowerCase();

      if (!['pdf', 'pptx', 'mp4'].includes(ext || '')) {

        alert("Unsupported file format: " + f.name);

        continue;

      }

      if (f.size > 50 * 1024 * 1024) {

        alert("File too large: " + f.name);

        continue;

      }

      

      const newAtt = { id: Math.random().toString(), name: f.name, size: f.size, status: 'uploading', progress: 0, sourceId: null };

      setAttachments(prev => [...prev, newAtt]);

      

      const formData = new FormData();

      formData.append("file", f);

      try {

        const res = await fetch("http://localhost:8000/api/courses//upload", {

          method: "POST",

          body: formData

        });

        const data = await res.json();

        if (res.ok) {

          setAttachments(prev => prev.map(p => p.id === newAtt.id ? { ...p, status: 'ready', progress: 100, sourceId: data.source_id } : p));

          setSources(prev => [...prev, { id: data.source_id, name: f.name, status: 'ready', progress: 100 }]);

        } else {

          setAttachments(prev => prev.map(p => p.id === newAtt.id ? { ...p, status: 'failed', error: data.detail } : p));

        }

      } catch (err: any) {

        setAttachments(prev => prev.map(p => p.id === newAtt.id ? { ...p, status: 'failed', error: err.message } : p));

      }

    }

  };



  const removeAttachment = (id: string) => {

    setAttachments(prev => prev.filter(p => p.id !== id));

  };



  const sendMessage = async (isExternal = false, forcedText?: string) => {

    const textToSend = forcedText !== undefined ? forcedText : inputValue;

    if (!textToSend.trim()) return;



    if (!forcedText) setInputValue("");

    const tempId = Math.random();

    setMessages(prev => [...prev, { id: tempId, role: 'user', content: textToSend }]);

    setIsTyping(true);

    

    try {

      const endpoint = isExternal ? "http://localhost:8000/api/chat/external" : "http://localhost:8000/api/chat";

      const body: any = { course_id: courseId, message: textToSend };

      if (sessionId) body.session_id = sessionId;

      if (!isExternal) body.style = style.toLowerCase().replace(' ', '_');



      const res = await fetch(endpoint, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(body)

      });

      const data = await res.json();

      setIsTyping(false);

      

      if (res.ok) {

        if (data.session_id) setSessionId(data.session_id);

        

        setMessages(prev => [...prev, { 

          id: data.message_id || Math.random(), 

          role: 'assistant', 

          content: data.answer,

          status: data.status,

          citations: data.citations || [],

          coverage_note: data.coverage_note,

          mode: data.mode,

          debug: data.debug

        }]);

      } else {

        setMessages(prev => [...prev, { id: Math.random(), role: 'assistant', content: "Failed to fetch response: " + data.detail }]);

      }

    } catch (err: any) {

      setIsTyping(false);

      setMessages(prev => [...prev, { id: Math.random(), role: 'assistant', content: "Network error: " + err.message }]);

    }

  };



  const handleKeyDown = (e: React.KeyboardEvent) => {

    if (e.key === 'Enter' && !e.shiftKey) {

      e.preventDefault();

      sendMessage();

    }

  };



  const openViewer = (cit: any) => {

    setViewerContent(cit);

    setViewerOpen(true);

  };



  return (

    <div className="flex h-full w-full bg-background overflow-hidden relative">

      {/* Left Panel */}

      <div className="w-64 border-r bg-card flex flex-col hidden md:flex shrink-0">

        <div className="p-4 border-b">

          <Button variant="default" className="w-full" onClick={() => {setSessionId(null); setMessages([]);}}>

            + New Chat

          </Button>

        </div>

                {/* DIFFERENTIATING FEATURE 5 & 6: TEACH ME DIFFERENTLY QUICK ACTION BAR */}
        <div className="px-6 py-2.5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2 select-none shadow-xs">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-foreground flex items-center gap-1 text-[11px] uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Teach Me Differently:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: "💡 Analogy", val: "Analogy" },
                { label: "❓ Socratic", val: "Socratic" },
                { label: "🔬 First Principles", val: "First Principles" },
                { label: "📖 Story", val: "Story" }
              ].map(s => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => { setStyle(s.val); handleTeachDifferently(s.val, language); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                    style === s.val
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card hover:bg-muted text-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Language:</span>
            {[
              { label: "English", val: "English" },
              { label: "हिंदी", val: "Hindi" },
              { label: "मराठी", val: "Marathi" }
            ].map(l => (
              <button
                key={l.val}
                type="button"
                onClick={() => { setLanguage(l.val); handleTeachDifferently(style === 'Standard' ? 'Analogy' : style, l.val); }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                  language === l.val
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-card hover:bg-muted text-foreground border-border hover:border-purple-500/40"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          <div>

            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sources</h3>

            {sources.length === 0 ? (

              <p className="text-sm text-muted-foreground">No sources uploaded.</p>

            ) : (

              <div className="space-y-2">

                {sources.map(s => (

                  <div key={s.id} className="text-sm bg-muted/50 p-2.5 rounded-lg border flex flex-col gap-1">

                    <span className="truncate font-medium" title={s.name}>{s.name}</span>

                    <div className="flex items-center gap-1.5">

                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">

                        Ready

                      </Badge>

                      <span className="text-[10px] text-muted-foreground uppercase">{s.name.endsWith('.pptx') ? 'PPTX' : 'PDF'}</span>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

          <div>

            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Chats</h3>

            <div className="space-y-1">

              {sessions.map(s => (

                <button key={s.id} className="w-full text-left text-sm p-2 hover:bg-muted rounded truncate">

                  {s.name}

                </button>

              ))}

            </div>

          </div>

        </div>

      </div>



      {/* Center Panel (Chat) */}

      <div 

        className="flex-1 flex flex-col relative transition-all"

        onDragOver={handleDragOver}

        onDragLeave={handleDragLeave}

        onDrop={handleDrop}

      >

        {isDragging && (

          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center">

            <div className="flex flex-col items-center">

              <Paperclip className="h-12 w-12 text-primary mb-4" />

              <h2 className="text-xl font-bold">Drop files here to upload</h2>

              <p className="text-muted-foreground mt-2">Supports PDF, PPTX, MP4 (Max 50MB)</p>

            </div>

          </div>

        )}



        <div className="flex items-center justify-between p-3.5 border-b bg-card">

          <div className="flex items-center space-x-2">
            <Select value={style} onValueChange={(v: any) => { setStyle(v || ''); if (v !== 'Standard') handleTeachDifferently(v, language); }}>
              <SelectTrigger className="w-[145px] h-8 text-xs font-medium">
                <SelectValue placeholder="Pedagogical Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard Academic</SelectItem>
                <SelectItem value="Analogy">💡 Analogy</SelectItem>
                <SelectItem value="Socratic">❓ Socratic Inquiry</SelectItem>
                <SelectItem value="First Principles">🔬 First Principles</SelectItem>
                <SelectItem value="Story">📖 Narrative / Story</SelectItem>
              </SelectContent>
            </Select>

            <Select value={language} onValueChange={(v: any) => { setLanguage(v || ''); if (v !== 'English') handleTeachDifferently(style === 'Standard' ? 'Analogy' : style, v); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs font-medium">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="Marathi">मराठी (Marathi)</SelectItem>
              </SelectContent>
            </Select>
          </div>



          <div className="flex items-center space-x-2">

            {/* DEMO_MODE Debug toggle */}

            <Button 

              variant={showDebug ? "default" : "outline" } 

              size="sm" 

              className="h-8 text-xs flex items-center gap-1.5"

              onClick={() => setShowDebug(!showDebug)}

            >

              <Bug className="h-3.5 w-3.5" />

              {showDebug ? "Debug: ON" : "Debug: OFF"}

            </Button>

          </div>

        </div>



                {/* DIFFERENTIATING FEATURE 5 & 6: TEACH ME DIFFERENTLY QUICK ACTION BAR */}
        <div className="px-6 py-2.5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2 select-none shadow-xs">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-foreground flex items-center gap-1 text-[11px] uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Teach Me Differently:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: "💡 Analogy", val: "Analogy" },
                { label: "❓ Socratic", val: "Socratic" },
                { label: "🔬 First Principles", val: "First Principles" },
                { label: "📖 Story", val: "Story" }
              ].map(s => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => { setStyle(s.val); handleTeachDifferently(s.val, language); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                    style === s.val
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card hover:bg-muted text-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Language:</span>
            {[
              { label: "English", val: "English" },
              { label: "हिंदी", val: "Hindi" },
              { label: "मराठी", val: "Marathi" }
            ].map(l => (
              <button
                key={l.val}
                type="button"
                onClick={() => { setLanguage(l.val); handleTeachDifferently(style === 'Standard' ? 'Analogy' : style, l.val); }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                  language === l.val
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-card hover:bg-muted text-foreground border-border hover:border-purple-500/40"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {messages.length === 0 && (

            <div className="flex h-full flex-col items-center justify-center text-center max-w-md mx-auto opacity-70 my-auto py-12">

              <MessageSquare className="h-12 w-12 mb-4 text-primary" />

              <h2 className="text-xl font-bold mb-2">Source-Grounded AI Tutor</h2>

              <p className="text-sm text-muted-foreground mb-6">Ask any question about your course materials or try the prompt shortcuts below.</p>

              <div className="flex flex-wrap gap-2 justify-center">

                <Button variant="outline" size="sm" onClick={() => sendMessage(false, "What is Stratus and how does it decouple consensus?")}>

                  What is Stratus?

                </Button>

                <Button variant="outline" size="sm" onClick={() => sendMessage(false, "explain the content in the attached ppt")}>

                  Summarize attached PPT

                </Button>

                <Button variant="outline" size="sm" onClick={() => sendMessage(false, "explain red-black trees")}>

                  Explain Red-Black trees (Off-material)

                </Button>

              </div>

            </div>

          )}

          

          {messages.map((m, i) => (

            <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>

              <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>

                {m.status === 'not_in_material' ? (

                  <div className="flex flex-col space-y-3">

                    <div className="flex items-center space-x-2 text-amber-500">

                      <AlertTriangle className="h-5 w-5" />

                      <span className="font-semibold">Refusal Gate: Not Found In Material</span>

                    </div>

                    <p className="text-sm text-foreground/90 leading-relaxed">{m.content}</p>

                    {m.coverage_note && (

                      <div className="text-xs bg-amber-500/10 text-amber-500 p-2 rounded-md border border-amber-500/20">

                        <strong>Coverage note:</strong> {m.coverage_note}

                      </div>

                    )}

                    <div className="flex items-center gap-2 pt-1">

                      <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs" onClick={() => {

                        const lastUserQ = messages[i-1]?.content || "";

                        sendMessage(true, lastUserQ);

                      }}>

                        Explain using External Knowledge

                      </Button>

                    </div>

                  </div>

                ) : (

                  <>

                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.content}</div>

                    

                    {m.mode === 'external' && (

                      <div className="mt-3">

                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/5 text-xs">

                          External Knowledge (Outside Material)

                        </Badge>

                      </div>

                    )}



                    {m.citations && m.citations.length > 0 && (

                      <div className="mt-4 pt-3 border-t">

                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">

                          Verified Citations ({m.citations.length}):

                        </div>

                        <div className="flex flex-wrap gap-2">

                          {m.citations.map((c: any, idx: number) => (
                            <button
                              key={idx}
                              type="button"
                              data-citation="true"
                              className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/80 hover:bg-primary/20 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log("Citation clicked!", c); openViewer(c); }}
                            >
                              {c.source_type === 'pdf' ? <FileText className="h-3.5 w-3.5 text-blue-400" /> : <ImageIcon className="h-3.5 w-3.5 text-orange-400" />}
                              <span className="font-medium text-xs">{c.location}</span>
                              <span className="text-[10px] opacity-75">({c.source_title?.slice(0, 16)}...)</span>
                            </button>
                          ))}

                        </div>

                      </div>

                    )}



                    {/* Debug Panel View (when enabled) */}

                    {showDebug && m.debug && (

                      <div className="mt-4 p-3 bg-muted/60 rounded-lg border text-xs font-mono space-y-1.5 overflow-x-auto text-muted-foreground">

                        <div className="text-foreground font-semibold flex items-center justify-between">

                          <span>[DEBUG RETRIEVAL LOGS]</span>

                          <span className="text-emerald-500">Rerank Score: {m.debug.max_score?.toFixed(4)}</span>

                        </div>

                        <div><strong>Query:</strong> {m.debug.rewritten_query}</div>

                        <div><strong>Status:</strong> {m.debug.refusal_status}</div>

                        <div><strong>Chunks Retrieved:</strong> {m.debug.retrieved_chunks?.length || 0}</div>

                        <div className="max-h-36 overflow-y-auto space-y-1 pt-1">

                          {m.debug.retrieved_chunks?.map((rc: any, rIdx: number) => (

                            <div key={rIdx} className="border-b pb-1">

                              #{rc.id} | {rc.location} | score: {rc.score?.toFixed(3)}: {rc.preview}

                            </div>

                          ))}

                        </div>

                      </div>

                    )}

                    

                    {m.role === 'assistant' && (

                      <div className="flex items-center space-x-1 mt-3 pt-2 text-muted-foreground">

                        <Button variant="ghost" size="icon" className="h-6 w-6"><Copy className="h-3 w-3" /></Button>

                        <div className="flex-1" />

                        <Button variant="ghost" size="icon" className="h-6 w-6"><ThumbsUp className="h-3 w-3" /></Button>

                        <Button variant="ghost" size="icon" className="h-6 w-6"><ThumbsDown className="h-3 w-3" /></Button>

                      </div>

                    )}

                  </>

                )}

              </div>

            </div>

          ))}

          

          {isTyping && (

            <div className="flex justify-start">

              <div className="bg-card border rounded-2xl p-4 flex space-x-2 items-center shadow-sm">

                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />

                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />

                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />

                <span className="text-xs text-muted-foreground ml-2">Grounded retrieval & reasoning...</span>

              </div>

            </div>

          )}

          

          <div ref={messagesEndRef} />

        </div>



        <div className="p-4 bg-background border-t">

          <div className="flex items-end bg-card border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-sm">

            <button 

              className="p-3 text-muted-foreground hover:text-foreground transition-colors"

              onClick={() => fileInputRef.current?.click()}

            >

              <Paperclip className="h-5 w-5" />

            </button>

            <input 

              type="file" 

              className="hidden" 

              ref={fileInputRef} 

              multiple 

              accept=".pdf,.pptx,.mp4" 

              onChange={(e) => { if(e.target.files) handleFiles(Array.from(e.target.files)); }} 

            />

            

            <textarea

              className="flex-1 bg-transparent p-3 outline-none resize-none min-h-[44px] max-h-32 text-sm text-foreground"

              placeholder="Ask anything from the course material or attached presentation..."

              rows={1}

              value={inputValue}

              onChange={e => setInputValue(e.target.value)}

              onKeyDown={handleKeyDown}

            />

            

            <button 

              className="p-3 transition-colors"

              onClick={() => sendMessage(false)}

              disabled={!inputValue.trim() || isTyping}

            >

              <Send className="h-5 w-5" />

            </button>

          </div>

          <div className="text-center mt-2 text-[10px] text-muted-foreground">

            Verified source citations are anchored strictly to uploaded database material.

          </div>

        </div>

      </div>



      {/* Right Panel (Source Viewer) */}

      {viewerOpen && (

        <div className="absolute right-0 top-0 bottom-0 w-96 bg-card border-l flex flex-col z-40 shadow-2xl transition-all duration-300">

          <div className="flex items-center justify-between p-3.5 border-b bg-muted/40">

            <div className="flex items-center gap-2">

              {viewerContent?.source_type === 'pdf' ? <FileText className="h-4 w-4 text-blue-400" /> : <ImageIcon className="h-4 w-4 text-orange-400" />}

              <h3 className="font-semibold text-sm truncate max-w-[200px]">{viewerContent?.location || "Source Viewer"}</h3>

            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewerOpen(false)}>

              <X className="h-4 w-4" />

            </Button>

          </div>

          

          <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">

            {viewerContent ? (

              <>

                <div className="p-3 bg-muted/50 rounded-lg border">

                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Source File</div>

                  <div className="text-sm font-medium text-foreground truncate">{viewerContent.source_title}</div>

                  <div className="mt-1 text-xs text-primary font-medium flex items-center gap-1">

                    Location: {viewerContent.location}

                  </div>

                </div>



                <div className="p-3 bg-card rounded-lg border space-y-2">

                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Extracted Chunk Text</div>

                  <div className="text-sm text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap bg-muted/30 p-2.5 rounded border">

                    {viewerContent.excerpt}

                  </div>

                </div>



                <div className="space-y-2 pt-2">

                  <Button 

                    variant="outline" 

                    className="w-full flex items-center justify-center gap-2 text-xs"

                    onClick={() => {

                      if (viewerContent.media_url) {

                        window.open(`http://localhost:8000${viewerContent.media_url}`, "_blank");

                      }

                    }}

                  >

                    <ExternalLink className="h-3.5 w-3.5" />

                    Open Original File in New Tab

                  </Button>

                </div>

              </>

            ) : (

              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">

                <FileText className="h-12 w-12 mb-3 opacity-30" />

                Select a citation badge to inspect original chunk and slide.

              </div>

            )}

          </div>

        </div>

      )}

    </div>

  );

}

