/**
 * Agent OS Configuration Schema
 * Defines the structure for Agent OS workflows, subagents, and instructions
 */

/**
 * Main configuration for Agent OS system
 */
export interface AgentOSConfiguration {
	/** Version of the configuration schema */
	version: "1.0";
	
	/** Global settings for the Agent OS system */
	settings?: AgentOSSettings;
	
	/** Path to the main instruction file */
	mainInstructionFile?: string;
	
	/** Available subagent definitions */
	subagents: SubagentDefinition[];
	
	/** Workflow templates */
	workflows: WorkflowDefinition[];
	
	/** Label to workflow mappings */
	labelMappings?: LabelMapping[];
	
	/** Default workflow ID when no label match */
	defaultWorkflow?: string;
}

/**
 * Global settings for Agent OS
 */
export interface AgentOSSettings {
	/** Enable debug mode for detailed logging */
	debug?: boolean;
	
	/** Maximum execution time per workflow in seconds */
	maxExecutionTime?: number;
	
	/** Strategy for handling subagent failures */
	failureStrategy?: "stop" | "continue" | "retry";
	
	/** Number of retries for failed subagents */
	maxRetries?: number;
	
	/** Context persistence settings */
	contextPersistence?: {
		enabled: boolean;
		storage: "memory" | "redis" | "dynamodb";
		ttl?: number; // Time to live in seconds
	};
}

/**
 * Definition of a subagent
 */
export interface SubagentDefinition {
	/** Unique identifier for the subagent */
	id: string;
	
	/** Human-readable name */
	name: string;
	
	/** Description of the subagent's purpose */
	description?: string;
	
	/** Path to the subagent's instruction file */
	instructionFile: string;
	
	/** Capabilities/tools available to this subagent */
	capabilities: SubagentCapability[];
	
	/** Input requirements */
	inputs?: InputRequirement[];
	
	/** Output specifications */
	outputs?: OutputSpecification[];
	
	/** Trigger conditions for autonomous activation */
	triggers?: TriggerCondition[];
	
	/** Resource limits */
	resourceLimits?: ResourceLimits;
}

/**
 * Subagent capability definition
 */
export interface SubagentCapability {
	/** Capability type */
	type: "read" | "write" | "analyze" | "test" | "build" | "deploy" | "custom";
	
	/** Specific scope or permissions */
	scope?: string[];
	
	/** Additional configuration for the capability */
	config?: Record<string, any>;
}

/**
 * Input requirement for a subagent
 */
export interface InputRequirement {
	/** Input name */
	name: string;
	
	/** Input type */
	type: "string" | "number" | "boolean" | "object" | "array" | "file" | "issue";
	
	/** Whether the input is required */
	required: boolean;
	
	/** Description of the input */
	description?: string;
	
	/** Validation schema (JSON Schema format) */
	schema?: Record<string, any>;
}

/**
 * Output specification for a subagent
 */
export interface OutputSpecification {
	/** Output name */
	name: string;
	
	/** Output type */
	type: "string" | "number" | "boolean" | "object" | "array" | "file" | "report";
	
	/** Description of the output */
	description?: string;
	
	/** Schema for structured outputs */
	schema?: Record<string, any>;
}

/**
 * Trigger condition for subagent activation
 */
export interface TriggerCondition {
	/** Trigger type */
	type: "label" | "keyword" | "pattern" | "event" | "schedule";
	
	/** Trigger value or pattern */
	value: string | string[];
	
	/** Additional trigger configuration */
	config?: Record<string, any>;
}

/**
 * Resource limits for a subagent
 */
export interface ResourceLimits {
	/** Maximum execution time in seconds */
	maxExecutionTime?: number;
	
	/** Maximum memory usage in MB */
	maxMemory?: number;
	
	/** Maximum number of API calls */
	maxApiCalls?: number;
	
	/** Rate limiting configuration */
	rateLimit?: {
		requests: number;
		period: number; // in seconds
	};
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
	/** Unique identifier for the workflow */
	id: string;
	
	/** Human-readable name */
	name: string;
	
	/** Description of the workflow */
	description?: string;
	
	/** Ordered stages in the workflow */
	stages: WorkflowStage[];
	
	/** Context sharing strategy between stages */
	contextStrategy?: ContextStrategy;
	
	/** Conditional logic for stage execution */
	conditionals?: ConditionalLogic[];
	
	/** Success criteria for the workflow */
	successCriteria?: SuccessCriteria;
	
	/** Workflow-level settings */
	settings?: WorkflowSettings;
}

/**
 * Stage in a workflow
 */
export interface WorkflowStage {
	/** Stage identifier */
	id: string;
	
	/** Stage name */
	name: string;
	
	/** Subagent to execute in this stage */
	subagentId: string;
	
	/** Stage-specific configuration */
	config?: Record<string, any>;
	
	/** Input mappings from previous stages */
	inputMappings?: InputMapping[];
	
	/** Whether this stage can be run in parallel with others */
	parallel?: boolean;
	
	/** Dependencies on other stages */
	dependencies?: string[];
	
	/** Skip conditions */
	skipConditions?: SkipCondition[];
	
	/** Retry configuration for this stage */
	retry?: RetryConfig;
}

/**
 * Context sharing strategy
 */
export interface ContextStrategy {
	/** Type of context sharing */
	type: "full" | "selective" | "summary" | "none";
	
