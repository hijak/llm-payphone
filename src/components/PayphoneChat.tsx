"use client";

import type { ChatStatus } from "ai";
import { useEffect, useMemo } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";

export type PayphoneChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
};

export function PayphoneChat({
  title,
  subtitle,
  avatarUrl,
  connected,
  messages,
  input,
  setInput,
  status,
  speaking,
  ttsPlaying,
  onSend,
  onHangup,
  onStopTts,
}: {
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  connected: boolean;
  messages: PayphoneChatMsg[];
  input: string;
  setInput: (v: string) => void;
  status: ChatStatus;
  speaking: boolean;
  ttsPlaying: boolean;
  onSend: (text: string) => Promise<void> | void;
  onHangup: () => void;
  onStopTts: () => void;
}) {
  const placeholder = connected ? "Say something…" : "Dial a configured number";

  const headerSubtitle = useMemo(() => {
    if (subtitle) return subtitle;
    return connected ? "Line connected" : "Idle";
  }, [connected, subtitle]);

  const headerHint = connected ? "Texting live" : "Pick a contact or dial";

  const collapsed = !connected;

  function AutoScroll({ dep }: { dep: number }) {
    const { scrollToBottom } = useStickToBottomContext()

    useEffect(() => {
      // Wait for layout, then scroll.
      const raf = requestAnimationFrame(() => scrollToBottom())
      return () => cancelAnimationFrame(raf)
    }, [dep, scrollToBottom])

    return null
  }

  return (
    <div className="w-full px-4">
      <div
        className={
          "mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-all duration-300 " +
          (collapsed ? "h-[64px]" : "h-[520px]")
        }
      >
        <header className="flex items-center justify-between gap-4 border-b border-border/80 px-4 py-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-balance text-sm font-semibold">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-md"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : null}
              {title}
            </div>
            <div className="flex items-center gap-2 text-pretty text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span
                  className={
                    "size-1.5 rounded-full " +
                    (connected ? "bg-emerald-500" : "bg-zinc-500")
                  }
                />
                {headerSubtitle}
              </span>
              <span className="hidden sm:inline">— {headerHint}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onStopTts}
              disabled={!ttsPlaying}
              title="Stop playback"
            >
              Stop
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onHangup}
              disabled={!connected}
            >
              Hang up
            </Button>
          </div>
        </header>

        {!collapsed && (
          <>
            <Conversation className="bg-muted/30">
              <ConversationContent className="gap-6 pl-1">
                {messages.map((m) => (
                  <Message key={m.id} from={m.role}>
                    <MessageContent className={m.pending ? "opacity-70" : undefined}>
                      {m.role === "assistant" ? (
                        <MessageResponse>{m.text}</MessageResponse>
                      ) : (
                        <p className="whitespace-pre-wrap text-pretty">{m.text}</p>
                      )}
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
                <AutoScroll dep={messages.length} />
                <ConversationScrollButton />
              </Conversation>

            <div className="bg-background">
              <PromptInput
                onSubmit={async (message) => {
                  await onSend(message.text);
                }}
                className="w-full [&>[data-slot=input-group]]:rounded-none [&>[data-slot=input-group]]:shadow-none [&>[data-slot=input-group]]:border-t [&>[data-slot=input-group]]:border-x-0 [&>[data-slot=input-group]]:border-b-0 [&>[data-slot=input-group]]:border-border/80 [&>[data-slot=input-group]]:focus-within:ring-0 [&>[data-slot=input-group]]:focus-within:ring-transparent [&>[data-slot=input-group]]:focus-within:ring-offset-0 [&>[data-slot=input-group]]:focus-within:border-border/80 [&>[data-slot=input-group]]:focus-within:outline-none"
              >
                <PromptInputTextarea
                  placeholder={placeholder}
                  value={input}
                  onChange={(event) => setInput(event.currentTarget.value)}
                  disabled={!connected}
                  className="min-h-[96px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      // Let PromptInput handle submit; just trigger the form submit event.
                      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit?.();
                    }
                  }}
                />
                <PromptInputFooter>
                  <PromptInputSubmit
                    status={status}
                    disabled={!connected || !input.trim() || speaking || status !== "ready"}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
