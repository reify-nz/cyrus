import type {
	AgentOSConfiguration,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	WorkflowDefinition,
	SubagentDefinition,
} from "./agent-os-schema.js";

/**
 * Validator for Agent OS configurations
 * Ensures configurations are valid and complete before use
 */
export class AgentOSConfigValidator {
	/**
	 * Validate a complete Agent OS configuration
	 * @param config Configuration to validate
	 * @returns Validation result with errors and warnings
	 */
	static validate(config: AgentOSConfiguration): ValidationResult {
		const errors: ValidationError[] = [];
		const warnings: ValidationWarning[] = [];

		// Validate version
		if (config.version !== "1.0") {
			errors.push({
				path: "version",
				message: `Unsupported configuration version: ${config.version}. Expected: 1.0`,
				code: "INVALID_VERSION",
			});
		}

		// Validate subagents
		this.validateSubagents(config.subagents, errors, warnings);

		// Validate workflows
		this.validateWorkflows(config.workflows, config.subagents, errors, warnings);

		// Validate label mappings
		if (config.labelMappings) {
			this.validateLabelMappings(config.labelMappings, config.workflows, errors, warnings);
		}

		// Validate default workflow
		if (config.defaultWorkflow) {
			const workflowExists = config.workflows.some(w => w.id === config.defaultWorkflow);
			if (!workflowExists) {
				errors.push({
					path: "defaultWorkflow",
					message: `Default workflow '${config.defaultWorkflow}' does not exist`,
					code: "INVALID_DEFAULT_WORKFLOW",
				});
			}
		}

		// Check for unused subagents
		const usedSubagents = new Set<string>();
		config.workflows.forEach(workflow => {
			workflow.stages.forEach(stage => {
				usedSubagents.add(stage.subagentId);
			});
		});

		config.subagents.forEach(subagent => {
			if (!usedSubagents.has(subagent.id)) {
				warnings.push({
					path: `subagents.${subagent.id}`,
					message: `Subagent '${subagent.id}' is defined but not used in any workflow`,
					suggestion: "Remove unused subagent or add it to a workflow",
				});
			}
		});

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}

	/**
	 * Validate subagent definitions
	 */
	private static validateSubagents(
		subagents: SubagentDefinition[],
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const subagentIds = new Set<string>();

		subagents.forEach((subagent, index) => {
			const basePath = `subagents[${index}]`;

			// Check for duplicate IDs
			if (subagentIds.has(subagent.id)) {
				errors.push({
					path: `${basePath}.id`,
					message: `Duplicate subagent ID: ${subagent.id}`,
					code: "DUPLICATE_SUBAGENT_ID",
				});
			}
			subagentIds.add(subagent.id);

			// Validate required fields
			if (!subagent.name) {
				errors.push({
					path: `${basePath}.name`,
					message: "Subagent name is required",
					code: "MISSING_NAME",
				});
			}

			if (!subagent.instructionFile) {
				errors.push({
					path: `${basePath}.instructionFile`,
					message: "Subagent instruction file is required",
					code: "MISSING_INSTRUCTION_FILE",
				});
			}

			// Validate capabilities
			if (!subagent.capabilities || subagent.capabilities.length === 0) {
				errors.push({
					path: `${basePath}.capabilities`,
					message: "Subagent must have at least one capability",
					code: "NO_CAPABILITIES",
				});
			}

			// Validate input/output specifications
			if (subagent.inputs) {
				subagent.inputs.forEach((input, inputIndex) => {
					if (!input.name) {
						errors.push({
							path: `${basePath}.inputs[${inputIndex}].name`,
							message: "Input name is required",
							code: "MISSING_INPUT_NAME",
						});
					}
				});
			}

			// Check for potentially dangerous capabilities
			if (subagent.capabilities?.some(cap => cap.type === "deploy" || cap.type === "write")) {
				if (!subagent.resourceLimits) {
					warnings.push({
						path: `${basePath}.resourceLimits`,
						message: `Subagent '${subagent.id}' has write/deploy capabilities but no resource limits`,
						suggestion: "Consider adding resource limits for safety",
					});
				}
			}
		});
	}

