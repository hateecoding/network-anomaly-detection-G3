export const REVIEW_THRESHOLD = 0.4;
export const ATTACK_THRESHOLD = 0.5;

export function getDisplayCategory(backendResult: "attack" | "normal", attackProbability: number) {
  if (backendResult === "attack" || attackProbability >= ATTACK_THRESHOLD) {
    return "Attack" as const;
  }

  if (attackProbability >= REVIEW_THRESHOLD) {
    return "Review Recommended" as const;
  }

  return "Normal" as const;
}
