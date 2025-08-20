import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LinearIssue } from "@linear/sdk";
import type { RepositoryConfig } from "../src/types.js";
import type { PromptContext } from "../src/adapters/PromptSystemAdapter.js";
import { TraditionalPromptAdapter } from "../src/adapters/TraditionalPromptAdapter.js";
import { readFile } from "node:fs/promises";

// Mock fs/promises to prevent file system access
vi.mock("node:fs/promises");

// Mock the prompt template files
vi.mocked(readFile).mockImplementation(async (path: string) => {
	if (path.includes("debugger.md")) {
		return `<version-tag value="debugger-v1.0.0" />
You are a debugger.`;
	}
	if (path.includes("builder.md")) {
		return `<version-tag value="builder-v1.0.0" />
You are a builder.`;
	}
	if (path.includes("label-prompt-template.md")) {
		return `Label-based prompt for {{repository_name}}
Issue: {{issue_identifier}}
Base branch: {{base_branch}}`;
	}
	if (path.includes("prompt-template-v2.md")) {
		return `Default prompt for {{repository_name}}
Issue: {{issue_identifier}}`;
	}
	throw new Error(`Unknown file: ${path}`);
});

describe("TraditionalPromptAdapter Integration", () => {
	let adapter: TraditionalPromptAdapter;
	let mockConfig: RepositoryConfig;
	let mockIssue: LinearIssue;
	let mockContext: PromptContext;

	beforeEach(async () => {
		adapter = new TraditionalPromptAdapter();

		mockConfig = {
			id: "test-repo",
			name: "Test Repository",
			repositoryPath: "/test/repo",
			workspaceBaseDir: "/test/workspaces",
			baseBranch: "main",
			linearToken: "test-token",
			linearWorkspaceId: "test-workspace",
			defaultAllowedTools: ["Read", "Write"],
		};

		mockIssue = {
			id: "issue-123",
			identifier: "TEST-123",
			title: "Test Issue",
			description: "Test description",
			url: "https://linear.app/test/issue/TEST-123",
			branchName: "test-branch",
			parent: Promise.resolve(null),
		} as LinearIssue;

		mockContext = {
			repository: mockConfig,
			issue: mockIssue,
			labels: [],
			isNewSession: true,
			isMentionTriggered: false,
		};
	});

	describe("Adapter Initialization", () => {
		it("should initialize successfully", async () => {
			await expect(adapter.initialize(mockConfig)).resolves.not.toThrow();
			expect(adapter["config"]).toBe(mockConfig);
			expect(adapter["edgeWorker"]).toBeDefined();
		});

		it("should throw error when not initialized", async () => {
			await expect(adapter.prepareSystemPrompt(mockContext)).rejects.toThrow(
				"Adapter not initialized",
			);
		});
	});

	describe("Basic Functionality", () => {
		beforeEach(async () => {
			await adapter.initialize(mockConfig);
		});

		it("should return undefined system prompt for mention-triggered sessions", async () => {
			const mentionContext = { ...mockContext, isMentionTriggered: true };
			const result = await adapter.prepareSystemPrompt(mentionContext);
			expect(result).toBeUndefined();
		});

		it("should build user prompt for standard sessions", async () => {
			// Mock the EdgeWorker instance methods
			const edgeWorker = adapter["edgeWorker"];
			vi.spyOn(edgeWorker, "determineSystemPromptFromLabels").mockResolvedValue(
				undefined,
			);
			vi.spyOn(edgeWorker, "buildPromptV2").mockResolvedValue({
				prompt: "Test prompt",
				version: "1.0.0",
			});

			const result = await adapter.prepareUserPrompt(mockIssue, mockContext);
			
			expect(result).toHaveProperty("prompt");
			expect(result.prompt).toBe("Test prompt");
			expect(edgeWorker.buildPromptV2).toHaveBeenCalled();
		});

		it("should get tool restrictions", () => {
			const edgeWorker = adapter["edgeWorker"];
			vi.spyOn(edgeWorker, "buildAllowedTools").mockReturnValue([
				"Read",
				"Write",
				"mcp__linear",
			]);

			const result = adapter.getToolRestrictions(mockContext);
			
			expect(Array.isArray(result)).toBe(true);
			expect(result).toContain("Read");
			expect(result).toContain("Write");
			expect(result).toContain("mcp__linear");
		});
	});

	describe("Label-based Prompts", () => {
		beforeEach(async () => {
			mockConfig.labelPrompts = {
				debugger: {
					labels: ["bug"],
					allowedTools: "readOnly",
				},
				builder: {
					labels: ["feature"],
					allowedTools: ["Read", "Write", "Edit"],
				},
			};
			await adapter.initialize(mockConfig);
		});

		it("should detect debugger prompt from labels", async () => {
			const debugContext = {
				...mockContext,
				labels: ["bug", "urgent"],
			};

			const edgeWorker = adapter["edgeWorker"];
			vi.spyOn(edgeWorker, "determineSystemPromptFromLabels").mockResolvedValue({
				prompt: "Debugger system prompt",
				type: "debugger",
				version: "1.0.0",
			});

			const result = await adapter.prepareSystemPrompt(debugContext);
			expect(result).toBe("Debugger system prompt");
		});

		it("should use label-based user prompt when system prompt exists", async () => {
			const featureContext = {
				...mockContext,
				labels: ["feature"],
			};

			const edgeWorker = adapter["edgeWorker"];
			vi.spyOn(edgeWorker, "determineSystemPromptFromLabels").mockResolvedValue({
				prompt: "Builder system prompt",
				type: "builder",
			});
			vi.spyOn(edgeWorker, "buildLabelBasedPrompt").mockResolvedValue({
				prompt: "Label-based user prompt",
				version: "1.0.0",
			});

			const result = await adapter.prepareUserPrompt(mockIssue, featureContext);
			expect(result.prompt).toBe("Label-based user prompt");
			expect(edgeWorker.buildLabelBasedPrompt).toHaveBeenCalled();
		});
	});

	describe("Mention-triggered Sessions", () => {
		beforeEach(async () => {
			await adapter.initialize(mockConfig);
		});

		it("should handle mention prompts correctly", async () => {
			const mentionContext = {
				...mockContext,
				isMentionTriggered: true,
				sessionData: {
					agentSession: {
						comment: { body: "Hey @agent, help me debug this" },
					},
				} as any,
			};

			const edgeWorker = adapter["edgeWorker"];
			vi.spyOn(edgeWorker, "buildMentionPrompt").mockResolvedValue({
				prompt: "Mention prompt response",
			});

			const result = await adapter.prepareUserPrompt(mockIssue, mentionContext);
			expect(result.prompt).toBe("Mention prompt response");
			expect(edgeWorker.buildMentionPrompt).toHaveBeenCalledWith(
				mockIssue,
				mentionContext.sessionData.agentSession,
				"",
			);
		});
	});
});
