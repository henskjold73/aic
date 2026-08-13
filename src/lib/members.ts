import { daysInMonth } from "@/lib/date";
import type {
  AicInsight,
  BudgetedMember,
  EnrichedMember,
  FlatMember,
  MonthKey,
  TeamMember,
} from "@/types";

/**
 * Keep only members who have synced usage for `month` and hoist their usage
 * figures to the top level for easier rendering.
 */
export function toFlatMembers(
  members: readonly TeamMember[],
  month: MonthKey,
): FlatMember[] {
  const flat: FlatMember[] = [];
  for (const member of members) {
    const usage = member.usage;
    if (!usage || usage.month !== month) continue;
    flat.push({
      uuid: member.uuid,
      name: member.name,
      joined_at: member.joined_at,
      usage,
      aiu: usage.aiu,
      budget: usage.budget ?? null,
    });
  }
  return flat;
}

/** Add pace figures (allowed vs actual AIU per day) to each member. */
export function enrichMembers(
  members: readonly FlatMember[],
  today: Date = new Date(),
): EnrichedMember[] {
  const dayOfMonth = today.getDate();
  const totalDays = daysInMonth(today.getFullYear(), today.getMonth());

  return members.map((member) => {
    const allowedPerDay = member.budget != null ? member.budget / totalDays : null;
    const actualPerDay = dayOfMonth > 0 ? member.aiu / dayOfMonth : 0;
    const ratio =
      allowedPerDay != null && allowedPerDay > 0 ? actualPerDay / allowedPerDay : null;
    return { ...member, allowedPerDay, actualPerDay, ratio };
  });
}

/** Type guard selecting members whose budget makes their pace figures non-null. */
export function hasBudget(member: EnrichedMember): member is BudgetedMember {
  return member.ratio != null && member.allowedPerDay != null;
}

/** Members sorted by AIU consumed, highest first. */
export function sortByUsage(members: readonly EnrichedMember[]): EnrichedMember[] {
  return [...members].sort((a, b) => b.aiu - a.aiu);
}

/** Budgeted members sorted by how close their actual pace is to their allowance. */
export function sortByBudgetProximity(
  members: readonly EnrichedMember[],
): BudgetedMember[] {
  return members
    .filter(hasBudget)
    .sort(
      (a, b) =>
        Math.abs(a.actualPerDay - a.allowedPerDay) -
        Math.abs(b.actualPerDay - b.allowedPerDay),
    );
}

/**
 * Burn-rate summary for a single budget/usage pair.
 *
 * @returns `null` when either figure is missing or not a positive number.
 */
export function computeInsight(
  budgetInput: string,
  usedInput: string,
  today: Date = new Date(),
): AicInsight | null {
  const budget = Number.parseFloat(budgetInput);
  const used = Number.parseFloat(usedInput);
  if (!Number.isFinite(budget) || !Number.isFinite(used) || !budget || !used) {
    return null;
  }

  const daysGone = today.getDate();
  const totalDays = daysInMonth(today.getFullYear(), today.getMonth());
  const daysLeft = totalDays - daysGone;

  const dailyBurnRate = used / daysGone;
  const projected = dailyBurnRate * totalDays;
  const remaining = budget - used;
  const allowedDailyFromNow = daysLeft > 0 ? remaining / daysLeft : 0;
  const pctUsed = (used / budget) * 100;
  const expectedPctUsed = (daysGone / totalDays) * 100;

  return {
    dailyBurnRate,
    projected,
    remaining,
    allowedDailyFromNow,
    overBudget: projected > budget,
    pctUsed,
    burnStatus: pctUsed - expectedPctUsed,
  };
}
