import { useState } from 'react';

export function useModalState() {
  const [showCharModal, setShowCharModal] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showLogConsole, setShowLogConsole] = useState(false);
  const [showRegexModal, setShowRegexModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showStoryDebugModal, setShowStoryDebugModal] = useState(false);
  const [selectedDebugMessageIndex, setSelectedDebugMessageIndex] = useState<number | null>(null);
  const [selectingAvatarFor, setSelectingAvatarFor] = useState<{
    type: 'player' | 'entity';
    id?: string;
  } | null>(null);

  return {
    showCharModal, setShowCharModal,
    showGlobalModal, setShowGlobalModal,
    showHistoryModal, setShowHistoryModal,
    showContextModal, setShowContextModal,
    showImageLibrary, setShowImageLibrary,
    showLogConsole, setShowLogConsole,
    showRegexModal, setShowRegexModal,
    showCalendarModal, setShowCalendarModal,
    showMobileSidebar, setShowMobileSidebar,
    showStoryDebugModal, setShowStoryDebugModal,
    selectedDebugMessageIndex, setSelectedDebugMessageIndex,
    selectingAvatarFor, setSelectingAvatarFor
  };
}
