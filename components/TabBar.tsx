"use client";

import React from "react";

export type TabId = "summary" | "keyPoints" | "qa";

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  isDarkTheme: boolean;
}

export function TabBar({ tabs, activeTab, onTabChange, isDarkTheme }: TabBarProps) {
  return (
    <div className={`border-b ${isDarkTheme ? "border-white/10" : "border-gray-200"} px-6`}>
      <div className="flex gap-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-4 px-2 font-medium text-sm transition-all relative group ${
              activeTab === tab.id
                ? isDarkTheme
                  ? "text-white"
                  : "text-gray-900"
                : isDarkTheme
                  ? "text-white/50 hover:text-white/70"
                  : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${
                isDarkTheme
                  ? "from-doc-purple-light to-doc-purple"
                  : "from-doc-purple to-doc-purple-light"
              }`}></div>
            )}
          </button>
        ))}
      </div>
      {/* Tooltip for active tab */}
      <div className={`py-2 text-xs ${isDarkTheme ? "text-white/40" : "text-gray-500"}`}>
        {tabs.find((tab) => tab.id === activeTab)?.description}
      </div>
    </div>
  );
}
