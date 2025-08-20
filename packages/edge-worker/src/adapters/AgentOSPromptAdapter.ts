import type { LinearIssue } from "@linear/sdk";
import type { RepositoryConfig } from "../types.js";
import {
	BasePromptSystemAdapter,
	type PromptContext,
} from "./PromptSystemAdapter.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import type { AgentOSConfiguration } from "./agent-os-schema.js";
import { AgentOSConfigValidator } from "./agent-os-validator.js";

/**
 * Configuration for Agent OS workflows
 */
export interface AgentOSConfig {
	/** Path to the main instruction file */
	instructionFile?: string;
	/** Available subagent configurations */
	subagents?: Record<string, SubagentConfig>;
	/** Workflow templates by label */
	workflows?: Record<string, WorkflowConfig>;
	/** Default workflow when no label match */
	defaultWorkflow?: string;
}

/**
 * Configuration for a subagent
 */
export interface SubagentConfig {
	/** Subagent name */
	name: string;
	/** Path to subagent instruction file */
	instructionFile: string;
	/** Capabilities/tools available to this subagent */
	capabilities: string[];
	/** Trigger conditions */
	triggers?: {
		labels?: string[];
		keywords?: string[];
	};
}

/**
 * Configuration for a workflow
 */
export interface WorkflowConfig {
	/** Workflow name */
	name: string;
	/** Ordered list of subagents to execute */
	subagents: string[];
	/** Context sharing strategy between subagents */
	contextSharing?: "full" | "summary" | "none";
	/** Maximum iterations for the workflow */
	maxIterations?: number;
}

/**
 * Agent OS adapter that uses structured workflows and subagents
 * instead of traditional monolithic prompts
 */
export class AgentOSPromptAdapter extends BasePromptSystemAdapter {
	private agentOSConfig?: AgentOSConfig;
	private instructionCache: Map<string, string> = new Map();

	/**
	 * Initialize the Agent OS adapter with repository configuration
	 * @param config Repository configuration
	 * @throws {Error} If Agent OS configuration is invalid
	 */
	async initialize(config: RepositoryConfig): Promise<void> {
		await super.initialize(config);

		// Load Agent OS configuration
		this.agentOSConfig = await this.loadAgentOSConfig(config);
		
		// Validate configuration
		this.validateConfig();
		
		// Preload instruction files
		await this.preloadInstructions();
	}

	/**
	 * Load Agent OS configuration from repository config or default location
	 * Merges configurations from:
	 * 1. Global config (~/.agent-os/config.json)
	 * 2. Local project config (.agent-os/config.json)
	 * 3. Repository-specific overrides
	 */
	private async loadAgentOSConfig(config: RepositoryConfig): Promise<AgentOSConfig> {
		const configurations: Partial<AgentOSConfiguration>[] = [];

		// 1. Load global configuration from ~/.agent-os
		const globalConfig = await this.loadConfigFromPath(
			path.join(os.homedir(), ".agent-os", "config.json")
		);
		if (globalConfig) {
			configurations.push(globalConfig);
		}

		// 2. Load local project configuration from .agent-os
		// Try to find project root by looking for .agent-os directory
		const localConfig = await this.findAndLoadLocalConfig(config);
		if (localConfig) {
			configurations.push(localConfig);
		}

		// 3. Apply repository-specific overrides if any
		if (config.agentOSConfig) {
			configurations.push(config.agentOSConfig as Partial<AgentOSConfiguration>);
		}

		// Merge configurations (later configs override earlier ones)
		const mergedConfig = this.mergeConfigurations(configurations);

		// Convert from AgentOSConfiguration schema to simplified AgentOSConfig
		return this.convertToSimplifiedConfig(mergedConfig);
	}

	/**
	 * Validate Agent OS configuration
	 */
	private validateConfig(): void {
		if (!this.agentOSConfig) {
			throw new Error("Agent OS configuration not loaded");
		}

		// Validate workflows reference existing subagents
		if (this.agentOSConfig.workflows) {
			for (const [workflowName, workflow] of Object.entries(this.agentOSConfig.workflows)) {
				for (const subagentId of workflow.subagents) {
					if (!this.agentOSConfig.subagents?.[subagentId]) {
						throw new Error(
							`Workflow '${workflowName}' references unknown subagent: ${subagentId}`
						);
					}
				}
			}
		}
	}

	/**
	 * Preload instruction files for better performance
	 */
	private async preloadInstructions(): Promise<void> {
		// TODO: Implement instruction file loading
		// This would load from file system or configuration store
	}

