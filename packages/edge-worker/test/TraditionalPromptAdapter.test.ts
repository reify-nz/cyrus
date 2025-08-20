import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import type { LinearIssue } from "@linear/sdk";
import type { RepositoryConfig } from "../src/types.js";
import type { PromptContext } from "../src/adapters/PromptSystemAdapter.js";
import { TraditionalPromptAdapter } from "../src/adapters/TraditionalPromptAdapter.js";

// Mock fs/promises
vi.mock("node:fs/promises");

describe("TraditionalPromptAdapter", () => {
	let adapter: any;
	let mockConfig: RepositoryConfig;
	let mockContext: PromptContext;
	let mockIssue: LinearIssue;
	let mockEdgeWorker: any;

	beforeEach(async () => {
		// Clear all mocks
		vi.clearAllMocks();

		// Create mock repository config
		mockConfig = {
			id: "test-repo",
			name: "Test Repository",
			repositoryPath: "/test/repo",
			workspaceBaseDir: "/test/workspaces",
			baseBranch: "main",
			linearToken: "test-token",
			linearWorkspaceId: "test-workspace",
			defaultAllowedTools: ["Read", "Write", "Edit"],
		};

		// Create mock Linear issue
		mockIssue = {
			id: "issue-123",
			identifier: "TEST-123",
			title: "Test Issue",
			description: "Test description",
			url: "https://linear.app/test/issue/TEST-123",
			branchName: "test-branch",
			state: Promise.resolve({ name: "Todo" }),
			parent: Promise.resolve(null),
		} as LinearIssue;

		// Create mock context
		mockContext = {
			repository: mockConfig,
			issue: mockIssue,
			labels: ["bug", "priority"],
			promptType: "debugger",
			attachmentManifest: "",
			isNewSession: true,
			isMentionTriggered: false,
		};

		// Create adapter instance
		adapter = new TraditionalPromptAdapter();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Initialization", () => {
		it("should initialize with repository config", async () => {
			await adapter.initialize(mockConfig);
			expect(adapter.config).toBe(mockConfig);
			expect(adapter.edgeWorker).toBeDefined();
		});

		it("should create EdgeWorker instance during initialization", async () => {
			await adapter.initialize(mockConfig);
			expect(adapter.edgeWorker).toBeDefined();
			expect(adapter.edgeWorker.config.id).toBe(mockConfig.id);
			expect(adapter.edgeWorker.config.name).toBe(mockConfig.name);
		});
	});

	describe("prepareSystemPrompt", () => {
		beforeEach(async () => {
			await adapter.initialize(mockConfig);
		});

		it("should return undefined for mention-triggered sessions", async () => {
			const mentionContext = { ...mockContext, isMentionTriggered: true };
			const result = await adapter.prepareSystemPrompt(mentionContext);
			expect(result).toBeUndefined();
		});

		it("should return system prompt for label-based sessions", async () => {
			// Spy on the EdgeWorker instance method
			const spy = vi.spyOn(adapter.edgeWorker, 'determineSystemPromptFromLabels').mockResolvedValue({
				prompt: "Debugger system prompt",
				version: "1.0.0",
				type: "debugger",
			});

			const result = await adapter.prepareSystemPrompt(mockContext);
			expect(result).toBe("Debugger system prompt");
			expect(spy).toHaveBeenCalledWith(
				mockContext.labels,
				mockConfig,
			);
		});

		it("should return undefined when no matching labels", async () => {
			vi.spyOn(adapter.edgeWorker, 'determineSystemPromptFromLabels').mockResolvedValue(
				undefined,
			);

			const result = await adapter.prepareSystemPrompt(mockContext);
			expect(result).toBeUndefined();
		});

		it("should handle errors gracefully", async () => {
			vi.spyOn(adapter.edgeWorker, 'determineSystemPromptFromLabels').mockRejectedValue(
				new Error("Label determination failed"),
			);

			await expect(adapter.prepareSystemPrompt(mockContext)).rejects.toThrow(
				"Label determination failed",
			);
		});
	});

	describe("prepareUserPrompt", () => {
		beforeEach(async () => {
			await adapter.initialize(mockConfig);
		});

		it("should use buildMentionPrompt for mention-triggered sessions", async () => {
			const mentionContext = { ...mockContext, isMentionTriggered: true };
			const agentSession = { comment: { body: "Hey @agent, help!" } };
			
			const spy = vi.spyOn(adapter.edgeWorker, 'buildMentionPrompt').mockResolvedValue({
				prompt: "Mention prompt",
				version: "1.0.0",
			});

			const result = await adapter.prepareUserPrompt(
				mockIssue,
				{ ...mentionContext, sessionData: { agentSession } as any },
			);

			expect(result).toEqual({ prompt: "Mention prompt", version: "1.0.0" });
			expect(spy).toHaveBeenCalledWith(
				mockIssue,
				agentSession,
				mentionContext.attachmentManifest,
			);
		});

		it("should use buildLabelBasedPrompt when system prompt exists", async () => {
			// Set up system prompt determination
			vi.spyOn(adapter.edgeWorker, 'determineSystemPromptFromLabels').mockResolvedValue({
				prompt: "System prompt",
				type: "debugger",
			});

			const spy = vi.spyOn(adapter.edgeWorker, 'buildLabelBasedPrompt').mockResolvedValue({
				prompt: "Label-based prompt",
				version: "2.0.0",
			});

			const result = await adapter.prepareUserPrompt(mockIssue, mockContext);

			expect(result).toEqual({
				prompt: "Label-based prompt",
				version: "2.0.0",
			});
			expect(spy).toHaveBeenCalledWith(
				mockIssue,
				mockConfig,
				mockContext.attachmentManifest,
			);
		});

		it("should use buildPromptV2 as fallback", async () => {
			vi.spyOn(adapter.edgeWorker, 'determineSystemPromptFromLabels').mockResolvedValue(
				undefined,
			);

			const spy = vi.spyOn(adapter.edgeWorker, 'buildPromptV2').mockResolvedValue({
				prompt: "Default prompt",
				version: "3.0.0",
			});

			const result = await adapter.prepareUserPrompt(mockIssue, mockContext);

			expect(result).toEqual({ prompt: "Default prompt", version: "3.0.0" });
			expect(spy).toHaveBeenCalledWith(
				mockIssue,
				mockConfig,
				undefined,
				mockContext.attachmentManifest,
			);
		});

		it("should handle new session context", async () => {
			const newSessionContext = { ...mockContext, isNewSession: false };
			const sessionData = {
				session: { id: "session-123" },
				fullIssue: mockIssue,
			};

			const spy = vi.spyOn(adapter.edgeWorker, 'buildPromptV2').mockResolvedValue({
				prompt: "Continued session prompt",
			});

			await adapter.prepareUserPrompt(mockIssue, {
				...newSessionContext,
				sessionData: sessionData as any,
			});

			expect(spy).toHaveBeenCalled();
		});
	});

	describe("getToolRestrictions", () => {
		beforeEach(async () => {
			await adapter.initialize(mockConfig);
		});

		it("should delegate to buildAllowedTools", () => {
			const spy = vi.spyOn(adapter.edgeWorker, 'buildAllowedTools').mockReturnValue([
				"Read",
				"Write",
				"mcp__linear",
			]);

			const result = adapter.getToolRestrictions(mockContext);

			expect(result).toEqual(["Read", "Write", "mcp__linear"]);
			expect(spy).toHaveBeenCalledWith(
				mockConfig,
				mockContext.promptType,
			);
		});

		it("should handle different prompt types", () => {
			const promptTypes: Array<"debugger" | "builder" | "scoper"> = [
				"debugger",
				"builder",
				"scoper",
			];

			promptTypes.forEach((type) => {
				const spy = vi.spyOn(adapter.edgeWorker, 'buildAllowedTools').mockReturnValue(["Tool1"]);
				
				const contextWithType = { ...mockContext, promptType: type };
				adapter.getToolRestrictions(contextWithType);

				expect(spy).toHaveBeenCalledWith(
					mockConfig,
					type,
				);
			});
		});

		it("should handle undefined prompt type", () => {
			const spy = vi.spyOn(adapter.edgeWorker, 'buildAllowedTools').mockReturnValue(["Default"]);

			const contextWithoutType = { ...mockContext, promptType: undefined };
			const result = adapter.getToolRestrictions(contextWithoutType);

			expect(result).toEqual(["Default"]);
			expect(spy).toHaveBeenCalledWith(
				mockConfig,
				undefined,
			);
		});

		it("should handle preset returns from buildAllowedTools", () => {
			// Test when buildAllowedTools returns a preset string
			vi.spyOn(adapter.edgeWorker, 'buildAllowedTools').mockReturnValue("readOnly");

			const result = adapter.getToolRestrictions(mockContext);
			expect(result).toBe("readOnly");
		});
	});

	describe("Label-based prompt configuration", () => {
		beforeEach(async () => {
			mockConfig.labelPrompts = {
				debugger: {
					labels: ["bug", "error"],
					allowedTools: "readOnly",
				},
				builder: {
					labels: ["feature"],
					allowedTools: ["Read", "Edit", "Task"],
				},
				scoper: {
					labels: ["prd"],
					allowedTools: "safe",
				},
			};
			await adapter.initialize(mockConfig);
		});

		it("should use label-specific tool restrictions", () => {
			const spy = vi.spyOn(adapter.edgeWorker, 'buildAllowedTools').mockReturnValue(["Read"]);

			const debuggerContext = {
				...mockContext,
				labels: ["bug"],
				promptType: "debugger" as const,
			};

			adapter.getToolRestrictions(debuggerContext);
			expect(spy).toHaveBeenCalledWith(
				mockConfig,
				"debugger",
			);
		});

		it("should detect prompt type from labels", async () => {
			const spy = vi.spyOn(adapter.edgeWorker, 'determineSystemPromptFromLabels').mockResolvedValue({
				prompt: "Builder prompt",
				type: "builder",
			});

			const builderContext = {
				...mockContext,
				labels: ["feature", "enhancement"],
			};

			await adapter.prepareSystemPrompt(builderContext);
			expect(spy).toHaveBeenCalledWith(
				["feature", "enhancement"],
				mockConfig,
			);
		});
	});

	describe("Error handling", () => {
		beforeEach(async () => {
			await adapter.initialize(mockConfig);
		});

		it("should handle buildPromptV2 errors", async () => {
			vi.spyOn(adapter.edgeWorker, 'buildPromptV2').mockRejectedValue(
				new Error("Prompt build failed"),
			);

			await expect(
				adapter.prepareUserPrompt(mockIssue, mockContext),
			).rejects.toThrow("Prompt build failed");
		});

		it("should handle missing EdgeWorker methods", async () => {
			// Simulate missing method by setting it to undefined
			adapter.edgeWorker.buildAllowedTools = undefined;

			expect(() => adapter.getToolRestrictions(mockContext)).toThrow();
		});
	});

	describe("Integration with EdgeWorker", () => {
		it("should create proper EdgeWorker instance wrapper", async () => {
			await adapter.initialize(mockConfig);
			
			expect(adapter.edgeWorker).toBeDefined();
			expect(adapter.edgeWorker.config.id).toBe(mockConfig.id);
			expect(adapter.edgeWorker.config.name).toBe(mockConfig.name);
			expect(adapter.edgeWorker.determineSystemPromptFromLabels).toBeDefined();
			expect(adapter.edgeWorker.buildPromptV2).toBeDefined();
			expect(adapter.edgeWorker.buildLabelBasedPrompt).toBeDefined();
			expect(adapter.edgeWorker.buildMentionPrompt).toBeDefined();
			expect(adapter.edgeWorker.buildAllowedTools).toBeDefined();
		});
	});
});
