"use client";

import { Plus, Search, Moon, Sun, Clock, File, Trash2 } from "lucide-react";
import React, { useState } from "react";

interface RecentDocument {
  id: string;
  filename: string;
  preview: string;
  timestamp: string;
}

interface SidebarProps {
  onNewDocument: () => void;
  onSelectDocument: (id: string) => void;
  recentDocuments: RecentDocument[];
  isDarkTheme: boolean;
  onThemeToggle: () => void;
  onSearchChange: (query: string) => void;
  onDeleteDocument: (id: string) => void;
}

export function Sidebar({
  onNewDocument,
  onSelectDocument,
  recentDocuments,
  isDarkTheme,
  onThemeToggle,
  onSearchChange,
  onDeleteDocument,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange(query);
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen w-60 flex flex-col z-50 ${
      isDarkTheme
        ? "bg-doc-dark border-r border-white/10"
        : "bg-white border-r border-gray-200"
    }`}>
      {/* Header with logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
            isDarkTheme
              ? "bg-gradient-to-br from-doc-purple to-doc-purple-light text-white"
              : "bg-doc-purple text-white"
          }`}>
            D
          </div>
          <div>
            <h1 className={`text-base font-bold ${isDarkTheme ? "text-white" : "text-gray-900"}`}>
              DocAnalyzer
            </h1>
            <p className={`text-xs ${isDarkTheme ? "text-white/40" : "text-gray-500"}`}>AI</p>
          </div>
        </div>
      </div>

      {/* New Document Button */}
      <div className="px-4 py-4">
        <button
          onClick={onNewDocument}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
            isDarkTheme
              ? "bg-doc-purple hover:shadow-[0_0_40px_rgba(127,119,221,0.8)] text-white"
              : "bg-doc-purple hover:bg-doc-purple/90 text-white"
          }`}
        >
          <Plus size={18} />
          <span>New Document</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className={`relative flex items-center gap-2 px-3 py-2 rounded-lg ${
          isDarkTheme ? "bg-white/5 border border-white/10" : "bg-gray-100 border border-gray-300"
        }`}>
          <Search size={16} className={isDarkTheme ? "text-white/50" : "text-gray-500"} />
          <input
            type="text"
            placeholder="Search... (Ctrl+K)"
            value={searchQuery}
            onChange={handleSearchChange}
            className={`flex-1 bg-transparent outline-none text-sm ${
              isDarkTheme ? "text-white placeholder-white/30" : "text-gray-900 placeholder-gray-500"
            }`}
          />
        </div>
      </div>

      {/* Recent Documents */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
          isDarkTheme ? "text-white/50" : "text-gray-500"
        }`}>
          Recent Documents
        </h2>

        {recentDocuments.length === 0 ? (
          <div className="text-center py-8">
            <File size={32} className={isDarkTheme ? "text-white/20 mx-auto mb-2" : "text-gray-300 mx-auto mb-2"} />
            <p className={`text-sm font-medium mb-1 ${isDarkTheme ? "text-white/50" : "text-gray-600"}`}>
              No recent documents yet
            </p>
            <p className={`text-xs ${isDarkTheme ? "text-white/30" : "text-gray-500"}`}>
              Upload or paste a document to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`group p-3 rounded-lg cursor-pointer transition-all ${
                  isDarkTheme
                    ? "hover:bg-white/10 active:bg-white/15"
                    : "hover:bg-gray-100 active:bg-gray-200"
                }`}
                onClick={() => onSelectDocument(doc.id)}
              >
                <p className={`text-sm font-medium truncate ${isDarkTheme ? "text-white/90" : "text-gray-900"}`}>
                  {doc.filename}
                </p>
                <p className={`text-xs italic truncate ${isDarkTheme ? "text-white/50" : "text-gray-600"}`}>
                  {doc.preview}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className={isDarkTheme ? "text-white/30" : "text-gray-500"} />
                    <span className={`text-xs ${isDarkTheme ? "text-white/30" : "text-gray-500"}`}>
                      {doc.timestamp}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
                      isDarkTheme ? "hover:bg-white/10" : "hover:bg-gray-300"
                    }`}
                  >
                    <Trash2 size={14} className={isDarkTheme ? "text-white/50" : "text-gray-600"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <div className="border-t border-white/10 px-4 py-4">
        <button
          onClick={onThemeToggle}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
            isDarkTheme
              ? "bg-white/10 hover:bg-white/15 text-white/90"
              : "bg-gray-100 hover:bg-gray-200 text-gray-900"
          }`}
        >
          {isDarkTheme ? (
            <>
              <Moon size={16} />
              <span className="text-sm">Dark</span>
            </>
          ) : (
            <>
              <Sun size={16} />
              <span className="text-sm">Light</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
