import { geminiKeyManager } from '../relearn/src/services/geminiService.js';

console.log("Initial Keys:", geminiKeyManager.getKeyCount());
console.log("Current Key:", geminiKeyManager.getCurrentKey());

// Simulate a 429 rate limit
geminiKeyManager.handleQuotaExhausted();

console.log("After exhaustion, Current Key:", geminiKeyManager.getCurrentKey());
