
import { DifficultyLevel, OutputLength, SafetySetting } from "../types";

export const DEFAULT_SAFETY_SETTINGS: SafetySetting[] = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    id: 'easy',
    label: 'Dễ (Easy)',
    prompt: "Game Difficulty: Easy — The story progresses such that '<user>' is always in a warm, dream-like world full of happiness, luck, and love. Challenges are trivial to overcome, and the protagonist has absolute main-character aura/invincibility."
  },
  {
    id: 'normal',
    label: 'Bình thường (Normal)',
    prompt: "Difficulty: Normal — The story progresses with a balanced mix of fortune and challenges. The world behaves normally, the player cannot die, and there are no permanent negative consequences or disadvantages for the player character."
  },
  {
    id: 'hard',
    label: 'Khó (Hard)',
    prompt: `Game Difficulty: Hard — Real-world logic and strict causality apply. Incorrect or careless actions will result in severe wounds, permanent scars, or realistic losses of possessions or companions. Characters have highly independent, unforgiving personalities.`
  },
  {
    id: 'torment',
    label: 'Địa Ngục (Hell)',
    prompt: `Game Difficulty: Hell / Torment — Brutal survival and unforgiving destiny. This is a Permadeath Mode.
RULES FOR DEATH TRIGGERING:
1. The protagonist (player character) does NOT have 100% smooth success for all requests/actions. There are high risks, variation, and struggles.
2. An elegant failure or critical injury is NOT a death. Characters can survive near-death experiences, lose items or companions, or suffer permanent wounds. Do NOT trigger a direct character death unless a fatal event is completely unavoidable or highly dramatic and logical.
3. If (and ONLY if) you as the Game Master AI have consistently determined and confirmed that the protagonist/player character is dead, you MUST explicitly output this tag at the very end of your response: <system_event>PLAYER_CHARACTER_DIED</system_event>. Do NOT output this tag if the player is still alive, injured, or merely near death.`
  }
];

export const OUTPUT_LENGTHS: OutputLength[] = [
  { id: 'short', label: 'Ngắn (300 - 600 từ)', minWords: 300, maxWords: 600 },
  { id: 'medium', label: 'Trung bình (600 - 1200 từ)', minWords: 600, maxWords: 1200 },
  { id: 'default', label: 'Mặc định (1200 - 2500 từ)', minWords: 1200, maxWords: 2500 },
  { id: 'long', label: 'Dài (2500 - 5000 từ)', minWords: 2500, maxWords: 5000 },
  { id: 'supreme', label: 'Tối thượng (5000 - 15000 từ)', minWords: 5000, maxWords: 15000 },
  { id: 'custom', label: 'Tùy chỉnh', minWords: 0 }, 
];

export const generateWordCountPrompt = (min: number, max: number) => `
<word_count_protocol>
TARGET: ${min} - ${max} words. (STRICTLY ADHERE TO MAXIMUM LIMIT)

You are a professional AI. Before writing the main story, you MUST open the <word_count> tag to plan the length.

Mandatory structure in the <word_count> tag:
1. [Target] Set a specific word count target within the range ${min}-${max}. Absolutely do not exceed ${max} words.
2. [Segmentation] Break the story into 3-4 segments (Checkpoints), estimating the word count for each.
3. [Pacing] Determine the pacing (Fast/Slow/Intense) to achieve that word count without using filler text.

Rules:
- Only perform arithmetic calculations and layout here.
- DO NOT write story content or character psychological speculation here.
- If you write too long (> ${max} words), the response will be cut off and considered a failure.
- If there is no <word_count> tag at the beginning of the response, the system will consider it a serious error.
</word_count_protocol>
`;
