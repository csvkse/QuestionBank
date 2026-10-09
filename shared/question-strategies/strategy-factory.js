/**
 * Question Queue Strategy Factory & Registry (Factory Pattern)
 * Core: shared/question-strategies/strategy-factory.js
 */

import {
  DailyReviewQueueStrategy,
  WeaknessQueueStrategy,
  CampaignSteppedQueueStrategy,
  SpeedSprintQueueStrategy,
  CategoryDrillQueueStrategy,
  SandboxCustomQueueStrategy
} from './strategies.js';

export class QuestionQueueStrategyFactory {
  constructor() {
    this.strategies = new Map();
    this.aliases = new Map();
    this.registerDefaults();
  }

  register(strategyId, strategyInstance, aliases = []) {
    const key = strategyId.toUpperCase();
    this.strategies.set(key, strategyInstance);
    aliases.forEach(alias => {
      this.aliases.set(alias.toUpperCase(), key);
    });
  }

  registerDefaults() {
    const daily = new DailyReviewQueueStrategy(20);
    const weakness = new WeaknessQueueStrategy(15);
    const campaign = new CampaignSteppedQueueStrategy(8);
    const speed = new SpeedSprintQueueStrategy(30);
    const drill = new CategoryDrillQueueStrategy();
    const sandbox = new SandboxCustomQueueStrategy();

    this.register('DAILY_REVIEW', daily, ['DAILY', 'EBBINGHAUS_REVIEW', 'REVIEW']);
    this.register('WEAKNESS', weakness, ['WEAKNESS_SURGE', 'MISTAKE', 'MISTAKES']);
    this.register('CAMPAIGN', campaign, ['LADDER', 'STEPPED', 'FULL_CAMPAIGN']);
    this.register('SPEED_SPRINT', speed, ['SPEED', 'SPRINT', 'ENDLESS']);
    this.register('CATEGORY_DRILL', drill, ['DRILL', 'TOPIC_DRILL', 'SINGLE_DRILL']);
    this.register('SANDBOX_CUSTOM', sandbox, ['SANDBOX', 'FREE_LAB', 'FREE', 'CUSTOM', 'DEFAULT']);
  }

  getStrategy(modeName) {
    const raw = (modeName || 'SANDBOX_CUSTOM').toUpperCase();
    const targetKey = this.aliases.get(raw) || raw;
    const strategy = this.strategies.get(targetKey);
    if (!strategy) {
      return this.strategies.get('SANDBOX_CUSTOM');
    }
    return strategy;
  }
}

// 导出全局单例
export const strategyFactory = new QuestionQueueStrategyFactory();