	/**
	 * Validate workflow definitions
	 */
	private static validateWorkflows(
		workflows: WorkflowDefinition[],
		subagents: SubagentDefinition[],
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const workflowIds = new Set<string>();
		const subagentIds = new Set(subagents.map(s => s.id));

		workflows.forEach((workflow, index) => {
			const basePath = `workflows[${index}]`;

			// Check for duplicate IDs
			if (workflowIds.has(workflow.id)) {
				errors.push({
					path: `${basePath}.id`,
					message: `Duplicate workflow ID: ${workflow.id}`,
					code: "DUPLICATE_WORKFLOW_ID",
				});
			}
			workflowIds.add(workflow.id);

			// Validate required fields
			if (!workflow.name) {
				errors.push({
					path: `${basePath}.name`,
					message: "Workflow name is required",
					code: "MISSING_NAME",
				});
			}

			// Validate stages
			if (!workflow.stages || workflow.stages.length === 0) {
				errors.push({
					path: `${basePath}.stages`,
					message: "Workflow must have at least one stage",
					code: "NO_STAGES",
				});
			} else {
				this.validateWorkflowStages(
					workflow.stages,
					subagentIds,
					`${basePath}.stages`,
					errors,
					warnings
				);
			}

			// Validate conditional logic
			if (workflow.conditionals) {
				workflow.conditionals.forEach((conditional, condIndex) => {
					if (!conditional.condition) {
						errors.push({
							path: `${basePath}.conditionals[${condIndex}].condition`,
							message: "Conditional must have a condition expression",
							code: "MISSING_CONDITION",
						});
					}
				});
			}

			// Check for circular dependencies
			const circularDeps = this.findCircularDependencies(workflow.stages);
			if (circularDeps.length > 0) {
				errors.push({
					path: `${basePath}.stages`,
					message: `Circular dependencies detected: ${circularDeps.join(" -> ")}`,
					code: "CIRCULAR_DEPENDENCY",
				});
			}
		});
	}

	/**
	 * Validate workflow stages
	 */
	private static validateWorkflowStages(
		stages: any[],
		subagentIds: Set<string>,
		basePath: string,
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const stageIds = new Set<string>();

		stages.forEach((stage, index) => {
			const stagePath = `${basePath}[${index}]`;

			// Check for duplicate stage IDs
			if (stageIds.has(stage.id)) {
				errors.push({
					path: `${stagePath}.id`,
					message: `Duplicate stage ID: ${stage.id}`,
					code: "DUPLICATE_STAGE_ID",
				});
			}
			stageIds.add(stage.id);

			// Validate subagent reference
			if (!subagentIds.has(stage.subagentId)) {
				errors.push({
					path: `${stagePath}.subagentId`,
					message: `Stage references unknown subagent: ${stage.subagentId}`,
					code: "UNKNOWN_SUBAGENT",
				});
			}

			// Validate dependencies
			if (stage.dependencies) {
				stage.dependencies.forEach((dep: string, depIndex: number) => {
					if (!stageIds.has(dep)) {
						errors.push({
							path: `${stagePath}.dependencies[${depIndex}]`,
							message: `Stage depends on unknown stage: ${dep}`,
							code: "UNKNOWN_DEPENDENCY",
						});
					}
				});
			}

			// Validate input mappings
			if (stage.inputMappings) {
				stage.inputMappings.forEach((mapping: any, mapIndex: number) => {
					if (!mapping.from || !mapping.to) {
						errors.push({
							path: `${stagePath}.inputMappings[${mapIndex}]`,
							message: "Input mapping must have 'from' and 'to' fields",
							code: "INVALID_INPUT_MAPPING",
						});
					}
				});
			}

			// Check for parallel stages without proper dependencies
			if (stage.parallel && !stage.dependencies?.length) {
				warnings.push({
					path: `${stagePath}.parallel`,
					message: `Stage '${stage.id}' is marked as parallel but has no dependencies`,
					suggestion: "Parallel stages should typically have dependencies to coordinate execution",
				});
			}
		});
	}

