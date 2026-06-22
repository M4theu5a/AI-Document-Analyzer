"use client";

import { Upload, MessageSquare, Zap, GitCompare } from "lucide-react";
import React from "react";

interface WelcomeScreenProps {
  isDarkTheme: boolean;
  onUploadClick: () => void;
}

export function WelcomeScreen({ isDarkTheme, onUploadClick }: WelcomeScreenProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const quickActions = [
    { icon: Zap, label: "Summarise" },
    { icon: MessageSquare, label: "Extract key points" },
    { icon: MessageSquare, label: "Ask a question" },
    { icon: GitCompare, label: "Compare documents" },
  ];

  return (
    <div className={`flex-1 flex items-center justify-center ${isDarkTheme ? "dark-theme" : ""}`}>
      <div className="w-full max-w-2xl mx-auto px-6 text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-3xl ${
            isDarkTheme
              ? "bg-gradient-to-br from-doc-purple to-doc-purple-light text-white"
              : "bg-gradient-to-br from-doc-purple to-doc-purple-light text-white"
          }`}>
            D
          </div>
        </div>

        {/* Greeting */}
        <h1 className={`text-4xl font-bold mb-2 ${isDarkTheme ? "text-white" : "text-gray-900"}`}>
          {getGreeting()}
        </h1>

        {/* Description */}
        <p className={`text-lg mb-8 ${isDarkTheme ? "text-white/60" : "text-gray-600"}`}>
          Upload or paste a document to get started with intelligent analysis
        </p>

        {/* Main Input Area */}
        <div
          onClick={onUploadClick}
          className={`mb-12 p-8 rounded-2xl cursor-pointer transition-all border-2 border-dashed ${
            isDarkTheme
              ? "border-doc-purple/30 hover:border-doc-purple/60 bg-doc-purple/5 hover:bg-doc-purple/10"
              : "border-doc-purple/30 hover:border-doc-purple/60 bg-doc-purple/5 hover:bg-doc-purple/10"
          }`}
        >
          <Upload size={48} className={`mx-auto mb-4 ${isDarkTheme ? "text-doc-purple" : "text-doc-purple"}`} />
          <p className={`text-xl font-semibold ${isDarkTheme ? "text-white" : "text-gray-900"}`}>
            Upload or paste a document to get started
          </p>
          <p className={`text-sm mt-2 ${isDarkTheme ? "text-white/50" : "text-gray-600"}`}>
            Supports PDF, Word, and plain text
          </p>
        </div>

        {/* Quick Action Chips */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  isDarkTheme
                    ? "glass-card hover:bg-white/10 text-white/90"
                    : "glass-card hover:bg-white/20 text-gray-900"
                }`}
              >
                <Icon size={18} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