	/**
	 * Prepare system prompt for Agent OS
	 * This combines the main instruction file with workflow-specific instructions
	 */
	async prepareSystemPrompt(context: PromptContext): Promise<string | undefined> {
		this.ensureInitialized();

		// Select workflow based on labels
		const workflow = this.selectWorkflow(context.labels);
		if (!workflow) {
			return undefined;
		}

		// Build system prompt from instruction files
		const instructions: string[] = [];

		// Add main instruction file content
		if (this.agentOSConfig?.instructionFile) {
			const mainInstructions = await this.loadInstructionFile(
				this.agentOSConfig.instructionFile
			);
			instructions.push(mainInstructions);
		}

		// Add workflow context
		instructions.push(this.buildWorkflowContext(workflow, context));

		return instructions.join("\n\n");
	}

	/**
	 * Prepare user prompt for Agent OS
	 * This structures the issue information for the workflow
	 */
	async prepareUserPrompt(
		issue: LinearIssue,
		context: PromptContext,
	): Promise<{ prompt: string; version?: string }> {
		this.ensureInitialized();

		// Select workflow and current subagent
		const workflow = this.selectWorkflow(context.labels);
		const currentSubagent = this.getCurrentSubagent(workflow, context);

		// Build structured prompt for the current subagent
		const prompt = this.buildSubagentPrompt(issue, context, workflow, currentSubagent);

		return {
			prompt,
			version: "agent-os-v1",
		};
	}

	/**
	 * Get tool restrictions based on current subagent capabilities
	 */
	getToolRestrictions(context: PromptContext): string[] | "readOnly" | "safe" | "all" {
		this.ensureInitialized();

		// Get current workflow and subagent
		const workflow = this.selectWorkflow(context.labels);
		const currentSubagent = this.getCurrentSubagent(workflow, context);

		if (!currentSubagent) {
			return "readOnly"; // Default to read-only if no subagent
		}

		// Map subagent capabilities to tool restrictions
		const capabilities = this.agentOSConfig?.subagents?.[currentSubagent]?.capabilities || [];
		
		if (capabilities.includes("write")) {
			return "all";
		} else if (capabilities.includes("test") || capabilities.includes("analyze")) {
			return "safe";
		} else {
			return "readOnly";
		}
	}

	/**
	 * Select workflow based on issue labels
	 */
	private selectWorkflow(labels: string[]): WorkflowConfig | undefined {
		if (!this.agentOSConfig?.workflows) {
			return undefined;
		}

		// Check each label for workflow match
		for (const label of labels) {
			const workflowKey = label.toLowerCase().replace(/\s+/g, "-");
			if (this.agentOSConfig.workflows[workflowKey]) {
				return this.agentOSConfig.workflows[workflowKey];
			}
		}

		// Use default workflow if specified
		if (this.agentOSConfig.defaultWorkflow && this.agentOSConfig.workflows[this.agentOSConfig.defaultWorkflow]) {
			return this.agentOSConfig.workflows[this.agentOSConfig.defaultWorkflow];
		}

		return undefined;
	}

	/**
	 * Get the current subagent based on workflow progress
	 */
	private getCurrentSubagent(
		workflow: WorkflowConfig | undefined,
		context: PromptContext
	): string | undefined {
		if (!workflow) {
			return undefined;
		}

		// TODO: Implement workflow state tracking
		// For now, return the first subagent
		return workflow.subagents[0];
	}

	/**
	 * Load instruction file content
	 */
	private async loadInstructionFile(instructionPath: string): Promise<string> {
		// Use the path-aware loading method that checks both global and local directories
		return this.loadInstructionFileWithPaths(instructionPath);
	}

	/**
	 * Build workflow context for system prompt
	 */
	private buildWorkflowContext(workflow: WorkflowConfig, context: PromptContext): string {
		const contextParts: string[] = [
			`## Current Workflow: ${workflow.name}`,
			``,
			`### Workflow Stages:`,
		];

		workflow.subagents.forEach((subagentId, index) => {
			const subagent = this.agentOSConfig?.subagents?.[subagentId];
			if (subagent) {
				contextParts.push(`${index + 1}. ${subagent.name} - ${subagent.capabilities.join(", ")}`);
			}
		});

		contextParts.push(``);
		contextParts.push(`### Context Sharing: ${workflow.contextSharing || "full"}`);
		
		if (workflow.maxIterations) {
			contextParts.push(`### Maximum Iterations: ${workflow.maxIterations}`);
		}

		return contextParts.join("\n");
	}

