import { PromptSystemFactory } from "./PromptSystemFactory.js";
import { TraditionalPromptAdapter } from "./TraditionalPromptAdapter.js";
import { AgentOSPromptAdapter } from "./AgentOSPromptAdapter.js";

/**
 * Register all available prompt system adapters
 * This should be called during application initialization
 */
export function registerPromptAdapters(): void {
	// Register traditional adapter for backward compatibility
	PromptSystemFactory.registerAdapter("traditional", TraditionalPromptAdapter);
	
	// Register Agent OS adapter for structured workflows
	PromptSystemFactory.registerAdapter("agent-os", AgentOSPromptAdapter);
	
	// Register alias for convenience
	PromptSystemFactory.registerAdapter("agentOS", AgentOSPromptAdapter);
}
