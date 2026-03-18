import { v4 as uuidv4 } from 'uuid';

export interface AgentService {
  id: string;
  agentId: string;
  agentAddress: string;
  name: string;
  description: string;
  priceUsdt: string; // Human-readable e.g. "0.10"
  chain: string;
  category: string;
  acceptanceCriteria: string;
  active: boolean;
  createdAt: Date;
  completedJobs: number;
  rating: number; // 0-5
}

export interface ServiceQuery {
  category?: string;
  maxPrice?: number;
  chain?: string;
  search?: string;
}

export class ServiceRegistry {
  private services: Map<string, AgentService> = new Map();

  publish(params: {
    agentId: string;
    agentAddress: string;
    name: string;
    description: string;
    priceUsdt: string;
    chain: string;
    category?: string;
    acceptanceCriteria?: string;
  }): AgentService {
    const service: AgentService = {
      id: uuidv4(),
      agentId: params.agentId,
      agentAddress: params.agentAddress,
      name: params.name,
      description: params.description,
      priceUsdt: params.priceUsdt,
      chain: params.chain,
      category: params.category || 'general',
      acceptanceCriteria: params.acceptanceCriteria || 'Service delivered as described',
      active: true,
      createdAt: new Date(),
      completedJobs: 0,
      rating: 0,
    };

    this.services.set(service.id, service);
    return service;
  }

  find(query: ServiceQuery): AgentService[] {
    let results = Array.from(this.services.values()).filter((s) => s.active);

    if (query.category) {
      results = results.filter((s) => s.category === query.category);
    }
    if (query.maxPrice) {
      results = results.filter((s) => parseFloat(s.priceUsdt) <= query.maxPrice!);
    }
    if (query.chain) {
      results = results.filter((s) => s.chain === query.chain);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    return results.sort((a, b) => b.rating - a.rating);
  }

  get(id: string): AgentService | undefined {
    return this.services.get(id);
  }

  deactivate(id: string): void {
    const service = this.services.get(id);
    if (service) service.active = false;
  }

  recordCompletion(id: string, rating: number): void {
    const service = this.services.get(id);
    if (service) {
      service.completedJobs++;
      // Running average
      service.rating =
        (service.rating * (service.completedJobs - 1) + rating) /
        service.completedJobs;
    }
  }

  getAll(): AgentService[] {
    return Array.from(this.services.values());
  }

  getByAgent(agentId: string): AgentService[] {
    return Array.from(this.services.values()).filter((s) => s.agentId === agentId);
  }
}
