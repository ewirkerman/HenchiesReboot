import { BaseAIEngine } from './base.js';

export class PassAI extends BaseAIEngine {
    determineSacrifice() {
        return { action: 'SKIP', cardId: null, detail: 'Skipped' };
    }

    determineMove() {
        return null;
    }
}