	/**
	 * Build structured prompt for a subagent
	 */
	private buildSubagentPrompt(
		issue: LinearIssue,
		context: PromptContext,
		workflow: WorkflowConfig | undefined,
		subagentId: string | undefined
	): string {
		const promptParts: string[] = [];

		// Add workflow context
		if (workflow) {
			promptParts.push(`[Workflow: ${workflow.name}]`);
		}

		// Add subagent context
		if (subagentId && this.agentOSConfig?.subagents?.[subagentId]) {
			const subagent = this.agentOSConfig.subagents[subagentId];
			promptParts.push(`[Current Stage: ${subagent.name}]`);
			promptParts.push(`[Capabilities: ${subagent.capabilities.join(", ")}]`);
		}

		promptParts.push(``);
		
		// Add issue information
		promptParts.push(`## Issue: ${issue.title}`);
		promptParts.push(``);
		
		if (issue.description) {
			promptParts.push(`### Description:`);
			promptParts.push(issue.description);
			promptParts.push(``);
		}

		// Add labels
		if (context.labels.length > 0) {
			promptParts.push(`### Labels: ${context.labels.join(", ")}`);
			promptParts.push(``);
		}

		// Add attachments if any
		if (context.attachmentManifest) {
			promptParts.push(`### Attachments:`);
			promptParts.push(context.attachmentManifest);
			promptParts.push(``);
		}

		// Add session data if available
		if (context.sessionData) {
			promptParts.push(`### Session Context:`);
			promptParts.push(JSON.stringify(context.sessionData, null, 2));
			promptParts.push(``);
		}

		// Add specific instructions for the subagent
		promptParts.push(`### Your Task:`);
		promptParts.push(`As the ${subagentId} subagent, analyze and process this issue according to your role and capabilities.`);

		return promptParts.join("\n");
	}

	/**
	 * Load configuration from a specific file path
	 */
	private async loadConfigFromPath(configPath: string): Promise<Partial<AgentOSConfiguration> | null> {
		try {
			const configContent = await fs.readFile(configPath, 'utf-8');
			const config = JSON.parse(configContent) as AgentOSConfiguration;
			
			// Validate the loaded configuration
			const validationResult = AgentOSConfigValidator.validate(config);
			if (!validationResult.valid) {
				console.warn(`Invalid Agent OS configuration at ${configPath}:`, validationResult.errors);
				return null;
			}
			
			return config;
		} catch (error) {
			// File doesn't exist or is not valid JSON - this is OK
			if ((error as any).code !== 'ENOENT') {
				console.warn(`Failed to load Agent OS config from ${configPath}:`, error);
			}
			return null;
		}
	}

	/**
	 * Find and load local project configuration
	 * Searches up the directory tree for .agent-os/config.json
	 */
	private async findAndLoadLocalConfig(config: RepositoryConfig): Promise<Partial<AgentOSConfiguration> | null> {
		// Start from the repository path if available, otherwise current working directory
		let currentDir = config.repositoryPath || process.cwd();
		const rootDir = path.parse(currentDir).root;

		while (currentDir !== rootDir) {
			const configPath = path.join(currentDir, '.agent-os', 'config.json');
			const config = await this.loadConfigFromPath(configPath);
			
			if (config) {
				return config;
			}

			// Move up one directory
			currentDir = path.dirname(currentDir);
		}

		return null;
	}

	/**
	 * Merge multiple configurations with later ones overriding earlier ones
	 */
	private mergeConfigurations(configs: Partial<AgentOSConfiguration>[]): Partial<AgentOSConfiguration> {
		const merged: Partial<AgentOSConfiguration> = {};

		for (const config of configs) {
			// Merge basic properties
			if (config.version) merged.version = config.version;
			if (config.mainInstructionFile) merged.mainInstructionFile = config.mainInstructionFile;
			if (config.defaultWorkflow) merged.defaultWorkflow = config.defaultWorkflow;

			// Merge settings
			if (config.settings) {
				merged.settings = { ...merged.settings, ...config.settings };
			}

			// Merge subagents (by ID)
			if (config.subagents) {
				if (!merged.subagents) merged.subagents = [];
				const subagentMap = new Map(merged.subagents.map(s => [s.id, s]));
				
				for (const subagent of config.subagents) {
					subagentMap.set(subagent.id, subagent);
				}
				
				merged.subagents = Array.from(subagentMap.values());
			}

			// Merge workflows (by ID)
			if (config.workflows) {
				if (!merged.workflows) merged.workflows = [];
				const workflowMap = new Map(merged.workflows.map(w => [w.id, w]));
				
				for (const workflow of config.workflows) {
					workflowMap.set(workflow.id, workflow);
				}
				
				merged.workflows = Array.from(workflowMap.values());
			}

			// Merge label mappings
			if (config.labelMappings) {
				if (!merged.labelMappings) merged.labelMappings = [];
				merged.labelMappings = [...merged.labelMappings, ...config.labelMappings];
			}
		}

		return merged;
	}

