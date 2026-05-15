import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { API } from "@/lib/api";
import { TAB_CONFIG, TAB_STATUS_MAP } from "@/lib/constants";
import type { BacklogItem, BacklogStats, TabKey } from "@/lib/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { KpiBar } from "@/components/backlog/KpiBar";
import { FilterBar } from "@/components/backlog/FilterBar";
import { ItemList } from "@/components/backlog/ItemList";
import { DetailPanel } from "@/components/backlog/DetailPanel";
import { CreateItemModal } from "@/components/modals/CreateItemModal";
import { AddEvidenceModal } from "@/components/modals/AddEvidenceModal";
import { RegenerateModal } from "@/components/modals/RegenerateModal";
import { DispatchModal } from "@/components/modals/DispatchModal";
import { PromptHistoryModal } from "@/components/modals/PromptHistoryModal";
import { ChatGptSettings } from "@/components/settings/ChatGptSettings";
import { ACTION_STATUS_MAP } from "@/components/backlog/quickActions";

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("DETECTED");
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [stats, setStats] = useState<BacklogStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [addEvidenceOpen, setAddEvidenceOpen] = useState(false);
  const [evidenceItemId, setEvidenceItemId] = useState<string | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateItemId, setRegenerateItemId] = useState<string | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchItemId, setDispatchItemId] = useState<string | null>(null);
  const [dispatchPromptId, setDispatchPromptId] = useState<string | null>(null);
  const [dispatchAgent, setDispatchAgent] = useState<"OPENCODE" | "CLAUDE_CODE">("OPENCODE");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContent, setHistoryContent] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await API.getStats();
      setStats(s);
    } catch (e) {
      console.error("Error cargando stats:", e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (activeTab === "CHATGPT_MCP") return;

    setLoadingItems(true);
    setItemsError(null);

    const statuses = TAB_STATUS_MAP[activeTab] ?? [];
    const params = {
      search: search || undefined,
      type: filterType || undefined,
      source: filterSource || undefined,
      area: filterArea || undefined,
    };

    try {
      let list: BacklogItem[];
      if (statuses.length === 0) {
        list = await API.listItems(params);
      } else if (statuses.length === 1) {
        list = await API.listItems({ ...params, status: statuses[0] });
      } else {
        const results = await Promise.all(
          statuses.map((s) => API.listItems({ ...params, status: s }))
        );
        list = results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      setItems(list);
    } catch (e) {
      setItemsError((e as Error).message);
    } finally {
      setLoadingItems(false);
    }
  }, [activeTab, search, filterType, filterSource, filterArea]);

  // Initial + filter changes
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleSearchChange(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearch(value), 300);
    // We need controlled input; lift the raw value
    setSearchRaw(value);
  }

  // Keep raw input value separately so the typing experience stays smooth
  const [searchRaw, setSearchRaw] = useState("");

  function handleSelectTab(tab: TabKey) {
    setActiveTab(tab);
    setSelectedId(null);
    setDetailOpen(false);
  }

  function handleRefresh() {
    loadStats();
    loadItems();
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  function handleItemChanged() {
    loadStats();
    loadItems();
  }

  async function handleQuickAction(action: string, id: string) {
    const newStatus = ACTION_STATUS_MAP[action as keyof typeof ACTION_STATUS_MAP];
    if (!newStatus) return;
    try {
      await API.transitionStatus(id, newStatus);
      toast.success("Estado actualizado");
      if (selectedId === id) {
        setDetailOpen(false);
      }
      handleItemChanged();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  function handleCreated(item: BacklogItem) {
    handleItemChanged();
    openDetail(item.id);
  }

  function openAddEvidence(itemId: string) {
    setEvidenceItemId(itemId);
    setAddEvidenceOpen(true);
  }

  function openRegenerate(itemId: string) {
    setRegenerateItemId(itemId);
    setRegenerateOpen(true);
  }

  function openDispatch(itemId: string, promptId: string, agent: "OPENCODE" | "CLAUDE_CODE") {
    setDispatchItemId(itemId);
    setDispatchPromptId(promptId);
    setDispatchAgent(agent);
    setDispatchOpen(true);
  }

  function openPromptHistory(content: string) {
    setHistoryContent(content);
    setHistoryOpen(true);
  }

  const cfg = TAB_CONFIG[activeTab];
  const isSettings = activeTab === "CHATGPT_MCP";

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <Sidebar activeTab={activeTab} stats={stats} onSelectTab={handleSelectTab} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          title={cfg.label}
          description={cfg.desc}
          showActions={!isSettings}
          theme={theme}
          onRefresh={handleRefresh}
          onCreate={() => setCreateOpen(true)}
          onToggleTheme={toggleTheme}
        />

        {isSettings ? (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <ChatGptSettings />
          </div>
        ) : (
          <>
            <KpiBar stats={stats} activeTab={activeTab} onSelectTab={handleSelectTab} />
            <FilterBar
              search={searchRaw}
              type={filterType}
              source={filterSource}
              area={filterArea}
              onSearchChange={handleSearchChange}
              onTypeChange={setFilterType}
              onSourceChange={setFilterSource}
              onAreaChange={setFilterArea}
            />
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <ItemList
                items={items}
                loading={loadingItems}
                error={itemsError}
                selectedId={selectedId}
                onSelect={openDetail}
                onQuickAction={handleQuickAction}
              />
            </div>
          </>
        )}
      </main>

      {/* Detail panel */}
      <DetailPanel
        itemId={selectedId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelectedId(null);
        }}
        onItemChanged={handleItemChanged}
        onOpenAddEvidence={openAddEvidence}
        onOpenRegenerate={openRegenerate}
        onOpenDispatch={openDispatch}
        onOpenPromptHistory={openPromptHistory}
      />

      {/* Modals */}
      <CreateItemModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <AddEvidenceModal
        open={addEvidenceOpen}
        onOpenChange={setAddEvidenceOpen}
        itemId={evidenceItemId}
        onAdded={() => {
          // re-open detail to refresh
          if (evidenceItemId) {
            setDetailOpen(true);
            setSelectedId(evidenceItemId);
          }
        }}
      />
      <RegenerateModal
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        itemId={regenerateItemId}
        onDone={() => {
          if (regenerateItemId) {
            setDetailOpen(true);
            setSelectedId(regenerateItemId);
          }
        }}
      />
      <DispatchModal
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        itemId={dispatchItemId}
        promptId={dispatchPromptId}
        agent={dispatchAgent}
        onDispatched={() => {
          handleItemChanged();
          if (dispatchItemId) {
            setDetailOpen(true);
            setSelectedId(dispatchItemId);
          }
        }}
      />
      <PromptHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        content={historyContent}
      />

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: "border border-border bg-card text-foreground",
            success: "!border-success/40",
            error: "!border-destructive/40",
            info: "!border-info/40",
          },
        }}
      />
    </div>
  );
}
