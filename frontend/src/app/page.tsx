import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white font-sans selection:bg-fuchsia-500 selection:text-white">
      <main className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-center justify-center min-h-[80vh] text-center">
        
        {/* Hero Section */}
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-medium tracking-wide text-emerald-100">LearnLoop AI v2.0 Live</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 drop-shadow-sm">
            Master Anything. <br/> Faster.
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            Your personalized AI tutor that maps your knowledge, targets your weaknesses, and adapts to how you learn best.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              href="/dashboard" 
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-600 font-bold text-lg hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(217,70,239,0.7)] transition-all duration-300"
            >
              Go to Dashboard
            </Link>
            <Link href="/learning-path" className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-lg backdrop-blur-sm transition-all duration-300">
              View Analytics
            </Link>
          </div>
        </div>
        
        {/* Stats / Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 w-full">
          {[
            { title: "Knowledge Tracing", desc: "Maps your exact mastery state" },
            { title: "RAG Augmented", desc: "Grounded in real course material" },
            { title: "Adaptive Quizzes", desc: "Questions scale to your level" }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 hover:-translate-y-2 transition-all duration-300 text-left group">
              <div className="w-12 h-12 rounded-full bg-fuchsia-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 bg-fuchsia-400 rounded-full blur-sm"></div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
        
      </main>
    </div>
  );
}