	/**
	 * Convert from full AgentOSConfiguration schema to simplified AgentOSConfig
	 */
	private convertToSimplifiedConfig(config: Partial<AgentOSConfiguration>): AgentOSConfig {
		const simplified: AgentOSConfig = {
			instructionFile: config.mainInstructionFile,
			defaultWorkflow: config.defaultWorkflow,
			subagents: {},
			workflows: {},
		};

		// Convert subagents
		if (config.subagents) {
			for (const subagent of config.subagents) {
				simplified.subagents![subagent.id] = {
					name: subagent.name,
					instructionFile: subagent.instructionFile,
					capabilities: subagent.capabilities.map(cap => 
						typeof cap === 'string' ? cap : cap.type
					),
					triggers: subagent.triggers ? {
						labels: subagent.triggers
							.filter(t => t.type === 'label')
							.map(t => t.value)
							.flat() as string[],
						keywords: subagent.triggers
							.filter(t => t.type === 'keyword')
							.map(t => t.value)
							.flat() as string[],
					} : undefined,
				};
			}
		}

		// Convert workflows
		if (config.workflows) {
			for (const workflow of config.workflows) {
				// Use label mappings to determine workflow keys
				const workflowKey = this.getWorkflowKey(workflow.id, config.labelMappings);
				
				simplified.workflows![workflowKey] = {
					name: workflow.name,
					subagents: workflow.stages.map(stage => stage.subagentId),
					contextSharing: workflow.contextStrategy?.type || 'full',
					maxIterations: workflow.settings?.maxIterations,
				};
			}
		}

		return simplified;
	}

	/**
	 * Get workflow key based on label mappings
	 */
	private getWorkflowKey(workflowId: string, labelMappings?: any[]): string {
		if (!labelMappings) return workflowId;

		// Find the first label that maps to this workflow
		const mapping = labelMappings.find(m => m.workflowId === workflowId);
		if (mapping && mapping.label) {
			return mapping.label.toLowerCase().replace(/\s+/g, '-');
		}

		return workflowId;
	}

	/**
	 * Load instruction file content with support for global and local paths
	 */
	private async loadInstructionFileWithPaths(instructionPath: string): Promise<string> {
		// Check cache first
		if (this.instructionCache.has(instructionPath)) {
			return this.instructionCache.get(instructionPath)!;
		}

		// Try loading from multiple locations in order:
		const searchPaths = [
			// 1. Local project .agent-os directory (using repository path if available)
			this.repositoryConfig?.repositoryPath 
				? path.join(this.repositoryConfig.repositoryPath, '.agent-os', instructionPath)
				: path.join(process.cwd(), '.agent-os', instructionPath),
			// 2. Global ~/.agent-os directory
			path.join(os.homedir(), '.agent-os', instructionPath),
			// 3. Absolute path (if provided)
			instructionPath,
		];

		for (const searchPath of searchPaths) {
			try {
				const content = await fs.readFile(searchPath, 'utf-8');
				this.instructionCache.set(instructionPath, content);
				return content;
			} catch (error) {
				// Continue to next path
				continue;
			}
		}

		// If no file found, return a default template
		const defaultContent = this.getDefaultInstructionContent(instructionPath);
		this.instructionCache.set(instructionPath, defaultContent);
		return defaultContent;
	}

	/**
	 * Get default instruction content when file is not found
	 */
	private getDefaultInstructionContent(instructionPath: string): string {
		if (instructionPath.includes('main')) {
			return `# Agent OS Instructions

You are operating within the Agent OS framework. Follow these principles:
1. Break down complex tasks into manageable steps
2. Collaborate with other subagents when needed
3. Maintain clear communication and context
4. Focus on your specific capabilities and role`;
		}

		// Extract subagent name from path
		const subagentName = path.basename(instructionPath, '.md');
		return `# ${subagentName} Subagent Instructions

You are the ${subagentName} subagent. Your role is to:
1. Process tasks according to your capabilities
2. Communicate results clearly
3. Request help when needed
4. Maintain quality and accuracy`;
	}
}
