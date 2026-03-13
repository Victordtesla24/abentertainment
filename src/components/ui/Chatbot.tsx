'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat() as any;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="bg-background border border-gold/20 rounded-2xl shadow-2xl w-80 sm:w-96 overflow-hidden flex flex-col h-[500px]">
          {/* Header */}
          <div className="bg-charcoal px-4 py-3 border-b border-gold/20 flex justify-between items-center text-ivory">
            <span className="font-playfair font-medium">AB Concierge</span>
            <button onClick={() => setIsOpen(false)} className="hover:text-gold transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground font-satoshi mt-10">
                Welcome to AB Entertainment. How may I assist you tonight?
              </p>
            )}
            {messages.map((m: { id: string, role: string, content: string }) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 font-satoshi text-sm ${
                    m.role === 'user'
                      ? 'bg-gold/20 text-foreground'
                      : 'bg-charcoal text-ivory'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-left">
                <div className="inline-block px-4 py-2 bg-charcoal text-ivory rounded-2xl animate-pulse text-sm">
                  Writing...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-gold/20 bg-background">
            <input
              className="w-full bg-charcoal/5 border border-gold/40 rounded-full px-4 py-2 text-sm font-satoshi focus:outline-none focus:ring-1 focus:ring-gold"
              value={input}
              placeholder="Ask about events, venues..."
              onChange={handleInputChange}
            />
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-charcoal text-ivory p-4 rounded-full shadow-xl hover:bg-gold hover:text-charcoal transition-all duration-300 border border-gold/40 group"
        >
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
}