	/** Fields to include/exclude in selective mode */
	fields?: {
		include?: string[];
		exclude?: string[];
	};
	
	/** Summary generation settings */
	summarySettings?: {
		maxLength?: number;
		format?: "text" | "json" | "markdown";
	};
}

/**
 * Conditional logic for workflow execution
 */
export interface ConditionalLogic {
	/** Condition identifier */
	id: string;
	
	/** Condition expression */
	condition: string;
	
	/** Actions to take if condition is true */
	onTrue?: WorkflowAction[];
	
	/** Actions to take if condition is false */
	onFalse?: WorkflowAction[];
}

/**
 * Workflow action
 */
export interface WorkflowAction {
	/** Action type */
	type: "goto" | "skip" | "fail" | "complete" | "parallel";
	
	/** Target stage or workflow ID */
	target?: string;
	
	/** Additional action configuration */
	config?: Record<string, any>;
}

/**
 * Success criteria for workflow completion
 */
export interface SuccessCriteria {
	/** Required stages that must complete successfully */
	requiredStages?: string[];
	
	/** Custom success conditions */
	conditions?: string[];
	
	/** Minimum success percentage for parallel stages */
	minSuccessRate?: number;
}

/**
 * Workflow-specific settings
 */
export interface WorkflowSettings {
	/** Maximum iterations allowed */
	maxIterations?: number;
	
	/** Timeout for the entire workflow */
	timeout?: number;
	
	/** Priority level */
	priority?: "low" | "normal" | "high" | "critical";
	
	/** Notification settings */
	notifications?: NotificationSettings;
}

/**
 * Input mapping configuration
 */
export interface InputMapping {
	/** Source field path */
	from: string;
	
	/** Target input name */
	to: string;
	
	/** Transformation to apply */
	transform?: string;
	
	/** Default value if source is missing */
	default?: any;
}

/**
 * Skip condition for a stage
 */
export interface SkipCondition {
	/** Condition type */
	type: "expression" | "previous-output" | "external";
	
	/** Condition value or expression */
	value: string;
	
	/** Additional configuration */
	config?: Record<string, any>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
	/** Maximum number of retries */
	maxAttempts: number;
	
	/** Backoff strategy */
	backoff?: "fixed" | "exponential" | "linear";
	
	/** Initial delay in milliseconds */
	initialDelay?: number;
	
	/** Maximum delay in milliseconds */
	maxDelay?: number;
	
	/** Retry only on specific error types */
	retryOn?: string[];
}

/**
 * Notification settings
 */
export interface NotificationSettings {
	/** Events to notify on */
	events: ("start" | "complete" | "fail" | "stage-complete")[];
	
	/** Notification channels */
	channels: NotificationChannel[];
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
	/** Channel type */
	type: "slack" | "email" | "webhook" | "linear";
	
	/** Channel-specific configuration */
	config: Record<string, any>;
	
	/** Filter for specific events */
	eventFilter?: string[];
}

/**
 * Label to workflow mapping
 */
export interface LabelMapping {
	/** Label pattern (supports wildcards) */
	label: string;
	
	/** Target workflow ID */
	workflowId: string;
	
	/** Priority for conflict resolution */
	priority?: number;
	
	/** Additional conditions */
	conditions?: string[];
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
	/** Unique execution ID */
	executionId: string;
	
	/** Workflow being executed */
	workflowId: string;
	
	/** Current stage */
	currentStage?: string;
	
	/** Execution state */
	state: "pending" | "running" | "completed" | "failed" | "cancelled";
	
	/** Stage results */
	stageResults: Map<string, StageResult>;
	
	/** Shared context data */
	sharedContext: Record<string, any>;
	
	/** Execution metadata */
	metadata: ExecutionMetadata;
}

/**
 * Result from a workflow stage execution
 */
export interface StageResult {
	/** Stage ID */
	stageId: string;
	
	/** Execution status */
	status: "success" | "failure" | "skipped";
	
	/** Stage outputs */
	outputs?: Record<string, any>;
	
	/** Error information if failed */
	error?: {
		message: string;
		code?: string;
		details?: any;
	};
	
	/** Execution timing */
	timing: {
		startTime: Date;
		endTime: Date;
		duration: number;
	};
	
	/** Resource usage */
	resourceUsage?: {
		apiCalls?: number;
		memory?: number;
	};
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
	/** Start time */
	startTime: Date;
	
	/** End time */
	endTime?: Date;
	
	/** Total duration */
	duration?: number;
	
	/** Trigger information */
	trigger: {
		type: "manual" | "label" | "schedule" | "api";
		source?: string;
		user?: string;
	};
	
	/** Issue information */
	issue?: {
		id: string;
		title: string;
		labels: string[];
		url?: string;
	};
	
	/** Iteration count */
	iterations?: number;
	
	/** Performance metrics */
	metrics?: Record<string, number>;
}

/**
 * Validation result for configuration
 */
export interface ValidationResult {
	/** Whether the configuration is valid */
	valid: boolean;
	
	/** Validation errors */
	errors?: ValidationError[];
	
	/** Validation warnings */
	warnings?: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
	/** Error path in the configuration */
	path: string;
	
	/** Error message */
	message: string;
	
	/** Error code */
	code?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
	/** Warning path in the configuration */
	path: string;
	
	/** Warning message */
	message: string;
	
	/** Suggestion for fixing */
	suggestion?: string;
}
