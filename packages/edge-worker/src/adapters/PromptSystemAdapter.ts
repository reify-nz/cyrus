import type { LinearIssue } from "@linear/sdk";
import type { SDKMessage } from "cyrus-claude-runner";
import type { LinearAgentSessionData, RepositoryConfig } from "../types.js";

/**
 * Context passed to prompt system adapters
 */
export interface PromptContext {
	/** Repository configuration */
	repository: RepositoryConfig;

	/** Linear issue being processed */
	issue: LinearIssue;

	/** Issue labels for prompt selection */
	labels: string[];

	/** Type of prompt based on labels */
	promptType?: "debugger" | "builder" | "scoper";

	/** Attachment manifest content */
	attachmentManifest?: string;

	/** Whether this is a new session */
	isNewSession: boolean;

	/** Whether session was triggered by mention */
	isMentionTriggered: boolean;

	/** Optional session data */
	sessionData?: LinearAgentSessionData;
}

/**
 * Interface for prompt system adapters
 * Allows switching between different prompt systems (traditional, Agent OS, etc.)
 */
export interface PromptSystemAdapter {
	/**
	 * Initialize the adapter with repository configuration
	 * @param config Repository configuration
	 */
	initialize(config: RepositoryConfig): Promise<void>;

	/**
	 * Prepare system prompt for Claude
	 * @param context Prompt context
	 * @returns System prompt string or undefined if no system prompt
	 */
	prepareSystemPrompt(context: PromptContext): Promise<string | undefined>;

	/**
	 * Prepare user prompt for Claude
	 * @param issue Linear issue
	 * @param context Prompt context
	 * @returns Prompt and optional version information
	 */
	prepareUserPrompt(
		issue: LinearIssue,
		context: PromptContext,
	): Promise<{ prompt: string; version?: string }>;

	/**
	 * Get tool restrictions based on context
	 * @param context Prompt context
	 * @returns Array of allowed tools or preset name
	 */
	getToolRestrictions(
		context: PromptContext,
	): string[] | "readOnly" | "safe" | "all";

	/**
	 * Handle Claude response (for workflow management)
	 * @param response Claude SDK message
	 * @param context Prompt context
	 */
	handleResponse(
		response: SDKMessage,
		context: PromptContext,
	): Promise<void>;
}

/**
 * Base class for prompt system adapters
 * Provides common functionality and default implementations
 */
export abstract class BasePromptSystemAdapter implements PromptSystemAdapter {
	protected config?: RepositoryConfig;

	/**
	 * Ensure the adapter has been initialized
	 * @protected
	 * @throws {Error} If adapter not initialized
	 */
	protected ensureInitialized(): void {
		if (!this.config) {
			throw new Error(
				"Adapter not initialized. Call initialize() with a RepositoryConfig first."
			);
		}
	}

	async initialize(config: RepositoryConfig): Promise<void> {
		this.config = config;
	}

	abstract prepareSystemPrompt(
		context: PromptContext,
	): Promise<string | undefined>;

	abstract prepareUserPrompt(
		issue: LinearIssue,
		context: PromptContext,
	): Promise<{ prompt: string; version?: string }>;

	abstract getToolRestrictions(
		context: PromptContext,
	): string[] | "readOnly" | "safe" | "all";

	/**
	 * Default implementation - no special response handling
	 * Can be overridden by adapters that need workflow management
	 */
	async handleResponse(
		_response: SDKMessage,
		_context: PromptContext,
	): Promise<void> {
		// Default: no special handling needed
	}
}