	/**
	 * Validate label mappings
	 */
	private static validateLabelMappings(
		labelMappings: any[],
		workflows: WorkflowDefinition[],
		errors: ValidationError[],
		warnings: ValidationWarning[]
	): void {
		const workflowIds = new Set(workflows.map(w => w.id));
		const labelPatterns = new Map<string, number[]>();

		labelMappings.forEach((mapping, index) => {
			const basePath = `labelMappings[${index}]`;

			// Validate workflow reference
			if (!workflowIds.has(mapping.workflowId)) {
				errors.push({
					path: `${basePath}.workflowId`,
					message: `Label mapping references unknown workflow: ${mapping.workflowId}`,
					code: "UNKNOWN_WORKFLOW",
				});
			}

			// Check for duplicate label patterns
			if (labelPatterns.has(mapping.label)) {
				const existingIndices = labelPatterns.get(mapping.label)!;
				warnings.push({
					path: `${basePath}.label`,
					message: `Label pattern '${mapping.label}' is used in multiple mappings`,
					suggestion: "Use priority field to resolve conflicts or make patterns more specific",
				});
				existingIndices.push(index);
			} else {
				labelPatterns.set(mapping.label, [index]);
			}
		});
	}

	/**
	 * Find circular dependencies in workflow stages
	 */
	private static findCircularDependencies(stages: any[]): string[] {
		const graph = new Map<string, string[]>();
		
		// Build dependency graph
		stages.forEach(stage => {
			graph.set(stage.id, stage.dependencies || []);
		});

		// Check for cycles using DFS
		const visited = new Set<string>();
		const visiting = new Set<string>();
		const cycle: string[] = [];

		const hasCycle = (node: string): boolean => {
			if (visiting.has(node)) {
				// Found cycle
				cycle.push(node);
				return true;
			}

			if (visited.has(node)) {
				return false;
			}

			visiting.add(node);
			const dependencies = graph.get(node) || [];

			for (const dep of dependencies) {
				if (hasCycle(dep)) {
					if (cycle[0] !== node) {
						cycle.push(node);
					}
					return true;
				}
			}

			visiting.delete(node);
			visited.add(node);
			return false;
		};

		// Check each node
		for (const [stageId] of graph) {
			if (hasCycle(stageId)) {
				return cycle.reverse();
			}
		}

		return [];
	}

	/**
	 * Validate a configuration file path
	 * @param filePath Path to validate
	 * @returns True if path appears valid
	 */
	static isValidFilePath(filePath: string): boolean {
		// Basic path validation
		if (!filePath || filePath.includes("..")) {
			return false;
		}

		// Check for valid file extension
		const validExtensions = [".json", ".yaml", ".yml", ".js", ".ts"];
		return validExtensions.some(ext => filePath.endsWith(ext));
	}

	/**
	 * Suggest fixes for common validation errors
	 * @param errors Validation errors
	 * @returns Suggested fixes
	 */
	static suggestFixes(errors: ValidationError[]): string[] {
		const suggestions: string[] = [];

		errors.forEach(error => {
			switch (error.code) {
				case "DUPLICATE_SUBAGENT_ID":
				case "DUPLICATE_WORKFLOW_ID":
				case "DUPLICATE_STAGE_ID":
					suggestions.push(`Rename one of the duplicate '${error.path}' to ensure uniqueness`);
					break;
				case "UNKNOWN_SUBAGENT":
					suggestions.push(`Add the missing subagent to the subagents array or fix the reference`);
					break;
				case "CIRCULAR_DEPENDENCY":
					suggestions.push(`Review and reorganize stage dependencies to remove the cycle`);
					break;
				case "NO_CAPABILITIES":
					suggestions.push(`Add at least one capability to the subagent (e.g., 'read', 'write', 'analyze')`);
					break;
			}
		});

		return suggestions;
	}
}
