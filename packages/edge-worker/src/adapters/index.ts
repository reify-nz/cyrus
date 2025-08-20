export { PromptSystemAdapter, PromptContext, BasePromptSystemAdapter } from "./PromptSystemAdapter.js";
export { PromptSystemFactory } from "./PromptSystemFactory.js";
export { TraditionalPromptAdapter } from "./TraditionalPromptAdapter.js";
export { AgentOSPromptAdapter, AgentOSConfig, SubagentConfig, WorkflowConfig } from "./AgentOSPromptAdapter.js";
export { registerPromptAdapters } from "./register-adapters.js";

// Auto-register adapters when module is imported
import { registerPromptAdapters } from "./register-adapters.js";
registerPromptAdapters();
