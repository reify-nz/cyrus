import type { LinearIssue } from "@linear/sdk";
import type { RepositoryConfig } from "../types.js";
import {
	BasePromptSystemAdapter,
	type PromptContext,
} from "./PromptSystemAdapter.js";

/**
 * Interface for EdgeWorker prompt methods used by the adapter
 * This avoids using 'any' type and provides type safety
 */
interface EdgeWorkerPromptMethods {
	determineSystemPromptFromLabels(
		labels: string[],
		config: RepositoryConfig,
	): Promise<{ prompt: string; version?: string; type?: string } | undefined>;
	buildMentionPrompt(
		issue: LinearIssue,
		session: any,
		manifest: string,
	): Promise<{ prompt: string; version?: string }>;
	buildLabelBasedPrompt(
		issue: LinearIssue,
		config: RepositoryConfig,
		manifest: string,
	): Promise<{ prompt: string; version?: string }>;
	buildPromptV2(
		issue: LinearIssue,
		config: RepositoryConfig,
		comment: any,
		manifest: string,
	): Promise<{ prompt: string; version?: string }>;
	buildAllowedTools(
		config: RepositoryConfig,
		promptType?: string,
	): string[] | "readOnly" | "safe" | "all";
}

/**
 * Adapter that wraps the existing EdgeWorker prompt system
 * Maintains backward compatibility while implementing the new adapter interface
 */
export class TraditionalPromptAdapter extends BasePromptSystemAdapter {
	private edgeWorker?: EdgeWorkerPromptMethods;
	private systemPromptCache?: {
		labelsKey: string;
		result: { prompt: string; version?: string; type?: string } | undefined;
	};

	/**
	 * Initialize the adapter with repository configuration
	 * @param config Repository configuration
	 * @throws {Error} If EdgeWorker cannot be imported or initialized
	 */
	async initialize(config: RepositoryConfig): Promise<void> {
		await super.initialize(config);
		
		try {
			// Dynamically import EdgeWorker to access its methods
			const { EdgeWorker } = await import("../EdgeWorker.js");
			
			// Create a minimal EdgeWorker instance to access private methods
			const instance = new (EdgeWorker as any)({
				...config,
				repositories: [config],
				proxyUrl: "", // Not needed for prompt generation
			});
			
			// Validate that the instance has required methods
			const requiredMethods = [
				'determineSystemPromptFromLabels',
				'buildMentionPrompt',
				'buildLabelBasedPrompt',
				'buildPromptV2',
				'buildAllowedTools'
			];
			
			for (const method of requiredMethods) {
				if (typeof instance[method] !== 'function') {
					throw new Error(`EdgeWorker instance missing required method: ${method}`);
				}
			}
			
			this.edgeWorker = instance as EdgeWorkerPromptMethods;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to initialize TraditionalPromptAdapter: ${errorMessage}`);
		}
	}

	/**
	 * Get cached system prompt result or fetch new one
	 * @private
	 */
	private async getSystemPromptResult(
		labels: string[],
	): Promise<{ prompt: string; version?: string; type?: string } | undefined> {
		if (!this.edgeWorker || !this.config) {
			throw new Error("Adapter not initialized");
		}

		// Create a cache key from sorted labels
		const labelsKey = labels.slice().sort().join(',');
		
		// Check cache
		if (this.systemPromptCache && this.systemPromptCache.labelsKey === labelsKey) {
			return this.systemPromptCache.result;
		}
		
		// Fetch new result
		const result = await this.edgeWorker.determineSystemPromptFromLabels(
			labels,
			this.config,
		);
		
		// Cache the result
		this.systemPromptCache = { labelsKey, result };
		
		return result;
	}

	/**
	 * Prepare system prompt using EdgeWorker's label-based logic
	 * @param context Prompt context containing labels and session state
	 * @returns System prompt string or undefined for mention-triggered sessions
	 * @throws {Error} If adapter not initialized
	 */
	async prepareSystemPrompt(
		context: PromptContext,
	): Promise<string | undefined> {
		if (!this.edgeWorker || !this.config) {
			throw new Error("Adapter not initialized");
		}

		// Skip system prompt for mention-triggered sessions
		if (context.isMentionTriggered) {
			return undefined;
		}

		// Get system prompt result (with caching)
		const systemPromptResult = await this.getSystemPromptResult(context.labels);

		return systemPromptResult?.prompt;
	}

	/**
	 * Prepare user prompt using EdgeWorker's existing prompt methods
	 * 
	 * The method selection follows this priority:
	 * 1. buildMentionPrompt - for mention-triggered sessions
	 * 2. buildLabelBasedPrompt - when system prompt exists (label-based routing)
	 * 3. buildPromptV2 - fallback for standard prompts
	 * 
	 * @param issue Linear issue to generate prompt for
	 * @param context Prompt context with labels, session data, and attachments
	 * @returns Prompt text and optional version information
	 * @throws {Error} If adapter not initialized
	 */
	async prepareUserPrompt(
		issue: LinearIssue,
		context: PromptContext,
	): Promise<{ prompt: string; version?: string }> {
		if (!this.edgeWorker || !this.config) {
			throw new Error("Adapter not initialized");
		}

		// Handle mention-triggered prompts
		if (context.isMentionTriggered && context.sessionData?.agentSession) {
			return this.edgeWorker.buildMentionPrompt(
				issue,
				context.sessionData.agentSession,
				context.attachmentManifest || "",
			);
		}

		// Get system prompt result (with caching)
		const systemPromptResult = await this.getSystemPromptResult(context.labels);

		// Use label-based prompt if system prompt exists
		if (systemPromptResult?.prompt) {
			return this.edgeWorker.buildLabelBasedPrompt(
				issue,
				this.config,
				context.attachmentManifest || "",
			);
		}

		// Fall back to standard prompt
		return this.edgeWorker.buildPromptV2(
			issue,
			this.config,
			undefined, // newComment
			context.attachmentManifest || "",
		);
	}

	/**
	 * Get tool restrictions using EdgeWorker's buildAllowedTools
	 * 
	 * Tool restrictions can be:
	 * - Array of specific tool names (e.g., ["Read", "Write", "Edit"])
	 * - "readOnly" - Only reading operations allowed
	 * - "safe" - Safe operations allowed (no write/delete)
	 * - "all" - All tools allowed
	 * 
	 * @param context Prompt context containing promptType (debugger/builder/scoper)
	 * @returns Tool restrictions based on prompt type and configuration
	 * @throws {Error} If adapter not initialized
	 */
	getToolRestrictions(
		context: PromptContext,
	): string[] | "readOnly" | "safe" | "all" {
		if (!this.edgeWorker || !this.config) {
			throw new Error("Adapter not initialized");
		}

		return this.edgeWorker.buildAllowedTools(this.config, context.promptType);
	}
}
