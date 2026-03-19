import { ChainPayAgent } from './agent';
import { agentReason, isLLMAvailable } from '../llm/claude';

/**
 * AgentGoals — Defines what the agent WANTS to do, not just what it CAN do.
 *
 * Human-first: agent waits for instructions.
 * Agent-first: agent has goals and pursues them proactively.
 *
 * Goals are evaluated every autonomous cycle. The agent decides which
 * goal to pursue based on current state, available resources, and AI reasoning.
 */

export interface Goal {
  id: string;
  type: 'acquire_service' | 'earn_revenue' | 'optimize_yield' | 'grow_reputation';
  description: string;
  priority: number; // 1-10
  constraints: Record<string, any>;
  active: boolean;
  progress: number; // 0-100
  createdAt: Date;
}

export class GoalEngine {
  private goals: Goal[] = [];

  constructor(private agent: ChainPayAgent) {}

  /**
   * Add a goal the agent should pursue autonomously.
   */
  addGoal(goal: Omit<Goal, 'active' | 'progress' | 'createdAt'>): Goal {
    const g: Goal = {
      ...goal,
      active: true,
      progress: 0,
      createdAt: new Date(),
    };
    this.goals.push(g);
    return g;
  }

  /**
   * Evaluate goals and return the best action to take right now.
   * Called by the autonomous loop every cycle.
   */
  async evaluateAndAct(): Promise<string | null> {
    const activeGoals = this.goals.filter(g => g.active && g.progress < 100);
    if (activeGoals.length === 0) return null;

    // Sort by priority (highest first)
    activeGoals.sort((a, b) => b.priority - a.priority);
    const topGoal = activeGoals[0];

    switch (topGoal.type) {
      case 'acquire_service':
        return this.pursueAcquireService(topGoal);
      case 'earn_revenue':
        return this.pursueEarnRevenue(topGoal);
      case 'optimize_yield':
        return this.pursueOptimizeYield(topGoal);
      case 'grow_reputation':
        return this.pursueGrowReputation(topGoal);
      default:
        return null;
    }
  }

  private async pursueAcquireService(goal: Goal): Promise<string | null> {
    const services = this.agent.getServiceRegistry().find({
      search: goal.constraints.query,
      maxPrice: goal.constraints.maxPrice,
    });

    if (services.length === 0) return null;

    // Pick the best service
    const best = services[0];
    const budget = goal.constraints.maxPrice || Infinity;

    if (parseFloat(best.priceUsdt) <= budget) {
      goal.progress = 50; // Found a service, escrow pending
      return `Goal "${goal.description}": Found service "${best.name}" at ${best.priceUsdt} USDT. Creating escrow.`;
    }

    return `Goal "${goal.description}": No services within budget (${budget} USDT).`;
  }

  private async pursueEarnRevenue(goal: Goal): Promise<string | null> {
    const myServices = this.agent.getServiceRegistry().getByAgent(this.agent.agentId);
    if (myServices.length === 0) {
      // Auto-publish a service based on goal description
      return `Goal "${goal.description}": No services published. Agent should publish services to earn revenue.`;
    }

    const totalJobs = myServices.reduce((sum, s) => sum + s.completedJobs, 0);
    const targetJobs = goal.constraints.targetJobs || 10;
    goal.progress = Math.min(100, (totalJobs / targetJobs) * 100);

    if (goal.progress >= 100) {
      goal.active = false;
      return `Goal "${goal.description}": Completed! ${totalJobs} jobs done.`;
    }

    return null; // Waiting for jobs
  }

  private async pursueOptimizeYield(goal: Goal): Promise<string | null> {
    const escrows = this.agent.getEscrowEngine();
    const subs = this.agent.getSubscriptionEngine();
    const escrowed = parseFloat(escrows.getTotalEscrowed());
    const monthly = subs.getMonthlySpend(this.agent.agentId);
    const buffer = escrowed + monthly * 2;

    // Check if we have idle funds above buffer
    if (goal.constraints.minIdle && buffer < goal.constraints.minIdle) {
      goal.progress = 75;
      return `Goal "${goal.description}": Idle funds above threshold. Should supply to Aave.`;
    }

    return null;
  }

  private async pursueGrowReputation(goal: Goal): Promise<string | null> {
    const myServices = this.agent.getServiceRegistry().getByAgent(this.agent.agentId);
    const avgRating = myServices.length > 0
      ? myServices.reduce((sum, s) => sum + s.rating, 0) / myServices.length
      : 0;
    const targetRating = goal.constraints.targetRating || 4.0;

    goal.progress = Math.min(100, (avgRating / targetRating) * 100);

    if (avgRating >= targetRating) {
      goal.active = false;
      return `Goal "${goal.description}": Achieved! Rating: ${avgRating.toFixed(1)}/${targetRating}`;
    }

    return null;
  }

  getGoals(): Goal[] { return this.goals; }
  getActive(): Goal[] { return this.goals.filter(g => g.active && g.progress < 100); }

  removeGoal(id: string): void {
    this.goals = this.goals.filter(g => g.id !== id);
  }
}
