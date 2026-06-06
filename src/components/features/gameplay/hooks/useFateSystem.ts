import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { FateSettings } from "../modals/FateSettingsModal";
import { ChatMessage, WorldData, AppSettings } from "../../../../types";
import { dbService } from "../../../../services/db/indexedDB";

export function useFateSystem(
  activeWorld: WorldData | null,
  settings: AppSettings | null,
  onUpdateWorld: ((data: Partial<WorldData>) => void) | undefined,
) {
  const [isDead, setIsDead] = useState(false);
  const [showFateSettingsModal, setShowFateSettingsModal] = useState(false);
  const [showFateRollModal, setShowFateRollModal] = useState(false);
  const [pendingActionText, setPendingActionText] = useState("");
  const [fateSettings, setFateSettings] = useState<FateSettings>({
    enabled: false,
    diceType: "D20",
    dc: 8,
    autoRoll: false,
    cheatEnabled: true,
    rate: 100,
    onlyHiddenFromSchedule: false,
  });

  // Sync Fate Settings per World
  useEffect(() => {
    if (activeWorld?.extensions?.fate_settings) {
      setFateSettings(activeWorld.extensions.fate_settings);
    } else {
      setFateSettings({
        enabled: false,
        diceType: "D20",
        dc: 8,
        autoRoll: false,
        cheatEnabled: true,
        rate: 100,
        onlyHiddenFromSchedule: false,
      });
    }
  }, [activeWorld?.id]);

  const handleUpdateFateSettings = useCallback(
    (newSettings: FateSettings) => {
      setFateSettings(newSettings);
      if (onUpdateWorld && activeWorld) {
        onUpdateWorld({
          extensions: {
            ...(activeWorld.extensions || {}),
            fate_settings: newSettings,
          },
        });
      }
    },
    [activeWorld, onUpdateWorld],
  );

  const checkDeathStatus = useCallback(
    (historyList: ChatMessage[], lsrData?: Record<string, unknown[]>): boolean => {
      const isTormentDifficulty =
        activeWorld?.config?.difficulty?.id === "torment" ||
        settings?.difficulty?.id === "torment";
      if (!isTormentDifficulty) return false;

      const modelMessages = historyList.filter((m) => m.role === "model");
      if (modelMessages.length === 0) return false;

      const lastModelMsg = modelMessages[modelMessages.length - 1];
      const textToSearch = lastModelMsg.text.toLowerCase();

      if (
        textToSearch.includes("player_character_died") ||
        (textToSearch.includes("system_event") && textToSearch.includes("died"))
      ) {
        return true;
      }

      const preciseDeathPhrases = [
        "bạn đã chết",
        "bạn đã tử vong",
        "ngươi đã chết",
        "ngươi đã tử vong",
        "nhân vật chính đã chết",
        "nhân vật chính đã tử vong",
        "bạn bị giết chết",
        "ngươi bị giết chết",
        "bí cảnh thất bại",
        "trò chơi kết thúc",
        "game over",
        "you died",
        "you have died",
        "you are dead",
      ];

      if (preciseDeathPhrases.some((phrase) => textToSearch.includes(phrase))) {
        return true;
      }

      if (lsrData && lsrData["2"]) {
        const t2 = lsrData["2"] as any[][];
        const playerStats = t2.map((row) => ({
          name: row[0],
          value: row[1],
          desc: row[2],
        }));
        const healthStat = playerStats.find((s) => {
          const nameLower = s.name?.toLowerCase() || "";
          return (
            (nameLower.includes("máu") ||
              nameLower.includes("hp") ||
              nameLower.includes("sinh mệnh") ||
              nameLower.includes("health")) &&
            !nameLower.includes("thể lực") &&
            !nameLower.includes("stamina") &&
            !nameLower.includes("mana") &&
            !nameLower.includes("nội lực")
          );
        });
        if (healthStat) {
          const valStr = String(healthStat.value).toLowerCase().trim();
          if (
            valStr === "0" ||
            valStr === "0%" ||
            valStr === "chết" ||
            valStr === "tử vong" ||
            valStr === "đã chết"
          ) {
            return true;
          }
        }
      }

      return false;
    },
    [activeWorld, settings],
  );

  const triggerPermadeath = useCallback(async () => {
    setIsDead(true);
    const worldName = activeWorld?.world?.worldName;
    const worldId = activeWorld?.id;
    if (worldName || worldId) {
      try {
        const saves = await dbService.getAllSaves();
        for (const save of saves) {
          const sData = save.data as WorldData;
          if (
            (worldId && sData?.id === worldId) ||
            (worldName && sData?.world?.worldName === worldName)
          ) {
            await dbService.deleteSave(save.id);
          }
        }
        toast.error(
          "Chế độ Địa Ngục: Nhân vật đã tử vong. Toàn bộ file lưu của thế giới này đã bị xóa sạch vễn viễn!",
        );
      } catch (err) {
        console.error("Permadeath save deletion failed:", err);
      }
    }
  }, [activeWorld]);

  return {
    isDead,
    setIsDead,
    showFateSettingsModal,
    setShowFateSettingsModal,
    showFateRollModal,
    setShowFateRollModal,
    pendingActionText,
    setPendingActionText,
    fateSettings,
    setFateSettings,
    handleUpdateFateSettings,
    checkDeathStatus,
    triggerPermadeath,
  };
}
