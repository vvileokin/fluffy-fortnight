import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Question,
  Option,
  QuestionKind,
  QuestionStatus,
  Difficulty,
} from "@/lib/data";

type Row = {
  id: string;
  match_id: string;
  kind: string;
  title: string;
  difficulty: string;
  status: string;
  deadline_label: string | null;
  options: Option[] | null;
};

function toQuestion(r: Row): Question {
  return {
    id: r.id,
    matchId: r.match_id,
    kind: (r.kind as QuestionKind) ?? "custom",
    title: r.title,
    difficulty: (r.difficulty as Difficulty) ?? "medium",
    status: (r.status as QuestionStatus) ?? "open",
    deadlineISO: "",
    deadlineLabel: r.deadline_label ?? "",
    options: Array.isArray(r.options) ? r.options : [],
  };
}

/** Questions attached to one match, in creation order. */
export async function getQuestionsForMatch(matchId: string): Promise<Question[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("questions")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => toQuestion(r as Row));
  } catch {
    return [];
  }
}

/** Currently answerable questions across all matches (for the home/interactives feeds). */
export async function getOpenQuestions(limit = 20): Promise<Question[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("questions")
      .select("*")
      .in("status", ["open", "upcoming"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => toQuestion(r as Row));
  } catch {
    return [];
  }
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("questions").select("*").eq("id", id).maybeSingle();
    if (data) return toQuestion(data as Row);
  } catch {
    /* ignore */
  }
  return undefined;
}
