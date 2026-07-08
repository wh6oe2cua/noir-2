import { historyQuestions } from "./questions/history";
import { scienceQuestions } from "./questions/science";
import { itTechQuestions } from "./questions/it_tech";
import { triviaQuestions } from "./questions/trivia";
import { fraudPreventionQuestions } from "./questions/fraud_prevention";
import { logicFlawQuestions } from "./questions/logic_flaw";

export interface Question {
  id: string;
  theme: string;
  difficulty: "normal" | "hard";
  title: string;
  segments: string[];
  incorrect_segment_index: number;
  original_incorrect_text: string;
  correct_fact: string;
  explanation: string;
}

export const PREMADE_QUESTIONS: Record<string, Question[]> = {
  "history": historyQuestions,
  "science": scienceQuestions,
  "it_tech": itTechQuestions,
  "trivia": triviaQuestions,
  "fraud_prevention": fraudPreventionQuestions,
  "logic_flaw": logicFlawQuestions
};
